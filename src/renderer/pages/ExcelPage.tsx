import React, { useState } from 'react';
import {
  Card, Button, Upload, Table, Space, Typography, Tabs, Select, App,
  Alert, Cascader, Divider, Row, Col, Tag,
} from 'antd';
import {
  DownloadOutlined, FileExcelOutlined,
  InboxOutlined, FileAddOutlined, SaveOutlined,
} from '@ant-design/icons';
import {
  getStudents, createStudent, getUnits, getAbsences, getAcademicScores, getDisciplineScores, getAwards,
  saveAcademicScores, saveDisciplineScores, createAbsence, createViolation, saveAward,
  createUnit,
} from '../services/api';
import { useAuth } from '../auth/AuthContext';
import type { Unit } from '../../shared/types';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Dragger } = Upload;

// ============ Helper: style cho header Excel ============
const headerStyle = (cell: any) => {
  cell.font = { bold: true, size: 12, color: { argb: 'FF1F2937' } };
  cell.fill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFD9E1F2' } };
  cell.border = {
    top: { style: 'thin' as const }, bottom: { style: 'thin' as const },
    left: { style: 'thin' as const }, right: { style: 'thin' as const },
  };
  cell.alignment = { horizontal: 'center' as const, vertical: 'middle' as const };
};

const cellBorder = (cell: any) => {
  cell.border = {
    top: { style: 'thin' as const }, bottom: { style: 'thin' as const },
    left: { style: 'thin' as const }, right: { style: 'thin' as const },
  };
};

const titleStyle = (cell: any) => {
  cell.font = { bold: true, size: 16, color: { argb: 'FF1F2937' } };
  cell.alignment = { horizontal: 'center' as const };
};

// ============ Helper: download workbook ============
const downloadWorkbook = async (workbook: any, filename: string) => {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const getCellString = (val: any): string => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'object') {
    if (val.text) return String(val.text);
    if (val.richText) {
      return val.richText.map((rt: any) => rt.text || '').join('');
    }
    if (val.result !== undefined) {
      return getCellString(val.result);
    }
    return '';
  }
  return String(val);
};

const detectSheetUnit = (worksheet: any) => {
  let tieuDoan = '';
  let daiDoi = '';
  let trungDoi = '';
  let tieuDoi = '';

  const parseUnitNames = (text: string) => {
    let td = '';
    let dd = '';
    let trd = '';
    let ti = '';

    const segments = text.split(/[\n\-;]/);
    for (let segment of segments) {
      segment = segment.trim();
      if (!segment) continue;

      // Detect Trung Doi: "TRUNG ĐỘI 1 (CT)" or "TĐ 1"
      const trdMatch = segment.match(/(?:TRUNG\s+ĐỘI|TĐỘI|T\.ĐỘI|TĐ)\s*([a-zA-Z0-9_\/\(\)\s\-+*]+)/i);
      if (trdMatch) {
        trd = 'Trung đội ' + trdMatch[1].trim().replace(/\s+/g, ' ');
        continue;
      }

      // Detect Dai Doi: "ĐẠI ĐỘI 1" or "ĐĐ 1" or "C1"
      const ddMatch = segment.match(/(?:ĐẠI\s+ĐỘI|ĐĐỘI|Đ\.ĐỘI|ĐĐ|C)\s*([a-zA-Z0-9_\/\(\)\s\-+*]+)/i);
      if (ddMatch) {
        dd = 'Đại đội ' + ddMatch[1].trim().replace(/\s+/g, ' ');
        continue;
      }

      // Detect Tieu Doan: "TIỂU ĐOÀN 1" or "TĐOÀN 1" or "D1"
      const tdMatch = segment.match(/(?:TIỂU\s+ĐOÀN|TĐOÀN|T\.ĐOÀN|D)\s*([a-zA-Z0-9_\/\(\)\s\-+*]+)/i);
      if (tdMatch) {
        td = 'Tiểu đoàn ' + tdMatch[1].trim().replace(/\s+/g, ' ');
        continue;
      }

      // Detect Tieu Doi: "TIỂU ĐỘI 1" or "TỔ 1"
      const tiMatch = segment.match(/(?:TIỂU\s+ĐỘI|TỔ)\s*([a-zA-Z0-9_\/\(\)\s\-+*]+)/i);
      if (tiMatch) {
        ti = 'Tiểu đội ' + tiMatch[1].trim().replace(/\s+/g, ' ');
        continue;
      }
    }
    return { tieuDoan: td, daiDoi: dd, trungDoi: trd, tieuDoi: ti };
  };

  for (let r = 1; r <= 8; r++) {
    const row = worksheet.getRow(r);
    if (!row) continue;
    for (let c = 1; c <= 15; c++) {
      const cell = row.getCell(c);
      const val = getCellString(cell.value);
      if (val) {
        const parsed = parseUnitNames(val);
        if (parsed.tieuDoan && !tieuDoan) tieuDoan = parsed.tieuDoan;
        if (parsed.daiDoi && !daiDoi) daiDoi = parsed.daiDoi;
        if (parsed.trungDoi && !trungDoi) trungDoi = parsed.trungDoi;
        if (parsed.tieuDoi && !tieuDoi) tieuDoi = parsed.tieuDoi;
      }
    }
  }

  return { tieuDoan, daiDoi, trungDoi, tieuDoi };
};

const detectSheetMonth = (worksheet: any): number => {
  for (let r = 1; r <= 8; r++) {
    const row = worksheet.getRow(r);
    if (!row) continue;
    for (let c = 1; c <= 15; c++) {
      const val = getCellString(row.getCell(c).value);
      if (val) {
        const mMatch = val.match(/tháng\s*(\d+)/i);
        if (mMatch) return Number(mMatch[1]);
      }
    }
  }
  return 1;
};

const detectSheetNamHoc = (worksheet: any): number | undefined => {
  for (let r = 1; r <= 15; r++) {
    const row = worksheet.getRow(r);
    if (!row) continue;
    for (let c = 1; c <= 15; c++) {
      const val = getCellString(row.getCell(c).value).toLowerCase();
      if (val.includes('năm nhất') || val.includes('năm 1') || val.includes('năm thứ nhất') || val.includes('năm_nhất')) return 1;
      if (val.includes('năm hai') || val.includes('năm 2') || val.includes('năm thứ hai') || val.includes('năm_hai')) return 2;
      if (val.includes('năm ba') || val.includes('năm 3') || val.includes('năm thứ ba') || val.includes('năm_ba')) return 3;
      if (val.includes('năm bốn') || val.includes('năm 4') || val.includes('năm thứ tư') || val.includes('năm thứ bốn') || val.includes('năm_bốn')) return 4;
    }
  }
  return undefined;
};

const detectSheetHocKy = (worksheet: any): number | undefined => {
  for (let r = 1; r <= 15; r++) {
    const row = worksheet.getRow(r);
    if (!row) continue;
    for (let c = 1; c <= 15; c++) {
      const val = getCellString(row.getCell(c).value).toLowerCase();
      if (val.includes('học kỳ i') || val.includes('học kỳ 1') || val.includes('hk i') || val.includes('hk 1') || val.includes('học_kỳ_1') || val.includes('học kỳ lẻ')) return 1;
      if (val.includes('học kỳ ii') || val.includes('học kỳ 2') || val.includes('hk ii') || val.includes('hk 2') || val.includes('học_kỳ_2') || val.includes('học kỳ chẵn')) return 2;
    }
  }
  return undefined;
};

