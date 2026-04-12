import React, { useEffect, useState, useCallback } from 'react';
import {
  Card, Table, Button, Modal, Form, InputNumber, Select, Space, Typography,
  Cascader, message, Tag, Popconfirm,
} from 'antd';
import { PlusOutlined, TrophyOutlined, CopyOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { getAwards, saveAward, deleteAward, getStudents, getUnits } from '../services/api';
import type { Unit } from '../../shared/types';

const { Title } = Typography;

const AwardsPage: React.FC = () => {
  const [awards, setAwards] = useState<any[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [filters, setFilters] = useState<any>({});
  const [form] = Form.useForm();

  const loadUnits = async () => { try { setUnits(await getUnits()); } catch { /* */ } };
  const loadStudents = async (unit_id?: number) => {
    try { const res = await getStudents({ unit_id, pageSize: 500 }); setStudents(res.data); } catch { /* */ }
  };

  const loadAwards = useCallback(async () => {
    setLoading(true);
    try { setAwards(await getAwards(filters)); }
    catch (err: any) { message.error('Lỗi: ' + err.message); }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { loadUnits(); loadStudents(); }, []);
  useEffect(() => { loadAwards(); }, [loadAwards]);

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

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      await saveAward({
        student_id: values.student_id,
        diem_nam_1: values.diem_nam_1 ?? null, diem_nam_2: values.diem_nam_2 ?? null,
        diem_nam_3: values.diem_nam_3 ?? null, diem_nam_4: values.diem_nam_4 ?? null,
      });
      message.success('Đã lưu'); setModalOpen(false); form.resetFields(); loadAwards();
    } catch (err: any) { if (!err.errorFields) message.error('Lỗi: ' + err.message); }
  };

  const openEdit = (record: any) => {
    form.setFieldsValue({
      student_id: record.student_id,
      diem_nam_1: record.diem_nam_1, diem_nam_2: record.diem_nam_2,
      diem_nam_3: record.diem_nam_3, diem_nam_4: record.diem_nam_4,
    });
    setModalOpen(true);
  };

  const renderDiem = (v: number | null) => {
    if (v == null) return <span style={{ color: '#ccc' }}>-</span>;
    const color = v >= 8 ? '#52c41a' : v >= 7.2 ? '#1677ff' : v >= 5 ? '#faad14' : '#ff4d4f';
    return <span style={{ fontWeight: 600, fontSize: 15, color }}>{v}</span>;
  };

  const getXepLoaiTag = (v: string | null) => {
    if (!v) return '-';
    const colors: Record<string, string> = { 'Giỏi': 'green', 'Khá': 'blue', 'Trung bình': 'orange' };
    return <Tag color={colors[v] || 'default'} style={{ fontSize: 13 }}>{v}</Tag>;
  };

  const handleCopy = () => {
    const headers = ['STT', 'Họ và tên', 'Năm nhất', 'Năm hai', 'Năm ba', 'Năm bốn', 'Tổng kết', 'Xếp loại'];
    const rows = awards.map((a, i) => [i + 1, a.ho_ten, a.diem_nam_1 ?? '', a.diem_nam_2 ?? '', a.diem_nam_3 ?? '', a.diem_nam_4 ?? '', a.tong_ket ?? '', a.xep_loai ?? '']);
    const text = [headers, ...rows].map((r) => r.join('\t')).join('\n');
    navigator.clipboard.writeText(text);
    message.success('Đã copy - paste vào Excel');
  };

  const columns = [
    { title: 'STT', width: 60, render: (_: any, __: any, i: number) => i + 1 },
    {
      title: 'Họ và tên', dataIndex: 'ho_ten', width: 200,
      render: (text: string, record: any) => <a onClick={() => openEdit(record)}>{text}</a>,
    },
    { title: 'Năm nhất', dataIndex: 'diem_nam_1', width: 110, align: 'center' as const, render: renderDiem },
    { title: 'Năm hai', dataIndex: 'diem_nam_2', width: 110, align: 'center' as const, render: renderDiem },
    { title: 'Năm ba', dataIndex: 'diem_nam_3', width: 110, align: 'center' as const, render: renderDiem },
    { title: 'Năm bốn', dataIndex: 'diem_nam_4', width: 110, align: 'center' as const, render: renderDiem },
    {
      title: 'Tổng kết', dataIndex: 'tong_ket', width: 110, align: 'center' as const,
      render: (v: number | null) => v != null
        ? <span style={{ fontWeight: 700, fontSize: 17, color: v >= 8 ? '#52c41a' : v >= 7.2 ? '#1677ff' : '#faad14' }}>{v}</span>
        : '-',
    },
    { title: 'Xếp loại', dataIndex: 'xep_loai', width: 120, align: 'center' as const, render: getXepLoaiTag },
    {
      title: '', width: 90, align: 'center' as const,
      render: (_: any, record: any) => (
        <Space size={4}>
          <Button size="small" icon={<EditOutlined />} type="text" onClick={() => openEdit(record)} />
          <Popconfirm title="Xóa?" onConfirm={async () => {
            try { await deleteAward(record.id); message.success('Đã xóa'); loadAwards(); }
            catch (err: any) { message.error('Lỗi: ' + err.message); }
          }}>
            <Button size="small" danger icon={<DeleteOutlined />} type="text" />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 20, justifyContent: 'space-between', width: '100%', flexWrap: 'wrap' }}>
        <Title level={4} style={{ margin: 0 }}><TrophyOutlined /> Thi đua khen thưởng</Title>
        <Space wrap>
          <Cascader options={buildCascaderOptions()} onChange={handleFilterUnit}
            placeholder="Lọc theo đơn vị" changeOnSelect allowClear style={{ width: 300 }} />
          <Button icon={<CopyOutlined />} onClick={handleCopy}>Copy bảng</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setModalOpen(true); }}>Thêm / Sửa</Button>
        </Space>
      </Space>

      <Card style={{ marginBottom: 16 }} size="small">
        <Space size={24}>
          <span>Quy định: <Tag color="green">Giỏi &ge; 8.0</Tag> <Tag color="blue">Khá &ge; 7.2</Tag> <Tag color="orange">TB &lt; 7.2</Tag></span>
          {awards.length > 0 && (
            <span>
              Giỏi: <Tag color="green">{awards.filter(a => a.xep_loai === 'Giỏi').length}</Tag>
              Khá: <Tag color="blue">{awards.filter(a => a.xep_loai === 'Khá').length}</Tag>
              TB: <Tag color="orange">{awards.filter(a => a.xep_loai === 'Trung bình').length}</Tag>
            </span>
          )}
        </Space>
      </Card>

      <Card bodyStyle={{ padding: 0 }}>
        <Table columns={columns} dataSource={awards} rowKey="id" loading={loading} size="middle"
          scroll={{ x: 900 }} pagination={false} bordered />
      </Card>

      <Modal title="Điểm thi đua" open={modalOpen} onOk={handleSave} onCancel={() => setModalOpen(false)}
        okText="Lưu" cancelText="Hủy" width={500}>
        <Form form={form} layout="vertical">
          <Form.Item name="student_id" label="Học viên" rules={[{ required: true }]}>
            <Select placeholder="Chọn" showSearch optionFilterProp="label"
              options={students.map(s => ({ value: s.id, label: s.ho_ten }))} />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item name="diem_nam_1" label="Năm nhất"><InputNumber min={0} max={10} step={0.1} style={{ width: '100%' }} /></Form.Item>
            <Form.Item name="diem_nam_2" label="Năm hai"><InputNumber min={0} max={10} step={0.1} style={{ width: '100%' }} /></Form.Item>
            <Form.Item name="diem_nam_3" label="Năm ba"><InputNumber min={0} max={10} step={0.1} style={{ width: '100%' }} /></Form.Item>
            <Form.Item name="diem_nam_4" label="Năm bốn"><InputNumber min={0} max={10} step={0.1} style={{ width: '100%' }} /></Form.Item>
          </div>
          <p style={{ color: '#999', fontSize: 13 }}>Tổng kết và xếp loại tính tự động.</p>
        </Form>
      </Modal>
    </div>
  );
};

export default AwardsPage;
