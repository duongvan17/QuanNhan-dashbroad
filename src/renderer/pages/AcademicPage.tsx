import React, { useEffect, useState, useCallback } from 'react';
import {
  Card, Table, Button, Modal, Form, Input, InputNumber, Select, Space, Typography,
  Cascader, message, Tag, Popconfirm,
} from 'antd';
import { PlusOutlined, BookOutlined, CopyOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';
import { getAcademicScores, saveAcademicScores, deleteAcademicScore, getStudents, getUnits } from '../services/api';
import type { Unit } from '../../shared/types';

const { Title } = Typography;

const AcademicPage: React.FC = () => {
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

  useEffect(() => { loadUnits(); }, []);
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
            children: trungDois.map((trd) => ({ value: trd.id, label: trd.name })),
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
    // Lấy danh sách môn học unique
    const subjectSet = new Set<string>();
    scores.forEach((s) => subjectSet.add(s.mon_hoc));
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

    return { subjects, rows };
  };

  const { subjects, rows } = buildPivotData();

  const getXepLoaiTag = (v: string) => {
    const colors: Record<string, string> = { 'Giỏi': 'green', 'Khá': 'blue', 'Trung bình': 'orange', 'Yếu': 'red' };
    return <Tag color={colors[v] || 'default'} style={{ fontSize: 13 }}>{v}</Tag>;
  };

  const renderDiem = (v: number | null) => {
    if (v == null) return <span style={{ color: '#ccc' }}>-</span>;
    const color = v >= 8 ? '#52c41a' : v >= 5 ? '#1677ff' : '#ff4d4f';
    return <span style={{ fontWeight: 600, fontSize: 15, color }}>{v}</span>;
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
      title: sub,
      dataIndex: `score_${sub}`,
      width: 100,
      align: 'center' as const,
      render: (v: number | null, record: any) => (
        <a onClick={() => handleEditScore(record.student_id, record.ho_ten, sub, getScoreObj(record.student_id, sub))}
          style={{ color: v == null ? '#ccc' : v >= 8 ? '#52c41a' : v >= 5 ? '#1677ff' : '#ff4d4f', fontWeight: 600, fontSize: 15 }}>
          {v != null ? v : '-'}
        </a>
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
    {
      title: '', width: 50, fixed: 'right' as const, align: 'center' as const,
      render: (_: any, record: any) => (
        <Popconfirm title="Xóa tất cả điểm của học viên này?" onConfirm={() => handleDeleteAllScoresForStudent(record.student_id)}>
          <Button size="small" danger icon={<DeleteOutlined />} type="text" />
        </Popconfirm>
      ),
    },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 20, justifyContent: 'space-between', width: '100%', flexWrap: 'wrap' }}>
        <Title level={4} style={{ margin: 0 }}><BookOutlined /> Điểm học tập</Title>
        <Space wrap>
          <Cascader options={buildCascaderOptions()} onChange={handleFilterUnit}
            placeholder="Lọc theo đơn vị" changeOnSelect allowClear style={{ width: 300 }} />
          <Select value={filters.nam_hoc} onChange={(v) => setFilters((p: any) => ({ ...p, nam_hoc: v }))}
            style={{ width: 140 }}>
            <Select.Option value={1}>Năm nhất</Select.Option>
            <Select.Option value={2}>Năm hai</Select.Option>
            <Select.Option value={3}>Năm ba</Select.Option>
            <Select.Option value={4}>Năm bốn</Select.Option>
          </Select>
          <Select value={filters.hoc_ky} onChange={(v) => setFilters((p: any) => ({ ...p, hoc_ky: v }))}
            style={{ width: 130 }}>
            <Select.Option value={1}>Học kỳ I</Select.Option>
            <Select.Option value={2}>Học kỳ II</Select.Option>
          </Select>
          <Button icon={<CopyOutlined />} onClick={handleCopy}>Copy bảng</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setModalOpen(true); }}>
            Thêm điểm
          </Button>
        </Space>
      </Space>

      <Card styles={{ body: { padding: 0 } }}>
        <Table
          columns={columns}
          dataSource={rows}
          rowKey="key"
          loading={loading}
          size="middle"
          scroll={{ x: 400 + subjects.length * 100 + 220 }}
          pagination={false}
          bordered
        />
      </Card>

      {rows.length > 0 && (
        <Card size="small" style={{ marginTop: 16 }}>
          <Space size={24}>
            <span>Tổng: <strong>{rows.length}</strong> học viên, <strong>{subjects.length}</strong> môn</span>
            <span>
              Giỏi: <Tag color="green">{rows.filter((r) => r.xep_loai === 'Giỏi').length}</Tag>
              Khá: <Tag color="blue">{rows.filter((r) => r.xep_loai === 'Khá').length}</Tag>
              TB: <Tag color="orange">{rows.filter((r) => r.xep_loai === 'Trung bình').length}</Tag>
              Yếu: <Tag color="red">{rows.filter((r) => r.xep_loai === 'Yếu').length}</Tag>
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
    </div>
  );
};

export default AcademicPage;
