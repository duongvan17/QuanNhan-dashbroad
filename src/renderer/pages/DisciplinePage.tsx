import React, { useEffect, useState, useCallback } from 'react';
import {
  Card, Table, Button, Modal, Form, Input, InputNumber, Select, Space, Typography,
  Cascader, App, Tag, Popconfirm,
} from 'antd';
import { PlusOutlined, StarOutlined, CopyOutlined, EditOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons';
import { getDisciplineScores, saveDisciplineScores, deleteDisciplineScore, getStudents, getUnits } from '../services/api';
import { useAuth } from '../auth/AuthContext';
import type { Unit } from '../../shared/types';

const { Title } = Typography;

const DisciplinePage: React.FC = () => {
  const { message } = App.useApp();
  const { isAdmin } = useAuth();
  const [scores, setScores] = useState<any[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [filters, setFilters] = useState<any>({ nam_hoc: 1, thang: 1 });
  const [form] = Form.useForm();
  const [searchText, setSearchText] = useState('');
  const displayScores = searchText
    ? scores.filter((s) => (s.ho_ten || '').toLowerCase().includes(searchText.toLowerCase()))
    : scores;

  const loadUnits = async () => { try { setUnits(await getUnits()); } catch { /* */ } };
  const loadStudents = async (unit_id?: number) => {
    try { const res = await getStudents({ unit_id, pageSize: 500 }); setStudents(res.data); } catch { /* */ }
  };

  const loadScores = useCallback(async () => {
    setLoading(true);
    try { setScores(await getDisciplineScores(filters)); }
    catch (err: any) { message.error('Lỗi: ' + err.message); }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { loadUnits(); }, []);
  useEffect(() => { loadScores(); }, [loadScores]);

  const buildCascaderOptions = () => {
    const tieuDoans = units.filter((u) => u.type === 'tieu_doan');
    return tieuDoans.map((td) => ({
      value: td.id, label: td.name,
      children: units.filter((u) => u.type === 'dai_doi' && u.parent_id === td.id).map((dd) => ({
        value: dd.id, label: dd.name,
        children: units.filter((u) => u.type === 'trung_doi' && u.parent_id === dd.id).map((trd) => ({ value: trd.id, label: trd.name })),
      })),
    }));
  };

  const handleFilterUnit = (value: any) => {
    const unit_id = value?.length > 0 ? value[value.length - 1] : undefined;
    setFilters((prev: any) => ({ ...prev, unit_id }));
    loadStudents(unit_id);
  };

  const handleAdd = async () => {
    try {
      const values = await form.validateFields();
      await saveDisciplineScores([{
        ...(editingId ? { id: editingId } : {}),
        student_id: values.student_id,
        nam_hoc: filters.nam_hoc, thang: filters.thang,
        tuan_1: values.tuan_1 ?? null, tuan_2: values.tuan_2 ?? null,
        tuan_3: values.tuan_3 ?? null, tuan_4: values.tuan_4 ?? null,
      }]);
      message.success(editingId ? 'Đã cập nhật' : 'Đã lưu');
      setModalOpen(false); setEditingId(null); form.resetFields(); loadScores();
    } catch (err: any) { if (!err.errorFields) message.error('Lỗi: ' + err.message); }
  };

  const renderDiem = (v: number | null) => {
    if (v == null) return <span style={{ color: '#ccc' }}>-</span>;
    const color = v >= 8 ? '#52c41a' : v >= 5 ? '#1677ff' : '#ff4d4f';
    return <span style={{ fontWeight: 600, fontSize: 15, color }}>{v}</span>;
  };

  const getXepLoaiTag = (v: string | null) => {
    if (!v) return '-';
    const colors: Record<string, string> = { 'Giỏi': 'green', 'Khá': 'blue', 'Trung bình': 'orange', 'Yếu': 'red' };
    return <Tag color={colors[v] || 'default'} style={{ fontSize: 13 }}>{v}</Tag>;
  };

  const handleCopy = () => {
    const headers = ['STT', 'Họ và tên', 'Tuần 01', 'Tuần 02', 'Tuần 03', 'Tuần 04', 'Điểm tháng', 'Xếp loại'];
    const rows = scores.map((s, i) => [i + 1, s.ho_ten, s.tuan_1 ?? '', s.tuan_2 ?? '', s.tuan_3 ?? '', s.tuan_4 ?? '', s.diem_thang ?? '', s.xep_loai ?? '']);
    const text = [headers, ...rows].map((r) => r.join('\t')).join('\n');
    navigator.clipboard.writeText(text);
    message.success('Đã copy - paste vào Excel');
  };

  const columns = [
    { title: 'STT', width: 60, render: (_: any, __: any, i: number) => i + 1 },
    { title: 'Họ và tên', dataIndex: 'ho_ten', width: 200 },
    { title: 'Tuần 01', dataIndex: 'tuan_1', width: 100, align: 'center' as const, render: renderDiem },
    { title: 'Tuần 02', dataIndex: 'tuan_2', width: 100, align: 'center' as const, render: renderDiem },
    { title: 'Tuần 03', dataIndex: 'tuan_3', width: 100, align: 'center' as const, render: renderDiem },
    { title: 'Tuần 04', dataIndex: 'tuan_4', width: 100, align: 'center' as const, render: renderDiem },
    {
      title: 'Điểm tháng', dataIndex: 'diem_thang', width: 120, align: 'center' as const,
      render: (v: number | null) => v != null
        ? <span style={{ fontWeight: 700, fontSize: 17, color: v >= 8 ? '#52c41a' : v >= 5 ? '#1677ff' : '#ff4d4f' }}>{v}</span>
        : '-',
    },
    { title: 'Xếp loại', dataIndex: 'xep_loai', width: 120, align: 'center' as const, render: getXepLoaiTag },
    ...(isAdmin ? [{
      title: '', width: 90, align: 'center' as const,
      render: (_: any, record: any) => (
        <Space size={4}>
          <Button size="small" icon={<EditOutlined />} type="text" onClick={() => {
            setEditingId(record.id);
            form.setFieldsValue({ student_id: record.student_id, tuan_1: record.tuan_1, tuan_2: record.tuan_2, tuan_3: record.tuan_3, tuan_4: record.tuan_4 });
            setModalOpen(true);
          }} />
          <Popconfirm title="Xóa?" onConfirm={async () => {
            try { await deleteDisciplineScore(record.id); message.success('Đã xóa'); loadScores(); }
            catch (err: any) { message.error('Lỗi: ' + err.message); }
          }}>
            <Button size="small" danger icon={<DeleteOutlined />} type="text" />
          </Popconfirm>
        </Space>
      ),
    }] : []),
  ];

  return (
    <div>
      <Space style={{ marginBottom: 20, justifyContent: 'space-between', width: '100%', flexWrap: 'wrap' }}>
        <Title level={4} style={{ margin: 0 }}><StarOutlined /> Điểm rèn luyện</Title>
        <Space wrap>
          <Cascader options={buildCascaderOptions()} onChange={handleFilterUnit}
            placeholder="Lọc theo đơn vị" changeOnSelect allowClear style={{ width: 300 }} />
          <Select value={filters.nam_hoc} onChange={(v) => setFilters((p: any) => ({ ...p, nam_hoc: v }))} style={{ width: 140 }}>
            {[1,2,3,4].map(n => <Select.Option key={n} value={n}>Năm {['nhất','hai','ba','bốn'][n-1]}</Select.Option>)}
          </Select>
          <Select value={filters.thang} onChange={(v) => setFilters((p: any) => ({ ...p, thang: v }))} style={{ width: 130 }}>
            {Array.from({ length: 12 }, (_, i) => (
              <Select.Option key={i + 1} value={i + 1}>Tháng {String(i + 1).padStart(2, '0')}</Select.Option>
            ))}
          </Select>
          <Input.Search
            placeholder="Tìm họ tên..." value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 220 }} allowClear enterButton={<SearchOutlined />}
          />
          <Button icon={<CopyOutlined />} onClick={handleCopy}>Copy bảng</Button>
          {isAdmin && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingId(null); form.resetFields(); setModalOpen(true); }}>Thêm điểm</Button>
          )}
        </Space>
      </Space>

      <Card styles={{ body: { padding: 0 } }}>
        <Table columns={columns} dataSource={displayScores} rowKey="id" loading={loading} size="middle"
          scroll={{ x: 900 }} pagination={false} bordered />
      </Card>

      {displayScores.length > 0 && (
        <Card size="small" style={{ marginTop: 16 }}>
          <Space size={24}>
            <span>Tổng: <strong>{displayScores.length}</strong> học viên</span>
            <span>
              Giỏi: <Tag color="green">{displayScores.filter(s => s.xep_loai === 'Giỏi').length}</Tag>
              Khá: <Tag color="blue">{displayScores.filter(s => s.xep_loai === 'Khá').length}</Tag>
              TB: <Tag color="orange">{displayScores.filter(s => s.xep_loai === 'Trung bình').length}</Tag>
              Yếu: <Tag color="red">{displayScores.filter(s => s.xep_loai === 'Yếu').length}</Tag>
            </span>
          </Space>
        </Card>
      )}

      <Modal title={editingId ? 'Sửa điểm rèn luyện' : 'Thêm điểm rèn luyện'} open={modalOpen} onOk={handleAdd}
        onCancel={() => { setModalOpen(false); setEditingId(null); }}
        okText="Lưu" cancelText="Hủy" width={500}>
        <Form form={form} layout="vertical">
          <Form.Item name="student_id" label="Học viên" rules={[{ required: true }]}>
            <Select placeholder="Chọn" showSearch optionFilterProp="label" disabled={editingId != null}
              options={students.map(s => ({ value: s.id, label: s.ho_ten }))} />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item name="tuan_1" label="Tuần 01"><InputNumber min={0} max={10} step={0.1} style={{ width: '100%' }} /></Form.Item>
            <Form.Item name="tuan_2" label="Tuần 02"><InputNumber min={0} max={10} step={0.1} style={{ width: '100%' }} /></Form.Item>
            <Form.Item name="tuan_3" label="Tuần 03"><InputNumber min={0} max={10} step={0.1} style={{ width: '100%' }} /></Form.Item>
            <Form.Item name="tuan_4" label="Tuần 04"><InputNumber min={0} max={10} step={0.1} style={{ width: '100%' }} /></Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default DisciplinePage;
