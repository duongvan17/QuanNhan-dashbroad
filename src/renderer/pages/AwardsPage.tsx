import React, { useEffect, useState, useCallback } from 'react';
import {
  Card, Table, Button, Modal, Form, Input, InputNumber, Select, Space, Typography,
  Cascader, App, Tag, Popconfirm, Tabs, DatePicker, Row, Col, Statistic
} from 'antd';
import {
  PlusOutlined, TrophyOutlined, CopyOutlined, EditOutlined, DeleteOutlined,
  SearchOutlined, StarOutlined, BookOutlined, CalendarOutlined
} from '@ant-design/icons';
import {
  getAwards, saveAward, deleteAward,
  getOtherAwards, saveOtherAward, deleteOtherAward,
  getAcademicScores, getDisciplineScores, getStudents, getUnits
} from '../services/api';
import { useAuth } from '../auth/AuthContext';
import type { Unit, OtherAward } from '../../shared/types';
import dayjs from 'dayjs';

const { Title } = Typography;

const AWARD_PRESETS = ['Chiến sĩ thi đua', 'Chiến sĩ tiên tiến', 'Lao động tiên tiến', 'Bằng khen', 'Giấy khen'];
const CAP_KHEN_THUONG_PRESETS = ['Đại đội', 'Tiểu đoàn', 'Trường', 'Bộ Quốc phòng', 'Khác'];

