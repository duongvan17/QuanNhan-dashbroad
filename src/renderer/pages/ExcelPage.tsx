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
} from '../services/api';
import { useAuth } from '../auth/AuthContext';
import type { Unit } from '../../shared/types';

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

// ============ Template definitions ============
const templates = [
  {
    key: 'students',
    title: 'Thông tin Học viên',
    desc: 'Họ tên, hình ảnh, ngày sinh, CCCD, cấp bậc, quê quán, thông tin bố mẹ',
    color: '#1677ff',
    headers: ['STT', 'Họ và tên', 'Hình ảnh', 'Ngày sinh', 'CCCD', 'Cấp bậc', 'Chức vụ', 'Quê quán', 'Địa chỉ thường trú',
      'Họ tên bố', 'Nghề nghiệp', 'Ngày sinh', 'Nơi ở hiện nay',
      'Họ tên mẹ', 'Nghề nghiệp', 'Ngày sinh', 'Nơi ở hiện nay'],
    sheetTitle: 'THÔNG TIN HỌC VIÊN',
    sheetName: 'Thông tin học viên',
    sampleRows: [],
    widths: [6, 20, 10, 12, 14, 10, 10, 14, 18, 16, 14, 12, 16, 16, 14, 12, 16],
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
    headers: ['STT', 'Họ và tên', 'Cấp bậc', 'Chức vụ', 'Tuần 01', 'Tuần 02', 'Tuần 03', 'Tuần 04', 'Tháng 01', 'Xếp loại'],
    sheetTitle: 'ĐIỂM RÈN LUYỆN HỌC VIÊN',
    sheetName: 'Điểm rèn luyện',
    extraRows: [['NĂM NHẤT']],
    sampleRows: [],
    widths: [6, 24, 12, 12, 10, 10, 10, 10, 12, 12],
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
  const [importResult, setImportResult] = useState<{ success: number; failed: number; details: string[] } | null>(null);
  const [importSheets, setImportSheets] = useState<{ name: string; headers: string[]; data: any[]; columns: any[] }[]>([]);
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
            children: trungDois.map((trd) => ({ value: trd.id, label: trd.name })),
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
    if (!importUnitId) {
      message.error('Chọn đơn vị (Trung đội) trước khi import!');
      return;
    }
    if (importSheets.length === 0) {
      message.error('Không có dữ liệu để import!');
      return;
    }

    setImporting(true);
    setImportResult(null);
    let success = 0;
    let failed = 0;
    const details: string[] = [];

    // Lấy danh sách học viên đã có trong DB (để map tên → id)
    let existingStudents: any[] = [];
    try {
      const res = await getStudents({ unit_id: importUnitId, pageSize: 10000 });
      existingStudents = res.data;
    } catch { /* */ }

    const findStudentId = (name: string) => {
      const s = existingStudents.find((st: any) => st.ho_ten === name);
      return s?.id;
    };

    const str = (val: any) => val ? String(val).trim() : null;

    for (const sheet of importSheets) {
      const h = sheet.headers;
      const sn = sheet.name.toLowerCase();

      // ====== Sheet: Thông tin học viên ======
      if (sn.includes('thông tin') || sn.includes('học viên')) {
        const nameCol = h.find((c) => c.toLowerCase().includes('họ và tên'));
        if (!nameCol) continue;
        const dobCol = h.find((c) => c.toLowerCase().includes('ngày sinh') || c.toLowerCase().includes('ngày/'));
        const cccdCol = h.find((c) => c.toLowerCase().includes('cccd'));
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
              unit_id: importUnitId,
              ho_ten: hoTen,
              ngay_sinh: parseDate(row[dobCol!]),
              cccd: str(row[cccdCol!]),
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
            existingStudents.push({ id: res.id, ho_ten: hoTen });
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
        for (const row of sheet.data) {
          const hoTen = str(row[nameCol]);
          if (!hoTen) continue;
          const sid = findStudentId(hoTen);
          if (!sid) { failed++; continue; }
          try {
            const t1Col = h.find((c) => c.toLowerCase().includes('tuần 01'));
            const t2Col = h.find((c) => c.toLowerCase().includes('tuần 02'));
            const t3Col = h.find((c) => c.toLowerCase().includes('tuần 03'));
            const t4Col = h.find((c) => c.toLowerCase().includes('tuần 04'));
            await saveDisciplineScores([{
              student_id: sid, nam_hoc: 1, thang: 1,
              tuan_1: row[t1Col!] != null && row[t1Col!] !== '' ? Number(row[t1Col!]) : null,
              tuan_2: row[t2Col!] != null && row[t2Col!] !== '' ? Number(row[t2Col!]) : null,
              tuan_3: row[t3Col!] != null && row[t3Col!] !== '' ? Number(row[t3Col!]) : null,
              tuan_4: row[t4Col!] != null && row[t4Col!] !== '' ? Number(row[t4Col!]) : null,
            }]);
            sheetOk++; success++;
          } catch { failed++; }
        }
        details.push(`Điểm rèn luyện: ${sheetOk} thành công`);
        continue;
      }

      // ====== Sheet: Điểm học tập ======
      if (sn.includes('học tập') || sn.includes('điểm học')) {
        // Format đặc biệt: mỗi dòng = 1 học viên, các cột = điểm từng môn
        const nameCol = h.find((c) => c.toLowerCase().includes('họ và tên'));
        if (!nameCol) continue;
        let sheetOk = 0;
        for (const row of sheet.data) {
          const hoTen = str(row[nameCol]);
          if (!hoTen) continue;
          const sid = findStudentId(hoTen);
          if (!sid) { failed++; continue; }
          // Các cột số (điểm) - bỏ STT, Họ tên, TÍN CHỈ, Trung bình, Xếp loại
          const scoreKeys = h.filter((k) => {
            const kl = k.toLowerCase();
            return !kl.includes('stt') && !kl.includes('họ') && !kl.includes('tín chỉ')
              && !kl.includes('trung bình') && !kl.includes('xếp loại')
              && !kl.includes('hc') && !kl.includes('môn học');
          });
          const scores = scoreKeys
            .filter((k) => row[k] != null && row[k] !== '' && !isNaN(Number(row[k])))
            .map((k) => {
              // Tên môn = chính header trong Excel (đã đổi sang tên thật trong template)
              // Tín chỉ: parse "Toán (3tc)" -> 3, mặc định 1
              const tcMatch = k.match(/\((\d+)\s*tc?\)/i);
              const tin_chi = tcMatch ? Number(tcMatch[1]) : 1;
              const mon_hoc = k.replace(/\s*\(\d+\s*tc?\)\s*$/i, '').trim();
              return {
                student_id: sid, nam_hoc: 1, hoc_ky: 1,
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
        for (const row of sheet.data) {
          const hoTen = str(row[nameCol]) || lastStudentName;
          if (!hoTen) continue;
          if (str(row[nameCol])) lastStudentName = hoTen;
          const sid = findStudentId(hoTen);
          if (!sid) continue;

          // Công vắng
          const cvCol = h.find((c) => c.toLowerCase().includes('công vắng'));
          const cvVal = str(row[cvCol!]);
          if (cvVal && cvVal.toLowerCase().includes('ngày')) {
            try {
              const dateMatch = cvVal.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
              if (dateMatch) {
                const ngay = `${dateMatch[3]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[1].padStart(2, '0')}`;
                await createAbsence({ student_id: sid, ngay_vang: ngay });
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
                  await createViolation({ student_id: sid, loai: loai as string, ngay, ly_do: lyDo || undefined });
                  sheetOk++; success++;
                }
              } catch { failed++; }
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
          const sid = findStudentId(hoTen);
          if (!sid) { failed++; continue; }
          const n1Col = h.find((c) => c.toLowerCase().includes('năm nhất'));
          const n2Col = h.find((c) => c.toLowerCase().includes('năm hai'));
          const n3Col = h.find((c) => c.toLowerCase().includes('năm ba'));
          const n4Col = h.find((c) => c.toLowerCase().includes('năm bốn'));
          try {
            await saveAward({
              student_id: sid,
              diem_nam_1: row[n1Col!] != null && row[n1Col!] !== '' ? Number(row[n1Col!]) : null,
              diem_nam_2: row[n2Col!] != null && row[n2Col!] !== '' ? Number(row[n2Col!]) : null,
              diem_nam_3: row[n3Col!] != null && row[n3Col!] !== '' ? Number(row[n3Col!]) : null,
              diem_nam_4: row[n4Col!] != null && row[n4Col!] !== '' ? Number(row[n4Col!]) : null,
            });
            sheetOk++; success++;
          } catch { failed++; }
        }
        details.push(`Thi đua: ${sheetOk} thành công`);
        continue;
      }
    }

    setImportResult({ success, failed, details });
    setImporting(false);
    if (success > 0) message.success(`Import thành công ${success} bản ghi!`);
    if (failed > 0) message.warning(`${failed} dòng bị lỗi`);
  };

  const getUnitSelectOptions = () => {
    return units
      .filter((u) => u.type === 'trung_doi')
      .map((u) => {
        const daiDoi = units.find((p) => p.id === u.parent_id);
        const tieuDoan = daiDoi ? units.find((p) => p.id === daiDoi.parent_id) : null;
        const label = [tieuDoan?.name, daiDoi?.name, u.name].filter(Boolean).join(' > ');
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
          const headers: string[] = [];
          const rows: any[] = [];
          let headerRow = 0;

          worksheet.eachRow((row, rowNumber) => {
            const values = row.values as any[];
            const rowStr = values.map((v) => String(v || '')).join(' ').toLowerCase();
            if (headerRow === 0 && (rowStr.includes('stt') || rowStr.includes('họ và tên'))) {
              headerRow = rowNumber;
              for (let i = 1; i < values.length; i++) {
                const val = String(values[i] || '').trim();
                if (val) headers.push(val);
              }
            }
          });

          if (headerRow === 0 || headers.length === 0) continue;

          worksheet.eachRow((row, rowNumber) => {
            if (rowNumber <= headerRow) return;
            const values = row.values as any[];
            if (!values || values.length <= 1) return;

            const rowData: any = { _key: `${worksheet.name}-${rowNumber}` };
            headers.forEach((h, idx) => {
              rowData[h] = values[idx + 1] ?? '';
            });

            const hasData = headers.some((h) => rowData[h] !== '' && rowData[h] != null);
            if (hasData) rows.push(rowData);
          });

          if (rows.length > 0) {
            const columns = headers.map((h) => ({
              title: h, dataIndex: h, width: 160, ellipsis: true,
              render: (v: any) => {
                if (v instanceof Date) return v.toLocaleDateString('vi-VN');
                return String(v ?? '');
              },
            }));
            sheets.push({ name: worksheet.name, headers, data: rows, columns });
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
          ['STT', 'Họ và tên', 'Ngày sinh', 'CCCD', 'Cấp bậc', 'Chức vụ', 'Quê quán', 'Địa chỉ thường trú'],
          res.data,
          (s, i) => [i + 1, s.ho_ten, s.ngay_sinh ? new Date(s.ngay_sinh).toLocaleDateString('vi-VN') : '', s.cccd || '', s.cap_bac || '', s.chuc_vu || '', s.que_quan || '', s.dia_chi_thuong_tru || '']
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
        addSheet(ws, 'ĐIỂM RÈN LUYỆN HỌC VIÊN', ['STT', 'Họ và tên', 'Tuần 01', 'Tuần 02', 'Tuần 03', 'Tuần 04', 'Điểm tháng', 'Xếp loại'], data,
          (s, i) => [i + 1, s.ho_ten, s.tuan_1, s.tuan_2, s.tuan_3, s.tuan_4, s.diem_thang, s.xep_loai]);
      }

      if (exportType === 'absences' || exportType === 'all') {
        const data = await getAbsences({ unit_id: exportUnitId });
        const ws = workbook.addWorksheet('Công vắng');
        addSheet(ws, 'CÔNG VẮNG CỦA HỌC VIÊN', ['STT', 'Họ và tên', 'Ngày vắng', 'Ghi chú'], data,
          (s, i) => [i + 1, s.ho_ten, new Date(s.ngay_vang).toLocaleDateString('vi-VN'), s.ghi_chu || '']);
      }

      if (exportType === 'awards' || exportType === 'all') {
        const data = await getAwards({ unit_id: exportUnitId });
        const ws = workbook.addWorksheet('Thi đua khen thưởng');
        addSheet(ws, 'XÉT LOẠI THI ĐUA KHEN THƯỞNG', ['STT', 'Họ và tên', 'Năm nhất', 'Năm hai', 'Năm ba', 'Năm bốn', 'Tổng kết', 'Xếp loại'], data,
          (s, i) => [i + 1, s.ho_ten, s.diem_nam_1, s.diem_nam_2, s.diem_nam_3, s.diem_nam_4, s.tong_ket, s.xep_loai]);
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
                        <Table
                          columns={sheet.columns}
                          dataSource={sheet.data}
                          rowKey="_key"
                          size="small"
                          scroll={{ x: sheet.columns.length * 160, y: 350 }}
                          pagination={{ pageSize: 50, showTotal: (t) => `${t} dòng` }}
                        />
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
