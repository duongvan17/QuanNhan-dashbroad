import React, { useEffect, useState, useCallback } from 'react';
import {
  Card, Table, Button, Modal, Form, Input, InputNumber, Select, Space, Typography,
  Cascader, App, Tag, Popconfirm, Tabs, Radio, Tooltip
} from 'antd';
import { PlusOutlined, BookOutlined, CopyOutlined, DeleteOutlined, SearchOutlined, TrophyOutlined } from '@ant-design/icons';
import { getAcademicScores, saveAcademicScores, deleteAcademicScore, getStudents, getUnits } from '../services/api';
import { useAuth } from '../auth/AuthContext';
import type { Unit } from '../../shared/types';

const { Title } = Typography;

const InlineScoreInput = ({ initialValue, studentId, subject, defaultCredit, scoreObj, filters, onSave }: any) => {
  const { message } = App.useApp();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState<number | null>(initialValue);
  const [loading, setLoading] = useState(false);

  useEffect(() => { setValue(initialValue); }, [initialValue]);

  const save = async () => {
    if (value === initialValue) {
      setEditing(false);
      return;
    }
    setLoading(true);
    try {
      if (value == null) {
        if (scoreObj?.id) {
          await deleteAcademicScore(scoreObj.id);
        }
      } else {
        await saveAcademicScores([{
          id: scoreObj?.id,
          student_id: studentId,
          nam_hoc: filters.nam_hoc,
          hoc_ky: filters.hoc_ky,
          mon_hoc: subject,
          tin_chi: scoreObj?.tin_chi || defaultCredit || 1,
          diem: value,
        }]);
      }
      setEditing(false);
      onSave();
    } catch (err: any) {
      message.error('Lỗi: ' + err.message);
      setValue(initialValue);
    } finally {
      setLoading(false);
    }
  };

  if (editing) {
    return (
      <InputNumber
        autoFocus
        min={0} max={10} step={0.1}
        value={value}
        onChange={(v) => setValue(v)}
        onBlur={save}
        onPressEnter={save}
        disabled={loading}
        size="small"
        style={{ width: 65, textAlign: 'center' }}
      />
    );
  }

  return (
    <div 
      onClick={() => setEditing(true)} 
      style={{ 
        cursor: 'pointer', 
        minHeight: 24, 
        color: initialValue == null ? '#ccc' : initialValue >= 8 ? '#52c41a' : initialValue >= 5 ? '#1677ff' : '#ff4d4f', 
        fontWeight: 600, 
        fontSize: 15,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '4px 0'
      }}
      title="Nhấn để nhập/sửa điểm"
    >
      {initialValue != null ? initialValue : '-'}
    </div>
  );
};