// ============ Template definitions ============
const templates = [
  {
    key: 'students',
    title: 'Thông tin Học viên',
    desc: 'Họ tên, hình ảnh, ngày sinh, CCCD, ngày cấp, nơi cấp, BHYT, cấp bậc, quê quán, thông tin bố mẹ',
    color: '#1677ff',
    headers: ['STT', 'Họ và tên', 'Hình ảnh', 'Ngày sinh', 'CCCD', 'CCCD Ngày cấp', 'CCCD Nơi cấp', 'BHYT', 'Cấp bậc', 'Chức vụ', 'Quê quán', 'Địa chỉ thường trú',
      'Họ tên bố', 'Nghề nghiệp', 'Ngày sinh', 'Nơi ở hiện nay',
      'Họ tên mẹ', 'Nghề nghiệp', 'Ngày sinh', 'Nơi ở hiện nay'],
    sheetTitle: 'THÔNG TIN HỌC VIÊN',
    sheetName: 'Thông tin học viên',
    sampleRows: [],
    widths: [6, 20, 10, 12, 14, 15, 18, 14, 10, 10, 14, 18, 16, 14, 12, 16, 16, 14, 12, 16],
  },
  {
    key: 'academic',
    title: 'Điểm học tập',
    desc: 'Điểm theo môn, tín chỉ, năm/học kỳ, trung bình, xếp loại',
    color: '#52c41a',
    headers: [],
    sheetTitle: 'ĐIỂM HỌC TẬP CỦA HỌC VIÊN',
    sheetName: 'Điểm học tập',
    sampleRows: [],
    widths: [],
    custom: true,
  },
  {
    key: 'discipline',
    title: 'Điểm rèn luyện',
    desc: 'Điểm 4 tuần, điểm tháng, xếp loại',
    color: '#faad14',
    headers: ['STT', 'Họ và tên', 'Cấp bậc', 'Chức vụ', 'Tuần 01', 'Tuần 02', 'Tuần 03', 'Tuần 04', 'Tuần 05', 'Tháng 01', 'Xếp loại'],
    sheetTitle: 'ĐIỂM RÈN LUYỆN HỌC VIÊN',
    sheetName: 'Điểm rèn luyện',
    extraRows: [['NĂM NHẤT']],
    sampleRows: [],
    widths: [6, 24, 12, 12, 10, 10, 10, 10, 10, 12, 12],
  },
  {
    key: 'absences',
    title: 'Công vắng & Vi phạm',
    desc: 'Ngày vắng, tổng công, khiển trách, cảnh cáo, kỷ luật',
    color: '#ff4d4f',
    headers: ['STT', 'Họ và tên', 'Công vắng', 'Tổng công', 'Vi phạm ', 'Khiển trách', 'Cảnh Cáo', 'Kỷ luật'],
    sheetTitle: 'CÔNG VẮNG VÀ VI PHẠM CỦA HỌC VIÊN',
    sheetName: 'Công vắng và vi phạm',
    extraRows: [['NĂM NHẤT']],
    sampleRows: [],
    widths: [6, 24, 18, 12, 12, 28, 28, 28],
  },
  {
    key: 'awards',
    title: 'Thi đua khen thưởng',
    desc: 'Điểm từng năm, tổng kết, xếp loại (Giỏi/Khá/TB)',
    color: '#eb2f96',
    headers: ['STT', 'Họ và tên', 'Cấp bậc', 'Chức vụ', 'Điểm năm nhất', 'Điểm năm hai', 'Điểm năm ba', 'Điểm năm bốn', 'Tổng kết', 'Xếp loại'],
    sheetTitle: 'XÉT LOẠI THI ĐUA KHEN THƯỞNG',
    sheetName: 'Xếp loại thi đua khen thưởng',
    sampleRows: [],
    widths: [6, 24, 12, 12, 14, 14, 14, 14, 12, 14],
  },
];

