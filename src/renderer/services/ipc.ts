import { IPC } from '../../shared/types';
import type { DbConfig } from '../../shared/types';

declare global {
  interface Window {
    electronAPI: {
      invoke: (channel: string, ...args: any[]) => Promise<any>;
    };
  }
}

const api = () => window.electronAPI;

// ============ Config ============
export const getDbConfig = (): Promise<DbConfig> => api().invoke(IPC.GET_CONFIG);
export const setDbConfig = (config: DbConfig) => api().invoke(IPC.SET_CONFIG, config);
export const testConnection = (config: DbConfig) => api().invoke(IPC.TEST_CONNECTION, config);
export const initDatabase = (config: DbConfig) => api().invoke(IPC.DB_INIT, config);

// ============ Units ============
export const getUnits = () => api().invoke(IPC.UNITS_GET_ALL);
export const createUnit = (data: { name: string; type: string; parent_id: number | null }) =>
  api().invoke(IPC.UNITS_CREATE, data);
export const updateUnit = (data: { id: number; name: string }) => api().invoke(IPC.UNITS_UPDATE, data);
export const deleteUnit = (id: number) => api().invoke(IPC.UNITS_DELETE, id);

// ============ Students ============
export const getStudents = (filters: { unit_id?: number; search?: string; page?: number; pageSize?: number }) =>
  api().invoke(IPC.STUDENTS_GET, filters);
export const createStudent = (data: any) => api().invoke(IPC.STUDENTS_CREATE, data);
export const updateStudent = (data: any) => api().invoke(IPC.STUDENTS_UPDATE, data);
export const deleteStudent = (id: number) => api().invoke(IPC.STUDENTS_DELETE, id);

// ============ Academic Scores ============
export const getAcademicScores = (filters: { student_id?: number; unit_id?: number; nam_hoc?: number; hoc_ky?: number }) =>
  api().invoke(IPC.SCORES_ACADEMIC_GET, filters);
export const saveAcademicScores = (scores: any[]) => api().invoke(IPC.SCORES_ACADEMIC_SAVE, scores);

// ============ Discipline Scores ============
export const getDisciplineScores = (filters: { student_id?: number; unit_id?: number; nam_hoc?: number; thang?: number }) =>
  api().invoke(IPC.SCORES_DISCIPLINE_GET, filters);
export const saveDisciplineScores = (scores: any[]) => api().invoke(IPC.SCORES_DISCIPLINE_SAVE, scores);

// ============ Absences ============
export const getAbsences = (filters: { student_id?: number; unit_id?: number }) =>
  api().invoke(IPC.ABSENCES_GET, filters);
export const createAbsence = (data: { student_id: number; ngay_vang: string; ghi_chu?: string }) =>
  api().invoke(IPC.ABSENCES_CREATE, data);
export const deleteAbsence = (id: number) => api().invoke(IPC.ABSENCES_DELETE, id);

// ============ Violations ============
export const getViolations = (filters: { student_id?: number; unit_id?: number }) =>
  api().invoke(IPC.VIOLATIONS_GET, filters);
export const createViolation = (data: { student_id: number; loai: string; ngay: string; ly_do?: string }) =>
  api().invoke(IPC.VIOLATIONS_CREATE, data);
export const deleteViolation = (id: number) => api().invoke(IPC.VIOLATIONS_DELETE, id);

// ============ Awards ============
export const getAwards = (filters: { student_id?: number; unit_id?: number }) =>
  api().invoke(IPC.AWARDS_GET, filters);
export const saveAward = (data: any) => api().invoke(IPC.AWARDS_SAVE, data);
