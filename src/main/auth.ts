import crypto from 'crypto';
import { query, isConnected } from './database';
import type { User, UserRole, AuthResult } from '../shared/types';

// Bí mật ký token. Ứng dụng nội bộ (LAN / TiDB), không public internet.
const AUTH_SECRET = 'quan-nhan-auth-secret-2026';
const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 ngày

// ============ Băm mật khẩu (scrypt, built-in) ============
function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = (stored || '').split(':');
  if (!salt || !hash) return false;
  const test = crypto.scryptSync(password, salt, 64);
  const hashBuf = Buffer.from(hash, 'hex');
  return hashBuf.length === test.length && crypto.timingSafeEqual(hashBuf, test);
}

// ============ Token HMAC ============
export interface TokenPayload {
  id: number;
  username: string;
  role: UserRole;
  exp: number;
}

function sign(payload: TokenPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', AUTH_SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyToken(token?: string | null): TokenPayload | null {
  if (!token) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = crypto.createHmac('sha256', AUTH_SECRET).update(body).digest('base64url');
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as TokenPayload;
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function tokenFor(u: User): string {
  return sign({ id: u.id, username: u.username, role: u.role, exp: Date.now() + TOKEN_TTL_MS });
}

function toUser(row: any): User {
  return {
    id: row.id,
    username: row.username,
    role: row.role,
    must_change_password: !!row.must_change_password,
    created_at: row.created_at,
  };
}

// ============ Bảng users + seed admin gốc ============
export async function ensureUsersTable(): Promise<void> {
  await query(`CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(64) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('admin','user') NOT NULL DEFAULT 'user',
    must_change_password TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);
  const rows = await query<any[]>('SELECT COUNT(*) AS c FROM users');
  if ((rows[0]?.c ?? 0) === 0) {
    await query(
      'INSERT INTO users (username, password_hash, role, must_change_password) VALUES (?,?,?,1)',
      ['admin', hashPassword('admin123'), 'admin']
    );
  }
}

export async function hasAnyUser(): Promise<boolean> {
  if (!isConnected()) return false;
  try {
    const rows = await query<any[]>('SELECT COUNT(*) AS c FROM users');
    return (rows[0]?.c ?? 0) > 0;
  } catch {
    return false;
  }
}

// ============ Thao tác xác thực ============
export async function login(username: string, password: string): Promise<AuthResult> {
  const rows = await query<any[]>('SELECT * FROM users WHERE username = ?', [String(username || '').trim()]);
  const row = rows[0];
  if (!row || !verifyPassword(password || '', row.password_hash)) {
    throw new Error('Sai tên đăng nhập hoặc mật khẩu');
  }
  const user = toUser(row);
  return { token: tokenFor(user), user };
}

export async function register(username: string, password: string): Promise<AuthResult> {
  const uname = String(username || '').trim();
  if (uname.length < 3) throw new Error('Tên đăng nhập tối thiểu 3 ký tự');
  if ((password || '').length < 6) throw new Error('Mật khẩu tối thiểu 6 ký tự');
  const exists = await query<any[]>('SELECT id FROM users WHERE username = ?', [uname]);
  if (exists.length > 0) throw new Error('Tên đăng nhập đã tồn tại');
  const res = await query<any>(
    'INSERT INTO users (username, password_hash, role, must_change_password) VALUES (?,?,?,0)',
    [uname, hashPassword(password), 'user']
  );
  const user: User = { id: res.insertId, username: uname, role: 'user', must_change_password: false };
  return { token: tokenFor(user), user };
}

export async function getUserById(id: number): Promise<User | null> {
  const rows = await query<any[]>('SELECT * FROM users WHERE id = ?', [id]);
  return rows[0] ? toUser(rows[0]) : null;
}

export async function changePassword(userId: number, oldPassword: string, newPassword: string): Promise<void> {
  if ((newPassword || '').length < 6) throw new Error('Mật khẩu mới tối thiểu 6 ký tự');
  const rows = await query<any[]>('SELECT * FROM users WHERE id = ?', [userId]);
  const row = rows[0];
  if (!row) throw new Error('Tài khoản không tồn tại');
  if (!verifyPassword(oldPassword || '', row.password_hash)) throw new Error('Mật khẩu hiện tại không đúng');
  await query('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?', [hashPassword(newPassword), userId]);
}

// ============ Quản trị tài khoản (admin) ============
export async function listUsers(): Promise<User[]> {
  const rows = await query<any[]>('SELECT id, username, role, must_change_password, created_at FROM users ORDER BY role, username');
  return rows.map(toUser);
}

export async function adminCreateUser(username: string, password: string, role: UserRole): Promise<User> {
  const uname = String(username || '').trim();
  if (uname.length < 3) throw new Error('Tên đăng nhập tối thiểu 3 ký tự');
  if ((password || '').length < 6) throw new Error('Mật khẩu tối thiểu 6 ký tự');
  const exists = await query<any[]>('SELECT id FROM users WHERE username = ?', [uname]);
  if (exists.length > 0) throw new Error('Tên đăng nhập đã tồn tại');
  const finalRole: UserRole = role === 'admin' ? 'admin' : 'user';
  const res = await query<any>(
    'INSERT INTO users (username, password_hash, role, must_change_password) VALUES (?,?,?,0)',
    [uname, hashPassword(password), finalRole]
  );
  return { id: res.insertId, username: uname, role: finalRole, must_change_password: false };
}

export async function adminDeleteUser(id: number, actingUserId: number): Promise<void> {
  if (id === actingUserId) throw new Error('Không thể tự xóa tài khoản đang đăng nhập');
  const rows = await query<any[]>('SELECT role FROM users WHERE id = ?', [id]);
  if (rows[0]?.role === 'admin') {
    const admins = await query<any[]>("SELECT COUNT(*) AS c FROM users WHERE role = 'admin'");
    if ((admins[0]?.c ?? 0) <= 1) throw new Error('Phải còn ít nhất 1 admin');
  }
  await query('DELETE FROM users WHERE id = ?', [id]);
}

export async function adminSetRole(id: number, role: UserRole, actingUserId: number): Promise<void> {
  if (id === actingUserId) throw new Error('Không thể tự đổi quyền của mình');
  const finalRole: UserRole = role === 'admin' ? 'admin' : 'user';
  if (finalRole !== 'admin') {
    const rows = await query<any[]>('SELECT role FROM users WHERE id = ?', [id]);
    if (rows[0]?.role === 'admin') {
      const admins = await query<any[]>("SELECT COUNT(*) AS c FROM users WHERE role = 'admin'");
      if ((admins[0]?.c ?? 0) <= 1) throw new Error('Phải còn ít nhất 1 admin');
    }
  }
  await query('UPDATE users SET role = ? WHERE id = ?', [finalRole, id]);
}

export async function adminResetPassword(id: number, newPassword: string): Promise<void> {
  if ((newPassword || '').length < 6) throw new Error('Mật khẩu tối thiểu 6 ký tự');
  await query('UPDATE users SET password_hash = ?, must_change_password = 1 WHERE id = ?', [hashPassword(newPassword), id]);
}