const AwardsPage: React.FC = () => {
  const { message } = App.useApp();
  const { isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<'emulation' | 'other'>('emulation');

  // Common Unit / Student lists
  const [units, setUnits] = useState<Unit[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<any>({});
  const [searchText, setSearchText] = useState('');

  // Tab 1: Emulation
  const [awards, setAwards] = useState<any[]>([]);
  const [academicScores, setAcademicScores] = useState<any[]>([]);
  const [disciplineScores, setDisciplineScores] = useState<any[]>([]);
  const [emuModalOpen, setEmuModalOpen] = useState(false);
  const [emuForm] = Form.useForm();
  const [selectedStudentEmu, setSelectedStudentEmu] = useState<any>(null);

  // Watch for custom input selections in form
  const [customEmuN1, setCustomEmuN1] = useState(false);
  const [customEmuN2, setCustomEmuN2] = useState(false);
  const [customEmuN3, setCustomEmuN3] = useState(false);
  const [customEmuN4, setCustomEmuN4] = useState(false);
  const [customEmuTK, setCustomEmuTK] = useState(false);

  // Tab 2: Unexpected / Other Awards
  const [otherAwards, setOtherAwards] = useState<OtherAward[]>([]);
  const [otherModalOpen, setOtherModalOpen] = useState(false);
  const [otherForm] = Form.useForm();
  const [editingOtherAward, setEditingOtherAward] = useState<OtherAward | null>(null);

  const loadUnits = async () => { try { setUnits(await getUnits()); } catch { /* */ } };
  const loadStudents = async (unit_id?: number) => {
    try { const res = await getStudents({ unit_id, pageSize: 1000 }); setStudents(res.data); } catch { /* */ }
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      if (activeTab === 'emulation') {
        const [awardsData, studentsData, academicData, disciplineData] = await Promise.all([
          getAwards(filters),
          getStudents({ ...filters, pageSize: 1000 }),
          getAcademicScores(filters),
          getDisciplineScores(filters)
        ]);
        setAwards(awardsData);
        setStudents(studentsData.data || []);
        setAcademicScores(academicData || []);
        setDisciplineScores(disciplineData || []);
      } else {
        const [otherAwardsData, studentsData] = await Promise.all([
          getOtherAwards(filters),
          getStudents({ ...filters, pageSize: 1000 })
        ]);
        setOtherAwards(otherAwardsData);
        setStudents(studentsData.data || []);
      }
    } catch (err: any) {
      message.error('Lỗi tải dữ liệu: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [filters, activeTab]);

  useEffect(() => { loadUnits(); loadStudents(); }, []);
  useEffect(() => { loadData(); }, [loadData]);

  const buildCascaderOptions = () => {
    const tieuDoans = units.filter((u) => u.type === 'tieu_doan');
    return tieuDoans.map((td) => ({
      value: td.id, label: td.name,
      children: units.filter((u) => u.type === 'dai_doi' && u.parent_id === td.id).map((dd) => ({
        value: dd.id, label: dd.name,
        children: units.filter((u) => u.type === 'trung_doi' && u.parent_id === dd.id).map((trd) => {
          const tieuDois = units.filter((u) => u.type === 'tieu_doi' && u.parent_id === trd.id);
          return {
            value: trd.id, label: trd.name,
            children: tieuDois.length > 0 ? tieuDois.map((ti) => ({ value: ti.id, label: ti.name })) : undefined,
          };
        }),
      })),
    }));
  };

  const handleFilterUnit = (value: any) => {
    const unit_id = value?.length > 0 ? value[value.length - 1] : undefined;
    setFilters((prev: any) => ({ ...prev, unit_id }));
    loadStudents(unit_id);
  };

  // ============ GPAs and Discipline Averages logic ============
  const computeGPA = (studentId: number, namHoc?: number) => {
    const studentScores = academicScores.filter(s =>
      s.student_id === studentId && (namHoc === undefined || s.nam_hoc === namHoc)
    );
    let totalWeighted = 0;
    let totalCredits = 0;
    studentScores.forEach(s => {
      totalWeighted += s.diem * (s.tin_chi || 1);
      totalCredits += (s.tin_chi || 1);
    });
    return totalCredits > 0 ? Math.round((totalWeighted / totalCredits) * 100) / 100 : null;
  };

  const computeRL = (studentId: number, namHoc?: number) => {
    const studentRL = disciplineScores.filter(s =>
      s.student_id === studentId && (namHoc === undefined || s.nam_hoc === namHoc) && s.diem_thang != null
    );
    return studentRL.length > 0
      ? Math.round((studentRL.reduce((sum, s) => sum + Number(s.diem_thang), 0) / studentRL.length) * 100) / 100
      : null;
  };

  // Helper for formatting scores
  const renderScore = (v: number | null) => {
    if (v == null) return <span style={{ color: '#ccc' }}>-</span>;
    const color = v >= 8 ? '#52c41a' : v >= 7.2 ? '#1677ff' : v >= 5 ? '#faad14' : '#ff4d4f';
    return <span style={{ fontWeight: 600, color }}>{v.toFixed(2)}</span>;
  };

  // Emulation row mapping
  const buildEmulationRows = () => {
    return students.map((s, idx) => {
      const awardRecord = awards.find(a => a.student_id === s.id) || {};
      const gpa1 = computeGPA(s.id, 1);
      const gpa2 = computeGPA(s.id, 2);
      const gpa3 = computeGPA(s.id, 3);
      const gpa4 = computeGPA(s.id, 4);
      const gpaTK = computeGPA(s.id);

      const rl1 = computeRL(s.id, 1);
      const rl2 = computeRL(s.id, 2);
      const rl3 = computeRL(s.id, 3);
      const rl4 = computeRL(s.id, 4);
      const rlTK = computeRL(s.id);

      // Find unit path
      const platoon = units.find(u => u.id === s.unit_id);
      const company = platoon ? units.find(u => u.id === platoon.parent_id) : null;
      const unitStr = company ? `${company.name} - ${platoon?.name}` : (platoon?.name || '-');

      return {
        key: s.id,
        stt: idx + 1,
        student_id: s.id,
        ho_ten: s.ho_ten,
        unitStr,
        awardRecord,
        gpa1, gpa2, gpa3, gpa4, gpaTK,
        rl1, rl2, rl3, rl4, rlTK,
        hinh_thuc_nam_1: awardRecord.hinh_thuc_nam_1,
        hinh_thuc_nam_2: awardRecord.hinh_thuc_nam_2,
        hinh_thuc_nam_3: awardRecord.hinh_thuc_nam_3,
        hinh_thuc_nam_4: awardRecord.hinh_thuc_nam_4,
        hinh_thuc_toan_khoa: awardRecord.hinh_thuc_toan_khoa,
      };
    });
  };

  const emulationRows = buildEmulationRows();
  const filteredEmulationRows = searchText
    ? emulationRows.filter(r => r.ho_ten.toLowerCase().includes(searchText.toLowerCase()))
    : emulationRows;

  // Filtered unexpected awards
  const filteredOtherAwards = searchText
    ? otherAwards.filter(oa => (oa.ho_ten || '').toLowerCase().includes(searchText.toLowerCase()) || (oa.ten_giai_thuong || '').toLowerCase().includes(searchText.toLowerCase()))
    : otherAwards;

  // Emulation Form setup
  const openEditEmu = (record: any) => {
    setSelectedStudentEmu(record);
    const rec = record.awardRecord;

    const getFormValues = (val: string | null) => {
      if (!val) return { select: undefined, custom: undefined };
      if (AWARD_PRESETS.includes(val)) return { select: val, custom: undefined };
      return { select: 'Khác', custom: val };
    };

    const v1 = getFormValues(rec.hinh_thuc_nam_1);
    const v2 = getFormValues(rec.hinh_thuc_nam_2);
    const v3 = getFormValues(rec.hinh_thuc_nam_3);
    const v4 = getFormValues(rec.hinh_thuc_nam_4);
    const vtk = getFormValues(rec.hinh_thuc_toan_khoa);

    setCustomEmuN1(v1.select === 'Khác');
    setCustomEmuN2(v2.select === 'Khác');
    setCustomEmuN3(v3.select === 'Khác');
    setCustomEmuN4(v4.select === 'Khác');
    setCustomEmuTK(vtk.select === 'Khác');

    emuForm.setFieldsValue({
      diem_nam_1: rec.diem_nam_1,
      diem_nam_2: rec.diem_nam_2,
      diem_nam_3: rec.diem_nam_3,
      diem_nam_4: rec.diem_nam_4,

      sel_nam_1: v1.select,
      cust_nam_1: v1.custom,

      sel_nam_2: v2.select,
      cust_nam_2: v2.custom,

      sel_nam_3: v3.select,
      cust_nam_3: v3.custom,

      sel_nam_4: v4.select,
      cust_nam_4: v4.custom,

      sel_toan_khoa: vtk.select,
      cust_toan_khoa: vtk.custom,
    });

    setEmuModalOpen(true);
  };

  const handleSaveEmu = async () => {
    try {
      const vals = await emuForm.validateFields();
      const resolveValue = (sel: string, cust: string) => {
        if (!sel) return null;
        if (sel === 'Khác') return cust || null;
        return sel;
      };

      await saveAward({
        student_id: selectedStudentEmu.student_id,
        diem_nam_1: vals.diem_nam_1 ?? null,
        diem_nam_2: vals.diem_nam_2 ?? null,
        diem_nam_3: vals.diem_nam_3 ?? null,
        diem_nam_4: vals.diem_nam_4 ?? null,
        hinh_thuc_nam_1: resolveValue(vals.sel_nam_1, vals.cust_nam_1),
        hinh_thuc_nam_2: resolveValue(vals.sel_nam_2, vals.cust_nam_2),
        hinh_thuc_nam_3: resolveValue(vals.sel_nam_3, vals.cust_nam_3),
        hinh_thuc_nam_4: resolveValue(vals.sel_nam_4, vals.cust_nam_4),
        hinh_thuc_toan_khoa: resolveValue(vals.sel_toan_khoa, vals.cust_toan_khoa),
      });

      message.success('Đã lưu thông tin thi đua');
      setEmuModalOpen(false);
      loadData();
    } catch (err: any) {
      if (!err.errorFields) message.error('Lỗi: ' + err.message);
    }
  };

  // Unexpected Awards Save/Delete
  const openAddOther = () => {
    setEditingOtherAward(null);
    otherForm.resetFields();
    otherForm.setFieldsValue({ ngay_khen_thuong: dayjs() });
    setOtherModalOpen(true);
  };

  const openEditOther = (record: OtherAward) => {
    setEditingOtherAward(record);
    otherForm.setFieldsValue({
      student_id: record.student_id,
      loai_khen_thuong: record.loai_khen_thuong,
      ten_giai_thuong: record.ten_giai_thuong,
      cap_khen_thuong: record.cap_khen_thuong,
      nam_hoc: record.nam_hoc,
      ngay_khen_thuong: record.ngay_khen_thuong ? dayjs(record.ngay_khen_thuong) : null,
      ghi_chu: record.ghi_chu,
    });
    setOtherModalOpen(true);
  };

  const handleSaveOther = async () => {
    try {
      const vals = await otherForm.validateFields();
      await saveOtherAward({
        id: editingOtherAward?.id,
        student_id: vals.student_id,
        loai_khen_thuong: vals.loai_khen_thuong,
        ten_giai_thuong: vals.ten_giai_thuong,
        cap_khen_thuong: vals.cap_khen_thuong || null,
        nam_hoc: vals.nam_hoc || null,
        ngay_khen_thuong: vals.ngay_khen_thuong ? vals.ngay_khen_thuong.format('YYYY-MM-DD') : null,
        ghi_chu: vals.ghi_chu || null,
      });
      message.success(editingOtherAward ? 'Đã cập nhật' : 'Đã thêm khen thưởng');
      setOtherModalOpen(false);
      loadData();
    } catch (err: any) {
      if (!err.errorFields) message.error('Lỗi: ' + err.message);
    }
  };

  const handleDeleteOther = async (id: number) => {
    try {
      await deleteOtherAward(id);
      message.success('Đã xóa thành công');
      loadData();
    } catch (err: any) {
      message.error('Lỗi: ' + err.message);
    }
  };

  const handleCopyTable = () => {
    if (activeTab === 'emulation') {
      const headers = [
        'STT', 'Họ và tên', 'Đơn vị',
        'GPAN1', 'RLN1', 'KhenThưởngN1',
        'GPAN2', 'RLN2', 'KhenThưởngN2',
        'GPAN3', 'RLN3', 'KhenThưởngN3',
        'GPAN4', 'RLN4', 'KhenThưởngN4',
        'GPATK', 'RLTK', 'KhenThưởngTK'
      ];
      const rows = filteredEmulationRows.map((r, i) => [
        i + 1, r.ho_ten, r.unitStr,
        r.gpa1 ?? '', r.rl1 ?? '', r.hinh_thuc_nam_1 ?? '',
        r.gpa2 ?? '', r.rl2 ?? '', r.hinh_thuc_nam_2 ?? '',
        r.gpa3 ?? '', r.rl3 ?? '', r.hinh_thuc_nam_3 ?? '',
        r.gpa4 ?? '', r.rl4 ?? '', r.hinh_thuc_nam_4 ?? '',
        r.gpaTK ?? '', r.rlTK ?? '', r.hinh_thuc_toan_khoa ?? ''
      ]);
      const text = [headers, ...rows].map((r) => r.join('\t')).join('\n');
      navigator.clipboard.writeText(text);
      message.success('Đã copy dữ liệu Thi đua năm học & Toàn khóa');
    } else {
      const headers = ['STT', 'Họ và tên', 'Đơn vị', 'Loại khen thưởng', 'Tên giải thưởng', 'Cấp khen thưởng', 'Năm học', 'Ngày nhận', 'Ghi chú'];
      const rows = filteredOtherAwards.map((oa, i) => [
        i + 1, oa.ho_ten ?? '', oa.unit_name ?? '', oa.loai_khen_thuong, oa.ten_giai_thuong,
        oa.cap_khen_thuong ?? '', oa.nam_hoc ? `Năm ${oa.nam_hoc}` : '',
        oa.ngay_khen_thuong ? dayjs(oa.ngay_khen_thuong).format('DD/MM/YYYY') : '',
        oa.ghi_chu ?? ''
      ]);
      const text = [headers, ...rows].map((r) => r.join('\t')).join('\n');
      navigator.clipboard.writeText(text);
      message.success('Đã copy dữ liệu Khen thưởng đột xuất');
    }
  };

  // ============ Define Columns ============
  const emulationColumns: any[] = [
    {
      title: 'Học viên',
      fixed: 'left',
      children: [
        { title: 'STT', dataIndex: 'stt', width: 50, align: 'center', fixed: 'left' },
        {
          title: 'Họ và tên',
          dataIndex: 'ho_ten',
          width: 170,
          fixed: 'left',
          render: (text: string, record: any) =>
            isAdmin ? <a onClick={() => openEditEmu(record)} style={{ fontWeight: 600 }}>{text}</a> : <span style={{ fontWeight: 600 }}>{text}</span>
        },
        { title: 'Đơn vị', dataIndex: 'unitStr', width: 130 }
      ]
    },
    {
      title: 'Năm nhất',
      children: [
        { title: 'Học tập', dataIndex: 'gpa1', width: 75, align: 'center', render: renderScore },
        { title: 'Rèn luyện', dataIndex: 'rl1', width: 75, align: 'center', render: renderScore },
        {
          title: 'Khen thưởng',
          dataIndex: 'hinh_thuc_nam_1',
          width: 130,
          render: (v: string) => v ? <Tag color="blue">{v}</Tag> : <span style={{ color: '#ccc' }}>-</span>
        }
      ]
    },
    {
      title: 'Năm hai',
      children: [
        { title: 'Học tập', dataIndex: 'gpa2', width: 75, align: 'center', render: renderScore },
        { title: 'Rèn luyện', dataIndex: 'rl2', width: 75, align: 'center', render: renderScore },
        {
          title: 'Khen thưởng',
          dataIndex: 'hinh_thuc_nam_2',
          width: 130,
          render: (v: string) => v ? <Tag color="blue">{v}</Tag> : <span style={{ color: '#ccc' }}>-</span>
        }
      ]
    },
    {
      title: 'Năm ba',
      children: [
        { title: 'Học tập', dataIndex: 'gpa3', width: 75, align: 'center', render: renderScore },
        { title: 'Rèn luyện', dataIndex: 'rl3', width: 75, align: 'center', render: renderScore },
        {
          title: 'Khen thưởng',
          dataIndex: 'hinh_thuc_nam_3',
          width: 130,
          render: (v: string) => v ? <Tag color="blue">{v}</Tag> : <span style={{ color: '#ccc' }}>-</span>
        }
      ]
    },
    {
      title: 'Năm bốn',
      children: [
        { title: 'Học tập', dataIndex: 'gpa4', width: 75, align: 'center', render: renderScore },
        { title: 'Rèn luyện', dataIndex: 'rl4', width: 75, align: 'center', render: renderScore },
        {
          title: 'Khen thưởng',
          dataIndex: 'hinh_thuc_nam_4',
          width: 130,
          render: (v: string) => v ? <Tag color="blue">{v}</Tag> : <span style={{ color: '#ccc' }}>-</span>
        }
      ]
    },
    {
      title: 'Toàn khóa',
      fixed: 'right',
      children: [
        { title: 'Học tập', dataIndex: 'gpaTK', width: 80, align: 'center', render: (v: any) => <strong>{renderScore(v)}</strong> },
        { title: 'Rèn luyện', dataIndex: 'rlTK', width: 80, align: 'center', render: (v: any) => <strong>{renderScore(v)}</strong> },
        {
          title: 'Khen thưởng TK',
          dataIndex: 'hinh_thuc_toan_khoa',
          width: 140,
          render: (v: string) => v ? <Tag color="gold" style={{ fontWeight: 600 }}>{v}</Tag> : <span style={{ color: '#ccc' }}>-</span>
        }
      ]
    }
  ];

  const otherAwardColumns = [
    { title: 'STT', width: 55, align: 'center' as const, render: (_: any, __: any, i: number) => i + 1 },
    { title: 'Họ và tên', dataIndex: 'ho_ten', width: 180, fontWeight: 600, render: (v: string, r: any) => isAdmin ? <a onClick={() => openEditOther(r)}>{v}</a> : <span>{v}</span> },
    { title: 'Đơn vị', dataIndex: 'unit_name', width: 120 },
    { title: 'Loại khen thưởng', dataIndex: 'loai_khen_thuong', width: 140, render: (v: string) => <Tag color="cyan">{v}</Tag> },
    { title: 'Tên giải thưởng / Thành tích', dataIndex: 'ten_giai_thuong' },
    { title: 'Cấp khen thưởng', dataIndex: 'cap_khen_thuong', width: 130, render: (v: string) => v ? <Tag color="purple">{v}</Tag> : '-' },
    { title: 'Năm học', dataIndex: 'nam_hoc', width: 95, align: 'center' as const, render: (v: number) => v ? `Năm ${v}` : '-' },
    { title: 'Ngày nhận', dataIndex: 'ngay_khen_thuong', width: 110, align: 'center' as const, render: (v: string) => v ? dayjs(v).format('DD/MM/YYYY') : '-' },
    { title: 'Ghi chú', dataIndex: 'ghi_chu', ellipsis: true },
    ...(isAdmin ? [{
      title: '',
      width: 90,
      align: 'center' as const,
      render: (_: any, r: any) => (
        <Space size={2}>
          <Button size="small" icon={<EditOutlined />} type="text" onClick={() => openEditOther(r)} />
          <Popconfirm title="Xóa?" onConfirm={() => handleDeleteOther(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} type="text" />
          </Popconfirm>
        </Space>
      )
    }] : [])
  ];

  // Quick statistics counters for Tab 1
  const countEmuType = (type: string) => {
    let count = 0;
    awards.forEach(a => {
      if (a.hinh_thuc_nam_1 === type) count++;
      if (a.hinh_thuc_nam_2 === type) count++;
      if (a.hinh_thuc_nam_3 === type) count++;
      if (a.hinh_thuc_nam_4 === type) count++;
      if (a.hinh_thuc_toan_khoa === type) count++;
    });
    return count;
  };

  return (
    <div>
      <Space style={{ marginBottom: 20, justifyContent: 'space-between', width: '100%', flexWrap: 'wrap' }}>
        <Title level={4} style={{ margin: 0 }}><TrophyOutlined /> Thi đua & Khen thưởng</Title>
        <Space wrap>
          <Cascader options={buildCascaderOptions()} onChange={handleFilterUnit}
            placeholder="Lọc theo đơn vị" changeOnSelect allowClear style={{ width: 250 }} />
          <Input.Search
            placeholder="Tìm họ tên học viên..." value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 220 }} allowClear enterButton={<SearchOutlined />}
          />
          <Button icon={<CopyOutlined />} onClick={handleCopyTable}>Copy bảng</Button>
          {isAdmin && activeTab === 'other' && (
            <Button type="primary" icon={<PlusOutlined />} onClick={openAddOther}>Thêm khen thưởng</Button>
          )}
        </Space>
      </Space>

      <Tabs
        activeKey={activeTab}
        onChange={(k: any) => { setActiveTab(k); setSearchText(''); }}
        items={[
          {
            key: 'emulation',
            label: <span><TrophyOutlined /> Thi đua năm học & Toàn khóa</span>,
            children: (
              <>
                <Row gutter={16} style={{ marginBottom: 16 }}>
                  <Col xs={12} sm={8} md={6}>
                    <Card size="small">
                      <Statistic title="Chiến sĩ thi đua" value={countEmuType('Chiến sĩ thi đua')} styles={{ content: { color: '#faad14', fontWeight: 600 } }} />
                    </Card>
                  </Col>
                  <Col xs={12} sm={8} md={6}>
                    <Card size="small">
                      <Statistic title="Chiến sĩ tiên tiến" value={countEmuType('Chiến sĩ tiên tiến')} styles={{ content: { color: '#1677ff', fontWeight: 600 } }} />
                    </Card>
                  </Col>
                  <Col xs={12} sm={8} md={6}>
                    <Card size="small">
                      <Statistic title="Bằng khen / Giấy khen" value={countEmuType('Bằng khen') + countEmuType('Giấy khen')} styles={{ content: { color: '#52c41a', fontWeight: 600 } }} />
                    </Card>
                  </Col>
                </Row>
                <Card styles={{ body: { padding: 0 } }}>
                  <Table
                    columns={emulationColumns}
                    dataSource={filteredEmulationRows}
                    loading={loading}
                    size="middle"
                    scroll={{ x: 1400 }}
                    pagination={{ pageSize: 20 }}
                    bordered
                  />
                </Card>
              </>
            )
          },
          {
            key: 'other',
            label: <span><StarOutlined /> Khen thưởng đột xuất / Khác</span>,
            children: (
              <>
                <Card styles={{ body: { padding: 0 } }}>
                  <Table
                    columns={otherAwardColumns}
                    dataSource={filteredOtherAwards}
                    loading={loading}
                    size="middle"
                    rowKey="id"
                    pagination={{ pageSize: 20 }}
                    bordered
                  />
                </Card>
              </>
            )
          }
        ]}
      />

      {/* Modal Edit Emulation Awards for student */}
      <Modal
        title={`Thông tin Thi đua: ${selectedStudentEmu?.ho_ten}`}
        open={emuModalOpen}
        onOk={handleSaveEmu}
        onCancel={() => setEmuModalOpen(false)}
        okText="Lưu"
        cancelText="Hủy"
        width={750}
      >
        <Form form={emuForm} layout="vertical">
          <Row gutter={16}>
            {/* Year 1 */}
            <Col span={12}>
              <Card size="small" title="Năm thứ nhất" style={{ marginBottom: 12 }} styles={{ header: { padding: '4px 12px', minHeight: 32 } }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <Form.Item name="diem_nam_1" label="Điểm thi đua" style={{ marginBottom: 8 }}>
                    <InputNumber min={0} max={10} step={0.1} style={{ width: '100%' }} />
                  </Form.Item>
                  <Form.Item name="sel_nam_1" label="Hình thức khen thưởng" style={{ marginBottom: 8 }}>
                    <Select allowClear onChange={(v) => setCustomEmuN1(v === 'Khác')}>
                      {AWARD_PRESETS.map(p => <Select.Option key={p} value={p}>{p}</Select.Option>)}
                      <Select.Option value="Khác">Khác (tự nhập)</Select.Option>
                    </Select>
                  </Form.Item>
                </div>
                {customEmuN1 && (
                  <Form.Item name="cust_nam_1" label="Hình thức khác" rules={[{ required: true, message: 'Nhập hình thức' }]} style={{ marginBottom: 8 }}>
                    <Input placeholder="Tự nhập..." />
                  </Form.Item>
                )}
              </Card>
            </Col>

            {/* Year 2 */}
            <Col span={12}>
              <Card size="small" title="Năm thứ hai" style={{ marginBottom: 12 }} styles={{ header: { padding: '4px 12px', minHeight: 32 } }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <Form.Item name="diem_nam_2" label="Điểm thi đua" style={{ marginBottom: 8 }}>
                    <InputNumber min={0} max={10} step={0.1} style={{ width: '100%' }} />
                  </Form.Item>
                  <Form.Item name="sel_nam_2" label="Hình thức khen thưởng" style={{ marginBottom: 8 }}>
                    <Select allowClear onChange={(v) => setCustomEmuN2(v === 'Khác')}>
                      {AWARD_PRESETS.map(p => <Select.Option key={p} value={p}>{p}</Select.Option>)}
                      <Select.Option value="Khác">Khác (tự nhập)</Select.Option>
                    </Select>
                  </Form.Item>
                </div>
                {customEmuN2 && (
                  <Form.Item name="cust_nam_2" label="Hình thức khác" rules={[{ required: true, message: 'Nhập hình thức' }]} style={{ marginBottom: 8 }}>
                    <Input placeholder="Tự nhập..." />
                  </Form.Item>
                )}
              </Card>
            </Col>

            {/* Year 3 */}
            <Col span={12}>
              <Card size="small" title="Năm thứ ba" style={{ marginBottom: 12 }} styles={{ header: { padding: '4px 12px', minHeight: 32 } }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <Form.Item name="diem_nam_3" label="Điểm thi đua" style={{ marginBottom: 8 }}>
                    <InputNumber min={0} max={10} step={0.1} style={{ width: '100%' }} />
                  </Form.Item>
                  <Form.Item name="sel_nam_3" label="Hình thức khen thưởng" style={{ marginBottom: 8 }}>
                    <Select allowClear onChange={(v) => setCustomEmuN3(v === 'Khác')}>
                      {AWARD_PRESETS.map(p => <Select.Option key={p} value={p}>{p}</Select.Option>)}
                      <Select.Option value="Khác">Khác (tự nhập)</Select.Option>
                    </Select>
                  </Form.Item>
                </div>
                {customEmuN3 && (
                  <Form.Item name="cust_nam_3" label="Hình thức khác" rules={[{ required: true, message: 'Nhập hình thức' }]} style={{ marginBottom: 8 }}>
                    <Input placeholder="Tự nhập..." />
                  </Form.Item>
                )}
              </Card>
            </Col>

            {/* Year 4 */}
            <Col span={12}>
              <Card size="small" title="Năm thứ tư" style={{ marginBottom: 12 }} styles={{ header: { padding: '4px 12px', minHeight: 32 } }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <Form.Item name="diem_nam_4" label="Điểm thi đua" style={{ marginBottom: 8 }}>
                    <InputNumber min={0} max={10} step={0.1} style={{ width: '100%' }} />
                  </Form.Item>
                  <Form.Item name="sel_nam_4" label="Hình thức khen thưởng" style={{ marginBottom: 8 }}>
                    <Select allowClear onChange={(v) => setCustomEmuN4(v === 'Khác')}>
                      {AWARD_PRESETS.map(p => <Select.Option key={p} value={p}>{p}</Select.Option>)}
                      <Select.Option value="Khác">Khác (tự nhập)</Select.Option>
                    </Select>
                  </Form.Item>
                </div>
                {customEmuN4 && (
                  <Form.Item name="cust_nam_4" label="Hình thức khác" rules={[{ required: true, message: 'Nhập hình thức' }]} style={{ marginBottom: 8 }}>
                    <Input placeholder="Tự nhập..." />
                  </Form.Item>
                )}
              </Card>
            </Col>

            {/* Toàn khóa */}
            <Col span={24}>
              <Card size="small" title="Toàn khóa" styles={{ header: { padding: '4px 12px', minHeight: 32 } }}>
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item name="sel_toan_khoa" label="Hình thức khen thưởng" style={{ marginBottom: 8 }}>
                      <Select allowClear onChange={(v) => setCustomEmuTK(v === 'Khác')}>
                        {AWARD_PRESETS.map(p => <Select.Option key={p} value={p}>{p}</Select.Option>)}
                        <Select.Option value="Khác">Khác (tự nhập)</Select.Option>
                      </Select>
                    </Form.Item>
                  </Col>
                  {customEmuTK && (
                    <Col span={12}>
                      <Form.Item name="cust_toan_khoa" label="Hình thức khác" rules={[{ required: true, message: 'Nhập hình thức' }]} style={{ marginBottom: 8 }}>
                        <Input placeholder="Tự nhập..." />
                      </Form.Item>
                    </Col>
                  )}
                </Row>
              </Card>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* Modal Add/Edit Unexpected Awards */}
      <Modal
        title={editingOtherAward ? 'Cập nhật Khen thưởng đột xuất' : 'Thêm Khen thưởng đột xuất'}
        open={otherModalOpen}
        onOk={handleSaveOther}
        onCancel={() => setOtherModalOpen(false)}
        okText="Lưu"
        cancelText="Hủy"
        width={500}
      >
        <Form form={otherForm} layout="vertical">
          <Form.Item name="student_id" label="Học viên" rules={[{ required: true, message: 'Vui lòng chọn học viên' }]}>
            <Select
              placeholder="Chọn học viên..."
              showSearch
              optionFilterProp="label"
              disabled={!!editingOtherAward}
              options={students.map(s => ({ value: s.id, label: s.ho_ten }))}
            />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="loai_khen_thuong" label="Loại khen thưởng" rules={[{ required: true, message: 'Nhập loại khen thưởng' }]}>
                <Select placeholder="Chọn hoặc tự nhập..." mode="tags" maxCount={1} style={{ width: '100%' }}>
                  <Select.Option value="Học tập">Học tập</Select.Option>
                  <Select.Option value="Rèn luyện">Rèn luyện</Select.Option>
                  <Select.Option value="Thể thao">Thể thao</Select.Option>
                  <Select.Option value="Văn nghệ">Văn nghệ</Select.Option>
                  <Select.Option value="Khác">Khác</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="cap_khen_thuong" label="Cấp khen thưởng">
                <Select placeholder="Chọn hoặc tự nhập..." mode="tags" maxCount={1} style={{ width: '100%' }}>
                  {CAP_KHEN_THUONG_PRESETS.map(c => <Select.Option key={c} value={c}>{c}</Select.Option>)}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="ten_giai_thuong" label="Tên giải thưởng / Thành tích" rules={[{ required: true, message: 'Nhập tên giải thưởng' }]}>
            <Input placeholder="VD: Giải nhất Olympic Toán toàn quốc, Đạt thành tích xuất sắc..." />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="nam_hoc" label="Năm học">
                <Select placeholder="Chọn năm" allowClear>
                  {[1, 2, 3, 4].map(n => <Select.Option key={n} value={n}>Năm {n}</Select.Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="ngay_khen_thuong" label="Ngày khen thưởng">
                <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="ghi_chu" label="Ghi chú">
            <Input.TextArea rows={3} placeholder="Ghi chú chi tiết nếu có..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AwardsPage;
