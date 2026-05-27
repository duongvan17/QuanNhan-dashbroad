import React, { useEffect, useState, useCallback } from 'react';
import {
  Card, Table, Button, Modal, Form, Input, Select, DatePicker, Space, Typography,
  Popconfirm, App, Drawer, Descriptions, Cascader, Tag, Tooltip, Image, Upload, Row, Col, Statistic,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined,
  EyeOutlined, UserOutlined, CopyOutlined, UploadOutlined, FlagOutlined,
} from '@ant-design/icons';
import {
  getPartyMembers, createPartyMember, updatePartyMember, deletePartyMember, getUnits,
} from '../services/api';
import { useAuth } from '../auth/AuthContext';
import type { Unit, PartyMember } from '../../shared/types';
import dayjs from 'dayjs';

const { Title } = Typography;

const officialTag = (chinhThuc: string | null) =>
  chinhThuc
    ? <Tag color="green" style={{ fontSize: 13 }}>Chính thức</Tag>
    : <Tag color="orange" style={{ fontSize: 13 }}>Chưa chính thức</Tag>;

const PartyMembersPage: React.FC = () => {
  const { message } = App.useApp();
  const { isAdmin } = useAuth();
  const [data, setData] = useState<PartyMember[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<{ unit_id?: number; search?: string; status?: 'official' | 'pending' }>({});
  const [searchText, setSearchText] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<PartyMember | null>(null);
  const [editing, setEditing] = useState<PartyMember | null>(null);
  const [form] = Form.useForm();
  const hinhAnh = Form.useWatch('hinh_anh', form);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await getPartyMembers(filters));
    } catch (err: any) {
      message.error('Lỗi: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [filters, message]);

  const loadUnits = async () => {
    try { setUnits(await getUnits()); } catch { /* */ }
  };

  useEffect(() => { loadUnits(); }, []);
  useEffect(() => { load(); }, [load]);

  const buildCascaderOptions = () => {
    const tieuDoans = units.filter((u) => u.type === 'tieu_doan');
    return tieuDoans.map((td) => ({
      value: td.id, label: td.name,
      children: units.filter((u) => u.type === 'dai_doi' && u.parent_id === td.id).map((dd) => ({
        value: dd.id, label: dd.name,
        children: units.filter((u) => u.type === 'trung_doi' && u.parent_id === dd.id).map((trd) => ({
          value: trd.id, label: trd.name,
        })),
      })),
    }));
  };

  const getUnitSelectOptions = () =>
    units.filter((u) => u.type === 'trung_doi').map((u) => {
      const dd = units.find((p) => p.id === u.parent_id);
      const td = dd ? units.find((p) => p.id === dd.parent_id) : null;
      return { value: u.id, label: [td?.name, dd?.name, u.name].filter(Boolean).join(' > ') };
    });

  const handleImageUpload = (file: File) => {
    if (file.size > 2 * 1024 * 1024) { message.error('Ảnh tối đa 2MB'); return false; }
    const reader = new FileReader();
    reader.onload = () => form.setFieldsValue({ hinh_anh: reader.result as string });
    reader.readAsDataURL(file);
    return false;
  };

  const openAdd = () => {
    setEditing(null); form.resetFields(); setModalOpen(true);
  };

  const openEdit = (r: PartyMember) => {
    setEditing(r);
    form.setFieldsValue({
      ...r,
      ngay_sinh: r.ngay_sinh ? dayjs(r.ngay_sinh) : null,
      ngay_vao_doan: r.ngay_vao_doan ? dayjs(r.ngay_vao_doan) : null,
      ngay_vao_dang: r.ngay_vao_dang ? dayjs(r.ngay_vao_dang) : null,
      ngay_vao_dang_chinh_thuc: r.ngay_vao_dang_chinh_thuc ? dayjs(r.ngay_vao_dang_chinh_thuc) : null,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const v = await form.validateFields();
      const payload = {
        ...v,
        ngay_sinh: v.ngay_sinh?.format('YYYY-MM-DD') || null,
        ngay_vao_doan: v.ngay_vao_doan?.format('YYYY-MM-DD') || null,
        ngay_vao_dang: v.ngay_vao_dang?.format('YYYY-MM-DD') || null,
        ngay_vao_dang_chinh_thuc: v.ngay_vao_dang_chinh_thuc?.format('YYYY-MM-DD') || null,
      };
      if (editing) {
        await updatePartyMember({ ...payload, id: editing.id });
        message.success('Đã cập nhật');
      } else {
        await createPartyMember(payload);
        message.success('Đã thêm');
      }
      setModalOpen(false);
      load();
    } catch (err: any) {
      if (err.errorFields) return;
      message.error('Lỗi: ' + err.message);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deletePartyMember(id);
      message.success('Đã xóa');
      load();
    } catch (err: any) {
      message.error('Lỗi: ' + err.message);
    }
  };

  const handleCopy = () => {
    const headers = ['STT', 'Họ và tên', 'Ngày sinh', 'Đơn vị', 'Ngày vào Đảng', 'Ngày chính thức', 'Trạng thái'];
    const rows = data.map((r, i) => [
      i + 1, r.ho_ten,
      r.ngay_sinh ? dayjs(r.ngay_sinh).format('DD/MM/YYYY') : '',
      r.unit_name || '',
      r.ngay_vao_dang ? dayjs(r.ngay_vao_dang).format('DD/MM/YYYY') : '',
      r.ngay_vao_dang_chinh_thuc ? dayjs(r.ngay_vao_dang_chinh_thuc).format('DD/MM/YYYY') : '',
      r.ngay_vao_dang_chinh_thuc ? 'Chính thức' : 'Chưa chính thức',
    ]);
    navigator.clipboard.writeText([headers, ...rows].map((r) => r.join('\t')).join('\n'));
    message.success('Đã copy bảng');
  };

  const handleFilterUnit = (val: any) => {
    const unit_id = val?.length > 0 ? val[val.length - 1] : undefined;
    setFilters((p) => ({ ...p, unit_id }));
  };

  const officialCount = data.filter((r) => r.ngay_vao_dang_chinh_thuc).length;
  const pendingCount = data.length - officialCount;

  const columns: any[] = [
    { title: 'STT', width: 60, render: (_: any, __: any, i: number) => i + 1 },
    {
      title: 'Ảnh', dataIndex: 'hinh_anh', width: 64, align: 'center' as const,
      render: (v: string | null) => v
        ? <Image src={v} width={36} height={36} style={{ objectFit: 'cover', borderRadius: 6 }} />
        : <UserOutlined style={{ fontSize: 20, color: '#ccc' }} />,
    },
    {
      title: 'Họ và tên', dataIndex: 'ho_ten', width: 200,
      render: (text: string, r: PartyMember) => (
        <a onClick={() => { setSelected(r); setDetailOpen(true); }}>{text}</a>
      ),
    },
    { title: 'Ngày sinh', dataIndex: 'ngay_sinh', width: 110,
      render: (v: string) => v ? dayjs(v).format('DD/MM/YYYY') : '-' },
    { title: 'Đơn vị', dataIndex: 'unit_name', width: 150, render: (v: string) => v || '-' },
    { title: 'Ngày vào Đảng', dataIndex: 'ngay_vao_dang', width: 130,
      render: (v: string) => v ? dayjs(v).format('DD/MM/YYYY') : '-' },
    { title: 'Ngày chính thức', dataIndex: 'ngay_vao_dang_chinh_thuc', width: 140,
      render: (v: string) => v ? dayjs(v).format('DD/MM/YYYY') : <span style={{ color: '#faad14' }}>Chưa</span> },
    { title: 'Trạng thái', dataIndex: 'ngay_vao_dang_chinh_thuc', width: 140, align: 'center' as const,
      render: (v: string | null) => officialTag(v) },
    {
      title: 'Thao tác', width: 120, align: 'center' as const,
      render: (_: any, r: PartyMember) => (
        <Space>
          <Tooltip title="Xem">
            <Button size="small" icon={<EyeOutlined />} onClick={() => { setSelected(r); setDetailOpen(true); }} />
          </Tooltip>
          {isAdmin && (
            <Tooltip title="Sửa">
              <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
            </Tooltip>
          )}
          {isAdmin && (
            <Popconfirm title="Xóa đảng viên này?" onConfirm={() => handleDelete(r.id)}>
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16, justifyContent: 'space-between', width: '100%', flexWrap: 'wrap' }}>
        <Title level={4} style={{ margin: 0 }}>
          <FlagOutlined /> Theo dõi Đảng viên
        </Title>
        <Space wrap>
          <Cascader
            options={buildCascaderOptions()} onChange={handleFilterUnit}
            placeholder="Lọc theo đơn vị" changeOnSelect allowClear
            style={{ width: 280 }}
          />
          <Select
            placeholder="Trạng thái" allowClear style={{ width: 170 }}
            onChange={(v) => setFilters((p) => ({ ...p, status: v }))}
            options={[
              { value: 'official', label: 'Chính thức' },
              { value: 'pending', label: 'Chưa chính thức' },
            ]}
          />
          <Input.Search
            placeholder="Tìm họ tên..." value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onSearch={(v) => setFilters((p) => ({ ...p, search: v }))}
            style={{ width: 240 }} enterButton={<SearchOutlined />} allowClear
          />
          <Button icon={<CopyOutlined />} onClick={handleCopy}>Copy bảng</Button>
          {isAdmin && (
            <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>Thêm đảng viên</Button>
          )}
        </Space>
      </Space>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={8} md={6}>
          <Card size="small"><Statistic title="Tổng đảng viên" value={data.length}
            styles={{ content: { color: '#1677ff', fontSize: 28 } }} /></Card>
        </Col>
        <Col xs={12} sm={8} md={6}>
          <Card size="small"><Statistic title="Chính thức" value={officialCount}
            styles={{ content: { color: '#52c41a', fontSize: 28 } }} /></Card>
        </Col>
        <Col xs={12} sm={8} md={6}>
          <Card size="small"><Statistic title="Chưa chính thức" value={pendingCount}
            styles={{ content: { color: '#faad14', fontSize: 28 } }} /></Card>
        </Col>
      </Row>

      <Card styles={{ body: { padding: 0 } }}>
        <Table
          columns={columns} dataSource={data} rowKey="id" loading={loading}
          size="middle" scroll={{ x: 1200 }} pagination={{ pageSize: 50, showSizeChanger: true, showTotal: (t) => `Tổng: ${t}` }}
        />
      </Card>

      {/* Modal Thêm / Sửa */}
      <Modal
        title={editing ? 'Sửa đảng viên' : 'Thêm đảng viên'} open={modalOpen}
        onOk={handleSave} onCancel={() => setModalOpen(false)}
        okText="Lưu" cancelText="Hủy" width={820}
      >
        <Form form={form} layout="vertical" style={{ maxHeight: '62vh', overflowY: 'auto', paddingRight: 16 }}>
          <Form.Item name="hinh_anh" hidden><Input /></Form.Item>
          <Form.Item label="Hình ảnh">
            <Space align="start" size={16}>
              {hinhAnh ? (
                <Image src={hinhAnh} width={88} height={88} style={{ objectFit: 'cover', borderRadius: 8 }} />
              ) : (
                <div style={{
                  width: 88, height: 88, borderRadius: 8, background: '#f5f5f5',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#bbb',
                }}>
                  <UserOutlined style={{ fontSize: 32 }} />
                </div>
              )}
              <Space direction="vertical">
                <Upload accept="image/*" showUploadList={false} maxCount={1} beforeUpload={handleImageUpload}>
                  <Button icon={<UploadOutlined />}>Chọn ảnh</Button>
                </Upload>
                {hinhAnh && (
                  <Button danger size="small" onClick={() => form.setFieldsValue({ hinh_anh: null })}>Xóa ảnh</Button>
                )}
              </Space>
            </Space>
          </Form.Item>

          <Title level={5}>Thông tin cá nhân</Title>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <Form.Item name="ho_ten" label="Họ và tên" rules={[{ required: true, message: 'Nhập họ tên' }]}>
              <Input />
            </Form.Item>
            <Form.Item name="unit_id" label="Đơn vị (Trung đội)">
              <Select placeholder="Chọn trung đội" allowClear showSearch optionFilterProp="label"
                options={getUnitSelectOptions()} />
            </Form.Item>
            <Form.Item name="ngay_sinh" label="Ngày sinh">
              <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="dan_toc" label="Dân tộc"><Input /></Form.Item>
            <Form.Item name="ton_giao" label="Tôn giáo"><Input /></Form.Item>
            <Form.Item name="que_quan" label="Quê quán"><Input /></Form.Item>
            <Form.Item name="noi_dkht" label="Nơi đăng ký hộ khẩu thường trú">
              <Input />
            </Form.Item>
            <Form.Item name="trinh_do" label="Trình độ (học vấn / chuyên môn / lý luận chính trị)">
              <Input.TextArea rows={2} />
            </Form.Item>
            <Form.Item name="nghe_nghiep" label="Nghề nghiệp / chức vụ / đơn vị công tác"
              style={{ gridColumn: '1 / -1' }}>
              <Input />
            </Form.Item>
          </div>

          <Title level={5} style={{ marginTop: 16 }}>Thông tin Đảng / Đoàn</Title>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <Form.Item name="ngay_vao_doan" label="Ngày vào Đoàn TNCS Hồ Chí Minh">
              <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="nguoi_gioi_thieu" label="Người giới thiệu vào Đảng">
              <Input />
            </Form.Item>
            <Form.Item name="ngay_vao_dang" label="Ngày vào Đảng (dự bị)">
              <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="ngay_vao_dang_chinh_thuc" label="Ngày vào Đảng chính thức"
              tooltip="Để trống nếu chưa được công nhận chính thức">
              <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
            </Form.Item>
          </div>
        </Form>
      </Modal>

      {/* Drawer chi tiết */}
      <Drawer title={selected?.ho_ten} open={detailOpen} onClose={() => setDetailOpen(false)} size="large">
        {selected && (
          <>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              {selected.hinh_anh
                ? <Image src={selected.hinh_anh} width={150} style={{ borderRadius: 8 }} />
                : <UserOutlined style={{ fontSize: 64, color: '#ccc' }} />}
            </div>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              {officialTag(selected.ngay_vao_dang_chinh_thuc)}
            </div>
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="Đơn vị">{selected.unit_name || '-'}</Descriptions.Item>
              <Descriptions.Item label="Ngày sinh">
                {selected.ngay_sinh ? dayjs(selected.ngay_sinh).format('DD/MM/YYYY') : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Dân tộc">{selected.dan_toc || '-'}</Descriptions.Item>
              <Descriptions.Item label="Tôn giáo">{selected.ton_giao || '-'}</Descriptions.Item>
              <Descriptions.Item label="Quê quán">{selected.que_quan || '-'}</Descriptions.Item>
              <Descriptions.Item label="Hộ khẩu thường trú">{selected.noi_dkht || '-'}</Descriptions.Item>
              <Descriptions.Item label="Trình độ">{selected.trinh_do || '-'}</Descriptions.Item>
              <Descriptions.Item label="Nghề nghiệp / chức vụ">{selected.nghe_nghiep || '-'}</Descriptions.Item>
              <Descriptions.Item label="Ngày vào Đoàn">
                {selected.ngay_vao_doan ? dayjs(selected.ngay_vao_doan).format('DD/MM/YYYY') : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Ngày vào Đảng">
                {selected.ngay_vao_dang ? dayjs(selected.ngay_vao_dang).format('DD/MM/YYYY') : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Ngày chính thức">
                {selected.ngay_vao_dang_chinh_thuc
                  ? dayjs(selected.ngay_vao_dang_chinh_thuc).format('DD/MM/YYYY')
                  : <span style={{ color: '#faad14' }}>Chưa được công nhận</span>}
              </Descriptions.Item>
              <Descriptions.Item label="Người giới thiệu">{selected.nguoi_gioi_thieu || '-'}</Descriptions.Item>
            </Descriptions>
          </>
        )}
      </Drawer>
    </div>
  );
};

export default PartyMembersPage;
