import { ipcMain } from 'electron';
import { IPC } from '../shared/types';
import type { DbConfig, UserRole } from '../shared/types';
import { getDbConfig, setDbConfig } from './config';
import { connectDb, testConnection, initTables, query, isConnected } from './database';
import {
  ensureUsersTable, hasAnyUser, needsSetup, login, register, getUserById, changePassword,
  listUsers, adminCreateUser, adminDeleteUser, adminSetRole, adminResetPassword,
  verifyToken, type TokenPayload,
} from './auth';

// Phiên đăng nhập lưu trong tiến trình main (1 cửa sổ / 1 tiến trình).
let session: TokenPayload | null = null;

type Mode = 'open' | 'auth' | 'admin' | 'config';

function handle(
  channel: string,
  mode: Mode,
  fn: (event: Electron.IpcMainInvokeEvent, ...args: any[]) => any,
): void {
  ipcMain.handle(channel, async (event, ...args) => {
    if (mode === 'auth' && !session) throw new Error('Chưa đăng nhập');
    if (mode === 'admin' && session?.role !== 'admin') throw new Error('Chỉ admin mới được thực hiện thao tác này');
    if (mode === 'config') {
      const bootstrap = !(await hasAnyUser());
      if (!bootstrap && session?.role !== 'admin') throw new Error('Chỉ admin mới được cấu hình');
    }
    return fn(event, ...args);
  });
}

