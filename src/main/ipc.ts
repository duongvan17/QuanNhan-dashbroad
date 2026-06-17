import { ipcMain } from 'electron';
import { IPC } from '../shared/types';
import type { UserRole } from '../shared/types';
import { query, isConnected } from './database';
import {
  needsSetup, login, register, getUserById, changePassword,
  listUsers, adminCreateUser, adminDeleteUser, adminSetRole, adminResetPassword,
  verifyToken, type TokenPayload,
} from './auth';

// Phiên đăng nhập lưu trong tiến trình main (1 cửa sổ / 1 tiến trình).
let session: TokenPayload | null = null;

type Mode = 'open' | 'auth' | 'admin';

function handle(
  channel: string,
  mode: Mode,
  fn: (event: Electron.IpcMainInvokeEvent, ...args: any[]) => any,
): void {
  ipcMain.handle(channel, async (event, ...args) => {
    if (mode === 'auth' && !session) throw new Error('Chưa đăng nhập');
    if (mode === 'admin' && session?.role !== 'admin') throw new Error('Chỉ admin mới được thực hiện thao tác này');
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
      'unit_id', 'ho_ten', 'hinh_anh', 'ngay_sinh', 'cccd', 'cccd_ngay_cap', 'cccd_noi_cap', 'bhyt', 'cap_bac', 'chuc_vu',
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
      'unit_id', 'ho_ten', 'hinh_anh', 'ngay_sinh', 'cccd', 'cccd_ngay_cap', 'cccd_noi_cap', 'bhyt', 'cap_bac', 'chuc_vu',
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
    let sql = `SELECT a.*, s.ho_ten, s.unit_id FROM academic_scores a
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
        const existing = await query<any[]>(
          'SELECT id FROM academic_scores WHERE student_id=? AND nam_hoc=? AND hoc_ky=? AND mon_hoc=?',
          [s.student_id, s.nam_hoc, s.hoc_ky, s.mon_hoc]
        );
        if (existing.length > 0) {
          await query(
            'UPDATE academic_scores SET tin_chi=?, diem=? WHERE id=?',
            [s.tin_chi, s.diem, existing[0].id]
          );
        } else {
          await query(
            'INSERT INTO academic_scores (student_id, nam_hoc, hoc_ky, mon_hoc, tin_chi, diem) VALUES (?,?,?,?,?,?)',
            [s.student_id, s.nam_hoc, s.hoc_ky, s.mon_hoc, s.tin_chi, s.diem]
          );
        }
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
      const diem_thang = [s.tuan_1, s.tuan_2, s.tuan_3, s.tuan_4, s.tuan_5]
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
          'UPDATE discipline_scores SET tuan_1=?, tuan_2=?, tuan_3=?, tuan_4=?, tuan_5=?, diem_thang=?, xep_loai=? WHERE id=?',
          [s.tuan_1, s.tuan_2, s.tuan_3, s.tuan_4, s.tuan_5, diem_thang, xep_loai, s.id]
        );
      } else {
        const existing = await query<any[]>(
          'SELECT id FROM discipline_scores WHERE student_id=? AND nam_hoc=? AND thang=?',
          [s.student_id, s.nam_hoc, s.thang]
        );
        if (existing.length > 0) {
          await query(
            'UPDATE discipline_scores SET tuan_1=?, tuan_2=?, tuan_3=?, tuan_4=?, tuan_5=?, diem_thang=?, xep_loai=? WHERE id=?',
            [s.tuan_1, s.tuan_2, s.tuan_3, s.tuan_4, s.tuan_5, diem_thang, xep_loai, existing[0].id]
          );
        } else {
          await query(
            'INSERT INTO discipline_scores (student_id, nam_hoc, thang, tuan_1, tuan_2, tuan_3, tuan_4, tuan_5, diem_thang, xep_loai) VALUES (?,?,?,?,?,?,?,?,?,?)',
            [s.student_id, s.nam_hoc, s.thang, s.tuan_1, s.tuan_2, s.tuan_3, s.tuan_4, s.tuan_5, diem_thang, xep_loai]
          );
        }
      }
    }
    return { success: true };
  });

  handle(IPC.SCORES_DISCIPLINE_DELETE, 'admin', async (_event, id: number) => {
    await query('DELETE FROM discipline_scores WHERE id = ?', [id]);
    return { success: true };
  });

  // ============ Absences ============
  handle(IPC.ABSENCES_GET, 'auth', async (_event, filters: { student_id?: number; unit_id?: number; nam_hoc?: number; hoc_ky?: number }) => {
    let sql = `SELECT a.*, s.ho_ten, u.name as unit_name FROM absences a
               JOIN students s ON a.student_id = s.id
               LEFT JOIN units u ON s.unit_id = u.id WHERE 1=1`;
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

    sql += ' ORDER BY a.ngay_vang DESC';
    return query(sql, params);
  });

  handle(IPC.ABSENCES_CREATE, 'admin', async (_event, data: any) => {
    const result = await query<any>(
      'INSERT INTO absences (student_id, ngay_vang, mon_hoc, so_tiet_vang, ten_bai, giang_vien, ghi_chu, ghi_chu_thi, nam_hoc, hoc_ky) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [
        data.student_id,
        data.ngay_vang,
        data.mon_hoc || null,
        data.so_tiet_vang ?? 1,
        data.ten_bai || null,
        data.giang_vien || null,
        data.ghi_chu || null,
        data.ghi_chu_thi || null,
        data.nam_hoc || null,
        data.hoc_ky || null
      ]
    );
    return { id: result.insertId };
  });

  ipcMain.handle('absences:update-note', async (_event, { id, ghi_chu_thi, ghi_chu }) => {
    if (ghi_chu_thi !== undefined && ghi_chu !== undefined) {
      await query('UPDATE absences SET ghi_chu_thi = ?, ghi_chu = ? WHERE id = ?', [ghi_chu_thi, ghi_chu, id]);
    } else if (ghi_chu_thi !== undefined) {
      await query('UPDATE absences SET ghi_chu_thi = ? WHERE id = ?', [ghi_chu_thi, id]);
    } else if (ghi_chu !== undefined) {
      await query('UPDATE absences SET ghi_chu = ? WHERE id = ?', [ghi_chu, id]);
    }
    return { success: true };
  });

  handle(IPC.ABSENCES_DELETE, 'admin', async (_event, id: number) => {
    await query('DELETE FROM absences WHERE id = ?', [id]);
    return { success: true };
  });

  // ============ Violations ============
  handle(IPC.VIOLATIONS_GET, 'auth', async (_event, filters: { student_id?: number; unit_id?: number; nam_hoc?: number; hoc_ky?: number }) => {
    let sql = `SELECT v.*, s.ho_ten, u.name as unit_name FROM violations v
               JOIN students s ON v.student_id = s.id
               LEFT JOIN units u ON s.unit_id = u.id WHERE 1=1`;
    const params: any[] = [];

    if (filters.student_id) {
      sql += ' AND v.student_id = ?';
      params.push(filters.student_id);
    }
    if (filters.nam_hoc) {
      sql += ' AND v.nam_hoc = ?';
      params.push(filters.nam_hoc);
    }
    if (filters.hoc_ky) {
      sql += ' AND v.hoc_ky = ?';
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

    sql += ' ORDER BY v.ngay DESC';
    return query(sql, params);
  });

  handle(IPC.VIOLATIONS_CREATE, 'admin', async (_event, data: any) => {
    const result = await query<any>(
      'INSERT INTO violations (student_id, loai, ngay, ly_do, nam_hoc, hoc_ky) VALUES (?,?,?,?,?,?)',
      [data.student_id, data.loai, data.ngay, data.ly_do || null, data.nam_hoc || null, data.hoc_ky || null]
    );
    return { id: result.insertId };
  });

  handle(IPC.VIOLATIONS_DELETE, 'admin', async (_event, id: number) => {
    await query('DELETE FROM violations WHERE id = ?', [id]);
    return { success: true };
  });

  // ============ Awards ============
  handle(IPC.AWARDS_GET, 'auth', async (_event, filters: { student_id?: number; unit_id?: number }) => {
    let sql = `SELECT aw.*, s.ho_ten, u.name as unit_name FROM awards aw
               JOIN students s ON aw.student_id = s.id
               LEFT JOIN units u ON s.unit_id = u.id WHERE 1=1`;
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
    const tong_ket_arr = [data.diem_nam_1, data.diem_nam_2, data.diem_nam_3, data.diem_nam_4]
      .filter((v: any) => v != null);
    const avg = tong_ket_arr.length > 0 ? tong_ket_arr.reduce((a: number, b: number) => a + b, 0) / tong_ket_arr.length : null;

    let xep_loai = null;
    if (avg != null) {
      if (avg >= 8) xep_loai = 'Giỏi';
      else if (avg >= 7.2) xep_loai = 'Khá';
      else xep_loai = 'Trung bình';
    }

    // Upsert
    await query(
      `INSERT INTO awards (student_id, diem_nam_1, diem_nam_2, diem_nam_3, diem_nam_4,
                           hinh_thuc_nam_1, hinh_thuc_nam_2, hinh_thuc_nam_3, hinh_thuc_nam_4, hinh_thuc_toan_khoa,
                           tong_ket, xep_loai)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE diem_nam_1=?, diem_nam_2=?, diem_nam_3=?, diem_nam_4=?,
                               hinh_thuc_nam_1=?, hinh_thuc_nam_2=?, hinh_thuc_nam_3=?, hinh_thuc_nam_4=?, hinh_thuc_toan_khoa=?,
                               tong_ket=?, xep_loai=?`,
      [
        data.student_id, data.diem_nam_1, data.diem_nam_2, data.diem_nam_3, data.diem_nam_4,
        data.hinh_thuc_nam_1 || null, data.hinh_thuc_nam_2 || null, data.hinh_thuc_nam_3 || null, data.hinh_thuc_nam_4 || null, data.hinh_thuc_toan_khoa || null,
        avg, xep_loai,
        
        data.diem_nam_1, data.diem_nam_2, data.diem_nam_3, data.diem_nam_4,
        data.hinh_thuc_nam_1 || null, data.hinh_thuc_nam_2 || null, data.hinh_thuc_nam_3 || null, data.hinh_thuc_nam_4 || null, data.hinh_thuc_toan_khoa || null,
        avg, xep_loai
      ]
    );
    return { success: true };
  });

  // ============ Other Awards (Giải thưởng đột xuất) ============
  handle(IPC.OTHER_AWARDS_GET, 'auth', async (_event, filters: { student_id?: number; unit_id?: number }) => {
    let sql = `SELECT oa.*, s.ho_ten, u.name as unit_name FROM other_awards oa
               JOIN students s ON oa.student_id = s.id
               LEFT JOIN units u ON s.unit_id = u.id WHERE 1=1`;
    const params: any[] = [];
    if (filters.student_id) {
      sql += ' AND oa.student_id = ?';
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
    sql += ' ORDER BY oa.ngay_khen_thuong DESC';
    return query(sql, params);
  });

  handle(IPC.OTHER_AWARDS_SAVE, 'admin', async (_event, data: any) => {
    if (data.id) {
      await query(
        `UPDATE other_awards SET loai_khen_thuong=?, ten_giai_thuong=?, cap_khen_thuong=?, nam_hoc=?, ngay_khen_thuong=?, ghi_chu=?
         WHERE id=?`,
        [data.loai_khen_thuong, data.ten_giai_thuong, data.cap_khen_thuong || null, data.nam_hoc || null, data.ngay_khen_thuong || null, data.ghi_chu || null, data.id]
      );
    } else {
      await query(
        `INSERT INTO other_awards (student_id, loai_khen_thuong, ten_giai_thuong, cap_khen_thuong, nam_hoc, ngay_khen_thuong, ghi_chu)
         VALUES (?,?,?,?,?,?,?)`,
        [data.student_id, data.loai_khen_thuong, data.ten_giai_thuong, data.cap_khen_thuong || null, data.nam_hoc || null, data.ngay_khen_thuong || null, data.ghi_chu || null]
      );
    }
    return { success: true };
  });

  handle(IPC.OTHER_AWARDS_DELETE, 'admin', async (_event, id: number) => {
    await query('DELETE FROM other_awards WHERE id = ?', [id]);
    return { success: true };
  });

  handle(IPC.AWARDS_DELETE, 'admin', async (_event, id: number) => {
    await query('DELETE FROM awards WHERE id = ?', [id]);
    return { success: true };
  });

  // ============ Party Members ============
  const PARTY_FIELDS = [
    'unit_id', 'ho_ten', 'hinh_anh', 'ngay_sinh', 'que_quan', 'noi_dkht',
    'dan_toc', 'ton_giao', 'trinh_do', 'nghe_nghiep',
    'ngay_vao_doan', 'ngay_vao_dang', 'ngay_vao_dang_chinh_thuc', 'nguoi_gioi_thieu',
  ];

  handle(IPC.PARTY_GET, 'auth', async (_event, filters: { unit_id?: number; search?: string; status?: 'official' | 'pending' }) => {
    let sql = `SELECT p.*, u.name AS unit_name FROM party_members p
               LEFT JOIN units u ON p.unit_id = u.id WHERE 1=1`;
    const params: any[] = [];
    if (filters.unit_id) {
      sql += ` AND p.unit_id IN (
        WITH RECURSIVE unit_tree AS (
          SELECT id FROM units WHERE id = ?
          UNION ALL
          SELECT u2.id FROM units u2 JOIN unit_tree ut ON u2.parent_id = ut.id
        )
        SELECT id FROM unit_tree
      )`;
      params.push(filters.unit_id);
    }
    if (filters.search) {
      sql += ' AND p.ho_ten LIKE ?';
      params.push(`%${filters.search}%`);
    }
    if (filters.status === 'official') sql += ' AND p.ngay_vao_dang_chinh_thuc IS NOT NULL';
    if (filters.status === 'pending') sql += ' AND p.ngay_vao_dang_chinh_thuc IS NULL';
    sql += ' ORDER BY p.ho_ten ASC';
    return query(sql, params);
  });

  handle(IPC.PARTY_CREATE, 'admin', async (_event, data: any) => {
    const values = PARTY_FIELDS.map((f) => data[f] ?? null);
    const result = await query<any>(
      `INSERT INTO party_members (${PARTY_FIELDS.join(', ')}) VALUES (${PARTY_FIELDS.map(() => '?').join(', ')})`,
      values
    );
    return { id: result.insertId };
  });

  handle(IPC.PARTY_UPDATE, 'admin', async (_event, data: any) => {
    const setClause = PARTY_FIELDS.map((f) => `${f} = ?`).join(', ');
    const values = PARTY_FIELDS.map((f) => data[f] ?? null);
    values.push(data.id);
    await query(`UPDATE party_members SET ${setClause} WHERE id = ?`, values);
    return { success: true };
  });

  handle(IPC.PARTY_DELETE, 'admin', async (_event, id: number) => {
    await query('DELETE FROM party_members WHERE id = ?', [id]);
    return { success: true };
  });

  handle(IPC.PARTY_COUNT_UNOFFICIAL, 'auth', async () => {
    const rows = await query<any[]>(
      'SELECT COUNT(*) AS c FROM party_members WHERE ngay_vao_dang_chinh_thuc IS NULL'
    );
    return { count: rows[0]?.c ?? 0 };
  });
}
