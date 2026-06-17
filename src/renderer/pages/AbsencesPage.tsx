import React, { useEffect, useState, useCallback } from 'react';
import {
  Card, Table, Button, Modal, Form, Select, DatePicker, Input, Space, Typography,
  Cascader, App, Popconfirm, Tag, Row, Col, Statistic, InputNumber
} from 'antd';
import { PlusOutlined, DeleteOutlined, CalendarOutlined, CopyOutlined, SearchOutlined } from '@ant-design/icons';
import { getAbsences, createAbsence, deleteAbsence, getStudents, getUnits, updateAbsenceNote } from '../services/api';
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
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedStudentRecords, setSelectedStudentRecords] = useState<any>(null);
  const [filters, setFilters] = useState<any>({ nam_hoc: 1, hoc_ky: 1 });
  const [form] = Form.useForm();
  const [searchText, setSearchText] = useState('');

  const loadUnits = async () => { try { setUnits(await getUnits()); } catch { /* */ } };
  const loadStudents = async (unit_id?: number) => {
    try { const res = await getStudents({ unit_id, pageSize: 1000 }); setStudents(res.data); } catch { /* */ }
  };

  const loadAbsences = useCallback(async () => {
    setLoading(true);
    try { setAbsences(await getAbsences(filters)); }
    catch (err: any) { message.error('Lỗi: ' + err.message); }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { loadUnits(); loadStudents(); }, []);
  useEffect(() => { loadAbsences(); }, [loadAbsences]);

  const getSemesterLabel = (namHoc: number, hocKy: number) => {
    const romanMap: Record<number, string[]> = {
      1: ['I', 'II'],
      2: ['III', 'IV'],
      3: ['V', 'VI'],
      4: ['VII', 'VIII']
    };
    return `Học kỳ ${romanMap[namHoc]?.[hocKy - 1] || hocKy}`;
  };

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

  const handleAdd = async () => {
    try {
      const values = await form.validateFields();
      await createAbsence({
        student_id: values.student_id,
        ngay_vang: values.ngay_vang.format('YYYY-MM-DD'),
        mon_hoc: values.mon_hoc || null,
        so_tiet_vang: values.so_tiet_vang || 1,
        ten_bai: values.ten_bai || null,
        giang_vien: values.giang_vien || null,
        ghi_chu: values.ghi_chu || null,
        ghi_chu_thi: values.ghi_chu_thi || 'Đủ điều kiện thi',
        nam_hoc: values.nam_hoc || filters.nam_hoc || 1,
        hoc_ky: values.hoc_ky || filters.hoc_ky || 1,
      });
      message.success('Đã thêm'); setModalOpen(false); form.resetFields(); loadAbsences();
    } catch (err: any) { if (!err.errorFields) message.error('Lỗi: ' + err.message); }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteAbsence(id);
      message.success('Đã xóa');
      loadAbsences();
      if (selectedStudentRecords) {
        setSelectedStudentRecords((prev: any) => {
          if (!prev) return null;
          const filtered = prev.records.filter((r: any) => r.id !== id);
          return {
            ...prev,
            records: filtered,
            tong_tiet: filtered.reduce((sum: number, r: any) => sum + (r.so_tiet_vang || 1), 0)
          };
        });
      }
    } catch (err: any) { message.error('Lỗi: ' + err.message); }
  };

  // Group by student
  const groupByStudent = () => {
    const map = new Map<number, { ho_ten: string; student_id: number; unit_name: string; records: any[] }>();
    absences.forEach((a) => {
      if (!map.has(a.student_id)) {
        map.set(a.student_id, {
          ho_ten: a.ho_ten,
          student_id: a.student_id,
          unit_name: a.unit_name || '',
          records: []
        });
      }
      map.get(a.student_id)!.records.push(a);
    });

    return Array.from(map.values()).map((g, i) => {
      const uniqueSubjects = Array.from(new Set(g.records.map((r) => r.mon_hoc).filter(Boolean)));
      const tong_tiet = g.records.reduce((sum, r) => sum + (r.so_tiet_vang || 1), 0);
      const ghi_chu_thi = g.records[0]?.ghi_chu_thi || 'Đủ điều kiện thi';

      return {
        key: g.student_id,
        stt: i + 1,
        ho_ten: g.ho_ten,
        student_id: g.student_id,
        unit_name: g.unit_name,
        tong_tiet,
        mon_vang: uniqueSubjects.join(', ') || 'Chưa rõ',
        ghi_chu_thi,
        records: g.records,
      };
    });
  };

  const handleCopy = () => {
    const grouped = groupByStudent();
    const headers = ['STT', 'Họ và tên', 'Đơn vị', 'Môn vắng', 'Tổng tiết vắng', 'Ghi chú thi'];
    const rows = grouped.map((g) => [g.stt, g.ho_ten, g.unit_name, g.mon_vang, g.tong_tiet, g.ghi_chu_thi]);
    const text = [headers, ...rows].map((r) => r.join('\t')).join('\n');
    navigator.clipboard.writeText(text);
    message.success('Đã copy - paste vào Excel');
  };

  const grouped = groupByStudent();
  const displayGrouped = searchText
    ? grouped.filter((g) => g.ho_ten.toLowerCase().includes(searchText.toLowerCase()))
    : grouped;
  const soHvVang = grouped.length;
  const hvKhongVang = Math.max(0, students.length - soHvVang);

  const NoteSelector = ({ studentId, currentNote, records }: any) => {
    const [value, setValue] = useState(currentNote || 'Đủ điều kiện thi');
    const [selectorLoading, setSelectorLoading] = useState(false);

    const change = async (v: string) => {
      setSelectorLoading(true);
      try {
        await Promise.all(records.map((r: any) => updateAbsenceNote(r.id, v, r.ghi_chu)));
        setValue(v);
        message.success('Đã cập nhật điều kiện thi');
        loadAbsences();
      } catch (err: any) {
        message.error('Lỗi cập nhật: ' + err.message);
      } finally {
        setSelectorLoading(false);
      }
    };

    return (
      <Select
        value={value}
        onChange={change}
        disabled={!isAdmin || selectorLoading}
        size="small"
        style={{ width: 170 }}
        dropdownStyle={{ minWidth: 170 }}
      >
        <Select.Option value="Đủ điều kiện thi">
          <Tag color="green">Đủ điều kiện thi</Tag>
        </Select.Option>
        <Select.Option value="Chưa đủ điều kiện thi">
          <Tag color="red">Chưa đủ điều kiện thi</Tag>
        </Select.Option>
      </Select>
    );
  };

  const studentColumns = [
    { title: 'STT', dataIndex: 'stt', width: 60, align: 'center' as const },
    { title: 'Họ và tên', dataIndex: 'ho_ten', width: 180, fontWeight: 600 },
    { title: 'Đơn vị', dataIndex: 'unit_name', width: 130 },
    {
      title: 'Môn vắng',
      dataIndex: 'mon_vang',
      render: (v: string) => v.split(', ').map((s, idx) => s && s !== 'Chưa rõ' ? <Tag key={idx} color="blue">{s}</Tag> : <span style={{ color: '#ccc' }}>-</span>)
    },
    {
      title: 'Tổng số tiết vắng',
      dataIndex: 'tong_tiet',
      width: 150,
      align: 'center' as const,
      render: (v: number, record: any) => (
        <Button
          type="link"
          onClick={() => { setSelectedStudentRecords(record); setDetailModalOpen(true); }}
          style={{ fontWeight: 700, fontSize: 15 }}
        >
          {v} tiết (Xem)
        </Button>
      )
    },
    {
      title: 'Đủ điều kiện thi?',
      dataIndex: 'ghi_chu_thi',
      width: 200,
      align: 'center' as const,
      render: (v: string, record: any) => (
        <NoteSelector studentId={record.student_id} currentNote={v} records={record.records} />
      )
    }
  ];

  const expandedRowRender = (record: any) => (
    <Table
      columns={[
        { title: 'Ngày vắng', dataIndex: 'ngay_vang', width: 130, render: (v: string) => dayjs(v).format('DD/MM/YYYY') },
        { title: 'Môn học', dataIndex: 'mon_hoc', width: 150 },
        { title: 'Số tiết', dataIndex: 'so_tiet_vang', width: 80, align: 'center' as const },
        { title: 'Tên bài học', dataIndex: 'ten_bai', width: 180 },
        { title: 'Giảng viên', dataIndex: 'giang_vien', width: 150 },
        { title: 'Lý do vắng', dataIndex: 'ghi_chu' },
        ...(isAdmin ? [{
          title: '', width: 60, align: 'center' as const,
          render: (_: any, r: any) => (
            <Popconfirm title="Xóa lượt vắng này?" onConfirm={() => handleDelete(r.id)}>
              <Button size="small" danger icon={<DeleteOutlined />} type="text" />
            </Popconfirm>
          ),
        }] : []),
      ]}
      dataSource={record.records}
      rowKey="id"
      pagination={false}
      size="small"
      bordered
    />
  );

  return (
    <div>
      <Space style={{ marginBottom: 20, justifyContent: 'space-between', width: '100%', flexWrap: 'wrap' }}>
        <Title level={4} style={{ margin: 0 }}><CalendarOutlined /> Công vắng</Title>
        <Space wrap>
          <Cascader options={buildCascaderOptions()} onChange={handleFilterUnit}
            placeholder="Lọc theo đơn vị" changeOnSelect allowClear style={{ width: 250 }} />
          <Select value={filters.nam_hoc} onChange={(v) => setFilters((p: any) => ({ ...p, nam_hoc: v, hoc_ky: 1 }))} style={{ width: 120 }}>
            {[1,2,3,4].map(n => <Select.Option key={n} value={n}>Năm {['nhất','hai','ba','bốn'][n-1]}</Select.Option>)}
          </Select>
          <Select value={filters.hoc_ky} onChange={(v) => setFilters((p: any) => ({ ...p, hoc_ky: v }))} style={{ width: 130 }}>
            <Select.Option value={1}>{getSemesterLabel(filters.nam_hoc, 1)}</Select.Option>
            <Select.Option value={2}>{getSemesterLabel(filters.nam_hoc, 2)}</Select.Option>
          </Select>
          <Input.Search
            placeholder="Tìm họ tên học viên..." value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 180 }} allowClear enterButton={<SearchOutlined />}
          />
          <Button icon={<CopyOutlined />} onClick={handleCopy}>Copy bảng</Button>
          {isAdmin && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setModalOpen(true); }}>Thêm công vắng</Button>
          )}
        </Space>
      </Space>

      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col xs={8} sm={6} md={4}>
          <Card size="small"><Statistic title="Tổng số lượt vắng" value={absences.length} styles={{ content: { color: '#faad14', fontSize: 28 } }} /></Card>
        </Col>
        <Col xs={8} sm={6} md={4}>
          <Card size="small"><Statistic title="Học viên vắng" value={soHvVang} styles={{ content: { color: '#ff4d4f', fontSize: 28 } }} /></Card>
        </Col>
        <Col xs={8} sm={6} md={4}>
          <Card size="small"><Statistic title="Học viên không vắng" value={hvKhongVang} styles={{ content: { color: '#52c41a', fontSize: 28 } }} /></Card>
        </Col>
      </Row>

      <Card styles={{ body: { padding: 0 } }}>
        <Table
          columns={studentColumns}
          dataSource={displayGrouped}
          rowKey="key"
          loading={loading}
          size="middle"
          bordered
          expandable={{ expandedRowRender, rowExpandable: (r) => r.records.length > 0, defaultExpandAllRows: true }}
          pagination={{ pageSize: 20 }}
        />
      </Card>

      {/* Drill-down Detail Modal */}
      <Modal
        title={`Chi tiết công vắng của học viên: ${selectedStudentRecords?.ho_ten || ''}`}
        open={detailModalOpen}
        onCancel={() => setDetailModalOpen(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalOpen(false)}>Đóng</Button>
        ]}
        width={900}
      >
        <Table
          columns={[
            { title: 'Ngày vắng', dataIndex: 'ngay_vang', width: 120, render: (v: string) => dayjs(v).format('DD/MM/YYYY') },
            { title: 'Môn học', dataIndex: 'mon_hoc', width: 150 },
            { title: 'Số tiết', dataIndex: 'so_tiet_vang', width: 80, align: 'center' as const },
            { title: 'Tên bài học', dataIndex: 'ten_bai', width: 200 },
            { title: 'Giảng viên', dataIndex: 'giang_vien', width: 150 },
            { title: 'Lý do vắng', dataIndex: 'ghi_chu' },
            ...(isAdmin ? [{
              title: 'Thao tác', width: 80, align: 'center' as const,
              render: (_: any, r: any) => (
                <Popconfirm title="Xóa lượt vắng này?" onConfirm={() => handleDelete(r.id)}>
                  <Button size="small" danger icon={<DeleteOutlined />} type="text" />
                </Popconfirm>
              )
            }] : [])
          ]}
          dataSource={selectedStudentRecords?.records || []}
          rowKey="id"
          pagination={false}
          size="middle"
          bordered
        />
      </Modal>

      {/* Add Absence Modal */}
      <Modal title="Thêm công vắng học viên" open={modalOpen} onOk={handleAdd} onCancel={() => setModalOpen(false)}
        okText="Lưu" cancelText="Hủy" width={550}>
        <Form form={form} layout="vertical">
          <Form.Item name="student_id" label="Học viên" rules={[{ required: true, message: 'Vui lòng chọn học viên' }]}>
            <Select placeholder="Chọn học viên" showSearch optionFilterProp="label"
              options={students.map(s => ({ value: s.id, label: s.ho_ten }))} />
          </Form.Item>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item name="nam_hoc" label="Năm học" rules={[{ required: true }]} initialValue={filters.nam_hoc || 1}>
              <Select>
                {[1,2,3,4].map(n => <Select.Option key={n} value={n}>Năm {['nhất','hai','ba','bốn'][n-1]}</Select.Option>)}
              </Select>
            </Form.Item>
            <Form.Item name="hoc_ky" label="Học kỳ" rules={[{ required: true }]} initialValue={filters.hoc_ky || 1}>
              <Select>
                <Select.Option value={1}>Học kỳ lẻ</Select.Option>
                <Select.Option value={2}>Học kỳ chẵn</Select.Option>
              </Select>
            </Form.Item>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item name="ngay_vang" label="Ngày vắng" rules={[{ required: true }]}>
              <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="mon_hoc" label="Môn học">
              <Input placeholder="Ví dụ: Kỹ thuật chiến đấu" />
            </Form.Item>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item name="so_tiet_vang" label="Số tiết vắng" initialValue={1} rules={[{ required: true }]}>
              <InputNumber min={1} max={10} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="giang_vien" label="Giảng viên giảng dạy">
              <Input placeholder="Tên giảng viên" />
            </Form.Item>
          </div>

          <Form.Item name="ten_bai" label="Tên bài học">
            <Input placeholder="Tên bài học cụ thể" />
          </Form.Item>

          <Form.Item name="ghi_chu_thi" label="Ghi chú điều kiện thi" initialValue="Đủ điều kiện thi">
            <Select>
              <Select.Option value="Đủ điều kiện thi">Đủ điều kiện thi</Select.Option>
              <Select.Option value="Chưa đủ điều kiện thi">Chưa đủ điều kiện thi</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item name="ghi_chu" label="Lý do vắng học">
            <Input.TextArea rows={2} placeholder="Nhập lý do nằm viện, nghỉ ốm, công tác, v.v." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AbsencesPage;
