// ============ Database Config ============
export interface DbConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

// ============ Tài khoản / Phân quyền ============
export type UserRole = 'admin' | 'user';

export interface User {
  id: number;
  username: string;
  role: UserRole;
  must_change_password?: boolean;
  created_at?: string;
}

export interface AuthResult {
  token: string;
  user: User;
}

export interface AuthStatus {
  dbConnected: boolean;
  // true khi tài khoản admin mặc định chưa đổi mật khẩu lần đầu
  needsSetup: boolean;
}

// ============ Đơn vị tổ chức ============
export type UnitType = 'tieu_doan' | 'dai_doi' | 'trung_doi';

export interface Unit {
  id: number;
  name: string;
  type: UnitType;
  parent_id: number | null;
  children?: Unit[];
}

// ============ Học viên ============
export interface Student {
  id: number;
  unit_id: number;
  ho_ten: string;
  hinh_anh: string | null;
  ngay_sinh: string | null;
  cccd: string | null;
  cap_bac: string | null;
  chuc_vu: string | null;
  que_quan: string | null;
  dia_chi_thuong_tru: string | null;
  // Bố
  bo_ho_ten: string | null;
  bo_nghe_nghiep: string | null;
  bo_ngay_sinh: string | null;
  bo_noi_o: string | null;
  // Mẹ
  me_ho_ten: string | null;
  me_nghe_nghiep: string | null;
  me_ngay_sinh: string | null;
  me_noi_o: string | null;
  created_at?: string;
  updated_at?: string;
}

// ============ Điểm học tập ============
export interface AcademicScore {
  id: number;
  student_id: number;
  nam_hoc: number; // 1-4
  hoc_ky: number;  // 1 or 2
  mon_hoc: string;
  tin_chi: number;
  diem: number;
  created_at?: string;
}

// ============ Điểm rèn luyện ============
export interface DisciplineScore {
  id: number;
  student_id: number;
  nam_hoc: number;
  thang: number;
  tuan_1: number | null;
  tuan_2: number | null;
  tuan_3: number | null;
  tuan_4: number | null;
  diem_thang: number | null;
  xep_loai: string | null;
  created_at?: string;
}

// ============ Công vắng ============
export interface Absence {
  id: number;
  student_id: number;
  ngay_vang: string;
  ghi_chu: string | null;
  created_at?: string;
}

// ============ Vi phạm ============
export type ViolationType = 'khien_trach' | 'canh_cao' | 'ky_luat';

export interface Violation {
  id: number;
  student_id: number;
  loai: ViolationType;
  ngay: string;
  ly_do: string | null;
  created_at?: string;
}

// ============ Thi đua khen thưởng ============
export interface Award {
  id: number;
  student_id: number;
  diem_nam_1: number | null;
  diem_nam_2: number | null;
  diem_nam_3: number | null;
  diem_nam_4: number | null;
  tong_ket: number | null;
  xep_loai: string | null;
  created_at?: string;
  updated_at?: string;
}

// ============ IPC Channels ============
export const IPC = {
  // Config
  GET_CONFIG: 'config:get',
  SET_CONFIG: 'config:set',
  TEST_CONNECTION: 'db:test-connection',

  // Auth
  AUTH_STATUS: 'auth:status',
  AUTH_LOGIN: 'auth:login',
  AUTH_REGISTER: 'auth:register',
  AUTH_ME: 'auth:me',
  AUTH_LOGOUT: 'auth:logout',
  AUTH_CHANGE_PASSWORD: 'auth:change-password',

  // Users (admin)
  USERS_LIST: 'users:list',
  USERS_CREATE: 'users:create',
  USERS_DELETE: 'users:delete',
  USERS_SET_ROLE: 'users:set-role',
  USERS_RESET_PASSWORD: 'users:reset-password',

  // Database
  DB_QUERY: 'db:query',
  DB_INIT: 'db:init',

  // Units
  UNITS_GET_ALL: 'units:get-all',
  UNITS_CREATE: 'units:create',
  UNITS_UPDATE: 'units:update',
  UNITS_DELETE: 'units:delete',

  // Students
  STUDENTS_GET: 'students:get',
  STUDENTS_CREATE: 'students:create',
  STUDENTS_UPDATE: 'students:update',
  STUDENTS_DELETE: 'students:delete',
  STUDENTS_SEARCH: 'students:search',

  // Academic Scores
  SCORES_ACADEMIC_GET: 'scores:academic:get',
  SCORES_ACADEMIC_SAVE: 'scores:academic:save',
  SCORES_ACADEMIC_DELETE: 'scores:academic:delete',

  // Discipline Scores
  SCORES_DISCIPLINE_GET: 'scores:discipline:get',
  SCORES_DISCIPLINE_SAVE: 'scores:discipline:save',
  SCORES_DISCIPLINE_DELETE: 'scores:discipline:delete',

  // Absences
  ABSENCES_GET: 'absences:get',
  ABSENCES_CREATE: 'absences:create',
  ABSENCES_DELETE: 'absences:delete',

  // Violations
  VIOLATIONS_GET: 'violations:get',
  VIOLATIONS_CREATE: 'violations:create',
  VIOLATIONS_DELETE: 'violations:delete',

  // Awards
  AWARDS_GET: 'awards:get',
  AWARDS_SAVE: 'awards:save',
  AWARDS_DELETE: 'awards:delete',

  // Excel
  EXCEL_IMPORT: 'excel:import',
  EXCEL_EXPORT: 'excel:export',
  EXCEL_OPEN_FILE: 'excel:open-file',
} as const;
