import type { AuthResult, AuthStatus, User, UserRole } from '../../shared/types';

const API_BASE = '/api';

const isElectron = !!(window as any).electronAPI;
const invoke = (channel: string, ...args: any[]) => (window as any).electronAPI.invoke(channel, ...args);

// ============ Token ============
const TOKEN_KEY = 'qnn_auth_token';
export const tokenStore = {
  get: (): string | null => localStorage.getItem(TOKEN_KEY),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

// ============ HTTP fetch helper ============
async function fetchApi<T = any>(url: string, options?: RequestInit): Promise<T> {
  const token = tokenStore.get();
  const res = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

// ============ Auth ============
export const getAuthStatus = (): Promise<AuthStatus> =>
  isElectron ? invoke('auth:status') : fetchApi('/auth/status');

export const apiLogin = (username: string, password: string): Promise<AuthResult> =>
  isElectron
    ? invoke('auth:login', { username, password })
    : fetchApi('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });

export const apiRegister = (username: string, password: string): Promise<AuthResult> =>
  isElectron
    ? invoke('auth:register', { username, password })
    : fetchApi('/auth/register', { method: 'POST', body: JSON.stringify({ username, password }) });

export const apiMe = (): Promise<{ user: User | null }> =>
  isElectron ? invoke('auth:me', tokenStore.get()) : fetchApi('/auth/me');

export const apiLogout = (): Promise<any> =>
  isElectron ? invoke('auth:logout') : Promise.resolve({ success: true });

export const apiChangePassword = (oldPassword: string, newPassword: string) =>
  isElectron
    ? invoke('auth:change-password', { oldPassword, newPassword })
    : fetchApi('/auth/change-password', { method: 'POST', body: JSON.stringify({ oldPassword, newPassword }) });

// ============ Users (admin) ============
export const getUsers = (): Promise<User[]> =>
  isElectron ? invoke('users:list') : fetchApi('/users');

export const createUser = (data: { username: string; password: string; role: UserRole }) =>
  isElectron ? invoke('users:create', data) : fetchApi('/users', { method: 'POST', body: JSON.stringify(data) });

export const deleteUser = (id: number) =>
  isElectron ? invoke('users:delete', id) : fetchApi(`/users/${id}`, { method: 'DELETE' });

export const setUserRole = (id: number, role: UserRole) =>
  isElectron
    ? invoke('users:set-role', { id, role })
    : fetchApi(`/users/${id}/role`, { method: 'PUT', body: JSON.stringify({ role }) });

export const resetUserPassword = (id: number, newPassword: string) =>
  isElectron
    ? invoke('users:reset-password', { id, newPassword })
    : fetchApi(`/users/${id}/password`, { method: 'PUT', body: JSON.stringify({ newPassword }) });

// ============ Units ============
export const getUnits = () =>
  isElectron ? (window as any).electronAPI.invoke('units:get-all') : fetchApi('/units');

export const createUnit = (data: { name: string; type: string; parent_id: number | null }) =>
  isElectron
    ? (window as any).electronAPI.invoke('units:create', data)
    : fetchApi('/units', { method: 'POST', body: JSON.stringify(data) });

export const updateUnit = (data: { id: number; name: string }) =>
  isElectron
    ? (window as any).electronAPI.invoke('units:update', data)
    : fetchApi(`/units/${data.id}`, { method: 'PUT', body: JSON.stringify(data) });

export const deleteUnit = (id: number) =>
  isElectron
    ? (window as any).electronAPI.invoke('units:delete', id)
    : fetchApi(`/units/${id}`, { method: 'DELETE' });

// ============ Students ============
export const getStudents = (filters: { unit_id?: number; search?: string; page?: number; pageSize?: number }) => {
  if (isElectron) return (window as any).electronAPI.invoke('students:get', filters);
  const params = new URLSearchParams();
  if (filters.unit_id) params.set('unit_id', String(filters.unit_id));
  if (filters.search) params.set('search', filters.search);
  if (filters.page) params.set('page', String(filters.page));
  if (filters.pageSize) params.set('pageSize', String(filters.pageSize));
  return fetchApi(`/students?${params}`);
};

export const createStudent = (data: any) =>
  isElectron
    ? (window as any).electronAPI.invoke('students:create', data)
    : fetchApi('/students', { method: 'POST', body: JSON.stringify(data) });

export const updateStudent = (data: any) =>
  isElectron
    ? (window as any).electronAPI.invoke('students:update', data)
    : fetchApi(`/students/${data.id}`, { method: 'PUT', body: JSON.stringify(data) });

export const deleteStudent = (id: number) =>
  isElectron
    ? (window as any).electronAPI.invoke('students:delete', id)
    : fetchApi(`/students/${id}`, { method: 'DELETE' });

// ============ Academic Scores ============
export const getAcademicScores = (filters: { student_id?: number; unit_id?: number; nam_hoc?: number; hoc_ky?: number }) => {
  if (isElectron) return (window as any).electronAPI.invoke('scores:academic:get', filters);
  const params = new URLSearchParams();
  if (filters.student_id) params.set('student_id', String(filters.student_id));
  if (filters.unit_id) params.set('unit_id', String(filters.unit_id));
  if (filters.nam_hoc) params.set('nam_hoc', String(filters.nam_hoc));
  if (filters.hoc_ky) params.set('hoc_ky', String(filters.hoc_ky));
  return fetchApi(`/academic-scores?${params}`);
};

export const saveAcademicScores = (scores: any[]) =>
  isElectron
    ? (window as any).electronAPI.invoke('scores:academic:save', scores)
    : fetchApi('/academic-scores', { method: 'POST', body: JSON.stringify({ scores }) });

export const deleteAcademicScore = (id: number) =>
  isElectron
    ? (window as any).electronAPI.invoke('scores:academic:delete', id)
    : fetchApi(`/academic-scores/${id}`, { method: 'DELETE' });

// ============ Discipline Scores ============
export const getDisciplineScores = (filters: { student_id?: number; unit_id?: number; nam_hoc?: number; thang?: number }) => {
  if (isElectron) return (window as any).electronAPI.invoke('scores:discipline:get', filters);
  const params = new URLSearchParams();
  if (filters.student_id) params.set('student_id', String(filters.student_id));
  if (filters.unit_id) params.set('unit_id', String(filters.unit_id));
  if (filters.nam_hoc) params.set('nam_hoc', String(filters.nam_hoc));
  if (filters.thang) params.set('thang', String(filters.thang));
  return fetchApi(`/discipline-scores?${params}`);
};

export const saveDisciplineScores = (scores: any[]) =>
  isElectron
    ? (window as any).electronAPI.invoke('scores:discipline:save', scores)
    : fetchApi('/discipline-scores', { method: 'POST', body: JSON.stringify({ scores }) });

export const deleteDisciplineScore = (id: number) =>
  isElectron
    ? (window as any).electronAPI.invoke('scores:discipline:delete', id)
    : fetchApi(`/discipline-scores/${id}`, { method: 'DELETE' });

// ============ Absences ============
export const getAbsences = (filters: { student_id?: number; unit_id?: number; nam_hoc?: number; hoc_ky?: number }) => {
  if (isElectron) return (window as any).electronAPI.invoke('absences:get', filters);
  const params = new URLSearchParams();
  if (filters.student_id) params.set('student_id', String(filters.student_id));
  if (filters.unit_id) params.set('unit_id', String(filters.unit_id));
  if (filters.nam_hoc) params.set('nam_hoc', String(filters.nam_hoc));
  if (filters.hoc_ky) params.set('hoc_ky', String(filters.hoc_ky));
  return fetchApi(`/absences?${params}`);
};

export const createAbsence = (data: any) =>
  isElectron
    ? (window as any).electronAPI.invoke('absences:create', data)
    : fetchApi('/absences', { method: 'POST', body: JSON.stringify(data) });

export const updateAbsenceNote = (id: number, ghi_chu_thi?: string | null, ghi_chu?: string | null) =>
  isElectron
    ? (window as any).electronAPI.invoke('absences:update-note', { id, ghi_chu_thi, ghi_chu })
    : fetchApi(`/absences/${id}/note`, { method: 'PUT', body: JSON.stringify({ ghi_chu_thi, ghi_chu }) });

export const deleteAbsence = (id: number) =>
  isElectron
    ? (window as any).electronAPI.invoke('absences:delete', id)
    : fetchApi(`/absences/${id}`, { method: 'DELETE' });

// ============ Violations ============
export const getViolations = (filters: { student_id?: number; unit_id?: number; nam_hoc?: number; hoc_ky?: number }) => {
  if (isElectron) return (window as any).electronAPI.invoke('violations:get', filters);
  const params = new URLSearchParams();
  if (filters.student_id) params.set('student_id', String(filters.student_id));
  if (filters.unit_id) params.set('unit_id', String(filters.unit_id));
  if (filters.nam_hoc) params.set('nam_hoc', String(filters.nam_hoc));
  if (filters.hoc_ky) params.set('hoc_ky', String(filters.hoc_ky));
  return fetchApi(`/violations?${params}`);
};

export const createViolation = (data: any) =>
  isElectron
    ? (window as any).electronAPI.invoke('violations:create', data)
    : fetchApi('/violations', { method: 'POST', body: JSON.stringify(data) });

export const deleteViolation = (id: number) =>
  isElectron
    ? (window as any).electronAPI.invoke('violations:delete', id)
    : fetchApi(`/violations/${id}`, { method: 'DELETE' });

// ============ Awards ============
export const getAwards = (filters: { student_id?: number; unit_id?: number }) => {
  if (isElectron) return (window as any).electronAPI.invoke('awards:get', filters);
  const params = new URLSearchParams();
  if (filters.student_id) params.set('student_id', String(filters.student_id));
  if (filters.unit_id) params.set('unit_id', String(filters.unit_id));
  return fetchApi(`/awards?${params}`);
};

// ============ Other Awards ============
export const getOtherAwards = (filters: { student_id?: number; unit_id?: number }) => {
  if (isElectron) return invoke('other-awards:get', filters);
  const params = new URLSearchParams();
  if (filters.student_id) params.set('student_id', String(filters.student_id));
  if (filters.unit_id) params.set('unit_id', String(filters.unit_id));
  return fetchApi(`/other-awards?${params}`);
};

export const saveOtherAward = (data: any) =>
  isElectron ? invoke('other-awards:save', data) : fetchApi('/other-awards', { method: 'POST', body: JSON.stringify(data) });

export const deleteOtherAward = (id: number) =>
  isElectron ? invoke('other-awards:delete', id) : fetchApi(`/other-awards/${id}`, { method: 'DELETE' });

export const saveAward = (data: any) =>
  isElectron
    ? (window as any).electronAPI.invoke('awards:save', data)
    : fetchApi('/awards', { method: 'POST', body: JSON.stringify(data) });

export const deleteAward = (id: number) =>
  isElectron
    ? (window as any).electronAPI.invoke('awards:delete', id)
    : fetchApi(`/awards/${id}`, { method: 'DELETE' });

// ============ Party Members ============
export const getPartyMembers = (filters: { unit_id?: number; search?: string; status?: 'official' | 'pending' }) => {
  if (isElectron) return invoke('party:get', filters);
  const params = new URLSearchParams();
  if (filters.unit_id) params.set('unit_id', String(filters.unit_id));
  if (filters.search) params.set('search', filters.search);
  if (filters.status) params.set('status', filters.status);
  return fetchApi(`/party?${params}`);
};

export const createPartyMember = (data: any) =>
  isElectron ? invoke('party:create', data) : fetchApi('/party', { method: 'POST', body: JSON.stringify(data) });

export const updatePartyMember = (data: any) =>
  isElectron ? invoke('party:update', data) : fetchApi(`/party/${data.id}`, { method: 'PUT', body: JSON.stringify(data) });

export const deletePartyMember = (id: number) =>
  isElectron ? invoke('party:delete', id) : fetchApi(`/party/${id}`, { method: 'DELETE' });

export const countUnofficialParty = (): Promise<{ count: number }> =>
  isElectron ? invoke('party:count-unofficial') : fetchApi('/party/count-unofficial');
