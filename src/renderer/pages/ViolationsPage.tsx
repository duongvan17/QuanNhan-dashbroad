import React, { useEffect, useState, useCallback } from 'react';
import {
  Card, Table, Button, Modal, Form, Select, DatePicker, Input, Space, Typography,
  Cascader, App, Popconfirm, Tag, Row, Col, Statistic,
} from 'antd';
import { PlusOutlined, DeleteOutlined, WarningOutlined, CopyOutlined } from '@ant-design/icons';
import { getViolations, createViolation, deleteViolation, getStudents, getUnits } from '../services/api';
import type { Unit } from '../../shared/types';
import dayjs from 'dayjs';

const { Title } = Typography;

const violationLabels: Record<string, { text: string; color: string }> = {
  khien_trach: { text: 'Khiển trách', color: 'orange' },
  canh_cao: { text: 'Cảnh cáo', color: 'red' },
  ky_luat: { text: 'Kỷ luật', color: '#8B0000' },
};

const ViolationsPage: React.FC = () => {
  const { message } = App.useApp();
  const [violations, setViolations] = useState<any[]>([]);
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

  const loadViolations = useCallback(async () => {
    setLoading(true);
    try { setViolations(await getViolations(filters)); }
    catch (err: any) { message.error('Lỗi: ' + err.message); }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { loadUnits(); loadStudents(); }, []);
  useEffect(() => { loadViolations(); }, [loadViolations]);

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
      await createViolation({
        student_id: values.student_id, loai: values.loai,
        ngay: values.ngay.format('YYYY-MM-DD'), ly_do: values.ly_do || undefined,
      });
      message.success('Đã thêm'); setModalOpen(false); form.resetFields(); loadViolations();
    } catch (err: any) { if (!err.errorFields) message.error('Lỗi: ' + err.message); }
  };

  const handleDelete = async (id: number) => {
    try { await deleteViolation(id); message.success('Đã xóa'); loadViolations(); }
    catch (err: any) { message.error('Lỗi: ' + err.message); }
  };

  // Group by student
  const groupByStudent = () => {
    const map = new Map<number, { ho_ten: string; student_id: number; records: any[]; khien_trach: number; canh_cao: number; ky_luat: number }>();
    violations.forEach((v) => {
      if (!map.has(v.student_id)) map.set(v.student_id, { ho_ten: v.ho_ten, student_id: v.student_id, records: [], khien_trach: 0, canh_cao: 0, ky_luat: 0 });
      const g = map.get(v.student_id)!;
      g.records.push(v);
      if (v.loai === 'khien_trach') g.khien_trach++;
      else if (v.loai === 'canh_cao') g.canh_cao++;
      else if (v.loai === 'ky_luat') g.ky_luat++;
    });
    return Array.from(map.values()).map((g, i) => ({ key: g.student_id, stt: i + 1, ...g, tong: g.records.length }));
  };

  const handleCopy = () => {
    const headers = ['STT', 'Họ và tên', 'Khiển trách', 'Cảnh cáo', 'Kỷ luật', 'Tổng'];
    const grouped = groupByStudent();
    const rows = grouped.map((g) => [g.stt, g.ho_ten, g.khien_trach, g.canh_cao, g.ky_luat, g.tong]);
    const text = [headers, ...rows].map((r) => r.join('\t')).join('\n');
    navigator.clipboard.writeText(text);
    message.success('Đã copy - paste vào Excel');
  };

  const grouped = groupByStudent();
  const countByType = (type: string) => violations.filter((v) => v.loai === type).length;

  const columns = [
    { title: 'STT', dataIndex: 'stt', width: 60 },
    { title: 'Họ và tên', dataIndex: 'ho_ten', width: 200 },
    {
      title: 'Khiển trách', dataIndex: 'khien_trach', width: 120, align: 'center' as const,
      render: (v: number) => v > 0 ? <Tag color="orange" style={{ fontSize: 14 }}>{v}</Tag> : <span style={{ color: '#ccc' }}>0</span>,
    },
    {
      title: 'Cảnh cáo', dataIndex: 'canh_cao', width: 120, align: 'center' as const,
      render: (v: number) => v > 0 ? <Tag color="red" style={{ fontSize: 14 }}>{v}</Tag> : <span style={{ color: '#ccc' }}>0</span>,
    },
    {
      title: 'Kỷ luật', dataIndex: 'ky_luat', width: 120, align: 'center' as const,
      render: (v: number) => v > 0 ? <Tag color="#8B0000" style={{ fontSize: 14, color: '#fff' }}>{v}</Tag> : <span style={{ color: '#ccc' }}>0</span>,
    },
    {
      title: 'Tổng', dataIndex: 'tong', width: 100, align: 'center' as const,
      render: (v: number) => <strong style={{ fontSize: 16 }}>{v}</strong>,
    },
  ];

  const expandedRowRender = (record: any) => (
    <Table
      columns={[
        {
          title: 'Loại', dataIndex: 'loai', width: 130,
          render: (v: string) => { const info = violationLabels[v]; return info ? <Tag color={info.color}>{info.text}</Tag> : v; },
        },
        { title: 'Ngày', dataIndex: 'ngay', width: 130, render: (v: string) => dayjs(v).format('DD/MM/YYYY') },
        { title: 'Lý do', dataIndex: 'ly_do', render: (v: string) => v || '-' },
        {
          title: '', width: 80,
          render: (_: any, r: any) => (
            <Popconfirm title="Xóa?" onConfirm={() => handleDelete(r.id)}>
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          ),
        },
      ]}
      dataSource={record.records}
      rowKey="id"
      pagination={false}
      size="small"
    />
  );

  return (
    <div>
      <Space style={{ marginBottom: 20, justifyContent: 'space-between', width: '100%', flexWrap: 'wrap' }}>
        <Title level={4} style={{ margin: 0 }}><WarningOutlined /> Vi phạm</Title>
        <Space wrap>
          <Cascader options={buildCascaderOptions()} onChange={handleFilterUnit}
            placeholder="Lọc theo đơn vị" changeOnSelect allowClear style={{ width: 300 }} />
          <Button icon={<CopyOutlined />} onClick={handleCopy}>Copy bảng</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setModalOpen(true); }}>Thêm vi phạm</Button>
        </Space>
      </Space>

      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col xs={8} sm={6} md={4}>
          <Card size="small"><Statistic title="Khiển trách" value={countByType('khien_trach')} valueStyle={{ color: '#faad14', fontSize: 28 }} /></Card>
        </Col>
        <Col xs={8} sm={6} md={4}>
          <Card size="small"><Statistic title="Cảnh cáo" value={countByType('canh_cao')} valueStyle={{ color: '#ff4d4f', fontSize: 28 }} /></Card>
        </Col>
        <Col xs={8} sm={6} md={4}>
          <Card size="small"><Statistic title="Kỷ luật" value={countByType('ky_luat')} valueStyle={{ color: '#8B0000', fontSize: 28 }} /></Card>
        </Col>
      </Row>

      <Card styles={{ body: { padding: 0 } }}>
        <Table columns={columns} dataSource={grouped} rowKey="key" loading={loading} size="middle"
          bordered pagination={false}
          expandable={{ expandedRowRender, rowExpandable: (r) => r.tong > 0 }} />
      </Card>

      <Modal title="Thêm vi phạm" open={modalOpen} onOk={handleAdd} onCancel={() => setModalOpen(false)}
        okText="Lưu" cancelText="Hủy" width={500}>
        <Form form={form} layout="vertical">
          <Form.Item name="student_id" label="Học viên" rules={[{ required: true }]}>
            <Select placeholder="Chọn" showSearch optionFilterProp="label"
              options={students.map(s => ({ value: s.id, label: s.ho_ten }))} />
          </Form.Item>
          <Form.Item name="loai" label="Loại" rules={[{ required: true }]}>
            <Select placeholder="Chọn loại">
              <Select.Option value="khien_trach">Khiển trách</Select.Option>
              <Select.Option value="canh_cao">Cảnh cáo</Select.Option>
              <Select.Option value="ky_luat">Kỷ luật</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="ngay" label="Ngày" rules={[{ required: true }]}>
            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="ly_do" label="Lý do">
            <Input.TextArea rows={3} placeholder="Mô tả lý do" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ViolationsPage;
