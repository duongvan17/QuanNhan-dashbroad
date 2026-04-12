import type { DbConfig } from '../../shared/types';

const API_BASE = '/api';

const isElectron = !!(window as any).electronAPI;

// ============ HTTP fetch helper ============
async function fetchApi<T = any>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

// ============ Config ============
export const getDbConfig = (): Promise<DbConfig> =>
  isElectron ? (window as any).electronAPI.invoke('config:get') : fetchApi('/config');

export const setDbConfig = (config: DbConfig) =>
  isElectron
    ? (window as any).electronAPI.invoke('config:set', config)
    : fetchApi('/config', { method: 'POST', body: JSON.stringify(config) });

export const testConnection = (config: DbConfig) =>
  isElectron
    ? (window as any).electronAPI.invoke('db:test-connection', config)
    : fetchApi('/test-connection', { method: 'POST', body: JSON.stringify(config) });

export const initDatabase = (config: DbConfig) =>
  isElectron
    ? (window as any).electronAPI.invoke('db:init', config)
    : fetchApi('/init-db', { method: 'POST', body: JSON.stringify(config) });

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
export const getAbsences = (filters: { student_id?: number; unit_id?: number }) => {
  if (isElectron) return (window as any).electronAPI.invoke('absences:get', filters);
  const params = new URLSearchParams();
  if (filters.student_id) params.set('student_id', String(filters.student_id));
  if (filters.unit_id) params.set('unit_id', String(filters.unit_id));
  return fetchApi(`/absences?${params}`);
};

export const createAbsence = (data: { student_id: number; ngay_vang: string; ghi_chu?: string }) =>
  isElectron
    ? (window as any).electronAPI.invoke('absences:create', data)
    : fetchApi('/absences', { method: 'POST', body: JSON.stringify(data) });

export const deleteAbsence = (id: number) =>
  isElectron
    ? (window as any).electronAPI.invoke('absences:delete', id)
    : fetchApi(`/absences/${id}`, { method: 'DELETE' });

// ============ Violations ============
export const getViolations = (filters: { student_id?: number; unit_id?: number }) => {
  if (isElectron) return (window as any).electronAPI.invoke('violations:get', filters);
  const params = new URLSearchParams();
  if (filters.student_id) params.set('student_id', String(filters.student_id));
  if (filters.unit_id) params.set('unit_id', String(filters.unit_id));
  return fetchApi(`/violations?${params}`);
};

export const createViolation = (data: { student_id: number; loai: string; ngay: string; ly_do?: string }) =>
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

export const saveAward = (data: any) =>
  isElectron
    ? (window as any).electronAPI.invoke('awards:save', data)
    : fetchApi('/awards', { method: 'POST', body: JSON.stringify(data) });

export const deleteAward = (id: number) =>
  isElectron
    ? (window as any).electronAPI.invoke('awards:delete', id)
    : fetchApi(`/awards/${id}`, { method: 'DELETE' });
