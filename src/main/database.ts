import mysql from 'mysql2/promise';
import type { DbConfig } from '../shared/types';

let pool: mysql.Pool | null = null;
// Nhớ config lần cuối kết nối thành công để tự reconnect khi TiDB ngủ đông
// / pool chết do laptop sleep, đổi mạng, v.v.
let lastConfig: DbConfig | null = null;

const CONNECTION_ERROR_CODES = new Set([
  'PROTOCOL_CONNECTION_LOST', 'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT',
  'ENOTFOUND', 'EAI_AGAIN', 'EPIPE', 'ER_SERVER_SHUTDOWN', 'PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR',
]);

function isConnectionError(err: any): boolean {
  const code = err?.code || err?.errno;
  if (code && CONNECTION_ERROR_CODES.has(String(code))) return true;
  const msg = String(err?.message || '');
  return /closed state|pool is closed|connection lost|server has gone away|handshake/i.test(msg);
}

export async function connectDb(config: DbConfig): Promise<void> {
  if (pool) {
    try { await pool.end(); } catch { /* ignore */ }
  }
  pool = mysql.createPool({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    ssl: { rejectUnauthorized: true },
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0,
    // TiDB Serverless mất ~5-15s để wake-up sau khi ngủ đông
    connectTimeout: 30000,
  });
  // Test connection
  const conn = await pool.getConnection();
  conn.release();
  lastConfig = config;
}

async function tryReconnect(): Promise<boolean> {
  if (!lastConfig) return false;
  try {
    await connectDb(lastConfig);
    return true;
  } catch {
    return false;
  }
}

export async function testConnection(config: DbConfig): Promise<{ success: boolean; message: string }> {
  try {
    const testPool = mysql.createPool({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      ssl: { rejectUnauthorized: true },
      connectionLimit: 1,
    });
    const conn = await testPool.getConnection();
    conn.release();
    await testPool.end();
    return { success: true, message: 'Kết nối thành công!' };
  } catch (err: any) {
    return { success: false, message: `Lỗi: ${err.message}` };
  }
}

async function runOnce<T>(sql: string, params?: any[]): Promise<T> {
  const [rows] = params && params.length > 0 ? await pool!.execute(sql, params) : await pool!.query(sql);
  return rows as T;
}

export async function query<T = any>(sql: string, params?: any[]): Promise<T> {
  if (!pool) {
    if (!(await tryReconnect())) throw new Error('Chưa kết nối database');
  }
  try {
    return await runOnce<T>(sql, params);
  } catch (err: any) {
    // Pool còn sống nhưng connection chết (TiDB hibernate, mạng gián đoạn,...)
    // Thử kết nối lại 1 lần rồi chạy lại query.
    if (isConnectionError(err) && (await tryReconnect())) {
      return runOnce<T>(sql, params);
    }
    throw err;
  }
}

export async function getPool(): Promise<mysql.Pool> {
  if (!pool) throw new Error('Chưa kết nối database');
  return pool;
}

export function isConnected(): boolean {
  return pool !== null;
}

export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