export function registerIpcHandlers(): void {
  // ============ Auth ============
  handle(IPC.AUTH_STATUS, 'open', async () => {
    return { dbConnected: isConnected(), needsSetup: await needsSetup() };
  });

  handle(IPC.AUTH_LOGIN, 'open', async (_event, data: { username: string; password: string }) => {
    const result = await login(data.username, data.password);
    session = verifyToken(result.token);
    return result;
  });

  handle(IPC.AUTH_REGISTER, 'open', async (_event, data: { username: string; password: string }) => {
    const result = await register(data.username, data.password);
    session = verifyToken(result.token);
    return result;
  });

  handle(IPC.AUTH_ME, 'open', async (_event, token: string) => {
    const payload = verifyToken(token);
    if (!payload) {
      session = null;
      return { user: null };
    }
    try {
      const user = await getUserById(payload.id);
      if (!user) {
        session = null;
        return { user: null };
      }
      session = { id: user.id, username: user.username, role: user.role, exp: payload.exp };
      return { user };
    } catch {
      // DB chưa kết nối — coi như chưa đăng nhập
      session = null;
      return { user: null };
    }
  });

  handle(IPC.AUTH_LOGOUT, 'open', () => {
    session = null;
    return { success: true };
  });

  handle(IPC.AUTH_CHANGE_PASSWORD, 'auth', async (_event, data: { oldPassword: string; newPassword: string }) => {
    await changePassword(session!.id, data.oldPassword, data.newPassword);
    return { success: true };
  });

  // ============ Users (admin) ============
  handle(IPC.USERS_LIST, 'admin', async () => {
    return listUsers();
  });

  handle(IPC.USERS_CREATE, 'admin', async (_event, data: { username: string; password: string; role: UserRole }) => {
    return adminCreateUser(data.username, data.password, data.role);
  });

  handle(IPC.USERS_DELETE, 'admin', async (_event, id: number) => {
    await adminDeleteUser(id, session!.id);
    return { success: true };
  });

  handle(IPC.USERS_SET_ROLE, 'admin', async (_event, data: { id: number; role: UserRole }) => {
    await adminSetRole(data.id, data.role, session!.id);
    return { success: true };
  });

  handle(IPC.USERS_RESET_PASSWORD, 'admin', async (_event, data: { id: number; newPassword: string }) => {
    await adminResetPassword(data.id, data.newPassword);
    return { success: true };
  });

  // ============ Config ============
  handle(IPC.GET_CONFIG, 'config', () => {
    return getDbConfig();
  });

  handle(IPC.SET_CONFIG, 'config', async (_event, config: DbConfig) => {
    setDbConfig(config);
    return { success: true };
  });

  handle(IPC.TEST_CONNECTION, 'config', async (_event, config: DbConfig) => {
    return testConnection(config);
  });

  handle(IPC.DB_INIT, 'config', async (_event, config: DbConfig) => {
    try {
      setDbConfig(config);
      await connectDb(config);
      await initTables();
      await ensureUsersTable();
      return { success: true, message: 'Kết nối và khởi tạo database thành công!' };
    } catch (err: any) {
      return { success: false, message: `Lỗi: ${err.message}` };
    }
  });

  // ============ Units ============
  handle(IPC.UNITS_GET_ALL, 'auth', async () => {
    return query('SELECT * FROM units ORDER BY type, name');
  });

  handle(IPC.UNITS_CREATE, 'admin', async (_event, data: { name: string; type: string; parent_id: number | null }) => {
    const result = await query<any>(
      'INSERT INTO units (name, type, parent_id) VALUES (?, ?, ?)',
      [data.name, data.type, data.parent_id]
    );
    return { id: result.insertId };
  });

  handle(IPC.UNITS_UPDATE, 'admin', async (_event, data: { id: number; name: string }) => {
    await query('UPDATE units SET name = ? WHERE id = ?', [data.name, data.id]);
    return { success: true };
  });

  handle(IPC.UNITS_DELETE, 'admin', async (_event, id: number) => {
    await query('DELETE FROM units WHERE id = ?', [id]);
    return { success: true };
  });

  // ============ Students ============
  handle(IPC.STUDENTS_GET, 'auth', async (_event, filters: { unit_id?: number; search?: string; page?: number; pageSize?: number }) => {
    let sql = 'SELECT s.*, u.name as unit_name FROM students s LEFT JOIN units u ON s.unit_id = u.id WHERE 1=1';
    const params: any[] = [];

    if (filters.unit_id) {
      // Lấy tất cả unit con (recursive)
      sql += ` AND s.unit_id IN (
        WITH RECURSIVE unit_tree AS (
          SELECT id FROM units WHERE id = ?
          UNION ALL
          SELECT u.id FROM units u JOIN unit_tree ut ON u.parent_id = ut.id
        )
        SELECT id FROM unit_tree
      )`;
      params.push(filters.unit_id);
    }

    if (filters.search) {
      sql += ' AND (s.ho_ten LIKE ? OR s.cccd LIKE ?)';
      params.push(`%${filters.search}%`, `%${filters.search}%`);
    }

    // Count total
    const countSql = sql.replace('SELECT s.*, u.name as unit_name', 'SELECT COUNT(*) as total');
    const countResult = await query<any[]>(countSql, params);
    const total = countResult[0]?.total || 0;

    // Pagination
    const page = filters.page || 1;
    const pageSize = Math.max(1, Math.min(500, filters.pageSize || 50));
    sql += ` ORDER BY s.ho_ten ASC LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`;

    const rows = await query<any[]>(sql, params);
    return { data: rows, total, page, pageSize };
  });

  handle(IPC.STUDENTS_CREATE, 'admin', async (_event, data: any) => {
    const fields = [
      'unit_id', 'ho_ten', 'hinh_anh', 'ngay_sinh', 'cccd', 'cap_bac', 'chuc_vu',
      'que_quan', 'dia_chi_thuong_tru',
      'bo_ho_ten', 'bo_nghe_nghiep', 'bo_ngay_sinh', 'bo_noi_o',
      'me_ho_ten', 'me_nghe_nghiep', 'me_ngay_sinh', 'me_noi_o',
    ];
    const placeholders = fields.map(() => '?').join(', ');
    const values = fields.map((f) => data[f] ?? null);
    const result = await query<any>(
      `INSERT INTO students (${fields.join(', ')}) VALUES (${placeholders})`,
      values
    );
    return { id: result.insertId };
  });

  handle(IPC.STUDENTS_UPDATE, 'admin', async (_event, data: any) => {
    const fields = [
      'unit_id', 'ho_ten', 'hinh_anh', 'ngay_sinh', 'cccd', 'cap_bac', 'chuc_vu',
      'que_quan', 'dia_chi_thuong_tru',
      'bo_ho_ten', 'bo_nghe_nghiep', 'bo_ngay_sinh', 'bo_noi_o',
      'me_ho_ten', 'me_nghe_nghiep', 'me_ngay_sinh', 'me_noi_o',
    ];
    const setClause = fields.map((f) => `${f} = ?`).join(', ');
    const values = fields.map((f) => data[f] ?? null);
    values.push(data.id);
    await query(`UPDATE students SET ${setClause} WHERE id = ?`, values);
    return { success: true };
  });

  handle(IPC.STUDENTS_DELETE, 'admin', async (_event, id: number) => {
    await query('DELETE FROM students WHERE id = ?', [id]);
    return { success: true };
  });

  // ============ Academic Scores ============
  handle(IPC.SCORES_ACADEMIC_GET, 'auth', async (_event, filters: { student_id?: number; unit_id?: number; nam_hoc?: number; hoc_ky?: number }) => {
    let sql = `SELECT a.*, s.ho_ten FROM academic_scores a
               JOIN students s ON a.student_id = s.id WHERE 1=1`;
    const params: any[] = [];

    if (filters.student_id) {
      sql += ' AND a.student_id = ?';
      params.push(filters.student_id);
    }
    if (filters.nam_hoc) {
      sql += ' AND a.nam_hoc = ?';
      params.push(filters.nam_hoc);
    }
    if (filters.hoc_ky) {
      sql += ' AND a.hoc_ky = ?';
      params.push(filters.hoc_ky);
    }
    if (filters.unit_id) {
      sql += ` AND s.unit_id IN (
        WITH RECURSIVE unit_tree AS (
          SELECT id FROM units WHERE id = ?
          UNION ALL
          SELECT u.id FROM units u JOIN unit_tree ut ON u.parent_id = ut.id
        )
        SELECT id FROM unit_tree
      )`;
      params.push(filters.unit_id);
    }

    sql += ' ORDER BY s.ho_ten, a.mon_hoc';
    return query(sql, params);
  });

  handle(IPC.SCORES_ACADEMIC_SAVE, 'admin', async (_event, scores: any[]) => {
    for (const s of scores) {
      if (s.id) {
        await query(
          'UPDATE academic_scores SET mon_hoc=?, tin_chi=?, diem=? WHERE id=?',
          [s.mon_hoc, s.tin_chi, s.diem, s.id]
        );
      } else {
        await query(
          'INSERT INTO academic_scores (student_id, nam_hoc, hoc_ky, mon_hoc, tin_chi, diem) VALUES (?,?,?,?,?,?)',
          [s.student_id, s.nam_hoc, s.hoc_ky, s.mon_hoc, s.tin_chi, s.diem]
        );
      }
    }
    return { success: true };
  });

  handle(IPC.SCORES_ACADEMIC_DELETE, 'admin', async (_event, id: number) => {
    await query('DELETE FROM academic_scores WHERE id = ?', [id]);
    return { success: true };
  });

  // ============ Discipline Scores ============
  handle(IPC.SCORES_DISCIPLINE_GET, 'auth', async (_event, filters: { student_id?: number; unit_id?: number; nam_hoc?: number; thang?: number }) => {
    let sql = `SELECT d.*, s.ho_ten FROM discipline_scores d
               JOIN students s ON d.student_id = s.id WHERE 1=1`;
    const params: any[] = [];

    if (filters.student_id) {
      sql += ' AND d.student_id = ?';
      params.push(filters.student_id);
    }
    if (filters.nam_hoc) {
      sql += ' AND d.nam_hoc = ?';
      params.push(filters.nam_hoc);
    }
    if (filters.thang) {
      sql += ' AND d.thang = ?';
      params.push(filters.thang);
    }
    if (filters.unit_id) {
      sql += ` AND s.unit_id IN (
        WITH RECURSIVE unit_tree AS (
          SELECT id FROM units WHERE id = ?
          UNION ALL
          SELECT u.id FROM units u JOIN unit_tree ut ON u.parent_id = ut.id
        )
        SELECT id FROM unit_tree
      )`;
      params.push(filters.unit_id);
    }

    sql += ' ORDER BY s.ho_ten';
    return query(sql, params);
  });

  handle(IPC.SCORES_DISCIPLINE_SAVE, 'admin', async (_event, scores: any[]) => {
    for (const s of scores) {
      const diem_thang = [s.tuan_1, s.tuan_2, s.tuan_3, s.tuan_4]
        .filter((v: any) => v != null)
        .reduce((sum: number, v: number, _: number, arr: number[]) => sum + v / arr.length, 0) || null;

      let xep_loai = null;
      if (diem_thang != null) {
        if (diem_thang >= 8) xep_loai = 'Giỏi';
        else if (diem_thang >= 7.2) xep_loai = 'Khá';
        else if (diem_thang >= 5) xep_loai = 'Trung bình';
        else xep_loai = 'Yếu';
      }

      if (s.id) {
        await query(
          'UPDATE discipline_scores SET tuan_1=?, tuan_2=?, tuan_3=?, tuan_4=?, diem_thang=?, xep_loai=? WHERE id=?',
          [s.tuan_1, s.tuan_2, s.tuan_3, s.tuan_4, diem_thang, xep_loai, s.id]
        );
      } else {
        await query(
          'INSERT INTO discipline_scores (student_id, nam_hoc, thang, tuan_1, tuan_2, tuan_3, tuan_4, diem_thang, xep_loai) VALUES (?,?,?,?,?,?,?,?,?)',
          [s.student_id, s.nam_hoc, s.thang, s.tuan_1, s.tuan_2, s.tuan_3, s.tuan_4, diem_thang, xep_loai]
        );
      }
    }
    return { success: true };
  });

  handle(IPC.SCORES_DISCIPLINE_DELETE, 'admin', async (_event, id: number) => {
    await query('DELETE FROM discipline_scores WHERE id = ?', [id]);
    return { success: true };
  });

  // ============ Absences ============
  handle(IPC.ABSENCES_GET, 'auth', async (_event, filters: { student_id?: number; unit_id?: number }) => {
    let sql = `SELECT a.*, s.ho_ten FROM absences a
               JOIN students s ON a.student_id = s.id WHERE 1=1`;
    const params: any[] = [];

    if (filters.student_id) {
      sql += ' AND a.student_id = ?';
      params.push(filters.student_id);
    }
    if (filters.unit_id) {
      sql += ` AND s.unit_id IN (
        WITH RECURSIVE unit_tree AS (
          SELECT id FROM units WHERE id = ?
          UNION ALL
          SELECT u.id FROM units u JOIN unit_tree ut ON u.parent_id = ut.id
        )
        SELECT id FROM unit_tree
      )`;
      params.push(filters.unit_id);
    }

    sql += ' ORDER BY a.ngay_vang DESC';
    return query(sql, params);
  });

  handle(IPC.ABSENCES_CREATE, 'admin', async (_event, data: { student_id: number; ngay_vang: string; ghi_chu?: string }) => {
    const result = await query<any>(
      'INSERT INTO absences (student_id, ngay_vang, ghi_chu) VALUES (?,?,?)',
      [data.student_id, data.ngay_vang, data.ghi_chu || null]
    );
    return { id: result.insertId };
  });

  handle(IPC.ABSENCES_DELETE, 'admin', async (_event, id: number) => {
    await query('DELETE FROM absences WHERE id = ?', [id]);
    return { success: true };
  });

  // ============ Violations ============
  handle(IPC.VIOLATIONS_GET, 'auth', async (_event, filters: { student_id?: number; unit_id?: number }) => {
    let sql = `SELECT v.*, s.ho_ten FROM violations v
               JOIN students s ON v.student_id = s.id WHERE 1=1`;
    const params: any[] = [];

    if (filters.student_id) {
      sql += ' AND v.student_id = ?';
      params.push(filters.student_id);
    }
    if (filters.unit_id) {
      sql += ` AND s.unit_id IN (
        WITH RECURSIVE unit_tree AS (
          SELECT id FROM units WHERE id = ?
          UNION ALL
          SELECT u.id FROM units u JOIN unit_tree ut ON u.parent_id = ut.id
        )
        SELECT id FROM unit_tree
      )`;
      params.push(filters.unit_id);
    }

    sql += ' ORDER BY v.ngay DESC';
    return query(sql, params);
  });

  handle(IPC.VIOLATIONS_CREATE, 'admin', async (_event, data: { student_id: number; loai: string; ngay: string; ly_do?: string }) => {
    const result = await query<any>(
      'INSERT INTO violations (student_id, loai, ngay, ly_do) VALUES (?,?,?,?)',
      [data.student_id, data.loai, data.ngay, data.ly_do || null]
    );
    return { id: result.insertId };
  });

  handle(IPC.VIOLATIONS_DELETE, 'admin', async (_event, id: number) => {
    await query('DELETE FROM violations WHERE id = ?', [id]);
    return { success: true };
  });

  // ============ Awards ============
  handle(IPC.AWARDS_GET, 'auth', async (_event, filters: { student_id?: number; unit_id?: number }) => {
    let sql = `SELECT aw.*, s.ho_ten FROM awards aw
               JOIN students s ON aw.student_id = s.id WHERE 1=1`;
    const params: any[] = [];

    if (filters.student_id) {
      sql += ' AND aw.student_id = ?';
      params.push(filters.student_id);
    }
    if (filters.unit_id) {
      sql += ` AND s.unit_id IN (
        WITH RECURSIVE unit_tree AS (
          SELECT id FROM units WHERE id = ?
          UNION ALL
          SELECT u.id FROM units u JOIN unit_tree ut ON u.parent_id = ut.id
        )
        SELECT id FROM unit_tree
      )`;
      params.push(filters.unit_id);
    }

    sql += ' ORDER BY s.ho_ten';
    return query(sql, params);
  });

  handle(IPC.AWARDS_SAVE, 'admin', async (_event, data: any) => {
    const tong_ket = [data.diem_nam_1, data.diem_nam_2, data.diem_nam_3, data.diem_nam_4]
      .filter((v: any) => v != null);
    const avg = tong_ket.length > 0 ? tong_ket.reduce((a: number, b: number) => a + b, 0) / tong_ket.length : null;

    let xep_loai = null;
    if (avg != null) {
      if (avg >= 8) xep_loai = 'Giỏi';
      else if (avg >= 7.2) xep_loai = 'Khá';
      else xep_loai = 'Trung bình';
    }

    // Upsert
    await query(
      `INSERT INTO awards (student_id, diem_nam_1, diem_nam_2, diem_nam_3, diem_nam_4, tong_ket, xep_loai)
       VALUES (?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE diem_nam_1=?, diem_nam_2=?, diem_nam_3=?, diem_nam_4=?, tong_ket=?, xep_loai=?`,
      [
        data.student_id, data.diem_nam_1, data.diem_nam_2, data.diem_nam_3, data.diem_nam_4, avg, xep_loai,
        data.diem_nam_1, data.diem_nam_2, data.diem_nam_3, data.diem_nam_4, avg, xep_loai,
      ]
    );
    return { success: true };
  });

  handle(IPC.AWARDS_DELETE, 'admin', async (_event, id: number) => {
    await query('DELETE FROM awards WHERE id = ?', [id]);
    return { success: true };
  });
}
