import mysql from 'mysql2/promise';
import type { DbConfig } from '../shared/types';

let pool: mysql.Pool | null = null;

export async function connectDb(config: DbConfig): Promise<void> {
  if (pool) {
    await pool.end();
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
  });
  // Test connection
  const conn = await pool.getConnection();
  conn.release();
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

export async function query<T = any>(sql: string, params?: any[]): Promise<T> {
  if (!pool) throw new Error('Chưa kết nối database');
  const [rows] = params && params.length > 0 ? await pool.execute(sql, params) : await pool.query(sql);
  return rows as T;
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
      type ENUM('tieu_doan', 'dai_doi', 'trung_doi') NOT NULL,
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
  ];

  for (const sql of statements) {
    await pool.execute(sql);
  }
}
