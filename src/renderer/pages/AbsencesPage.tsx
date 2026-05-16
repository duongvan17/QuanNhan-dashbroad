import React, { useEffect, useState, useCallback } from 'react';
import {
  Card, Table, Button, Modal, Form, Select, DatePicker, Input, Space, Typography,
  Cascader, App, Popconfirm, Tag, Row, Col, Statistic,
} from 'antd';
import { PlusOutlined, DeleteOutlined, CalendarOutlined, CopyOutlined } from '@ant-design/icons';
import { getAbsences, createAbsence, deleteAbsence, getStudents, getUnits } from '../services/api';
import { useAuth } from '../auth/AuthContext';
import type { Unit } from '../../shared/types';
import dayjs from 'dayjs';

const { Title } = Typography;

const AbsencesPage: React.FC = () => {
  const { message } = App.useApp();
  const { isAdmin } = useAuth();
  const [absences, setAbsences] = useState<any[]>([]);
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

  const loadAbsences = useCallback(async () => {
    setLoading(true);
    try { setAbsences(await getAbsences(filters)); }
    catch (err: any) { message.error('Lỗi: ' + err.message); }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { loadUnits(); loadStudents(); }, []);
  useEffect(() => { loadAbsences(); }, [loadAbsences]);

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
      await createAbsence({
        student_id: values.student_id,
        ngay_vang: values.ngay_vang.format('YYYY-MM-DD'),
        ghi_chu: values.ghi_chu || undefined,
      });
      message.success('Đã thêm'); setModalOpen(false); form.resetFields(); loadAbsences();
    } catch (err: any) { if (!err.errorFields) message.error('Lỗi: ' + err.message); }
  };

  const handleDelete = async (id: number) => {
    try { await deleteAbsence(id); message.success('Đã xóa'); loadAbsences(); }
    catch (err: any) { message.error('Lỗi: ' + err.message); }
  };

  // Group by student
  const groupByStudent = () => {
    const map = new Map<number, { ho_ten: string; student_id: number; records: any[] }>();
    absences.forEach((a) => {
      if (!map.has(a.student_id)) map.set(a.student_id, { ho_ten: a.ho_ten, student_id: a.student_id, records: [] });
      map.get(a.student_id)!.records.push(a);
    });
    return Array.from(map.values()).map((g, i) => ({
      key: g.student_id,
      stt: i + 1,
      ho_ten: g.ho_ten,
      tong_cong: g.records.length,
      ngay_vang: g.records.map((r) => dayjs(r.ngay_vang).format('DD/MM/YYYY')).join(', '),
      records: g.records,
    }));
  };

  const handleCopy = () => {
    const grouped = groupByStudent();
    const headers = ['STT', 'Họ và tên', 'Tổng công vắng', 'Các ngày vắng'];
    const rows = grouped.map((g) => [g.stt, g.ho_ten, g.tong_cong, g.ngay_vang]);
    const text = [headers, ...rows].map((r) => r.join('\t')).join('\n');
    navigator.clipboard.writeText(text);
    message.success('Đã copy - paste vào Excel');
  };

  const grouped = groupByStudent();
  const soHvVang = grouped.length;
  const hvKhongVang = Math.max(0, students.length - soHvVang);

  const studentColumns = [
    { title: 'STT', dataIndex: 'stt', width: 60 },
    { title: 'Họ và tên', dataIndex: 'ho_ten', width: 200 },
    {
      title: 'Tổng công vắng', dataIndex: 'tong_cong', width: 140, align: 'center' as const,
      render: (v: number) => <Tag color={v === 0 ? 'green' : v <= 2 ? 'orange' : 'red'} style={{ fontSize: 15 }}>{v}</Tag>,
    },
    {
      title: 'Các ngày vắng', dataIndex: 'ngay_vang', ellipsis: true,
      render: (v: string) => v || <span style={{ color: '#ccc' }}>Không vắng</span>,
    },
  ];

  const expandedRowRender = (record: any) => (
    <Table
      columns={[
        { title: 'Ngày vắng', dataIndex: 'ngay_vang', width: 150, render: (v: string) => <Tag color="orange">{dayjs(v).format('DD/MM/YYYY')}</Tag> },
        { title: 'Ghi chú', dataIndex: 'ghi_chu', render: (v: string) => v || '-' },
        ...(isAdmin ? [{
          title: '', width: 80,
          render: (_: any, r: any) => (
            <Popconfirm title="Xóa?" onConfirm={() => handleDelete(r.id)}>
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          ),
        }] : []),
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
        <Title level={4} style={{ margin: 0 }}><CalendarOutlined /> Công vắng</Title>
        <Space wrap>
          <Cascader options={buildCascaderOptions()} onChange={handleFilterUnit}
            placeholder="Lọc theo đơn vị" changeOnSelect allowClear style={{ width: 300 }} />
          <Button icon={<CopyOutlined />} onClick={handleCopy}>Copy bảng</Button>
          {isAdmin && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setModalOpen(true); }}>Thêm công vắng</Button>
          )}
        </Space>
      </Space>

      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col xs={8} sm={6} md={4}>
          <Card size="small"><Statistic title="Tổng lượt vắng" value={absences.length} valueStyle={{ color: '#faad14', fontSize: 28 }} /></Card>
        </Col>
        <Col xs={8} sm={6} md={4}>
          <Card size="small"><Statistic title="Số HV vắng" value={soHvVang} valueStyle={{ color: '#ff4d4f', fontSize: 28 }} /></Card>
        </Col>
        <Col xs={8} sm={6} md={4}>
          <Card size="small"><Statistic title="HV không vắng" value={hvKhongVang} valueStyle={{ color: '#52c41a', fontSize: 28 }} /></Card>
        </Col>
      </Row>

      <Card styles={{ body: { padding: 0 } }}>
        <Table
          columns={studentColumns}
          dataSource={grouped}
          rowKey="key"
          loading={loading}
          size="middle"
          bordered
          expandable={{ expandedRowRender, rowExpandable: (r) => r.tong_cong > 0 }}
          pagination={false}
        />
      </Card>

      <Modal title="Thêm công vắng" open={modalOpen} onOk={handleAdd} onCancel={() => setModalOpen(false)}
        okText="Lưu" cancelText="Hủy" width={480}>
        <Form form={form} layout="vertical">
          <Form.Item name="student_id" label="Học viên" rules={[{ required: true }]}>
            <Select placeholder="Chọn" showSearch optionFilterProp="label"
              options={students.map(s => ({ value: s.id, label: s.ho_ten }))} />
          </Form.Item>
          <Form.Item name="ngay_vang" label="Ngày vắng" rules={[{ required: true }]}>
            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="ghi_chu" label="Ghi chú">
            <Input.TextArea rows={2} placeholder="Lý do (nếu có)" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AbsencesPage;