// ============ Migration: tạo bảng ============
export async function initTables(): Promise<void> {
  if (!pool) throw new Error('Chưa kết nối database');

  const statements = [
    `CREATE TABLE IF NOT EXISTS units (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      type ENUM('tieu_doan', 'dai_doi', 'trung_doi', 'tieu_doi') NOT NULL,
      parent_id INT NULL,
      FOREIGN KEY (parent_id) REFERENCES units(id) ON DELETE CASCADE
    )`,

    `CREATE TABLE IF NOT EXISTS students (
      id INT AUTO_INCREMENT PRIMARY KEY,
      unit_id INT NOT NULL,
      ho_ten VARCHAR(255) NOT NULL,
      hinh_anh LONGTEXT NULL,
      ngay_sinh DATE NULL,
      cccd VARCHAR(20) NULL,
      cap_bac VARCHAR(100) NULL,
      chuc_vu VARCHAR(100) NULL,
      que_quan VARCHAR(500) NULL,
      dia_chi_thuong_tru VARCHAR(500) NULL,
      bo_ho_ten VARCHAR(255) NULL,
      bo_nghe_nghiep VARCHAR(255) NULL,
      bo_ngay_sinh DATE NULL,
      bo_noi_o VARCHAR(500) NULL,
      me_ho_ten VARCHAR(255) NULL,
      me_nghe_nghiep VARCHAR(255) NULL,
      me_ngay_sinh DATE NULL,
      me_noi_o VARCHAR(500) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE CASCADE
    )`,

    `CREATE TABLE IF NOT EXISTS academic_scores (
      id INT AUTO_INCREMENT PRIMARY KEY,
      student_id INT NOT NULL,
      nam_hoc INT NOT NULL,
      hoc_ky INT NOT NULL,
      mon_hoc VARCHAR(255) NOT NULL,
      tin_chi INT DEFAULT 0,
      diem DECIMAL(4,2) DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    )`,

    `CREATE TABLE IF NOT EXISTS discipline_scores (
      id INT AUTO_INCREMENT PRIMARY KEY,
      student_id INT NOT NULL,
      nam_hoc INT NOT NULL,
      thang INT NOT NULL,
      tuan_1 DECIMAL(4,2) NULL,
      tuan_2 DECIMAL(4,2) NULL,
      tuan_3 DECIMAL(4,2) NULL,
      tuan_4 DECIMAL(4,2) NULL,
      tuan_5 DECIMAL(4,2) NULL,
      diem_thang DECIMAL(4,2) NULL,
      xep_loai VARCHAR(50) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    )`,

    `CREATE TABLE IF NOT EXISTS absences (
      id INT AUTO_INCREMENT PRIMARY KEY,
      student_id INT NOT NULL,
      ngay_vang DATE NOT NULL,
      ghi_chu TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    )`,

    `CREATE TABLE IF NOT EXISTS violations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      student_id INT NOT NULL,
      loai ENUM('khien_trach', 'canh_cao', 'ky_luat') NOT NULL,
      ngay DATE NOT NULL,
      ly_do TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    )`,

    `CREATE TABLE IF NOT EXISTS awards (
      id INT AUTO_INCREMENT PRIMARY KEY,
      student_id INT NOT NULL UNIQUE,
      diem_nam_1 DECIMAL(4,2) NULL,
      diem_nam_2 DECIMAL(4,2) NULL,
      diem_nam_3 DECIMAL(4,2) NULL,
      diem_nam_4 DECIMAL(4,2) NULL,
      tong_ket DECIMAL(4,2) NULL,
      xep_loai VARCHAR(50) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    )`,

    `CREATE TABLE IF NOT EXISTS party_members (
      id INT AUTO_INCREMENT PRIMARY KEY,
      unit_id INT NULL,
      ho_ten VARCHAR(255) NOT NULL,
      hinh_anh LONGTEXT NULL,
      ngay_sinh DATE NULL,
      que_quan VARCHAR(500) NULL,
      noi_dkht VARCHAR(500) NULL,
      dan_toc VARCHAR(100) NULL,
      ton_giao VARCHAR(100) NULL,
      trinh_do VARCHAR(500) NULL,
      nghe_nghiep VARCHAR(500) NULL,
      ngay_vao_doan DATE NULL,
      ngay_vao_dang DATE NULL,
      ngay_vao_dang_chinh_thuc DATE NULL,
      nguoi_gioi_thieu VARCHAR(255) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE SET NULL
    )`,

    `CREATE TABLE IF NOT EXISTS other_awards (
      id INT AUTO_INCREMENT PRIMARY KEY,
      student_id INT NOT NULL,
      loai_khen_thuong VARCHAR(255) NOT NULL,
      ten_giai_thuong VARCHAR(500) NOT NULL,
      cap_khen_thuong VARCHAR(255) NULL,
      nam_hoc INT NULL,
      ngay_khen_thuong DATE NULL,
      ghi_chu TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    )`,
  ];

  for (const sql of statements) {
    await pool.execute(sql);
  }

  // Auto-migrate tables to add new columns
  const alters = [
    "ALTER TABLE units MODIFY COLUMN type ENUM('tieu_doan', 'dai_doi', 'trung_doi', 'tieu_doi') NOT NULL",
    'ALTER TABLE students ADD COLUMN cccd_ngay_cap DATE NULL',
    'ALTER TABLE students ADD COLUMN cccd_noi_cap VARCHAR(255) NULL',
    'ALTER TABLE students ADD COLUMN bhyt VARCHAR(100) NULL',
    'ALTER TABLE absences ADD COLUMN mon_hoc VARCHAR(255) NULL',
    'ALTER TABLE absences ADD COLUMN so_tiet_vang INT DEFAULT 1',
    'ALTER TABLE absences ADD COLUMN ten_bai VARCHAR(255) NULL',
    'ALTER TABLE absences ADD COLUMN giang_vien VARCHAR(255) NULL',
    'ALTER TABLE absences ADD COLUMN ghi_chu_thi VARCHAR(255) NULL',
    'ALTER TABLE absences ADD COLUMN nam_hoc INT NULL',
    'ALTER TABLE absences ADD COLUMN hoc_ky INT NULL',
    'ALTER TABLE violations ADD COLUMN nam_hoc INT NULL',
    'ALTER TABLE violations ADD COLUMN hoc_ky INT NULL',
    'ALTER TABLE awards ADD COLUMN hinh_thuc_nam_1 VARCHAR(255) NULL',
    'ALTER TABLE awards ADD COLUMN hinh_thuc_nam_2 VARCHAR(255) NULL',
    'ALTER TABLE awards ADD COLUMN hinh_thuc_nam_3 VARCHAR(255) NULL',
    'ALTER TABLE awards ADD COLUMN hinh_thuc_nam_4 VARCHAR(255) NULL',
    'ALTER TABLE awards ADD COLUMN hinh_thuc_toan_khoa VARCHAR(255) NULL',
    'ALTER TABLE discipline_scores ADD COLUMN tuan_5 DECIMAL(4,2) NULL',
  ];

  for (const sql of alters) {
    try {
      await pool.execute(sql);
    } catch (e: any) {
      // Ignore if columns already exist
    }
  }
}