const AcademicPage: React.FC = () => {
  const { message } = App.useApp();
  const { isAdmin } = useAuth();
  const [scores, setScores] = useState<any[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [filters, setFilters] = useState<any>({ nam_hoc: 1, hoc_ky: 1 });
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingScore, setEditingScore] = useState<any>(null);
  const [searchText, setSearchText] = useState('');
  const [rankOpen, setRankOpen] = useState(false);
  const [localSubjects, setLocalSubjects] = useState<{ name: string; credits: number }[]>([]);
  const [addSubjectModalOpen, setAddSubjectModalOpen] = useState(false);
  const [subjectForm] = Form.useForm();

  // Rankings variables
  const [rankTab, setRankTab] = useState<'semester' | 'course'>('semester');
  const [rankSearchText, setRankSearchText] = useState('');
  const [allTimeScores, setAllTimeScores] = useState<any[]>([]);
  const [rankingLoading, setRankingLoading] = useState(false);

  const loadAllTimeScores = async () => {
    setRankingLoading(true);
    try {
      const data = await getAcademicScores({});
      setAllTimeScores(data);
    } catch (err: any) {
      message.error('Lỗi tải dữ liệu bảng xếp hạng: ' + err.message);
    } finally {
      setRankingLoading(false);
    }
  };

  useEffect(() => {
    if (rankOpen) {
      loadAllTimeScores();
    }
  }, [rankOpen]);

  useEffect(() => {
    if (scores.length > 0 && localSubjects.length > 0) {
      const dbSubjects = new Set(scores.map(s => s.mon_hoc.toLowerCase().trim()));
      setLocalSubjects(prev => prev.filter(sub => !dbSubjects.has(sub.name.toLowerCase().trim())));
    }
  }, [scores]);

  const getSemesterLabel = (namHoc: number, hocKy: number) => {
    const romanMap: Record<number, string[]> = {
      1: ['I', 'II'],
      2: ['III', 'IV'],
      3: ['V', 'VI'],
      4: ['VII', 'VIII']
    };
    return `Học kỳ ${romanMap[namHoc]?.[hocKy - 1] || hocKy}`;
  };

  const getStaticSTT = (studentId: number, studentUnitId: number) => {
    const platoonStudents = students.filter(s => s.unit_id === studentUnitId);
    if (platoonStudents.length === 0) return '-';
    // Sắp xếp học viên theo alphabet của họ tên tiếng Việt
    const sorted = [...platoonStudents].sort((a, b) => (a.ho_ten || '').localeCompare(b.ho_ten || '', 'vi'));
    const idx = sorted.findIndex(s => s.id === studentId);
    return idx !== -1 ? idx + 1 : '-';
  };

  const getRankData = () => {
    if (allTimeScores.length === 0) return [];

    let dataset: any[] = [];
    if (rankTab === 'semester') {
      dataset = allTimeScores.filter(s => s.nam_hoc === filters.nam_hoc && s.hoc_ky === filters.hoc_ky);
    } else {
      dataset = allTimeScores;
    }

    const studentMap = new Map<number, { student_id: number; ho_ten: string; unit_id: number; totalWeighted: number; totalCredits: number }>();
    dataset.forEach((s) => {
      if (!studentMap.has(s.student_id)) {
        studentMap.set(s.student_id, {
          student_id: s.student_id,
          ho_ten: s.ho_ten,
          unit_id: s.unit_id,
          totalWeighted: 0,
          totalCredits: 0
        });
      }
      const entry = studentMap.get(s.student_id)!;
      entry.totalWeighted += s.diem * (s.tin_chi || 1);
      entry.totalCredits += (s.tin_chi || 1);
    });

    const list = Array.from(studentMap.values()).map((entry) => {
      const gpa = entry.totalCredits > 0 ? Math.round((entry.totalWeighted / entry.totalCredits) * 100) / 100 : null;
      let xep_loai = '-';
      if (gpa != null) {
        if (gpa >= 8) xep_loai = 'Giỏi';
        else if (gpa >= 7.2) xep_loai = 'Khá';
        else if (gpa >= 5) xep_loai = 'Trung bình';
        else xep_loai = 'Yếu';
      }
      return {
        student_id: entry.student_id,
        ho_ten: entry.ho_ten,
        unit_id: entry.unit_id,
        gpa,
        xep_loai
      };
    }).filter(x => x.gpa !== null);

    const sorted = list.sort((a, b) => (b.gpa ?? 0) - (a.gpa ?? 0));

    const getUnitHierarchy = (uid: number) => {
      const platoon = units.find(u => u.id === uid);
      const company = platoon ? units.find(u => u.id === platoon.parent_id) : null;
      const battalion = company ? units.find(u => u.id === company.parent_id) : null;
      return {
        platoonId: uid,
        platoonName: platoon?.name || '',
        companyId: company?.id || null,
        companyName: company?.name || '',
        battalionId: battalion?.id || null,
        battalionName: battalion?.name || ''
      };
    };

    const ranked = sorted.map((item, index, arr) => {
      const h = getUnitHierarchy(item.unit_id);
      
      const platoonList = arr.filter(x => x.unit_id === item.unit_id);
      const platoonRank = platoonList.findIndex(x => x.student_id === item.student_id) + 1;

      const companyList = arr.filter(x => {
        const xh = getUnitHierarchy(x.unit_id);
        return xh.companyId === h.companyId && h.companyId !== null;
      });
      const companyRank = companyList.findIndex(x => x.student_id === item.student_id) + 1;

      const battalionList = arr.filter(x => {
        const xh = getUnitHierarchy(x.unit_id);
        return xh.battalionId === h.battalionId && h.battalionId !== null;
      });
      const battalionRank = battalionList.findIndex(x => x.student_id === item.student_id) + 1;

      const unitStr = [h.companyName, h.platoonName].filter(Boolean).join(' > ');

      return {
        ...item,
        key: item.student_id,
        rankOverall: index + 1,
        rankPlatoon: platoonRank,
        rankCompany: companyRank,
        rankBattalion: battalionRank,
        unitStr
      };
    });

    if (rankSearchText) {
      return ranked.filter(r => (r.ho_ten || '').toLowerCase().includes(rankSearchText.toLowerCase()));
    }
    return ranked;
  };

  const loadUnits = async () => {
    try { setUnits(await getUnits()); } catch { /* */ }
  };

  const loadStudents = async (unit_id?: number) => {
    try {
      const res = await getStudents({ unit_id, pageSize: 500 });
      setStudents(res.data);
    } catch { /* */ }
  };

  const loadScores = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAcademicScores(filters);
      setScores(data);
    } catch (err: any) {
      message.error('Lỗi: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { loadUnits(); loadStudents(); }, []);
  useEffect(() => { loadScores(); }, [loadScores]);

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

  const handleFilterUnit = (value: any) => {
    const unit_id = value?.length > 0 ? value[value.length - 1] : undefined;
    setFilters((prev: any) => ({ ...prev, unit_id }));
    loadStudents(unit_id);
  };

  const handleAdd = async () => {
    try {
      const values = await form.validateFields();
      await saveAcademicScores([{
        student_id: values.student_id,
        nam_hoc: filters.nam_hoc,
        hoc_ky: filters.hoc_ky,
        mon_hoc: values.mon_hoc,
        tin_chi: values.tin_chi || 1,
        diem: values.diem || 0,
      }]);
      message.success('Đã thêm điểm');
      setModalOpen(false);
      form.resetFields();
      loadScores();
    } catch (err: any) {
      if (err.errorFields) return;
      message.error('Lỗi: ' + err.message);
    }
  };

  const handleCreateSubjectColumn = () => {
    subjectForm.validateFields().then((values) => {
      const name = values.name.trim();
      const credits = values.credits || 1;
      if (name) {
        const existsInDb = scores.some(s => s.mon_hoc.toLowerCase().trim() === name.toLowerCase().trim());
        const existsInLocal = localSubjects.some(s => s.name.toLowerCase().trim() === name.toLowerCase().trim());
        if (existsInDb || existsInLocal) {
          message.warning('Môn học này đã tồn tại trong bảng!');
          return;
        }
        setLocalSubjects(prev => [...prev, { name, credits }]);
        setAddSubjectModalOpen(false);
        subjectForm.resetFields();
        message.success(`Đã thêm cột môn học "${name}"`);
      }
    });
  };

  const handleEditScore = (studentId: number, hoTen: string, subject: string, scoreData: any) => {
    setEditingScore({ studentId, hoTen, subject, ...scoreData });
    editForm.setFieldsValue({
      mon_hoc: subject,
      tin_chi: scoreData?.tin_chi || 1,
      diem: scoreData?.diem || 0,
    });
    setEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    try {
      const values = await editForm.validateFields();
      await saveAcademicScores([{
        id: editingScore?.id,
        student_id: editingScore.studentId,
        nam_hoc: filters.nam_hoc,
        hoc_ky: filters.hoc_ky,
        mon_hoc: values.mon_hoc,
        tin_chi: values.tin_chi || 1,
        diem: values.diem,
      }]);
      message.success('Đã cập nhật');
      setEditModalOpen(false);
      loadScores();
    } catch (err: any) {
      if (!err.errorFields) message.error('Lỗi: ' + err.message);
    }
  };

  const handleDeleteScore = async (id: number) => {
    try {
      await deleteAcademicScore(id);
      message.success('Đã xóa');
      loadScores();
    } catch (err: any) {
      message.error('Lỗi: ' + err.message);
    }
  };

  const handleDeleteAllScoresForStudent = async (studentId: number) => {
    const studentScores = scores.filter(s => s.student_id === studentId);
    for (const s of studentScores) {
      try { await deleteAcademicScore(s.id); } catch { /* */ }
    }
    message.success(`Đã xóa ${studentScores.length} điểm`);
    loadScores();
  };

  // ====== Pivot: group by student, subjects as columns ======
  const buildPivotData = () => {
    // Lấy danh sách môn học unique + tín chỉ (lấy giá trị tín chỉ đầu tiên không null)
    const subjectSet = new Set<string>();
    const subjectCredit: Record<string, number> = {};
    scores.forEach((s) => {
      subjectSet.add(s.mon_hoc);
      const tc = Number(s.tin_chi);
      if (subjectCredit[s.mon_hoc] == null && tc > 0) subjectCredit[s.mon_hoc] = tc;
    });
    
    // Thêm các môn học từ localSubjects
    localSubjects.forEach((sub) => {
      subjectSet.add(sub.name);
      if (subjectCredit[sub.name] == null) {
        subjectCredit[sub.name] = sub.credits;
      }
    });

    const subjects = Array.from(subjectSet).sort();

    // Group theo student
    const studentMap = new Map<number, {
      student_id: number;
      ho_ten: string;
      scores: Record<string, { diem: number; tin_chi: number; id: number }>;
    }>();

    scores.forEach((s) => {
      if (!studentMap.has(s.student_id)) {
        studentMap.set(s.student_id, {
          student_id: s.student_id,
          ho_ten: s.ho_ten,
          scores: {},
        });
      }
      const entry = studentMap.get(s.student_id)!;
      entry.scores[s.mon_hoc] = { diem: s.diem, tin_chi: s.tin_chi, id: s.id };
    });

    // Tính TB + xếp loại
    const rows = Array.from(studentMap.values()).map((entry) => {
      const row: any = {
        key: entry.student_id,
        student_id: entry.student_id,
        ho_ten: entry.ho_ten,
      };

      let totalWeighted = 0;
      let totalCredits = 0;

      subjects.forEach((sub) => {
        const sc = entry.scores[sub];
        if (sc) {
          row[`score_${sub}`] = sc.diem;
          totalWeighted += sc.diem * (sc.tin_chi || 1);
          totalCredits += (sc.tin_chi || 1);
        } else {
          row[`score_${sub}`] = null;
        }
      });

      row.avg = totalCredits > 0 ? Math.round((totalWeighted / totalCredits) * 100) / 100 : null;
      if (row.avg != null) {
        if (row.avg >= 8) row.xep_loai = 'Giỏi';
        else if (row.avg >= 7.2) row.xep_loai = 'Khá';
        else if (row.avg >= 5) row.xep_loai = 'Trung bình';
        else row.xep_loai = 'Yếu';
      }

      return row;
    });

    return { subjects, rows, subjectCredit };
  };

  const { subjects, rows, subjectCredit } = buildPivotData();
  const displayRows = searchText
    ? rows.filter((r: any) => (r.ho_ten || '').toLowerCase().includes(searchText.toLowerCase()))
    : rows;

  const getXepLoaiTag = (v: string) => {
    const colors: Record<string, string> = { 'Giỏi': 'green', 'Khá': 'blue', 'Trung bình': 'orange', 'Yếu': 'red' };
    return <Tag color={colors[v] || 'default'} style={{ fontSize: 13 }}>{v}</Tag>;
  };


  const handleCopy = () => {
    const headers = ['STT', 'Họ và tên', ...subjects, 'Trung bình', 'Xếp loại'];
    const data = rows.map((r, i) => [
      i + 1, r.ho_ten,
      ...subjects.map((sub) => r[`score_${sub}`] ?? ''),
      r.avg ?? '', r.xep_loai ?? '',
    ]);
    const text = [headers, ...data].map((r) => r.join('\t')).join('\n');
    navigator.clipboard.writeText(text);
    message.success('Đã copy - paste vào Excel');
  };

  // Lấy score object theo student + subject
  const getScoreObj = (studentId: number, subject: string) => {
    return scores.find(s => s.student_id === studentId && s.mon_hoc === subject);
  };

  const columns: any[] = [
    { title: 'STT', width: 60, fixed: 'left', render: (_: any, __: any, i: number) => i + 1 },
    { title: 'Họ và tên', dataIndex: 'ho_ten', width: 200, fixed: 'left' },
    ...subjects.map((sub) => ({
      title: (
        <div style={{ lineHeight: 1.2 }}>
          <div style={{ fontWeight: 600 }}>{sub}</div>
          {subjectCredit[sub] != null && (
            <div style={{ fontSize: 11, color: '#888', fontWeight: 400 }}>{subjectCredit[sub]} tín chỉ</div>
          )}
        </div>
      ),
      dataIndex: `score_${sub}`,
      width: 110,
      align: 'center' as const,
      render: (v: number | null, record: any) => (
        isAdmin ? (
          <InlineScoreInput
            initialValue={v}
            studentId={record.student_id}
            subject={sub}
            defaultCredit={subjectCredit[sub]}
            scoreObj={getScoreObj(record.student_id, sub)}
            filters={filters}
            onSave={loadScores}
          />
        ) : (
          <span style={{ color: v == null ? '#ccc' : v >= 8 ? '#52c41a' : v >= 5 ? '#1677ff' : '#ff4d4f', fontWeight: 600, fontSize: 15 }}>
            {v != null ? v : '-'}
          </span>
        )
      ),
    })),
    {
      title: 'TB', dataIndex: 'avg', width: 90, align: 'center' as const, fixed: 'right' as const,
      render: (v: number | null) => v != null
        ? <span style={{ fontWeight: 700, fontSize: 16, color: v >= 8 ? '#52c41a' : v >= 5 ? '#1677ff' : '#ff4d4f' }}>{v}</span>
        : '-',
    },
    {
      title: 'Xếp loại', dataIndex: 'xep_loai', width: 100, align: 'center' as const, fixed: 'right' as const,
      render: (v: string) => v ? getXepLoaiTag(v) : '-',
    },
    ...(isAdmin ? [{
      title: '', width: 50, fixed: 'right' as const, align: 'center' as const,
      render: (_: any, record: any) => (
        <Popconfirm title="Xóa tất cả điểm của học viên này?" onConfirm={() => handleDeleteAllScoresForStudent(record.student_id)}>
          <Button size="small" danger icon={<DeleteOutlined />} type="text" />
        </Popconfirm>
      ),
    }] : []),
  ];

  return (
    <div>
      <Space style={{ marginBottom: 20, justifyContent: 'space-between', width: '100%', flexWrap: 'wrap' }}>
        <Title level={4} style={{ margin: 0 }}><BookOutlined /> Điểm học tập</Title>
        <Space wrap>
          <Cascader options={buildCascaderOptions()} onChange={handleFilterUnit}
            placeholder="Lọc theo đơn vị" changeOnSelect allowClear style={{ width: 300 }} />
          <Select value={filters.nam_hoc} onChange={(v) => setFilters((p: any) => ({ ...p, nam_hoc: v, hoc_ky: 1 }))}
            style={{ width: 140 }}>
            <Select.Option value={1}>Năm nhất</Select.Option>
            <Select.Option value={2}>Năm hai</Select.Option>
            <Select.Option value={3}>Năm ba</Select.Option>
            <Select.Option value={4}>Năm bốn</Select.Option>
          </Select>
          <Select value={filters.hoc_ky} onChange={(v) => setFilters((p: any) => ({ ...p, hoc_ky: v }))}
            style={{ width: 130 }}>
            <Select.Option value={1}>{getSemesterLabel(filters.nam_hoc, 1)}</Select.Option>
            <Select.Option value={2}>{getSemesterLabel(filters.nam_hoc, 2)}</Select.Option>
          </Select>
          <Input.Search
            placeholder="Tìm họ tên..." value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 220 }} allowClear enterButton={<SearchOutlined />}
          />
          <Button icon={<TrophyOutlined />} onClick={() => setRankOpen(true)}>Bảng xếp hạng</Button>
          <Button icon={<CopyOutlined />} onClick={handleCopy}>Copy bảng</Button>
          {isAdmin && (
            <>
              <Button type="primary" ghost icon={<BookOutlined />} onClick={() => { subjectForm.resetFields(); setAddSubjectModalOpen(true); }}>
                Thêm môn học
              </Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setModalOpen(true); }}>
                Thêm điểm
              </Button>
            </>
          )}
        </Space>
      </Space>

      <Card styles={{ body: { padding: 0 } }}>
        <Table
          columns={columns}
          dataSource={displayRows}
          rowKey="key"
          loading={loading}
          size="middle"
          scroll={{ x: 400 + subjects.length * 110 + 240 }}
          pagination={false}
          bordered
        />
      </Card>

      {displayRows.length > 0 && (
        <Card size="small" style={{ marginTop: 16 }}>
          <Space size={24}>
            <span>Tổng: <strong>{displayRows.length}</strong> học viên, <strong>{subjects.length}</strong> môn</span>
            <span>
              Giỏi: <Tag color="green">{displayRows.filter((r) => r.xep_loai === 'Giỏi').length}</Tag>
              Khá: <Tag color="blue">{displayRows.filter((r) => r.xep_loai === 'Khá').length}</Tag>
              TB: <Tag color="orange">{displayRows.filter((r) => r.xep_loai === 'Trung bình').length}</Tag>
              Yếu: <Tag color="red">{displayRows.filter((r) => r.xep_loai === 'Yếu').length}</Tag>
            </span>
          </Space>
        </Card>
      )}

      <Modal title="Thêm điểm học tập" open={modalOpen} onOk={handleAdd} onCancel={() => setModalOpen(false)}
        okText="Lưu" cancelText="Hủy" width={500}>
        <Form form={form} layout="vertical">
          <Form.Item name="student_id" label="Học viên" rules={[{ required: true, message: 'Chọn học viên' }]}>
            <Select placeholder="Chọn học viên" showSearch optionFilterProp="label"
              options={students.map((s) => ({ value: s.id, label: s.ho_ten }))} />
          </Form.Item>
          <Form.Item name="mon_hoc" label="Môn học" rules={[{ required: true, message: 'Nhập tên môn' }]}>
            <Input placeholder="VD: Toán cao cấp" />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item name="tin_chi" label="Tín chỉ" initialValue={1}>
              <InputNumber min={1} max={10} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="diem" label="Điểm" rules={[{ required: true, message: 'Nhập điểm' }]}>
              <InputNumber min={0} max={10} step={0.1} style={{ width: '100%' }} placeholder="8.5" />
            </Form.Item>
          </div>
        </Form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        title={`Sửa điểm: ${editingScore?.hoTen} - ${editingScore?.subject}`}
        open={editModalOpen}
        onCancel={() => setEditModalOpen(false)}
        footer={[
          editingScore?.id && (
            <Popconfirm key="del" title="Xóa điểm này?" onConfirm={() => { handleDeleteScore(editingScore.id); setEditModalOpen(false); }}>
              <Button danger icon={<DeleteOutlined />}>Xóa</Button>
            </Popconfirm>
          ),
          <Button key="cancel" onClick={() => setEditModalOpen(false)}>Hủy</Button>,
          <Button key="save" type="primary" onClick={handleSaveEdit}>Lưu</Button>,
        ]}
        width={400}
      >
        <Form form={editForm} layout="vertical">
          <Form.Item name="mon_hoc" label="Môn học" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item name="tin_chi" label="Tín chỉ">
              <InputNumber min={1} max={10} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="diem" label="Điểm" rules={[{ required: true }]}>
              <InputNumber min={0} max={10} step={0.1} style={{ width: '100%' }} />
            </Form.Item>
          </div>
        </Form>
      </Modal>

      {/* Ranking Modal */}
      <Modal
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingRight: 32 }}>
            <span style={{ fontSize: 18, fontWeight: 600 }}><TrophyOutlined style={{ color: '#faad14' }} /> Bảng xếp hạng Học tập</span>
            <Radio.Group value={rankTab} onChange={(e) => setRankTab(e.target.value)} size="small">
              <Radio.Button value="semester">Học kỳ hiện tại</Radio.Button>
              <Radio.Button value="course">Toàn khóa</Radio.Button>
            </Radio.Group>
          </div>
        }
        open={rankOpen}
        onCancel={() => { setRankOpen(false); setRankSearchText(''); }}
        footer={null}
        width={900}
      >
        <Input.Search
          placeholder="Tìm họ tên học viên..."
          value={rankSearchText}
          onChange={(e) => setRankSearchText(e.target.value)}
          style={{ marginBottom: 16 }}
          allowClear
          enterButton
        />
        <Table
          dataSource={getRankData()}
          rowKey="key"
          loading={rankingLoading}
          pagination={{ pageSize: 20 }}
          size="middle"
          scroll={{ y: 450 }}
          columns={[
            {
              title: 'Hạng',
              width: 70,
              align: 'center',
              render: (_: any, r: any) => (
                <strong style={{ color: r.rankOverall <= 3 ? '#faad14' : 'inherit' }}>
                  {r.rankOverall}
                </strong>
              )
            },
            {
              title: (
                <Tooltip title="Số thứ tự cố định theo tên trong trung đội">
                  STT Tên
                </Tooltip>
              ),
              width: 80,
              align: 'center',
              render: (_: any, r: any) => <span style={{ color: '#888' }}>{getStaticSTT(r.student_id, r.unit_id)}</span>
            },
            { title: 'Họ và tên', dataIndex: 'ho_ten', fontWeight: 600 },
            { title: 'Đơn vị', dataIndex: 'unitStr', width: 140 },
            {
              title: 'Điểm TB',
              dataIndex: 'gpa',
              width: 90,
              align: 'center',
              render: (v: number) => (
                <strong style={{ color: v >= 8 ? '#52c41a' : v >= 7.2 ? '#1677ff' : '#faad14', fontSize: 15 }}>
                  {v}
                </strong>
              )
            },
            { title: 'Hạng TĐ', dataIndex: 'rankPlatoon', width: 90, align: 'center' },
            { title: 'Hạng ĐĐ', dataIndex: 'rankCompany', width: 90, align: 'center' },
            { title: 'Hạng TĐoàn', dataIndex: 'rankBattalion', width: 100, align: 'center' },
            {
              title: 'Xếp loại',
              dataIndex: 'xep_loai',
              width: 110,
              align: 'center',
              render: (v: string) => getXepLoaiTag(v)
            },
          ]}
        />
      </Modal>

      {/* Add Subject Modal */}
      <Modal title="Thêm môn học mới (Thêm cột)" open={addSubjectModalOpen} onOk={handleCreateSubjectColumn} onCancel={() => setAddSubjectModalOpen(false)}
        okText="Thêm cột" cancelText="Hủy" width={400}>
        <Form form={subjectForm} layout="vertical">
          <Form.Item name="name" label="Tên môn học" rules={[{ required: true, message: 'Nhập tên môn học' }]}>
            <Input placeholder="VD: Triết học Mác - Lênin" />
          </Form.Item>
          <Form.Item name="credits" label="Số tín chỉ (tùy chọn)" initialValue={2} rules={[{ required: true, message: 'Nhập số tín chỉ' }]}>
            <InputNumber min={1} max={10} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AcademicPage;
