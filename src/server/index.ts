import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { connectDb, initTables, query, closeDb, isConnected } from '../main/database';
import {
  ensureUsersTable, needsSetup, login, register, getUserById, changePassword,
  listUsers, adminCreateUser, adminDeleteUser, adminSetRole, adminResetPassword,
  verifyToken, type TokenPayload,
} from '../main/auth';
import { DB_CONFIG } from '../main/db-credentials';

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const PORT = 3456;

// ============ Auth middleware ============
function currentUser(req: express.Request): TokenPayload | null {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  return verifyToken(token);
}

async function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!currentUser(req)) return res.status(401).json({ error: 'Chưa đăng nhập' });
  next();
}

function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const u = currentUser(req);
  if (!u) return res.status(401).json({ error: 'Chưa đăng nhập' });
  if (u.role !== 'admin') return res.status(403).json({ error: 'Chỉ admin mới được thực hiện thao tác này' });
  next();
}


// ============ Auth ============
app.get('/api/auth/status', async (_req, res) => {
  res.json({ dbConnected: isConnected(), needsSetup: await needsSetup() });
});

app.post('/api/auth/login', async (req, res) => {
  try {
    res.json(await login(req.body.username, req.body.password));
  } catch (err: any) {
    res.status(401).json({ error: err.message });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    res.json(await register(req.body.username, req.body.password));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/auth/me', async (req, res) => {
  const payload = currentUser(req);
  if (!payload) return res.json({ user: null });
  try {
    res.json({ user: await getUserById(payload.id) });
  } catch {
    res.json({ user: null });
  }
});

app.post('/api/auth/change-password', requireAuth, async (req, res) => {
  try {
    await changePassword(currentUser(req)!.id, req.body.oldPassword, req.body.newPassword);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ============ Users (admin) ============
app.get('/api/users', requireAdmin, async (_req, res) => {
  try {
    res.json(await listUsers());
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/users', requireAdmin, async (req, res) => {
  try {
    res.json(await adminCreateUser(req.body.username, req.body.password, req.body.role));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/users/:id', requireAdmin, async (req, res) => {
  try {
    await adminDeleteUser(Number(req.params.id), currentUser(req)!.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/users/:id/role', requireAdmin, async (req, res) => {
  try {
    await adminSetRole(Number(req.params.id), req.body.role, currentUser(req)!.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/users/:id/password', requireAdmin, async (req, res) => {
  try {
    await adminResetPassword(Number(req.params.id), req.body.newPassword);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ============ Guard: GET cần đăng nhập, ghi cần admin ============
app.use('/api', (req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD') return requireAuth(req, res, next);
  return requireAdmin(req, res, next);
});

// ============ Units ============
app.get('/api/units', async (_req, res) => {
  try {
    const rows = await query<any[]>('SELECT * FROM units');
    const typeOrder = { tieu_doan: 1, dai_doi: 2, trung_doi: 3, tieu_doi: 4 };
    const sorted = rows.sort((a, b) => {
      const orderA = typeOrder[a.type as keyof typeof typeOrder] || 99;
      const orderB = typeOrder[b.type as keyof typeof typeOrder] || 99;
      if (orderA !== orderB) return orderA - orderB;
      return (a.name || '').localeCompare(b.name || '', undefined, { numeric: true, sensitivity: 'base' });
    });
    res.json(sorted);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/units', async (req, res) => {
  try {
    const { name, type, parent_id, note } = req.body;
    const result = await query<any>(
      'INSERT INTO units (name, type, parent_id, note) VALUES (?, ?, ?, ?)',
      [name, type, parent_id, note ?? null]
    );
    res.json({ id: result.insertId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/units/:id', async (req, res) => {
  try {
    const { name, note } = req.body;
    await query('UPDATE units SET name = ?, note = ? WHERE id = ?', [name, note ?? null, req.params.id]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/units/:id', async (req, res) => {
  try {
    await query('DELETE FROM units WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============ Subjects ============
app.get('/api/subjects', async (req, res) => {
  try {
    const { nam_hoc, hoc_ky } = req.query;
    let sql = 'SELECT * FROM subjects WHERE 1=1';
    const params: any[] = [];
    if (nam_hoc) {
      sql += ' AND nam_hoc = ?';
      params.push(Number(nam_hoc));
    }
    if (hoc_ky) {
      sql += ' AND hoc_ky = ?';
      params.push(Number(hoc_ky));
    }
    sql += ' ORDER BY nam_hoc, hoc_ky, name';
    const data = await query(sql, params);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/subjects', async (req, res) => {
  try {
    const list = Array.isArray(req.body) ? req.body : [req.body];
    for (const item of list) {
      await query(
        `INSERT INTO subjects (nam_hoc, hoc_ky, name, credits)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE credits = VALUES(credits)`,
        [item.nam_hoc, item.hoc_ky, item.name, item.credits]
      );
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/subjects/:id', async (req, res) => {
  try {
    await query('DELETE FROM subjects WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============ Students ============
app.get('/api/students', async (req, res) => {
  try {
    const { unit_id, search, page = '1', pageSize = '50' } = req.query as any;

    let sql = 'SELECT s.*, u.name as unit_name FROM students s LEFT JOIN units u ON s.unit_id = u.id WHERE 1=1';
    const params: any[] = [];

    if (unit_id) {
      sql += ` AND s.unit_id IN (
        WITH RECURSIVE unit_tree AS (
          SELECT id FROM units WHERE id = ?
          UNION ALL
          SELECT u2.id FROM units u2 JOIN unit_tree ut ON u2.parent_id = ut.id
        )
        SELECT id FROM unit_tree
      )`;
      params.push(Number(unit_id));
    }

    if (search) {
      sql += ' AND (s.ho_ten LIKE ? OR s.cccd LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    const countSql = sql.replace('SELECT s.*, u.name as unit_name', 'SELECT COUNT(*) as total');
    const countResult = await query<any[]>(countSql, params);
    const total = countResult[0]?.total || 0;

    const p = Math.max(1, parseInt(page) || 1);
    const ps = Math.max(1, Math.min(500, parseInt(pageSize) || 50));
    sql += ` ORDER BY s.ho_ten ASC LIMIT ${ps} OFFSET ${(p - 1) * ps}`;

    const rows = await query<any[]>(sql, params);
    res.json({ data: rows, total, page: p, pageSize: ps });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/students', async (req, res) => {
  try {
    const fields = [
      'unit_id', 'ho_ten', 'hinh_anh', 'ngay_sinh', 'cccd', 'cccd_ngay_cap', 'cccd_noi_cap', 'bhyt', 'cap_bac', 'chuc_vu',
      'que_quan', 'dia_chi_thuong_tru',
      'bo_ho_ten', 'bo_nghe_nghiep', 'bo_ngay_sinh', 'bo_noi_o',
      'me_ho_ten', 'me_nghe_nghiep', 'me_ngay_sinh', 'me_noi_o',
    ];
    // Check trùng: CCCD hoặc (tên + ngày sinh + unit_id)
    const { ho_ten, cccd, ngay_sinh, unit_id } = req.body;
    let existing: any[] = [];
    if (cccd) {
      existing = await query<any[]>('SELECT id FROM students WHERE cccd = ?', [cccd]);
    }
    if (existing.length === 0 && ho_ten && ngay_sinh) {
      existing = await query<any[]>(
        'SELECT id FROM students WHERE ho_ten = ? AND ngay_sinh = ? AND unit_id = ?',
        [ho_ten, ngay_sinh, unit_id]
      );
    }
    if (existing.length > 0) {
      // Đã tồn tại → update thay vì insert
      const setClause = fields.filter(f => f !== 'unit_id').map((f) => `${f} = ?`).join(', ');
      const updateValues = fields.filter(f => f !== 'unit_id').map((f) => req.body[f] ?? null);
      updateValues.push(existing[0].id);
      await query(`UPDATE students SET ${setClause} WHERE id = ?`, updateValues);
      return res.json({ id: existing[0].id, updated: true });
    }

    const placeholders = fields.map(() => '?').join(', ');
    const values = fields.map((f) => req.body[f] ?? null);
    const result = await query<any>(
      `INSERT INTO students (${fields.join(', ')}) VALUES (${placeholders})`,
      values
    );
    res.json({ id: result.insertId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/students/:id', async (req, res) => {
  try {
    const fields = [
      'unit_id', 'ho_ten', 'hinh_anh', 'ngay_sinh', 'cccd', 'cccd_ngay_cap', 'cccd_noi_cap', 'bhyt', 'cap_bac', 'chuc_vu',
      'que_quan', 'dia_chi_thuong_tru',
      'bo_ho_ten', 'bo_nghe_nghiep', 'bo_ngay_sinh', 'bo_noi_o',
      'me_ho_ten', 'me_nghe_nghiep', 'me_ngay_sinh', 'me_noi_o',
    ];
    const setClause = fields.map((f) => `${f} = ?`).join(', ');
    const values = fields.map((f) => req.body[f] ?? null);
    values.push(Number(req.params.id));
    await query(`UPDATE students SET ${setClause} WHERE id = ?`, values);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/students/:id', async (req, res) => {
  try {
    await query('DELETE FROM students WHERE id = ?', [Number(req.params.id)]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============ Academic Scores ============
app.get('/api/academic-scores', async (req, res) => {
  try {
    const { student_id, unit_id, nam_hoc, hoc_ky } = req.query as any;
    let sql = `SELECT a.*, s.ho_ten, s.unit_id FROM academic_scores a
               JOIN students s ON a.student_id = s.id WHERE 1=1`;
    const params: any[] = [];

    if (student_id) { sql += ' AND a.student_id = ?'; params.push(Number(student_id)); }
    if (nam_hoc) { sql += ' AND a.nam_hoc = ?'; params.push(Number(nam_hoc)); }
    if (hoc_ky) { sql += ' AND a.hoc_ky = ?'; params.push(Number(hoc_ky)); }
    if (unit_id) {
      sql += ` AND s.unit_id IN (
        WITH RECURSIVE unit_tree AS (
          SELECT id FROM units WHERE id = ?
          UNION ALL
          SELECT u2.id FROM units u2 JOIN unit_tree ut ON u2.parent_id = ut.id
        )
        SELECT id FROM unit_tree
      )`;
      params.push(Number(unit_id));
    }

    sql += ' ORDER BY s.ho_ten, a.mon_hoc';
    const data = await query(sql, params);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/academic-scores', async (req, res) => {
  try {
    const { scores } = req.body;
    for (const s of scores) {
      if (s.id) {
        await query('UPDATE academic_scores SET mon_hoc=?, tin_chi=?, diem=? WHERE id=?',
          [s.mon_hoc, s.tin_chi, s.diem, s.id]);
      } else {
        // Check trùng: student + nam_hoc + hoc_ky + mon_hoc
        const existing = await query<any[]>(
          'SELECT id FROM academic_scores WHERE student_id=? AND nam_hoc=? AND hoc_ky=? AND mon_hoc=?',
          [s.student_id, s.nam_hoc, s.hoc_ky, s.mon_hoc]
        );
        if (existing.length > 0) {
          await query('UPDATE academic_scores SET tin_chi=?, diem=? WHERE id=?',
            [s.tin_chi, s.diem, existing[0].id]);
        } else {
          await query('INSERT INTO academic_scores (student_id, nam_hoc, hoc_ky, mon_hoc, tin_chi, diem) VALUES (?,?,?,?,?,?)',
            [s.student_id, s.nam_hoc, s.hoc_ky, s.mon_hoc, s.tin_chi, s.diem]);
        }
      }
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/academic-scores/:id', async (req, res) => {
  try {
    await query('DELETE FROM academic_scores WHERE id = ?', [Number(req.params.id)]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============ Discipline Scores ============
app.get('/api/discipline-scores', async (req, res) => {
  try {
    const { student_id, unit_id, nam_hoc, thang } = req.query as any;
    let sql = `SELECT d.*, s.ho_ten FROM discipline_scores d
               JOIN students s ON d.student_id = s.id WHERE 1=1`;
    const params: any[] = [];

    if (student_id) { sql += ' AND d.student_id = ?'; params.push(Number(student_id)); }
    if (nam_hoc) { sql += ' AND d.nam_hoc = ?'; params.push(Number(nam_hoc)); }
    if (thang) { sql += ' AND d.thang = ?'; params.push(Number(thang)); }
    if (unit_id) {
      sql += ` AND s.unit_id IN (
        WITH RECURSIVE unit_tree AS (
          SELECT id FROM units WHERE id = ?
          UNION ALL
          SELECT u2.id FROM units u2 JOIN unit_tree ut ON u2.parent_id = ut.id
        )
        SELECT id FROM unit_tree
      )`;
      params.push(Number(unit_id));
    }

    sql += ' ORDER BY s.ho_ten';
    const data = await query(sql, params);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/discipline-scores', async (req, res) => {
  try {
    const { scores } = req.body;
    for (const s of scores) {
      const vals = [s.tuan_1, s.tuan_2, s.tuan_3, s.tuan_4, s.tuan_5].filter((v: any) => v != null);
      const diem_thang = vals.length > 0 ? vals.reduce((a: number, b: number) => a + b, 0) / vals.length : null;

      let xep_loai = null;
      if (diem_thang != null) {
        if (diem_thang >= 8) xep_loai = 'Giỏi';
        else if (diem_thang >= 7.2) xep_loai = 'Khá';
        else if (diem_thang >= 5) xep_loai = 'Trung bình';
        else xep_loai = 'Yếu';
      }

      if (s.id) {
        await query('UPDATE discipline_scores SET tuan_1=?, tuan_2=?, tuan_3=?, tuan_4=?, tuan_5=?, diem_thang=?, xep_loai=? WHERE id=?',
          [s.tuan_1, s.tuan_2, s.tuan_3, s.tuan_4, s.tuan_5, diem_thang, xep_loai, s.id]);
      } else {
        // Check trùng
        const existing = await query<any[]>(
          'SELECT id FROM discipline_scores WHERE student_id=? AND nam_hoc=? AND thang=?',
          [s.student_id, s.nam_hoc, s.thang]
        );
        if (existing.length > 0) {
          await query('UPDATE discipline_scores SET tuan_1=?, tuan_2=?, tuan_3=?, tuan_4=?, tuan_5=?, diem_thang=?, xep_loai=? WHERE id=?',
            [s.tuan_1, s.tuan_2, s.tuan_3, s.tuan_4, s.tuan_5, diem_thang, xep_loai, existing[0].id]);
        } else {
          await query('INSERT INTO discipline_scores (student_id, nam_hoc, thang, tuan_1, tuan_2, tuan_3, tuan_4, tuan_5, diem_thang, xep_loai) VALUES (?,?,?,?,?,?,?,?,?,?)',
            [s.student_id, s.nam_hoc, s.thang, s.tuan_1, s.tuan_2, s.tuan_3, s.tuan_4, s.tuan_5, diem_thang, xep_loai]);
        }
      }
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/discipline-scores/:id', async (req, res) => {
  try {
    await query('DELETE FROM discipline_scores WHERE id = ?', [Number(req.params.id)]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/awards/:id', async (req, res) => {
  try {
    await query('DELETE FROM awards WHERE id = ?', [Number(req.params.id)]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============ Absences ============
app.get('/api/absences', async (req, res) => {
  try {
    const { student_id, unit_id, nam_hoc, hoc_ky } = req.query as any;
    let sql = `SELECT a.*, s.ho_ten, u.name as unit_name FROM absences a
               JOIN students s ON a.student_id = s.id
               LEFT JOIN units u ON s.unit_id = u.id WHERE 1=1`;
    const params: any[] = [];

    if (student_id) { sql += ' AND a.student_id = ?'; params.push(Number(student_id)); }
    if (nam_hoc) { sql += ' AND a.nam_hoc = ?'; params.push(Number(nam_hoc)); }
    if (hoc_ky) { sql += ' AND a.hoc_ky = ?'; params.push(Number(hoc_ky)); }
    if (unit_id) {
      sql += ` AND s.unit_id IN (
        WITH RECURSIVE unit_tree AS (
          SELECT id FROM units WHERE id = ?
          UNION ALL
          SELECT u2.id FROM units u2 JOIN unit_tree ut ON u2.parent_id = ut.id
        )
        SELECT id FROM unit_tree
      )`;
      params.push(Number(unit_id));
    }

    sql += ' ORDER BY a.ngay_vang DESC';
    const data = await query(sql, params);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/absences', async (req, res) => {
  try {
    const { student_id, ngay_vang, mon_hoc, so_tiet_vang, ten_bai, giang_vien, ghi_chu, ghi_chu_thi, nam_hoc, hoc_ky } = req.body;
    const result = await query<any>(
      'INSERT INTO absences (student_id, ngay_vang, mon_hoc, so_tiet_vang, ten_bai, giang_vien, ghi_chu, ghi_chu_thi, nam_hoc, hoc_ky) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [
        student_id,
        ngay_vang,
        mon_hoc || null,
        so_tiet_vang ?? 1,
        ten_bai || null,
        giang_vien || null,
        ghi_chu || null,
        ghi_chu_thi || null,
        nam_hoc || null,
        hoc_ky || null
      ]
    );
    res.json({ id: result.insertId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/absences/:id/note', async (req, res) => {
  try {
    const { ghi_chu_thi, ghi_chu } = req.body;
    const id = Number(req.params.id);
    if (ghi_chu_thi !== undefined && ghi_chu !== undefined) {
      await query('UPDATE absences SET ghi_chu_thi = ?, ghi_chu = ? WHERE id = ?', [ghi_chu_thi, ghi_chu, id]);
    } else if (ghi_chu_thi !== undefined) {
      await query('UPDATE absences SET ghi_chu_thi = ? WHERE id = ?', [ghi_chu_thi, id]);
    } else if (ghi_chu !== undefined) {
      await query('UPDATE absences SET ghi_chu = ? WHERE id = ?', [ghi_chu, id]);
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/absences/:id', async (req, res) => {
  try {
    await query('DELETE FROM absences WHERE id = ?', [Number(req.params.id)]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============ Violations ============
app.get('/api/violations', async (req, res) => {
  try {
    const { student_id, unit_id, nam_hoc, hoc_ky } = req.query as any;
    let sql = `SELECT v.*, s.ho_ten, u.name as unit_name FROM violations v
               JOIN students s ON v.student_id = s.id
               LEFT JOIN units u ON s.unit_id = u.id WHERE 1=1`;
    const params: any[] = [];

    if (student_id) { sql += ' AND v.student_id = ?'; params.push(Number(student_id)); }
    if (nam_hoc) { sql += ' AND v.nam_hoc = ?'; params.push(Number(nam_hoc)); }
    if (hoc_ky) { sql += ' AND v.hoc_ky = ?'; params.push(Number(hoc_ky)); }
    if (unit_id) {
      sql += ` AND s.unit_id IN (
        WITH RECURSIVE unit_tree AS (
          SELECT id FROM units WHERE id = ?
          UNION ALL
          SELECT u2.id FROM units u2 JOIN unit_tree ut ON u2.parent_id = ut.id
        )
        SELECT id FROM unit_tree
      )`;
      params.push(Number(unit_id));
    }

    sql += ' ORDER BY v.ngay DESC';
    const data = await query(sql, params);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/violations', async (req, res) => {
  try {
    const { student_id, loai, ngay, ly_do, nam_hoc, hoc_ky } = req.body;
    const result = await query<any>(
      'INSERT INTO violations (student_id, loai, ngay, ly_do, nam_hoc, hoc_ky) VALUES (?,?,?,?,?,?)',
      [student_id, loai, ngay, ly_do || null, nam_hoc || null, hoc_ky || null]
    );
    res.json({ id: result.insertId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/violations/:id', async (req, res) => {
  try {
    await query('DELETE FROM violations WHERE id = ?', [Number(req.params.id)]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============ Awards ============
app.get('/api/awards', async (req, res) => {
  try {
    const { student_id, unit_id } = req.query as any;
    let sql = `SELECT aw.*, s.ho_ten, u.name as unit_name FROM awards aw
               JOIN students s ON aw.student_id = s.id
               LEFT JOIN units u ON s.unit_id = u.id WHERE 1=1`;
    const params: any[] = [];

    if (student_id) { sql += ' AND aw.student_id = ?'; params.push(Number(student_id)); }
    if (unit_id) {
      sql += ` AND s.unit_id IN (
        WITH RECURSIVE unit_tree AS (
          SELECT id FROM units WHERE id = ?
          UNION ALL
          SELECT u2.id FROM units u2 JOIN unit_tree ut ON u2.parent_id = ut.id
        )
        SELECT id FROM unit_tree
      )`;
      params.push(Number(unit_id));
    }

    sql += ' ORDER BY s.ho_ten';
    const data = await query(sql, params);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/awards', async (req, res) => {
  try {
    const data = req.body;
    const tong_ket_vals = [data.diem_nam_1, data.diem_nam_2, data.diem_nam_3, data.diem_nam_4]
      .filter((v: any) => v != null);
    const avg = tong_ket_vals.length > 0
      ? tong_ket_vals.reduce((a: number, b: number) => a + b, 0) / tong_ket_vals.length
      : null;

    let xep_loai = null;
    if (avg != null) {
      if (avg >= 8) xep_loai = 'Giỏi';
      else if (avg >= 7.2) xep_loai = 'Khá';
      else xep_loai = 'Trung bình';
    }

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
        avg, xep_loai,
      ]
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============ Other Awards ============
app.get('/api/other-awards', async (req, res) => {
  try {
    const { student_id, unit_id } = req.query as any;
    let sql = `SELECT oa.*, s.ho_ten, u.name as unit_name FROM other_awards oa
               JOIN students s ON oa.student_id = s.id
               LEFT JOIN units u ON s.unit_id = u.id WHERE 1=1`;
    const params: any[] = [];
    if (student_id) { sql += ' AND oa.student_id = ?'; params.push(Number(student_id)); }
    if (unit_id) {
      sql += ` AND s.unit_id IN (
        WITH RECURSIVE unit_tree AS (
          SELECT id FROM units WHERE id = ?
          UNION ALL
          SELECT u2.id FROM units u2 JOIN unit_tree ut ON u2.parent_id = ut.id
        )
        SELECT id FROM unit_tree
      )`;
      params.push(Number(unit_id));
    }
    sql += ' ORDER BY oa.ngay_khen_thuong DESC';
    res.json(await query(sql, params));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/other-awards', async (req, res) => {
  try {
    const data = req.body;
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
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/other-awards/:id', async (req, res) => {
  try {
    await query('DELETE FROM other_awards WHERE id = ?', [Number(req.params.id)]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============ Party Members ============
const PARTY_FIELDS = [
  'unit_id', 'ho_ten', 'hinh_anh', 'ngay_sinh', 'que_quan', 'noi_dkht',
  'dan_toc', 'ton_giao', 'trinh_do', 'nghe_nghiep',
  'ngay_vao_doan', 'ngay_vao_dang', 'ngay_vao_dang_chinh_thuc', 'nguoi_gioi_thieu',
];

app.get('/api/party', async (req, res) => {
  try {
    const { unit_id, search, status } = req.query as any;
    let sql = `SELECT p.*, u.name AS unit_name FROM party_members p
               LEFT JOIN units u ON p.unit_id = u.id WHERE 1=1`;
    const params: any[] = [];
    if (unit_id) {
      sql += ` AND p.unit_id IN (
        WITH RECURSIVE unit_tree AS (
          SELECT id FROM units WHERE id = ?
          UNION ALL
          SELECT u2.id FROM units u2 JOIN unit_tree ut ON u2.parent_id = ut.id
        )
        SELECT id FROM unit_tree
      )`;
      params.push(Number(unit_id));
    }
    if (search) { sql += ' AND p.ho_ten LIKE ?'; params.push(`%${search}%`); }
    if (status === 'official') sql += ' AND p.ngay_vao_dang_chinh_thuc IS NOT NULL';
    if (status === 'pending') sql += ' AND p.ngay_vao_dang_chinh_thuc IS NULL';
    sql += ' ORDER BY p.ho_ten ASC';
    res.json(await query(sql, params));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/party/count-unofficial', async (_req, res) => {
  try {
    const rows = await query<any[]>(
      'SELECT COUNT(*) AS c FROM party_members WHERE ngay_vao_dang_chinh_thuc IS NULL'
    );
    res.json({ count: rows[0]?.c ?? 0 });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/party', async (req, res) => {
  try {
    const values = PARTY_FIELDS.map((f) => req.body[f] ?? null);
    const result = await query<any>(
      `INSERT INTO party_members (${PARTY_FIELDS.join(', ')}) VALUES (${PARTY_FIELDS.map(() => '?').join(', ')})`,
      values
    );
    res.json({ id: result.insertId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/party/:id', async (req, res) => {
  try {
    const setClause = PARTY_FIELDS.map((f) => `${f} = ?`).join(', ');
    const values = PARTY_FIELDS.map((f) => req.body[f] ?? null);
    values.push(Number(req.params.id));
    await query(`UPDATE party_members SET ${setClause} WHERE id = ?`, values);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/party/:id', async (req, res) => {
  try {
    await query('DELETE FROM party_members WHERE id = ?', [Number(req.params.id)]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============ Serve frontend (production) ============
const distPath = path.join(process.cwd(), 'dist', 'renderer');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('{*path}', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// ============ Start ============
app.listen(PORT, async () => {
  console.log(`\n  Server running at http://localhost:${PORT}`);
  console.log(`  API ready - open http://localhost:5173 in browser\n`);

  try {
    await connectDb(DB_CONFIG);
    await initTables();
    await ensureUsersTable();
    console.log(`  Connected to ${DB_CONFIG.host}:${DB_CONFIG.port}/${DB_CONFIG.database}\n`);
  } catch (err: any) {
    console.log(`  DB connect failed: ${err.message}\n`);
  }
});

process.on('SIGINT', async () => {
  await closeDb();
  process.exit(0);
});
