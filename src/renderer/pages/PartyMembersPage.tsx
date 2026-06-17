import React, { useEffect, useState, useCallback } from 'react';
import {
  Card, Table, Button, Modal, Form, Input, Select, DatePicker, Space, Typography,
  Popconfirm, App, Drawer, Descriptions, Cascader, Tag, Tooltip, Image, Upload, Row, Col, Statistic, Tabs
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined,
  EyeOutlined, UserOutlined, CopyOutlined, UploadOutlined, FlagOutlined,
  FileWordOutlined, BookOutlined, UserAddOutlined
} from '@ant-design/icons';
import {
  getPartyMembers, createPartyMember, updatePartyMember, deletePartyMember, getUnits, getStudents
} from '../services/api';
import { useAuth } from '../auth/AuthContext';
import type { Unit, PartyMember, Student } from '../../shared/types';
import dayjs from 'dayjs';

const { Title } = Typography;

const PartyMembersPage: React.FC = () => {
  const { message } = App.useApp();
  const { isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<'official' | 'pending' | 'non_party'>('official');

  const [partyMembers, setPartyMembers] = useState<PartyMember[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [filters, setFilters] = useState<{ unit_id?: number }>({});
  const [searchText, setSearchText] = useState('');
  
  const [modalOpen, setModalOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [handbookOpen, setHandbookOpen] = useState(false);
  const [resumeOpen, setResumeOpen] = useState(false);
  const [resumeStudent, setResumeStudent] = useState<PartyMember | null>(null);
  const [selected, setSelected] = useState<PartyMember | null>(null);
  const [editing, setEditing] = useState<PartyMember | null>(null);
  
  const [form] = Form.useForm();
  const hinhAnh = Form.useWatch('hinh_anh', form);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [membersData, studentsData] = await Promise.all([
        getPartyMembers(filters),
        getStudents({ unit_id: filters.unit_id, pageSize: 1000 })
      ]);
      setPartyMembers(membersData);
      setStudents(studentsData.data || []);
    } catch (err: any) {
      message.error('Lỗi tải dữ liệu: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [filters, message]);

  const loadUnits = async () => {
    try { setUnits(await getUnits()); } catch { /* */ }
  };

  useEffect(() => { loadUnits(); }, []);
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

  const getUnitSelectOptions = () => {
    return units
      .filter((u) => u.type === 'trung_doi' || u.type === 'tieu_doi')
      .map((u) => {
        let label = '';
        if (u.type === 'tieu_doi') {
          const trungDoi = units.find((p) => p.id === u.parent_id);
          const daiDoi = trungDoi ? units.find((p) => p.id === trungDoi.parent_id) : null;
          const tieuDoan = daiDoi ? units.find((p) => p.id === daiDoi.parent_id) : null;
          label = [tieuDoan?.name, daiDoi?.name, trungDoi?.name, u.name].filter(Boolean).join(' > ');
        } else {
          const daiDoi = units.find((p) => p.id === u.parent_id);
          const tieuDoan = daiDoi ? units.find((p) => p.id === daiDoi.parent_id) : null;
          label = [tieuDoan?.name, daiDoi?.name, u.name].filter(Boolean).join(' > ');
        }
        return { value: u.id, label };
      });
  };

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

  const openAddFromStudent = (student: Student) => {
    setEditing(null);
    form.resetFields();
    
    // Find unit name
    const platoon = units.find(u => u.id === student.unit_id);
    
    form.setFieldsValue({
      ho_ten: student.ho_ten,
      unit_id: student.unit_id,
      ngay_sinh: student.ngay_sinh ? dayjs(student.ngay_sinh) : null,
      que_quan: student.que_quan,
      noi_dkht: student.dia_chi_thuong_tru,
      hinh_anh: student.hinh_anh,
    });
    setModalOpen(true);
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
        message.success('Đã cập nhật đảng viên');
      } else {
        await createPartyMember(payload);
        message.success('Đã thêm đảng viên mới');
      }
      setModalOpen(false);
      loadData();
    } catch (err: any) {
      if (err.errorFields) return;
      message.error('Lỗi: ' + err.message);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deletePartyMember(id);
      message.success('Đã xóa');
      loadData();
    } catch (err: any) {
      message.error('Lỗi: ' + err.message);
    }
  };

  const handleFilterUnit = (val: any) => {
    const unit_id = val?.length > 0 ? val[val.length - 1] : undefined;
    setFilters((p) => ({ ...p, unit_id }));
  };

  // Lists filtering and classification
  const officialList = partyMembers.filter(pm => pm.ngay_vao_dang_chinh_thuc != null && pm.ngay_vao_dang_chinh_thuc !== '');
  const pendingList = partyMembers.filter(pm => pm.ngay_vao_dang_chinh_thuc == null || pm.ngay_vao_dang_chinh_thuc === '');
  
  const getChuaVaoDangList = () => {
    return students.filter(s => {
      const isMember = partyMembers.some(pm => {
        const nameMatch = (pm.ho_ten || '').trim().toLowerCase() === (s.ho_ten || '').trim().toLowerCase();
        const bdayMatch = !pm.ngay_sinh || !s.ngay_sinh || pm.ngay_sinh === s.ngay_sinh;
        return nameMatch && bdayMatch;
      });
      return !isMember;
    });
  };
  const nonPartyList = getChuaVaoDangList();

  // In-memory text filters
  const filteredOfficial = officialList.filter(pm => (pm.ho_ten || '').toLowerCase().includes(searchText.toLowerCase()));
  const filteredPending = pendingList.filter(pm => (pm.ho_ten || '').toLowerCase().includes(searchText.toLowerCase()));
  const filteredNonParty = nonPartyList.filter(s => (s.ho_ten || '').toLowerCase().includes(searchText.toLowerCase()));

  // Countdown calculations
  const renderCountdown = (ngayVaoDang: string | null) => {
    if (!ngayVaoDang) return <span style={{ color: '#ccc' }}>-</span>;
    const today = dayjs().startOf('day');
    const joinDate = dayjs(ngayVaoDang).startOf('day');
    const targetDate = joinDate.add(1, 'year'); // 12 months reserve period
    const diffDays = targetDate.diff(today, 'day');

    if (diffDays > 0) {
      return <Tag color="blue">Còn {diffDays} ngày</Tag>;
    } else if (diffDays === 0) {
      return <Tag color="green">Hôm nay chuyển chính thức!</Tag>;
    } else {
      return <Tag color="red">Quá hạn {-diffDays} ngày</Tag>;
    }
  };

  const handleCopy = () => {
    let headers: string[] = [];
    let rows: any[][] = [];

    if (activeTab === 'official') {
      headers = ['STT', 'Họ và tên', 'Ngày sinh', 'Đơn vị', 'Ngày vào Đảng (dự bị)', 'Ngày chính thức'];
      rows = filteredOfficial.map((r, i) => [
        i + 1, r.ho_ten,
        r.ngay_sinh ? dayjs(r.ngay_sinh).format('DD/MM/YYYY') : '',
        r.unit_name || '',
        r.ngay_vao_dang ? dayjs(r.ngay_vao_dang).format('DD/MM/YYYY') : '',
        r.ngay_vao_dang_chinh_thuc ? dayjs(r.ngay_vao_dang_chinh_thuc).format('DD/MM/YYYY') : ''
      ]);
    } else if (activeTab === 'pending') {
      headers = ['STT', 'Họ và tên', 'Ngày sinh', 'Đơn vị', 'Ngày vào Đảng (dự bị)', 'Thời gian còn lại'];
      rows = filteredPending.map((r, i) => {
        const joinDate = r.ngay_vao_dang ? dayjs(r.ngay_vao_dang) : null;
        const target = joinDate ? joinDate.add(1, 'year') : null;
        const diff = target ? target.diff(dayjs(), 'day') : 0;
        const countdownStr = diff > 0 ? `Còn ${diff} ngày` : diff === 0 ? 'Hôm nay' : `Quá hạn ${-diff} ngày`;
        return [
          i + 1, r.ho_ten,
          r.ngay_sinh ? dayjs(r.ngay_sinh).format('DD/MM/YYYY') : '',
          r.unit_name || '',
          r.ngay_vao_dang ? dayjs(r.ngay_vao_dang).format('DD/MM/YYYY') : '',
          countdownStr
        ];
      });
    } else {
      headers = ['STT', 'Họ và tên', 'Ngày sinh', 'Đơn vị', 'Chức vụ', 'Cấp bậc'];
      rows = filteredNonParty.map((r, i) => {
        const platoon = units.find(u => u.id === r.unit_id);
        return [
          i + 1, r.ho_ten,
          r.ngay_sinh ? dayjs(r.ngay_sinh).format('DD/MM/YYYY') : '',
          platoon?.name || '',
          r.chuc_vu || '',
          r.cap_bac || ''
        ];
      });
    }

    navigator.clipboard.writeText([headers, ...rows].map((r) => r.join('\t')).join('\n'));
    message.success('Đã copy dữ liệu bảng hiện tại');
  };

  // Columns Definitions
  const sharedColumns = [
    { title: 'STT', width: 60, align: 'center' as const, render: (_: any, __: any, i: number) => i + 1 },
    {
      title: 'Ảnh', dataIndex: 'hinh_anh', width: 64, align: 'center' as const,
      render: (v: string | null) => v
        ? <Image src={v} width={36} height={36} style={{ objectFit: 'cover', borderRadius: 6 }} />
        : <UserOutlined style={{ fontSize: 20, color: '#ccc' }} />,
    },
    {
      title: 'Họ và tên', dataIndex: 'ho_ten', width: 200,
      render: (text: string, r: PartyMember) => (
        <a onClick={() => { setSelected(r); setDetailOpen(true); }} style={{ fontWeight: 600 }}>{text}</a>
      ),
    },
    { title: 'Ngày sinh', dataIndex: 'ngay_sinh', width: 110,
      render: (v: string) => v ? dayjs(v).format('DD/MM/YYYY') : '-' },
    { title: 'Đơn vị', dataIndex: 'unit_name', width: 150, render: (v: string) => v || '-' },
  ];

  const officialColumns = [
    ...sharedColumns,
    { title: 'Ngày vào Đảng (DB)', dataIndex: 'ngay_vao_dang', width: 140,
      render: (v: string) => v ? dayjs(v).format('DD/MM/YYYY') : '-' },
    { title: 'Ngày chính thức', dataIndex: 'ngay_vao_dang_chinh_thuc', width: 140,
      render: (v: string) => <strong>{dayjs(v).format('DD/MM/YYYY')}</strong> },
    {
      title: 'Thao tác', width: 150, align: 'center' as const,
      render: (_: any, r: PartyMember) => (
        <Space size={2}>
          <Tooltip title="Xem">
            <Button size="small" icon={<EyeOutlined />} type="text" onClick={() => { setSelected(r); setDetailOpen(true); }} />
          </Tooltip>
          <Tooltip title="Lý lịch Đảng viên">
            <Button size="small" icon={<FileWordOutlined />} type="text" onClick={() => { setResumeStudent(r); setResumeOpen(true); }} />
          </Tooltip>
          {isAdmin && (
            <Tooltip title="Sửa">
              <Button size="small" icon={<EditOutlined />} type="text" onClick={() => openEdit(r)} />
            </Tooltip>
          )}
          {isAdmin && (
            <Popconfirm title="Xóa đảng viên này?" onConfirm={() => handleDelete(r.id)}>
              <Button size="small" danger icon={<DeleteOutlined />} type="text" />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  const pendingColumns = [
    ...sharedColumns,
    { title: 'Ngày vào Đảng (DB)', dataIndex: 'ngay_vao_dang', width: 140,
      render: (v: string) => v ? dayjs(v).format('DD/MM/YYYY') : '-' },
    { title: 'Thời gian chuyển chính thức', width: 180, align: 'center' as const,
      render: (_: any, r: PartyMember) => renderCountdown(r.ngay_vao_dang) },
    {
      title: 'Thao tác', width: 150, align: 'center' as const,
      render: (_: any, r: PartyMember) => (
        <Space size={2}>
          <Tooltip title="Xem">
            <Button size="small" icon={<EyeOutlined />} type="text" onClick={() => { setSelected(r); setDetailOpen(true); }} />
          </Tooltip>
          <Tooltip title="Lý lịch Đảng viên">
            <Button size="small" icon={<FileWordOutlined />} type="text" onClick={() => { setResumeStudent(r); setResumeOpen(true); }} />
          </Tooltip>
          {isAdmin && (
            <Tooltip title="Sửa">
              <Button size="small" icon={<EditOutlined />} type="text" onClick={() => openEdit(r)} />
            </Tooltip>
          )}
          {isAdmin && (
            <Popconfirm title="Xóa đảng viên này?" onConfirm={() => handleDelete(r.id)}>
              <Button size="small" danger icon={<DeleteOutlined />} type="text" />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  const nonPartyColumns = [
    { title: 'STT', width: 60, align: 'center' as const, render: (_: any, __: any, i: number) => i + 1 },
    {
      title: 'Ảnh', dataIndex: 'hinh_anh', width: 64, align: 'center' as const,
      render: (v: string | null) => v
        ? <Image src={v} width={36} height={36} style={{ objectFit: 'cover', borderRadius: 6 }} />
        : <UserOutlined style={{ fontSize: 20, color: '#ccc' }} />,
    },
    { title: 'Họ và tên', dataIndex: 'ho_ten', width: 200, style: { fontWeight: 600 } },
    { title: 'Ngày sinh', dataIndex: 'ngay_sinh', width: 120,
      render: (v: string) => v ? dayjs(v).format('DD/MM/YYYY') : '-' },
    { title: 'Đơn vị', dataIndex: 'unit_id', width: 180,
      render: (uid: number) => {
        const platoon = units.find(u => u.id === uid);
        const company = platoon ? units.find(u => u.id === platoon.parent_id) : null;
        return company ? `${company.name} - ${platoon?.name}` : (platoon?.name || '-');
      }
    },
    { title: 'Quê quán', dataIndex: 'que_quan', ellipsis: true },
    {
      title: 'Thao tác', width: 140, align: 'center' as const,
      render: (_: any, record: Student) => (
        isAdmin ? (
          <Button
            type="primary"
            ghost
            size="small"
            icon={<UserAddOutlined />}
            onClick={() => openAddFromStudent(record)}
          >
            Kết nạp Đảng
          </Button>
        ) : '-'
      )
    }
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
            style={{ width: 250 }}
          />
          <Input.Search
            placeholder="Tìm họ tên..." value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 220 }} allowClear enterButton={<SearchOutlined />}
          />
          <Button icon={<BookOutlined />} onClick={() => setHandbookOpen(true)}>Sổ tay đảng viên</Button>
          <Button icon={<CopyOutlined />} onClick={handleCopy}>Copy bảng</Button>
          {isAdmin && activeTab !== 'non_party' && (
            <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>Thêm đảng viên</Button>
          )}
        </Space>
      </Space>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <Card size="small"><Statistic title="Tổng đảng viên" value={partyMembers.length} styles={{ content: { color: '#1677ff', fontWeight: 600 } }} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small"><Statistic title="Chính thức" value={officialList.length} styles={{ content: { color: '#52c41a', fontWeight: 600 } }} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small"><Statistic title="Dự bị" value={pendingList.length} styles={{ content: { color: '#faad14', fontWeight: 600 } }} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small"><Statistic title="Chưa vào Đảng" value={nonPartyList.length} styles={{ content: { color: '#8c8c8c', fontWeight: 600 } }} /></Card>
        </Col>
      </Row>

      <Tabs
        activeKey={activeTab}
        onChange={(k: any) => { setActiveTab(k); setSearchText(''); }}
        items={[
          {
            key: 'official',
            label: <span><Tag color="green" style={{ border: 'none', margin: 0, padding: '0 8px' }}>Chính thức ({filteredOfficial.length})</Tag></span>,
            children: (
              <Card styles={{ body: { padding: 0 } }}>
                <Table
                  columns={officialColumns} dataSource={filteredOfficial} rowKey="id" loading={loading}
                  size="middle" scroll={{ x: 1000 }} pagination={{ pageSize: 25 }} bordered
                />
              </Card>
            )
          },
          {
            key: 'pending',
            label: <span><Tag color="orange" style={{ border: 'none', margin: 0, padding: '0 8px' }}>Dự bị ({filteredPending.length})</Tag></span>,
            children: (
              <Card styles={{ body: { padding: 0 } }}>
                <Table
                  columns={pendingColumns} dataSource={filteredPending} rowKey="id" loading={loading}
                  size="middle" scroll={{ x: 1000 }} pagination={{ pageSize: 25 }} bordered
                />
              </Card>
            )
          },
          {
            key: 'non_party',
            label: <span><Tag color="default" style={{ border: 'none', margin: 0, padding: '0 8px' }}>Chưa vào Đảng ({filteredNonParty.length})</Tag></span>,
            children: (
              <Card styles={{ body: { padding: 0 } }}>
                <Table
                  columns={nonPartyColumns} dataSource={filteredNonParty} rowKey="id" loading={loading}
                  size="middle" scroll={{ x: 1000 }} pagination={{ pageSize: 25 }} bordered
                />
              </Card>
            )
          }
        ]}
      />

      {/* Modal Thêm / Sửa */}
      <Modal
        title={editing ? 'Sửa thông tin đảng viên' : 'Thêm đảng viên mới'} open={modalOpen}
        onOk={handleSave} onCancel={() => setModalOpen(false)}
        okText="Lưu" cancelText="Hủy" width={820}
      >
        <Form form={form} layout="vertical" style={{ maxHeight: '60vh', overflowY: 'auto', paddingRight: 16 }}>
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
              {selected.ngay_vao_dang_chinh_thuc ? (
                <Tag color="green" style={{ fontSize: 13 }}>Chính thức</Tag>
              ) : (
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Tag color="orange" style={{ fontSize: 13 }}>Chưa chính thức (Dự bị)</Tag>
                  <div>{renderCountdown(selected.ngay_vao_dang)}</div>
                </Space>
              )}
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

      {/* Sổ tay Đảng viên */}
      <Modal title="Sổ tay Đảng viên điện tử" open={handbookOpen} onCancel={() => setHandbookOpen(false)} footer={null} width={800}>
        <div style={{ minHeight: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fafafa', border: '1px dashed #d9d9d9', borderRadius: 8 }}>
          <Typography.Text type="secondary">
            (Nội dung Sổ tay Đảng viên sẽ hiển thị ở đây - Có thể đính kèm các tệp Word về Điều lệ Đảng)
          </Typography.Text>
        </div>
      </Modal>

      {/* Lý lịch Đảng viên */}
      <Modal title={`Lý lịch Đảng viên - ${resumeStudent?.ho_ten || ''}`} open={resumeOpen} onCancel={() => setResumeOpen(false)} footer={null} width={800}>
        <div style={{ minHeight: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fafafa', border: '1px dashed #d9d9d9', borderRadius: 8 }}>
          <Typography.Text type="secondary">
            (Trang Word trống để hiển thị Lý lịch Đảng viên)
          </Typography.Text>
        </div>
      </Modal>
    </div>
  );
};

export default PartyMembersPage;