const ExcelPage: React.FC = () => {
  const { message } = App.useApp();
  const { isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState('template');
  const [units, setUnits] = useState<Unit[]>([]);
  const [exportType, setExportType] = useState('students');
  const [exportUnitId, setExportUnitId] = useState<number | undefined>();
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importUnitId, setImportUnitId] = useState<number | undefined>();
  const [importNamHoc, setImportNamHoc] = useState<number>(1);
  const [importHocKy, setImportHocKy] = useState<number>(1);
  const [importResult, setImportResult] = useState<{ success: number; failed: number; details: string[] } | null>(null);
  const [importSheets, setImportSheets] = useState<{
    name: string;
    headers: string[];
    data: any[];
    columns: any[];
    detectedUnit?: { tieuDoan?: string; daiDoi?: string; trungDoi?: string; tieuDoi?: string };
    detectedMonth?: number;
    detectedNamHoc?: number;
    detectedHocKy?: number;
    credits?: { [colName: string]: number };
  }[]>([]);
  const [activeImportSheet, setActiveImportSheet] = useState('0');

  React.useEffect(() => { loadUnits(); }, []);

  const loadUnits = async () => {
    try { setUnits(await getUnits()); } catch { /* */ }
  };

  const buildCascaderOptions = () => {
    const tieuDoans = units.filter((u) => u.type === 'tieu_doan');
    return tieuDoans.map((td) => {
      const daiDois = units.filter((u) => u.type === 'dai_doi' && u.parent_id === td.id);
      return {
        value: td.id, label: td.name,
        children: daiDois.map((dd) => {
          const trungDois = units.filter((u) => u.type === 'trung_doi' && u.parent_id === dd.id);
          return {
            value: dd.id, label: dd.name,
            children: trungDois.map((trd) => {
              const tieuDois = units.filter((u) => u.type === 'tieu_doi' && u.parent_id === trd.id);
              return {
                value: trd.id, label: trd.name,
                children: tieuDois.length > 0 ? tieuDois.map((ti) => ({ value: ti.id, label: ti.name })) : undefined,
              };
            }),
          };
        }),
      };
    });
  };

  // ========== Build 1 sheet theo format gốc ==========
  const buildSheet = (ws: any, template: typeof templates[0], ExcelJS: any) => {
    const colCount = template.headers.length || 17;

    // Row 1: Title
    ws.mergeCells(1, 1, 1, colCount);
    const tc = ws.getCell('A1');
    tc.value = template.sheetTitle;
    titleStyle(tc);

    // Row 2-4: Empty (match gốc)
    ws.addRow([]);
    ws.addRow([]);
    ws.addRow([]);

    // Row 5-7: Đơn vị
    ws.mergeCells(5, 1, 5, colCount);
    ws.getCell('A5').value = 'TIỂU ĐOÀN 1';
    ws.getCell('A5').font = { bold: true, size: 12 };
    ws.mergeCells(6, 1, 6, colCount);
    ws.getCell('A6').value = 'ĐẠI ĐỘI 2';
    ws.getCell('A6').font = { bold: true, size: 12 };
    ws.mergeCells(7, 1, 7, colCount);
    ws.getCell('A7').value = 'TRUNG ĐỘI 1';
    ws.getCell('A7').font = { bold: true, size: 12 };

    // Extra rows (NĂM NHẤT, etc.)
    const extra = (template as any).extraRows as string[][] | undefined;
    if (extra) {
      extra.forEach((row: string[]) => {
        const r = ws.addRow(row);
        r.getCell(1).font = { bold: true, size: 12 };
        ws.mergeCells(r.number, 1, r.number, colCount);
      });
    }

    // Header row
    const hr = ws.addRow(template.headers);
    hr.height = 32;
    hr.eachCell((cell: any) => {
      headerStyle(cell);
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    });

    // Empty rows (no sample data)
    for (let i = 0; i < 30; i++) {
      const r = ws.addRow(template.headers.map((_: any, idx: number) => idx === 0 ? i + 1 : ''));
      r.eachCell((cell: any) => cellBorder(cell));
    }

    // Column widths
    template.widths.forEach((w: number, i: number) => {
      ws.getColumn(i + 1).width = w;
    });
  };

  // ========== Build sheet Điểm học tập (format đặc biệt theo gốc) ==========
  const buildAcademicSheet = (ws: any) => {
    const colCount = 17;

    // Title
    ws.mergeCells(1, 1, 1, colCount);
    ws.getCell('A1').value = 'ĐIỂM HỌC TẬP CỦA HỌC VIÊN';
    titleStyle(ws.getCell('A1'));

    // Empty rows
    ws.addRow([]); ws.addRow([]); ws.addRow([]);

    // Đơn vị
    ws.mergeCells(5, 1, 5, colCount);
    ws.getCell('A5').value = 'TIỂU ĐOÀN 1';
    ws.getCell('A5').font = { bold: true, size: 12 };
    ws.mergeCells(6, 1, 6, colCount);
    ws.getCell('A6').value = 'ĐẠI ĐỘI 2';
    ws.getCell('A6').font = { bold: true, size: 12 };
    ws.mergeCells(7, 1, 7, colCount);
    ws.getCell('A7').value = 'TRUNG ĐỘI 1';
    ws.getCell('A7').font = { bold: true, size: 12 };

    // Empty rows
    ws.addRow([]); ws.addRow([]);

    // NĂM NHẤT
    ws.mergeCells(10, 1, 10, colCount);
    ws.getCell('A10').value = 'NĂM NHẤT';
    ws.getCell('A10').font = { bold: true, size: 12 };

    // HỌC KỲ I
    ws.mergeCells(11, 1, 11, colCount);
    ws.getCell('A11').value = 'HỌC KỲ I';
    ws.getCell('A11').font = { bold: true, size: 12 };

    // Sub-header row: MÔN HỌC, HC, ..., Trung bình, Xếp loại
    const subHeaders: any[] = new Array(colCount).fill(null);
    subHeaders[2] = 'MÔN HỌC';
    subHeaders[3] = 'HC';
    subHeaders[11] = 'Trung bình';
    subHeaders[12] = 'Xếp loại';
    const shr = ws.addRow(subHeaders);
    shr.eachCell((cell: any, colNumber: number) => {
      if (cell.value) headerStyle(cell);
    });

    // Header row: STT, Họ và tên, (8 cột tên môn - sửa thành tên thật rồi mới import),
    // Trung bình, Xếp loại. Format tên môn: "Toán cao cấp (3tc)" để parse được tín chỉ.
    const mainHeaders: any[] = new Array(colCount).fill(null);
    mainHeaders[0] = 'STT';
    mainHeaders[1] = 'Họ và tên';
    for (let i = 2; i < 10; i++) mainHeaders[i] = `Tên môn ${i - 1} (1tc)`;
    mainHeaders[10] = 'Trung bình';
    mainHeaders[11] = 'Xếp loại';
    const mhr = ws.addRow(mainHeaders);
    mhr.height = 32;
    mhr.eachCell((cell: any) => {
      headerStyle(cell);
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    });

    // Note row
    const noteR = ws.addRow(['', 'CHÚ Ý: Sửa "Tên môn N (1tc)" thành tên môn thật + tín chỉ (vd "Toán cao cấp (3tc)") trước khi import']);
    ws.mergeCells(noteR.number, 2, noteR.number, colCount);
    noteR.getCell(2).font = { italic: true, color: { argb: 'FF888888' }, size: 11 };

    // Empty rows
    for (let i = 0; i < 30; i++) {
      const row = new Array(colCount).fill('');
      row[0] = i + 1;
      const r = ws.addRow(row);
      r.eachCell((cell: any) => cellBorder(cell));
    }

    // Column widths
    ws.getColumn(1).width = 8;
    ws.getColumn(2).width = 28;
    for (let i = 3; i <= 10; i++) ws.getColumn(i).width = 14;
    ws.getColumn(11).width = 12;
    ws.getColumn(12).width = 12;
    for (let i = 13; i <= 17; i++) ws.getColumn(i).width = 10;
  };

  // ========== DOWNLOAD TEMPLATE ==========
  const handleDownloadTemplate = async (template: typeof templates[0]) => {
    try {
      const ExcelJS = await import('exceljs');
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Quản Lý Quân Nhân';

      const ws = workbook.addWorksheet(template.sheetName);

      if ((template as any).custom) {
        buildAcademicSheet(ws);
      } else {
        buildSheet(ws, template, ExcelJS);
      }

      await downloadWorkbook(workbook, `template_${template.key}.xlsx`);
      message.success(`Đã tải template "${template.title}"`);
    } catch (err: any) {
      message.error('Lỗi: ' + err.message);
    }
  };

  // ========== DOWNLOAD ALL TEMPLATES ==========
  const handleDownloadAllTemplates = async () => {
    try {
      const ExcelJS = await import('exceljs');
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Quản Lý Quân Nhân';

      for (const template of templates) {
        const ws = workbook.addWorksheet(template.sheetName);
        if ((template as any).custom) {
          buildAcademicSheet(ws);
        } else {
          buildSheet(ws, template, ExcelJS);
        }
      }

      await downloadWorkbook(workbook, 'template_tat_ca.xlsx');
      message.success('Đã tải template tất cả (5 sheets)');
    } catch (err: any) {
      message.error('Lỗi: ' + err.message);
    }
  };

  // ========== Helper: convert ngày DD/MM/YYYY → YYYY-MM-DD ==========
  const parseDate = (val: any): string | null => {
    if (!val) return null;
    const s = String(val).trim();
    if (!s) return null;
    // Nếu đã là YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    // DD/MM/YYYY
    const match = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
    if (match) return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
    // Date object
    try {
      const d = new Date(s);
      if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    } catch { /* */ }
    return null;
  };

  // ========== IMPORT ALL SHEETS TO DB ==========
  const handleImportToDB = async () => {
    if (importSheets.length === 0) {
      message.error('Không có dữ liệu để import!');
      return;
    }

    // Check if we can resolve a unit for all sheets
    for (const sheet of importSheets) {
      const du = sheet.detectedUnit;
      const hasDetected = du && (du.trungDoi || du.daiDoi || du.tieuDoan);
      if (!hasDetected && !importUnitId) {
        message.error(`Sheet "${sheet.name}" không chứa thông tin đơn vị và bạn chưa chọn đơn vị dự phòng!`);
        return;
      }
    }

    setImporting(true);
    setImportResult(null);
    let success = 0;
    let failed = 0;
    const details: string[] = [];

    // Load the current units from DB (to make sure we have the latest)
    let currentUnits = [...units];
    try {
      currentUnits = await getUnits();
      setUnits(currentUnits);
    } catch { /* */ }

    // Helper to find or create unit path
    const findOrCreateUnitPath = async (
      tieuDoanName?: string,
      daiDoiName?: string,
      trungDoiName?: string,
      tieuDoiName?: string,
      fallbackUnitId?: number
    ): Promise<number | undefined> => {
      if (!tieuDoiName && !trungDoiName && !daiDoiName && !tieuDoanName) {
        return fallbackUnitId;
      }

      const cleanStr = (s: string) => s.toLowerCase().replace(/\s+/g, '');

      const findUnit = (name: string, type: 'tieu_doan' | 'dai_doi' | 'trung_doi' | 'tieu_doi', parentId: number | null) => {
        return currentUnits.find(
          (u: any) =>
            u.type === type &&
            cleanStr(u.name) === cleanStr(name) &&
            (parentId === null || u.parent_id === parentId)
        );
      };

      // 1. Resolve tieuDoan
      let parentId: number | null = null;
      if (tieuDoanName) {
        let td = currentUnits.find((u: any) => u.type === 'tieu_doan' && cleanStr(u.name) === cleanStr(tieuDoanName));
        if (!td) {
          try {
            const res = await createUnit({ name: tieuDoanName, type: 'tieu_doan', parent_id: null });
            td = { id: res.id, name: tieuDoanName, type: 'tieu_doan', parent_id: null };
            currentUnits.push(td);
          } catch (e: any) {
            console.error('Failed to create tieu_doan unit', e);
          }
        }
        if (td) parentId = td.id;
      }

      // 2. Resolve daiDoi
      if (daiDoiName) {
        if (parentId === null && fallbackUnitId) {
          const fallbackUnit = currentUnits.find((u: any) => u.id === fallbackUnitId);
          if (fallbackUnit) {
            if (fallbackUnit.type === 'tieu_doan') {
              parentId = fallbackUnit.id;
            } else if (fallbackUnit.type === 'dai_doi') {
              parentId = fallbackUnit.parent_id;
            } else if (fallbackUnit.type === 'trung_doi') {
              const p = currentUnits.find((u: any) => u.id === fallbackUnit.parent_id);
              parentId = p ? p.parent_id : null;
            } else if (fallbackUnit.type === 'tieu_doi') {
              const trd = currentUnits.find((u: any) => u.id === fallbackUnit.parent_id);
              const p = trd ? currentUnits.find((u: any) => u.id === trd.parent_id) : null;
              parentId = p ? p.parent_id : null;
            }
          }
        }

        let dd = findUnit(daiDoiName, 'dai_doi', parentId);
        if (!dd && parentId === null) {
          dd = currentUnits.find((u: any) => u.type === 'dai_doi' && cleanStr(u.name) === cleanStr(daiDoiName));
        }

        if (!dd) {
          try {
            const res = await createUnit({ name: daiDoiName, type: 'dai_doi', parent_id: parentId });
            dd = { id: res.id, name: daiDoiName, type: 'dai_doi', parent_id: parentId };
            currentUnits.push(dd);
          } catch (e: any) {
            console.error('Failed to create dai_doi unit', e);
          }
        }
        if (dd) parentId = dd.id;
      }

      // 3. Resolve trungDoi
      if (trungDoiName) {
        if (parentId === null && fallbackUnitId) {
          const fallbackUnit = currentUnits.find((u: any) => u.id === fallbackUnitId);
          if (fallbackUnit) {
            if (fallbackUnit.type === 'dai_doi') {
              parentId = fallbackUnit.id;
            } else if (fallbackUnit.type === 'trung_doi') {
              parentId = fallbackUnit.parent_id;
            } else if (fallbackUnit.type === 'tieu_doi') {
              parentId = fallbackUnit.parent_id;
            }
          }
        }

        let trd = findUnit(trungDoiName, 'trung_doi', parentId);
        if (!trd && parentId === null) {
          trd = currentUnits.find((u: any) => u.type === 'trung_doi' && cleanStr(u.name) === cleanStr(trungDoiName));
        }

        if (!trd) {
          try {
            const res = await createUnit({ name: trungDoiName, type: 'trung_doi', parent_id: parentId });
            trd = { id: res.id, name: trungDoiName, type: 'trung_doi', parent_id: parentId };
            currentUnits.push(trd);
          } catch (e: any) {
            console.error('Failed to create trung_doi unit', e);
          }
        }
        if (trd) parentId = trd.id;
      }

      // 4. Resolve tieuDoi
      if (tieuDoiName) {
        if (parentId === null && fallbackUnitId) {
          const fallbackUnit = currentUnits.find((u: any) => u.id === fallbackUnitId);
          if (fallbackUnit && fallbackUnit.type === 'trung_doi') {
            parentId = fallbackUnit.id;
          }
        }

        let ti = findUnit(tieuDoiName, 'tieu_doi', parentId);
        if (!ti && parentId === null) {
          ti = currentUnits.find((u: any) => u.type === 'tieu_doi' && cleanStr(u.name) === cleanStr(tieuDoiName));
        }

        if (!ti) {
          try {
            const res = await createUnit({ name: tieuDoiName, type: 'tieu_doi', parent_id: parentId });
            ti = { id: res.id, name: tieuDoiName, type: 'tieu_doi', parent_id: parentId };
            currentUnits.push(ti);
          } catch (e: any) {
            console.error('Failed to create tieu_doi unit', e);
          }
        }
        if (ti) return ti.id;
      }

      return parentId || fallbackUnitId;
    };

    // Lấy toàn bộ danh sách học viên đã có trong DB (để map tên → id trên toàn hệ thống)
    let existingStudents: any[] = [];
    try {
      const res = await getStudents({ pageSize: 100000 });
      existingStudents = res.data;
    } catch { /* */ }

    const findStudentId = (name: string, targetUnitId: number) => {
      const clean = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
      const targetName = clean(name);
      const s = existingStudents.find((st: any) => clean(st.ho_ten) === targetName && st.unit_id === targetUnitId);
      return s?.id;
    };

    const str = (val: any) => val ? String(val).trim() : null;

    for (const sheet of importSheets) {
      const h = sheet.headers;
      const sn = sheet.name.toLowerCase();

      // Nhận diện đơn vị của sheet và tìm/tạo trong CSDL
      const du = sheet.detectedUnit;
      const targetUnitId = (await findOrCreateUnitPath(
        du?.tieuDoan,
        du?.daiDoi,
        du?.trungDoi,
        du?.tieuDoi,
        importUnitId
      )) || importUnitId;

      const targetNamHoc = sheet.detectedNamHoc || importNamHoc;
      const targetHocKy = sheet.detectedHocKy || importHocKy;

      // ====== Sheet: Thông tin học viên ======
      if (sn.includes('thông tin') || sn.includes('học viên')) {
        const nameCol = h.find((c) => c.toLowerCase().includes('họ và tên'));
        if (!nameCol) continue;
        const dobCol = h.find((c) => c.toLowerCase().includes('ngày sinh') || c.toLowerCase().includes('ngày/'));
        const cccdCol = h.find((c) => c.toLowerCase().includes('cccd'));
        const cccdNgayCapCol = h.find((c) => c.toLowerCase().includes('ngày cấp') || c.toLowerCase().includes('ngay_cap') || c.toLowerCase().includes('ngaycap'));
        const cccdNoiCapCol = h.find((c) => c.toLowerCase().includes('nơi cấp') || c.toLowerCase().includes('noi_cap') || c.toLowerCase().includes('noicap'));
        const bhytCol = h.find((c) => c.toLowerCase().includes('bhyt') || c.toLowerCase().includes('bảo hiểm'));
        const capBacCol = h.find((c) => c.toLowerCase().includes('cấp bậc'));
        const chucVuCol = h.find((c) => c.toLowerCase().includes('chức vụ'));
        const queQuanCol = h.find((c) => c.toLowerCase().includes('quê quán'));
        const diaChiCol = h.find((c) => c.toLowerCase().includes('địa chỉ'));
        const boIdx = h.findIndex((c) => c.toLowerCase().includes('họ tên bố'));
        const meIdx = h.findIndex((c) => c.toLowerCase().includes('họ tên mẹ'));

        let sheetOk = 0;
        for (const row of sheet.data) {
          const hoTen = str(row[nameCol]);
          if (!hoTen) continue;
          try {
            const res = await createStudent({
              unit_id: targetUnitId,
              ho_ten: hoTen,
              ngay_sinh: parseDate(row[dobCol!]),
              cccd: str(row[cccdCol!]),
              cccd_ngay_cap: cccdNgayCapCol ? parseDate(row[cccdNgayCapCol]) : null,
              cccd_noi_cap: cccdNoiCapCol ? str(row[cccdNoiCapCol]) : null,
              bhyt: bhytCol ? str(row[bhytCol]) : null,
              cap_bac: str(row[capBacCol!]),
              chuc_vu: str(row[chucVuCol!]),
              que_quan: str(row[queQuanCol!]),
              dia_chi_thuong_tru: str(row[diaChiCol!]),
              bo_ho_ten: boIdx >= 0 ? str(row[h[boIdx]]) : null,
              bo_nghe_nghiep: boIdx >= 0 && boIdx + 1 < meIdx ? str(row[h[boIdx + 1]]) : null,
              bo_ngay_sinh: boIdx >= 0 && boIdx + 2 < meIdx ? parseDate(row[h[boIdx + 2]]) : null,
              bo_noi_o: boIdx >= 0 && boIdx + 3 <= meIdx ? str(row[h[boIdx + 3]]) : null,
              me_ho_ten: meIdx >= 0 ? str(row[h[meIdx]]) : null,
              me_nghe_nghiep: meIdx >= 0 && meIdx + 1 < h.length ? str(row[h[meIdx + 1]]) : null,
              me_ngay_sinh: meIdx >= 0 && meIdx + 2 < h.length ? parseDate(row[h[meIdx + 2]]) : null,
              me_noi_o: meIdx >= 0 && meIdx + 3 < h.length ? str(row[h[meIdx + 3]]) : null,
            });
            existingStudents.push({ id: res.id, ho_ten: hoTen, unit_id: targetUnitId });
            sheetOk++;
            success++;
          } catch { failed++; }
        }
        details.push(`Học viên: ${sheetOk} thành công`);
        continue;
      }

      // ====== Sheet: Điểm rèn luyện ======
      if (sn.includes('rèn luyện')) {
        const nameCol = h.find((c) => c.toLowerCase().includes('họ và tên'));
        if (!nameCol) continue;
        let sheetOk = 0;
        const hasWeekly = h.some((c) => c.toLowerCase().includes('tuần'));

        if (hasWeekly) {
          // Weekly detail sheet (Mục 2)
          for (const row of sheet.data) {
            const hoTen = str(row[nameCol]);
            if (!hoTen) continue;
            const sid = findStudentId(hoTen, targetUnitId);
            if (!sid) { failed++; continue; }
            try {
              const t1Col = h.find((c) => c.toLowerCase().includes('tuần 01') || c.toLowerCase().includes('tuần 1'));
              const t2Col = h.find((c) => c.toLowerCase().includes('tuần 02') || c.toLowerCase().includes('tuần 2'));
              const t3Col = h.find((c) => c.toLowerCase().includes('tuần 03') || c.toLowerCase().includes('tuần 3'));
              const t4Col = h.find((c) => c.toLowerCase().includes('tuần 04') || c.toLowerCase().includes('tuần 4'));
              const t5Col = h.find((c) => c.toLowerCase().includes('tuần 05') || c.toLowerCase().includes('tuần 5'));
              
              const val1 = row[t1Col!] != null && row[t1Col!] !== '' ? Number(row[t1Col!]) : null;
              const val2 = row[t2Col!] != null && row[t2Col!] !== '' ? Number(row[t2Col!]) : null;
              const val3 = row[t3Col!] != null && row[t3Col!] !== '' ? Number(row[t3Col!]) : null;
              const val4 = row[t4Col!] != null && row[t4Col!] !== '' ? Number(row[t4Col!]) : null;
              const val5 = row[t5Col!] != null && row[t5Col!] !== '' ? Number(row[t5Col!]) : null;

              const vals = [val1, val2, val3, val4, val5].filter((v) => v !== null) as number[];
              const diem_thang = vals.length > 0 ? Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 100) / 100 : null;

              const getXepLoai = (avg: number | null) => {
                if (avg == null) return null;
                if (avg >= 8) return 'Giỏi';
                if (avg >= 7.2) return 'Khá';
                if (avg >= 5) return 'Trung bình';
                return 'Yếu';
              };

              const detectedMonth = sheet.detectedMonth || 1;

              await saveDisciplineScores([{
                student_id: sid,
                nam_hoc: targetNamHoc,
                thang: detectedMonth,
                tuan_1: val1,
                tuan_2: val2,
                tuan_3: val3,
                tuan_4: val4,
                tuan_5: val5,
                diem_thang,
                xep_loai: getXepLoai(diem_thang),
              }]);
              sheetOk++; success++;
            } catch { failed++; }
          }
        } else {
          // Monthly summary sheet (Mục 1)
          const monthCols = h.filter((c) => c.toLowerCase().includes('tháng'));

          for (const row of sheet.data) {
            const hoTen = str(row[nameCol]);
            if (!hoTen) continue;
            const sid = findStudentId(hoTen, targetUnitId);
            if (!sid) { failed++; continue; }

            for (const col of monthCols) {
              const val = row[col];
              if (val != null && val !== '') {
                const numVal = Number(val);
                if (!isNaN(numVal)) {
                  const mMatch = col.match(/tháng\s*(\d+)/i);
                  const thang = mMatch ? Number(mMatch[1]) : 1;

                  const getXepLoai = (avg: number | null) => {
                    if (avg == null) return null;
                    if (avg >= 8) return 'Giỏi';
                    if (avg >= 7.2) return 'Khá';
                    if (avg >= 5) return 'Trung bình';
                    return 'Yếu';
                  };

                  try {
                    await saveDisciplineScores([{
                      student_id: sid,
                      nam_hoc: targetNamHoc,
                      thang,
                      diem_thang: numVal,
                      xep_loai: getXepLoai(numVal),
                    }]);
                    sheetOk++; success++;
                  } catch { failed++; }
                }
              }
            }
          }
        }
        details.push(`Điểm rèn luyện: ${sheetOk} thành công`);
        continue;
      }

      // ====== Sheet: Điểm học tập ======
      if (sn.includes('học tập') || sn.includes('điểm học')) {
        const nameCol = h.find((c) => c.toLowerCase().includes('họ và tên'));
        if (!nameCol) continue;
        let sheetOk = 0;
        for (const row of sheet.data) {
          const hoTen = str(row[nameCol]);
          if (!hoTen) continue;
          const sid = findStudentId(hoTen, targetUnitId);
          if (!sid) { failed++; continue; }
          const scoreKeys = h.filter((k) => {
            const kl = k.toLowerCase();
            return !kl.includes('stt') && !kl.includes('họ') && !kl.includes('tín chỉ')
              && !kl.includes('trung bình') && !kl.includes('xếp loại')
              && !kl.includes('hc') && !kl.includes('môn học');
          });
          const scores = scoreKeys
            .filter((k) => row[k] != null && row[k] !== '' && !isNaN(Number(row[k])))
            .map((k) => {
              let tin_chi = 1;
              if (sheet.credits && sheet.credits[k] !== undefined) {
                tin_chi = sheet.credits[k];
              } else {
                const tcMatch = k.match(/\((\d+)\s*tc?\)/i);
                if (tcMatch) tin_chi = Number(tcMatch[1]);
              }
              const mon_hoc = k.replace(/\s*\(\d+\s*tc?\)\s*$/i, '').trim();
              return {
                student_id: sid, nam_hoc: targetNamHoc, hoc_ky: targetHocKy,
                mon_hoc, tin_chi, diem: Number(row[k]),
              };
            });
          if (scores.length > 0) {
            try {
              await saveAcademicScores(scores);
              sheetOk++; success++;
            } catch { failed++; }
          }
        }
        details.push(`Điểm học tập: ${sheetOk} thành công`);
        continue;
      }

      // ====== Sheet: Công vắng & Vi phạm ======
      if (sn.includes('công vắng') || sn.includes('vi phạm')) {
        const nameCol = h.find((c) => c.toLowerCase().includes('họ và tên'));
        if (!nameCol) continue;
        let sheetOk = 0;
        let lastStudentName = '';
        
        const ngayVangCol = h.find((c) => c.toLowerCase().includes('ngày vắng'));

        if (ngayVangCol) {
          const monVangCol = h.find((c) => c.toLowerCase().includes('môn vắng') || c.toLowerCase().includes('môn học'));
          const soTietCol = h.find((c) => c.toLowerCase().includes('tiết vắng') || c.toLowerCase().includes('số tiết'));
          const tenBaiCol = h.find((c) => c.toLowerCase().includes('tên bài') || c.toLowerCase().includes('bài học'));
          const giangVienCol = h.find((c) => c.toLowerCase().includes('giảng viên'));
          const ghiChuThiCol = h.find((c) => c.toLowerCase().includes('thi'));
          const ghiChuCol = h.find((c) => c.toLowerCase().includes('ghi chú'));

          for (const row of sheet.data) {
            const hoTen = str(row[nameCol]);
            if (!hoTen) continue;
            const sid = findStudentId(hoTen, targetUnitId);
            if (!sid) { failed++; continue; }

            const ngay = parseDate(row[ngayVangCol]);
            if (!ngay) continue;

            try {
              await createAbsence({
                student_id: sid,
                ngay_vang: ngay,
                mon_hoc: monVangCol ? str(row[monVangCol]) : null,
                so_tiet_vang: soTietCol && row[soTietCol] != null && row[soTietCol] !== '' ? Number(row[soTietCol]) : 1,
                ten_bai: tenBaiCol ? str(row[tenBaiCol]) : null,
                giang_vien: giangVienCol ? str(row[giangVienCol]) : null,
                ghi_chu_thi: ghiChuThiCol ? str(row[ghiChuThiCol]) : null,
                ghi_chu: ghiChuCol ? str(row[ghiChuCol]) : null,
                nam_hoc: targetNamHoc,
                hoc_ky: targetHocKy,
              });
              sheetOk++; success++;
            } catch { failed++; }
          }
        } else {
          for (const row of sheet.data) {
            const hoTen = str(row[nameCol]) || lastStudentName;
            if (!hoTen) continue;
            if (str(row[nameCol])) lastStudentName = hoTen;
            const sid = findStudentId(hoTen, targetUnitId);
            if (!sid) continue;

            // Công vắng
            const cvCol = h.find((c) => c.toLowerCase().includes('công vắng'));
            const cvVal = str(row[cvCol!]);
            if (cvVal && cvVal.toLowerCase().includes('ngày')) {
              try {
                const dateMatch = cvVal.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
                if (dateMatch) {
                  const ngay = `${dateMatch[3]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[1].padStart(2, '0')}`;
                  await createAbsence({
                    student_id: sid,
                    ngay_vang: ngay,
                    nam_hoc: targetNamHoc,
                    hoc_ky: targetHocKy,
                  });
                  sheetOk++; success++;
                }
              } catch { failed++; }
            }

            // Vi phạm: Khiển trách, Cảnh cáo, Kỷ luật
            const ktCol = h.find((c) => c.toLowerCase().includes('khiển trách'));
            const ccCol = h.find((c) => c.toLowerCase().includes('cảnh'));
            const klCol = h.find((c) => c.toLowerCase().includes('kỷ luật'));

            for (const [col, loai] of [[ktCol, 'khien_trach'], [ccCol, 'canh_cao'], [klCol, 'ky_luat']] as const) {
              const val = str(row[col!]);
              if (val && val.toLowerCase().includes('ngày')) {
                try {
                  const dateMatch = val.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
                  const lyDo = val.replace(/ngày\s*\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{4}/i, '').replace(/[()]/g, '').replace(/lý do:\s*/i, '').trim();
                  if (dateMatch) {
                    const ngay = `${dateMatch[3]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[1].padStart(2, '0')}`;
                    await createViolation({
                      student_id: sid,
                      loai: loai as string,
                      ngay,
                      ly_do: lyDo || undefined,
                      nam_hoc: targetNamHoc,
                      hoc_ky: targetHocKy,
                    });
                    sheetOk++; success++;
                  }
                } catch { failed++; }
              }
            }
          }
        }
        details.push(`Công vắng/Vi phạm: ${sheetOk} thành công`);
        continue;
      }

      // ====== Sheet: Thi đua khen thưởng ======
      if (sn.includes('thi đua') || sn.includes('khen thưởng') || sn.includes('xếp loại')) {
        const nameCol = h.find((c) => c.toLowerCase().includes('họ và tên'));
        if (!nameCol) continue;
        let sheetOk = 0;
        for (const row of sheet.data) {
          const hoTen = str(row[nameCol]);
          if (!hoTen) continue;
          const sid = findStudentId(hoTen, targetUnitId);
          if (!sid) { failed++; continue; }
          const n1Col = h.find((c) => c.toLowerCase().includes('năm nhất') || c.toLowerCase().includes('n1') || c.toLowerCase().includes('điểm n1'));
          const n2Col = h.find((c) => c.toLowerCase().includes('năm hai') || c.toLowerCase().includes('n2') || c.toLowerCase().includes('điểm n2'));
          const n3Col = h.find((c) => c.toLowerCase().includes('năm ba') || c.toLowerCase().includes('n3') || c.toLowerCase().includes('điểm n3'));
          const n4Col = h.find((c) => c.toLowerCase().includes('năm bốn') || c.toLowerCase().includes('n4') || c.toLowerCase().includes('điểm n4'));

          // Khen thưởng
          const kt1Col = h.find((c) => c.toLowerCase().includes('khen thưởng n1'));
          const kt2Col = h.find((c) => c.toLowerCase().includes('khen thưởng n2'));
          const kt3Col = h.find((c) => c.toLowerCase().includes('khen thưởng n3'));
          const kt4Col = h.find((c) => c.toLowerCase().includes('khen thưởng n4'));
          const ktTKCol = h.find((c) => c.toLowerCase().includes('khen thưởng tk') || c.toLowerCase().includes('toàn khóa'));

          try {
            await saveAward({
              student_id: sid,
              diem_nam_1: n1Col && row[n1Col] != null && row[n1Col] !== '' ? Number(row[n1Col]) : null,
              diem_nam_2: n2Col && row[n2Col] != null && row[n2Col] !== '' ? Number(row[n2Col]) : null,
              diem_nam_3: n3Col && row[n3Col] != null && row[n3Col] !== '' ? Number(row[n3Col]) : null,
              diem_nam_4: n4Col && row[n4Col] != null && row[n4Col] !== '' ? Number(row[n4Col]) : null,
              hinh_thuc_nam_1: kt1Col ? str(row[kt1Col]) : null,
              hinh_thuc_nam_2: kt2Col ? str(row[kt2Col]) : null,
              hinh_thuc_nam_3: kt3Col ? str(row[kt3Col]) : null,
              hinh_thuc_nam_4: kt4Col ? str(row[kt4Col]) : null,
              hinh_thuc_toan_khoa: ktTKCol ? str(row[ktTKCol]) : null,
            });
            sheetOk++; success++;
          } catch { failed++; }
        }
        details.push(`Thi đua: ${sheetOk} thành công`);
        continue;
      }
    }

    // Refresh units state after creation
    await loadUnits();

    setImportResult({ success, failed, details });
    setImporting(false);
    if (success > 0) message.success(`Import thành công ${success} bản ghi!`);
    if (failed > 0) message.warning(`${failed} dòng bị lỗi`);
  };

  const getUnitSelectOptions = () => {
    return units
      .filter((u) => u.type === 'trung_doi' || u.type === 'tieu_doi')
      .map((u) => {
        let label = '';
        if (u.type === 'tieu_doi') {
          const trungDoi = units.find((p) => p.id === u.parent_id);
          const daiDoi = trungDoi ? units.find((p) => p.id === trungDoi.parent_id) : null;
          const tieuDoan = daiDoi ? units.find((p) => p.id === daiDoi.parent_id) : null;
          label = [tieuDoan?.name, daiDoi?.name, trungDoi?.name, u.name].filter(Boolean).join(' > ');
        } else {
          const daiDoi = units.find((p) => p.id === u.parent_id);
          const tieuDoan = daiDoi ? units.find((p) => p.id === daiDoi.parent_id) : null;
          label = [tieuDoan?.name, daiDoi?.name, u.name].filter(Boolean).join(' > ');
        }
        return { value: u.id, label };
      });
  };

  // ========== IMPORT: đọc tất cả sheets ==========
  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const XLSX = await import('exceljs');
        const workbook = new XLSX.Workbook();
        const buffer = e.target?.result as ArrayBuffer;
        await workbook.xlsx.load(buffer);

        if (workbook.worksheets.length === 0) {
          message.error('File Excel không có sheet nào');
          return;
        }

        const sheets: typeof importSheets = [];

        for (const worksheet of workbook.worksheets) {
          const headersMap: { [colIndex: number]: string } = {};
          let nameColIdx = -1;
          let hasSplitName = false;
          let headerRow = 0;

          worksheet.eachRow((row, rowNumber) => {
            const values = row.values as any[];
            if (!values) return;
            const rowStr = values.map((v) => String(v || '')).join(' ').toLowerCase();
            if (headerRow === 0 && (rowStr.includes('stt') || rowStr.includes('họ và tên') || rowStr.includes('họ tên'))) {
              headerRow = rowNumber;
              for (let i = 1; i < values.length; i++) {
                const val = String(values[i] || '').trim().replace(/\s+/g, ' ');
                if (!val) {
                  headersMap[i] = `Col_${i}`;
                } else {
                  const valLower = val.toLowerCase();
                  if (valLower.includes('họ và tên') || valLower.includes('họ tên')) {
                    if (nameColIdx === -1) {
                      nameColIdx = i;
                      headersMap[i] = 'Họ và tên';
                    } else {
                      headersMap[i] = 'Tên';
                      hasSplitName = true;
                    }
                  } else if (valLower === 'họ' || valLower === 'họ đệm' || valLower === 'họ và tên đệm') {
                    nameColIdx = i;
                    headersMap[i] = 'Họ và tên';
                  } else if (valLower === 'tên') {
                    headersMap[i] = 'Tên';
                    hasSplitName = true;
                  } else {
                    headersMap[i] = val;
                  }
                }
              }
            }
          });

          if (headerRow === 0 || Object.keys(headersMap).length === 0) continue;

          // Detect credits if it is a study scores sheet
          const sn = worksheet.name.toLowerCase();
          const isAcademic = sn.includes('học tập') || sn.includes('điểm học');
          let hasCreditsRow = false;
          const creditsMap: { [colName: string]: number } = {};

          if (isAcademic) {
            const nextRow = worksheet.getRow(headerRow + 1);
            if (nextRow) {
              const values = nextRow.values as any[];
              if (values && values.length > 0) {
                for (let i = 1; i < values.length; i++) {
                  const cellVal = values[i];
                  const num = Number(cellVal);
                  if (cellVal !== null && cellVal !== '' && !isNaN(num)) {
                    const colName = headersMap[i];
                    if (colName && !colName.startsWith('Col_') && !colName.includes('Họ và tên') && !colName.includes('Tên') && !colName.includes('STT') && !colName.includes('TB') && !colName.includes('Hạng') && !colName.includes('Xếp loại')) {
                      creditsMap[colName] = num;
                      hasCreditsRow = true;
                    }
                  }
                }
              }
            }
          }

          const rows: any[] = [];
          worksheet.eachRow((row, rowNumber) => {
            if (rowNumber <= headerRow) return;
            if (hasCreditsRow && rowNumber === headerRow + 1) return;

            const values = row.values as any[];
            if (!values || values.length <= 1) return;

            const rowData: any = { _key: `${worksheet.name}-${rowNumber}` };
            Object.keys(headersMap).forEach((colIdxStr) => {
              const colIdx = Number(colIdxStr);
              const h = headersMap[colIdx];
              rowData[h] = values[colIdx] ?? '';
            });

            // Merge Họ và tên and Tên if split
            if (hasSplitName && rowData['Họ và tên'] !== undefined && rowData['Tên'] !== undefined) {
              rowData['Họ và tên'] = (String(rowData['Họ và tên']).trim() + ' ' + String(rowData['Tên']).trim()).replace(/\s+/g, ' ');
            }

            const hasData = Object.values(headersMap).some((h) => rowData[h] !== '' && rowData[h] != null && !h.startsWith('Col_'));
            if (hasData) rows.push(rowData);
          });

          const validHeaders: string[] = [];
          for (let i = 1; i <= worksheet.columnCount; i++) {
            const h = headersMap[i];
            if (h && !h.startsWith('Col_') && h !== 'Tên') {
              validHeaders.push(h);
            }
          }

          if (rows.length > 0) {
            const columns = validHeaders.map((h) => ({
              title: h, dataIndex: h, width: 160, ellipsis: true,
              render: (v: any) => {
                if (v instanceof Date) return v.toLocaleDateString('vi-VN');
                return String(v ?? '');
              },
            }));
            const detectedUnit = detectSheetUnit(worksheet);
            const detectedMonth = detectSheetMonth(worksheet);
            sheets.push({
              name: worksheet.name,
              headers: validHeaders,
              data: rows,
              columns,
              detectedUnit,
              detectedMonth,
              credits: creditsMap
            });
          }
        }

        setImportSheets(sheets);
        setActiveImportSheet('0');
        setImportResult(null);
        message.success(`Đã đọc ${sheets.length} sheet, tổng ${sheets.reduce((s, sh) => s + sh.data.length, 0)} dòng`);
      } catch (err: any) {
        message.error('Lỗi đọc file: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
    return false;
  };

  // ========== EXPORT ==========
  const handleExport = async () => {
    setExporting(true);
    try {
      const ExcelJS = await import('exceljs');
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Quản Lý Quân Nhân';

      const addSheet = (ws: any, title: string, headers: string[], data: any[], mapRow: (item: any, i: number) => any[]) => {
        ws.mergeCells(1, 1, 1, headers.length);
        const tc = ws.getCell('A1');
        tc.value = title;
        titleStyle(tc);
        ws.addRow([]);
        const hr = ws.addRow(headers);
        hr.height = 28;
        hr.eachCell((cell: any) => headerStyle(cell));
        data.forEach((item, i) => {
          const r = ws.addRow(mapRow(item, i));
          r.eachCell((cell: any) => cellBorder(cell));
        });
        ws.columns.forEach((col: any) => { col.width = 18; });
        ws.getColumn(1).width = 8;
        ws.getColumn(2).width = 28;
      };

      if (exportType === 'students' || exportType === 'all') {
        const res = await getStudents({ unit_id: exportUnitId, pageSize: 10000 });
        const ws = workbook.addWorksheet('Thông tin học viên');
        addSheet(ws, 'TRÍCH NGANG HỌC VIÊN',
          [
            'STT', 'Họ và tên', 'Hình ảnh', 'Ngày sinh', 'CCCD', 'CCCD Ngày cấp', 'CCCD Nơi cấp', 'BHYT',
            'Cấp bậc', 'Chức vụ', 'Quê quán', 'Địa chỉ thường trú',
            'Họ tên bố', 'Nghề nghiệp', 'Ngày sinh', 'Nơi ở hiện nay',
            'Họ tên mẹ', 'Nghề nghiệp', 'Ngày sinh', 'Nơi ở hiện nay'
          ],
          res.data,
          (s, i) => [
            i + 1,
            s.ho_ten || '',
            s.hinh_anh || '',
            s.ngay_sinh ? dayjs(s.ngay_sinh).format('DD/MM/YYYY') : '',
            s.cccd || '',
            s.cccd_ngay_cap ? dayjs(s.cccd_ngay_cap).format('DD/MM/YYYY') : '',
            s.cccd_noi_cap || '',
            s.bhyt || '',
            s.cap_bac || '',
            s.chuc_vu || '',
            s.que_quan || '',
            s.dia_chi_thuong_tru || '',
            s.bo_ho_ten || '',
            s.bo_nghe_nghiep || '',
            s.bo_ngay_sinh ? dayjs(s.bo_ngay_sinh).format('DD/MM/YYYY') : '',
            s.bo_noi_o || '',
            s.me_ho_ten || '',
            s.me_nghe_nghiep || '',
            s.me_ngay_sinh ? dayjs(s.me_ngay_sinh).format('DD/MM/YYYY') : '',
            s.me_noi_o || ''
          ]
        );
      }

      if (exportType === 'academic' || exportType === 'all') {
        const data = await getAcademicScores({ unit_id: exportUnitId });
        const ws = workbook.addWorksheet('Điểm học tập');
        addSheet(ws, 'ĐIỂM HỌC TẬP CỦA HỌC VIÊN', ['STT', 'Họ và tên', 'Môn học', 'Tín chỉ', 'Điểm'], data,
          (s, i) => [i + 1, s.ho_ten, s.mon_hoc, s.tin_chi, s.diem]);
      }

      if (exportType === 'discipline' || exportType === 'all') {
        const data = await getDisciplineScores({ unit_id: exportUnitId });
        const ws = workbook.addWorksheet('Điểm rèn luyện');
        addSheet(ws, 'ĐIỂM RÈN LUYỆN HỌC VIÊN', ['STT', 'Họ và tên', 'Tuần 01', 'Tuần 02', 'Tuần 03', 'Tuần 04', 'Tuần 05', 'Điểm tháng', 'Xếp loại'], data,
          (s, i) => [i + 1, s.ho_ten, s.tuan_1, s.tuan_2, s.tuan_3, s.tuan_4, s.tuan_5, s.diem_thang, s.xep_loai]);
      }

      if (exportType === 'absences' || exportType === 'all') {
        const data = await getAbsences({ unit_id: exportUnitId });
        const ws = workbook.addWorksheet('Công vắng');
        addSheet(ws, 'CÔNG VẮNG CỦA HỌC VIÊN', 
          ['STT', 'Họ và tên', 'Ngày vắng', 'Môn vắng', 'Số tiết vắng', 'Tên bài', 'Giảng viên', 'Ghi chú thi', 'Ghi chú'], 
          data,
          (s, i) => [
            i + 1, 
            s.ho_ten, 
            s.ngay_vang ? dayjs(s.ngay_vang).format('DD/MM/YYYY') : '', 
            s.mon_hoc || '', 
            s.so_tiet_vang ?? '', 
            s.ten_bai || '', 
            s.giang_vien || '', 
            s.ghi_chu_thi || '', 
            s.ghi_chu || ''
          ]
        );
      }

      if (exportType === 'awards' || exportType === 'all') {
        const data = await getAwards({ unit_id: exportUnitId });
        const ws = workbook.addWorksheet('Thi đua khen thưởng');
        addSheet(ws, 'XÉT LOẠI THI ĐUA KHEN THƯỞNG', 
          ['STT', 'Họ và tên', 'Điểm N1', 'Khen thưởng N1', 'Điểm N2', 'Khen thưởng N2', 'Điểm N3', 'Khen thưởng N3', 'Điểm N4', 'Khen thưởng N4', 'Tổng kết', 'Xếp loại', 'Khen thưởng TK'], 
          data,
          (s, i) => [
            i + 1, 
            s.ho_ten, 
            s.diem_nam_1 ?? '', 
            s.hinh_thuc_nam_1 || '', 
            s.diem_nam_2 ?? '', 
            s.hinh_thuc_nam_2 || '', 
            s.diem_nam_3 ?? '', 
            s.hinh_thuc_nam_3 || '', 
            s.diem_nam_4 ?? '', 
            s.hinh_thuc_nam_4 || '', 
            s.tong_ket ?? '', 
            s.xep_loai || '', 
            s.hinh_thuc_toan_khoa || ''
          ]
        );
      }

      await downloadWorkbook(workbook, `quan_nhan_${exportType}_${new Date().toISOString().slice(0, 10)}.xlsx`);
      message.success('Đã xuất file Excel thành công!');
    } catch (err: any) {
      message.error('Lỗi xuất Excel: ' + err.message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <Title level={4} style={{ marginBottom: 20 }}><FileExcelOutlined /> Excel Import / Export</Title>

      <Tabs activeKey={activeTab} onChange={setActiveTab} size="large" items={[
        {
          key: 'template',
          label: <span><FileAddOutlined /> Template mẫu</span>,
          children: (
            <div>
              <Alert
                type="info" showIcon
                style={{ marginBottom: 20 }}
                title="Tải template mẫu về, điền dữ liệu theo đúng format, sau đó import vào app."
              />

              <Button
                type="primary"
                icon={<DownloadOutlined />}
                size="large"
                onClick={handleDownloadAllTemplates}
                style={{ marginBottom: 24, height: 48, fontSize: 16, paddingInline: 32 }}
              >
                Tải tất cả Template (1 file, 5 sheets)
              </Button>

              <Row gutter={[16, 16]}>
                {templates.map((t) => (
                  <Col xs={24} sm={12} lg={8} key={t.key}>
                    <Card
                      hoverable
                      style={{ height: '100%', borderTop: `3px solid ${t.color}` }}
                      actions={[
                        <Button
                          type="link"
                          icon={<DownloadOutlined />}
                          onClick={() => handleDownloadTemplate(t)}
                          style={{ fontSize: 14 }}
                        >
                          Tải template
                        </Button>,
                      ]}
                    >
                      <Title level={5} style={{ color: t.color, marginBottom: 8 }}>{t.title}</Title>
                      <Text type="secondary">{t.desc}</Text>
                      <div style={{ marginTop: 12 }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>Các cột: </Text>
                        <div style={{ marginTop: 4 }}>
                          {t.headers.length > 0 ? (
                            <>
                              {t.headers.slice(0, 6).map((h, i) => (
                                <Tag key={`${h}-${i}`} style={{ marginBottom: 4, fontSize: 12 }}>{h}</Tag>
                              ))}
                              {t.headers.length > 6 && <Tag style={{ fontSize: 12 }}>+{t.headers.length - 6} cột</Tag>}
                            </>
                          ) : (
                            <Tag style={{ fontSize: 12 }}>STT, Họ và tên, TÍN CHỈ, Môn 1-8, TB, Xếp loại</Tag>
                          )}
                        </div>
                      </div>
                    </Card>
                  </Col>
                ))}
              </Row>
            </div>
          ),
        },
        {
          key: 'import',
          label: 'Import (Nhập dữ liệu)',
          children: (
            <div>
              <Card style={{ marginBottom: 20 }}>
                <Dragger
                  accept=".xlsx,.xls"
                  showUploadList={false}
                  beforeUpload={handleFileUpload}
                  style={{ padding: '32px 0' }}
                >
                  <p className="ant-upload-drag-icon">
                    <InboxOutlined style={{ fontSize: 52, color: '#1677ff' }} />
                  </p>
                  <p style={{ fontSize: 17, fontWeight: 500 }}>Kéo thả file Excel vào đây hoặc click để chọn</p>
                  <p style={{ color: '#999', fontSize: 14 }}>Hỗ trợ file .xlsx, .xls</p>
                </Dragger>
              </Card>

              {importSheets.length > 0 && (
                <Card title={`Đã đọc ${importSheets.length} sheet`}>
                  <Alert
                    type="info"
                    title="Kiểm tra dữ liệu từng sheet bên dưới. Chọn đơn vị rồi bấm Import tất cả vào Database."
                    style={{ marginBottom: 16 }}
                    showIcon
                  />

                  <Space size="middle" style={{ marginBottom: 16 }} wrap>
                    <div>
                      <Text strong style={{ marginRight: 8 }}>Chọn đơn vị (Trung đội):</Text>
                      <Select
                        placeholder="Chọn trung đội"
                        style={{ width: 320 }}
                        options={getUnitSelectOptions()}
                        value={importUnitId}
                        onChange={setImportUnitId}
                        showSearch
                        optionFilterProp="label"
                      />
                    </div>
                    <Button
                      type="primary"
                      icon={<SaveOutlined />}
                      size="large"
                      onClick={handleImportToDB}
                      loading={importing}
                      disabled={!importUnitId}
                      style={{ height: 40 }}
                    >
                      Import TẤT CẢ vào Database
                    </Button>
                  </Space>

                  {importResult && (
                    <Alert
                      type={importResult.failed === 0 ? 'success' : 'warning'}
                      showIcon
                      style={{ marginBottom: 16 }}
                      title={`Import xong: ${importResult.success} thành công${importResult.failed > 0 ? `, ${importResult.failed} lỗi` : ''}`}
                      description={importResult.details.length > 0 ? (
                        <ul style={{ margin: '8px 0 0 0', paddingLeft: 20 }}>
                          {importResult.details.map((d, i) => <li key={i}>{d}</li>)}
                        </ul>
                      ) : undefined}
                    />
                  )}

                  <Tabs
                    activeKey={activeImportSheet}
                    onChange={setActiveImportSheet}
                    size="small"
                    items={importSheets.map((sheet, idx) => ({
                      key: String(idx),
                      label: `${sheet.name} (${sheet.data.length})`,
                      children: (
                        <div>
                          {sheet.detectedUnit && (sheet.detectedUnit.tieuDoan || sheet.detectedUnit.daiDoi || sheet.detectedUnit.trungDoi) ? (
                            <Alert
                              type="success"
                              showIcon
                              style={{ marginBottom: 12 }}
                              message={
                                <span>
                                  Tự động nhận diện đơn vị: {' '}
                                  <strong>
                                    {[
                                      sheet.detectedUnit.tieuDoan,
                                      sheet.detectedUnit.daiDoi,
                                      sheet.detectedUnit.trungDoi
                                    ].filter(Boolean).join(' > ')}
                                  </strong>
                                </span>
                              }
                            />
                          ) : (
                            <Alert
                              type="warning"
                              showIcon
                              style={{ marginBottom: 12 }}
                              message="Không nhận diện được tiêu đề đơn vị trong sheet này. Hệ thống sẽ sử dụng đơn vị được chọn ở trên làm dự phòng."
                            />
                          )}
                          <Table
                            columns={sheet.columns}
                            dataSource={sheet.data}
                            rowKey="_key"
                            size="small"
                            scroll={{ x: sheet.columns.length * 160, y: 350 }}
                            pagination={{ pageSize: 50, showTotal: (t) => `${t} dòng` }}
                          />
                        </div>
                      ),
                    }))}
                  />
                </Card>
              )}
            </div>
          ),
        },
        {
          key: 'export',
          label: 'Export (Xuất dữ liệu)',
          children: (
            <Card>
              <Space direction="vertical" size={20} style={{ width: '100%' }}>
                <div>
                  <Text strong style={{ fontSize: 16, display: 'block', marginBottom: 8 }}>Chọn loại dữ liệu xuất:</Text>
                  <Select value={exportType} onChange={setExportType} style={{ width: 300 }} size="large">
                    <Select.Option value="all">Tất cả (5 sheets)</Select.Option>
                    <Select.Option value="students">Thông tin học viên</Select.Option>
                    <Select.Option value="academic">Điểm học tập</Select.Option>
                    <Select.Option value="discipline">Điểm rèn luyện</Select.Option>
                    <Select.Option value="absences">Công vắng</Select.Option>
                    <Select.Option value="awards">Thi đua khen thưởng</Select.Option>
                  </Select>
                </div>

                <div>
                  <Text strong style={{ fontSize: 16, display: 'block', marginBottom: 8 }}>Lọc theo đơn vị (tùy chọn):</Text>
                  <Cascader
                    options={buildCascaderOptions()}
                    onChange={(v: any) => setExportUnitId(v?.length > 0 ? v[v.length - 1] : undefined)}
                    placeholder="Tất cả đơn vị"
                    changeOnSelect allowClear
                    style={{ width: 400 }}
                    size="large"
                  />
                </div>

                <Divider />

                <Button
                  type="primary"
                  icon={<DownloadOutlined />}
                  size="large"
                  onClick={handleExport}
                  loading={exporting}
                  style={{ height: 48, fontSize: 16, paddingInline: 32 }}
                >
                  Xuất file Excel
                </Button>

                <Alert
                  type="info"
                  title="File Excel sẽ được xuất với template chuẩn: header đẹp, border, format sẵn."
                  showIcon
                />
              </Space>
            </Card>
          ),
        },
      ].filter((t) => isAdmin || t.key !== 'import')} />
    </div>
  );
};

export default ExcelPage;
