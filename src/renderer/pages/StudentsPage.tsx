import React, { useEffect, useState, useCallback } from 'react';
import {
  Card, Table, Button, Modal, Form, Input, Select, DatePicker, Space, Typography,
  Popconfirm, App, Drawer, Descriptions, Cascader, Tooltip, Image, Upload, Divider,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined,
  EyeOutlined, UserOutlined, CopyOutlined, UploadOutlined,
} from '@ant-design/icons';
import { getStudents, createStudent, updateStudent, deleteStudent, getUnits, getOtherAwards } from '../services/api';
import { useAuth } from '../auth/AuthContext';
import type { Unit } from '../../shared/types';
import dayjs from 'dayjs';

const { Title } = Typography;

const compareVietnameseNames = (a: string, b: string): number => {
  const getParts = (fullName: string) => {
    const trimmed = fullName.trim().replace(/\s+/g, ' ');
    const parts = trimmed.split(' ');
    const firstName = parts.length > 0 ? parts[parts.length - 1] : '';
    const lastName = parts.slice(0, parts.length - 1).join(' ');
    return { firstName, lastName };
  };
  const partsA = getParts(a);
  const partsB = getParts(b);
  const cmp = partsA.firstName.localeCompare(partsB.firstName, 'vi', { sensitivity: 'base' });
  if (cmp !== 0) return cmp;
  return partsA.lastName.localeCompare(partsB.lastName, 'vi', { sensitivity: 'base' });
};

const getStudentPlatoon = (student: any, allUnits: Unit[]) => {
  const unit = allUnits.find(u => u.id === student.unit_id);
  if (!unit) return { id: 0, name: 'Chưa phân trung đội', note: '' };
  if (unit.type === 'trung_doi') return { id: unit.id, name: unit.name, note: unit.note || '' };
  if (unit.type === 'tieu_doi') {
    const parent = allUnits.find(p => p.id === unit.parent_id);
    if (parent && parent.type === 'trung_doi') {
      return { id: parent.id, name: parent.name, note: parent.note || '' };
    }
  }
  return { id: student.unit_id, name: unit.name, note: unit.note || '' };
};

const StudentsPage: React.FC = () => {
  const { message } = App.useApp();
  const { isAdmin } = useAuth();
  const [students, setStudents] = useState<any[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<any>({ page: 1, pageSize: 10000 });
  const [modalOpen, setModalOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [editingStudent, setEditingStudent] = useState<any>(null);
  const [form] = Form.useForm();
  const [searchText, setSearchText] = useState('');
  const [studentAwards, setStudentAwards] = useState<any[]>([]);
  const hinhAnh = Form.useWatch('hinh_anh', form);

  useEffect(() => {
    if (detailOpen && selectedStudent) {
      loadStudentAwards(selectedStudent.id);
    }
  }, [detailOpen, selectedStudent]);

  const loadStudentAwards = async (studentId: number) => {
    try {
      const res = await getOtherAwards({ student_id: studentId });
      setStudentAwards(res);
    } catch {
      setStudentAwards([]);
    }
  };

  const handleImageUpload = (file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      message.error('Ảnh tối đa 2MB');
      return false;
    }
    const reader = new FileReader();
    reader.onload = () => form.setFieldsValue({ hinh_anh: reader.result as string });
    reader.readAsDataURL(file);
    return false; // ngăn antd tự upload
  };

  const loadStudents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getStudents(filters);
      setStudents(res.data);
      setTotal(res.total);
    } catch (err: any) {
      message.error('Lỗi: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const loadUnits = async () => {
    try {
      const data = await getUnits();
      setUnits(data);
    } catch {
      // ignore
    }
  };

  useEffect(() => { loadUnits(); }, []);
  useEffect(() => { loadStudents(); }, [loadStudents]);

  // Build cascader options: Tiểu đoàn > Đại đội > Trung đội > Tiểu đội
  const buildCascaderOptions = () => {
    const tieuDoans = units.filter((u) => u.type === 'tieu_doan');
    return tieuDoans.map((td) => {
      const daiDois = units.filter((u) => u.type === 'dai_doi' && u.parent_id === td.id);
      return {
        value: td.id,
        label: td.name,
        children: daiDois.map((dd) => {
          const trungDois = units.filter((u) => u.type === 'trung_doi' && u.parent_id === dd.id);
          return {
            value: dd.id,
            label: dd.name,
            children: trungDois.map((trd) => {
              const tieuDois = units.filter((u) => u.type === 'tieu_doi' && u.parent_id === trd.id);
              return {
                value: trd.id,
                label: trd.name,
                children: tieuDois.length > 0 ? tieuDois.map((ti) => ({ value: ti.id, label: ti.name })) : undefined,
              };
            }),
          };
        }),
      };
    });
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

  const handleFilterUnit = (value: any) => {
    const unitId = value && value.length > 0 ? value[value.length - 1] : undefined;
    setFilters((prev: any) => ({ ...prev, unit_id: unitId, page: 1 }));
  };

  const handleSearch = () => {
    setFilters((prev: any) => ({ ...prev, search: searchText, page: 1 }));
  };

  const openAdd = () => {
    setEditingStudent(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (record: any) => {
    setEditingStudent(record);
    form.setFieldsValue({
      ...record,
      ngay_sinh: record.ngay_sinh ? dayjs(record.ngay_sinh) : null,
      cccd_ngay_cap: record.cccd_ngay_cap ? dayjs(record.cccd_ngay_cap) : null,
      bo_ngay_sinh: record.bo_ngay_sinh ? dayjs(record.bo_ngay_sinh) : null,
      me_ngay_sinh: record.me_ngay_sinh ? dayjs(record.me_ngay_sinh) : null,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const data = {
        ...values,
        ngay_sinh: values.ngay_sinh?.format('YYYY-MM-DD') || null,
        cccd_ngay_cap: values.cccd_ngay_cap?.format('YYYY-MM-DD') || null,
        bo_ngay_sinh: values.bo_ngay_sinh?.format('YYYY-MM-DD') || null,
        me_ngay_sinh: values.me_ngay_sinh?.format('YYYY-MM-DD') || null,
      };

      if (editingStudent) {
        await updateStudent({ ...data, id: editingStudent.id });
        message.success('Đã cập nhật');
      } else {
        await createStudent(data);
        message.success('Đã thêm');
      }
      setModalOpen(false);
      loadStudents();
    } catch (err: any) {
      if (err.errorFields) return; // form validation
      message.error('Lỗi: ' + err.message);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteStudent(id);
      message.success('Đã xóa');
      loadStudents();
    } catch (err: any) {
      message.error('Lỗi: ' + err.message);
    }
  };

  // 1. Group students by platoon
  const groupedStudentsMap = new Map<number, { id: number; name: string; note: string; list: any[] }>();
  
  students.forEach((student) => {
    const plat = getStudentPlatoon(student, units);
    if (!groupedStudentsMap.has(plat.id)) {
      groupedStudentsMap.set(plat.id, { id: plat.id, name: plat.name, note: plat.note, list: [] });
    }
    groupedStudentsMap.get(plat.id)!.list.push(student);
  });

  // 2. Sort students within each platoon alphabetically by Vietnamese name
  groupedStudentsMap.forEach((group) => {
    group.list.sort((a, b) => compareVietnameseNames(a.ho_ten || '', b.ho_ten || ''));
  });

  // 3. Convert map to list and sort the platoons naturally
  const groupedList = Array.from(groupedStudentsMap.values()).sort((a, b) => {
    if (a.id === 0) return 1;
    if (b.id === 0) return -1;
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
  });

  const handleCopyTable = () => {
    const headers = ['STT', 'Họ và tên', 'Ngày sinh', 'CCCD', 'Ngày cấp CCCD', 'Nơi cấp CCCD', 'BHYT', 'Cấp bậc', 'Chức vụ', 'Quê quán', 'Đơn vị'];
    const rows: any[] = [];
    let globalIndex = 1;
    groupedList.forEach((group) => {
      group.list.forEach((s) => {
        rows.push([
          globalIndex++, s.ho_ten, s.ngay_sinh || '', s.cccd || '', s.cccd_ngay_cap || '', s.cccd_noi_cap || '', s.bhyt || '', s.cap_bac || '',
          s.chuc_vu || '', s.que_quan || '', s.unit_name || '',
        ]);
      });
    });
    const text = [headers, ...rows].map((r) => r.join('\t')).join('\n');
    navigator.clipboard.writeText(text);
    message.success('Đã copy bảng - paste vào Excel');
  };

  const columns = [
    {
      title: 'STT',
      width: 60,
      render: (_: any, __: any, index: number) => index + 1,
    },
    {
      title: 'Ảnh',
      dataIndex: 'hinh_anh',
      width: 64,
      align: 'center' as const,
      render: (v: string | null) => v
        ? <Image src={v} width={36} height={36} style={{ objectFit: 'cover', borderRadius: 6 }} />
        : <UserOutlined style={{ fontSize: 20, color: '#ccc' }} />,
    },
    {
      title: 'Họ và tên',
      dataIndex: 'ho_ten',
      width: 200,
      render: (text: string, record: any) => (
        <a onClick={() => { setSelectedStudent(record); setDetailOpen(true); }}>
          {text}
        </a>
      ),
    },
    { title: 'Ngày sinh', dataIndex: 'ngay_sinh', width: 120,
      render: (v: string) => v ? dayjs(v).format('DD/MM/YYYY') : '-' },
    { title: 'CCCD', dataIndex: 'cccd', width: 140 },
    { title: 'Cấp bậc', dataIndex: 'cap_bac', width: 120 },
    { title: 'Chức vụ', dataIndex: 'chuc_vu', width: 120 },
    { title: 'Đơn vị', dataIndex: 'unit_name', width: 150 },
    {
      title: 'Thao tác',
      width: 120,
      render: (_: any, record: any) => (
        <Space>
          <Tooltip title="Xem">
            <Button size="small" icon={<EyeOutlined />}
              onClick={() => { setSelectedStudent(record); setDetailOpen(true); }} />
          </Tooltip>
          {isAdmin && (
            <Tooltip title="Sửa">
              <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
            </Tooltip>
          )}
          {isAdmin && (
            <Popconfirm title="Xóa học viên này?" onConfirm={() => handleDelete(record.id)}>
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
          <UserOutlined /> Danh sách Học viên
        </Title>
        <Space wrap>
          <Cascader
            options={buildCascaderOptions()}
            onChange={handleFilterUnit}
            placeholder="Lọc theo đơn vị"
            changeOnSelect
            style={{ width: 300 }}
            allowClear
          />
          <Input.Search
            placeholder="Tìm tên, CCCD..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onSearch={handleSearch}
            style={{ width: 250 }}
            enterButton={<SearchOutlined />}
          />
          <Button icon={<CopyOutlined />} onClick={handleCopyTable}>
            Copy bảng
          </Button>
          {isAdmin && (
            <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>
              Thêm học viên
            </Button>
          )}
        </Space>
      </Space>

      {loading ? (
        <Card loading={true} />
      ) : groupedList.length > 0 ? (
        groupedList.map((group) => (
          <Card
            key={group.id}
            title={
              <Space>
                <span style={{ fontSize: 16, fontWeight: 600, color: '#1677ff' }}>{group.name}</span>
                {group.note && <span style={{ fontSize: 13, color: '#8c8c8c', fontStyle: 'italic' }}>(Chuyên ngành: {group.note})</span>}
                <Tag color="blue">{group.list.length} học viên</Tag>
              </Space>
            }
            style={{ marginBottom: 20 }}
            styles={{ body: { padding: 0 } }}
          >
            <Table
              columns={columns}
              dataSource={group.list}
              rowKey="id"
              size="middle"
              scroll={{ x: 1180 }}
              pagination={false}
            />
          </Card>
        ))
      ) : (
        <Card>
          <Empty description="Không có học viên nào" />
        </Card>
      )}

      {/* Modal Thêm/Sửa */}
      <Modal
        title={editingStudent ? 'Sửa học viên' : 'Thêm học viên'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
        okText="Lưu"
        cancelText="Hủy"
        width={800}
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
                  <Button danger size="small" onClick={() => form.setFieldsValue({ hinh_anh: null })}>
                    Xóa ảnh
                  </Button>
                )}
              </Space>
            </Space>
          </Form.Item>
          <Divider orientation="left" style={{ fontWeight: 600, color: '#1677ff', borderColor: '#d9d9d9' }}>Thông tin cá nhân</Divider>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <Form.Item name="unit_id" label="Đơn vị (Trung đội)" rules={[{ required: true, message: 'Chọn đơn vị' }]}>
              <Select placeholder="Chọn trung đội" options={getUnitSelectOptions()} showSearch optionFilterProp="label" />
            </Form.Item>
            <Form.Item name="ho_ten" label="Họ và tên" rules={[{ required: true, message: 'Nhập họ tên' }]}>
              <Input />
            </Form.Item>
            <Form.Item name="ngay_sinh" label="Ngày sinh">
              <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} placeholder="Chọn ngày sinh" />
            </Form.Item>
            <Form.Item name="cccd" label="CCCD">
              <Input />
            </Form.Item>
            <Form.Item name="cccd_ngay_cap" label="Ngày cấp CCCD">
              <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} placeholder="Chọn ngày cấp" />
            </Form.Item>
            <Form.Item name="cccd_noi_cap" label="Nơi cấp CCCD">
              <Input />
            </Form.Item>
            <Form.Item name="bhyt" label="Mã BHYT">
              <Input />
            </Form.Item>
            <Form.Item name="cap_bac" label="Cấp bậc">
              <Input />
            </Form.Item>
            <Form.Item name="chuc_vu" label="Chức vụ">
              <Input />
            </Form.Item>
            <Form.Item name="que_quan" label="Quê quán">
              <Input />
            </Form.Item>
            <Form.Item name="dia_chi_thuong_tru" label="Địa chỉ thường trú">
              <Input />
            </Form.Item>
          </div>
 
          <Divider orientation="left" style={{ fontWeight: 600, color: '#1677ff', borderColor: '#d9d9d9', marginTop: 24 }}>Thông tin thân nhân</Divider>
          
          <Title level={5} style={{ fontSize: 14, color: '#555', marginBottom: 12 }}>Thông tin Bố</Title>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <Form.Item name="bo_ho_ten" label="Họ tên bố">
              <Input />
            </Form.Item>
            <Form.Item name="bo_nghe_nghiep" label="Nghề nghiệp">
              <Input />
            </Form.Item>
            <Form.Item name="bo_ngay_sinh" label="Ngày sinh">
              <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="bo_noi_o" label="Nơi ở hiện nay">
              <Input />
            </Form.Item>
          </div>
 
          <Title level={5} style={{ fontSize: 14, color: '#555', marginTop: 16, marginBottom: 12 }}>Thông tin Mẹ</Title>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <Form.Item name="me_ho_ten" label="Họ tên mẹ">
              <Input />
            </Form.Item>
            <Form.Item name="me_nghe_nghiep" label="Nghề nghiệp">
              <Input />
            </Form.Item>
            <Form.Item name="me_ngay_sinh" label="Ngày sinh">
              <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="me_noi_o" label="Nơi ở hiện nay">
              <Input />
            </Form.Item>
          </div>
        </Form>
      </Modal>

      {/* Drawer Chi tiết */}
      <Drawer
        title={selectedStudent?.ho_ten}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        size="large"
      >
        {selectedStudent && (
          <>
          {selectedStudent.hinh_anh && (
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <Image src={selectedStudent.hinh_anh} width={150} style={{ borderRadius: 8 }} />
            </div>
          )}
          <Divider orientation="left" style={{ fontWeight: 600, color: '#1677ff', margin: '12px 0' }}>Thông tin cá nhân</Divider>
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="Họ và tên">{selectedStudent.ho_ten}</Descriptions.Item>
            <Descriptions.Item label="Đơn vị">{selectedStudent.unit_name}</Descriptions.Item>
            <Descriptions.Item label="Ngày sinh">
              {selectedStudent.ngay_sinh ? dayjs(selectedStudent.ngay_sinh).format('DD/MM/YYYY') : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="CCCD">{selectedStudent.cccd || '-'}</Descriptions.Item>
            <Descriptions.Item label="Ngày cấp CCCD">
              {selectedStudent.cccd_ngay_cap ? dayjs(selectedStudent.cccd_ngay_cap).format('DD/MM/YYYY') : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Nơi cấp CCCD">{selectedStudent.cccd_noi_cap || '-'}</Descriptions.Item>
            <Descriptions.Item label="Mã BHYT">{selectedStudent.bhyt || '-'}</Descriptions.Item>
            <Descriptions.Item label="Cấp bậc">{selectedStudent.cap_bac || '-'}</Descriptions.Item>
            <Descriptions.Item label="Chức vụ">{selectedStudent.chuc_vu || '-'}</Descriptions.Item>
            <Descriptions.Item label="Quê quán">{selectedStudent.que_quan || '-'}</Descriptions.Item>
            <Descriptions.Item label="Địa chỉ thường trú">{selectedStudent.dia_chi_thuong_tru || '-'}</Descriptions.Item>
            <Descriptions.Item label="Khen thưởng đột xuất & Giải thưởng riêng">
              {studentAwards.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {studentAwards.map((a, idx) => (
                    <Tag key={idx} color="purple" style={{ whiteSpace: 'normal', height: 'auto', padding: '4px 8px', margin: 0 }}>
                      <strong>{a.ten_giai_thuong}</strong> ({a.loai_khen_thuong}) - Cấp: {a.cap_khen_thuong || 'Chưa rõ'}
                      {a.ngay_khen_thuong && ` - Ngày: ${dayjs(a.ngay_khen_thuong).format('DD/MM/YYYY')}`}
                      {a.ghi_chu && ` (${a.ghi_chu})`}
                    </Tag>
                  ))}
                </div>
              ) : (
                <span style={{ color: '#aaa' }}>Chưa có giải thưởng riêng</span>
              )}
            </Descriptions.Item>
          </Descriptions>

          <Divider orientation="left" style={{ fontWeight: 600, color: '#1677ff', margin: '24px 0 12px 0' }}>Thông tin thân nhân</Divider>
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="Bố - Họ tên">{selectedStudent.bo_ho_ten || '-'}</Descriptions.Item>
            <Descriptions.Item label="Bố - Nghề nghiệp">{selectedStudent.bo_nghe_nghiep || '-'}</Descriptions.Item>
            <Descriptions.Item label="Bố - Nơi ở">{selectedStudent.bo_noi_o || '-'}</Descriptions.Item>
            <Descriptions.Item label="Mẹ - Họ tên">{selectedStudent.me_ho_ten || '-'}</Descriptions.Item>
            <Descriptions.Item label="Mẹ - Nghề nghiệp">{selectedStudent.me_nghe_nghiep || '-'}</Descriptions.Item>
            <Descriptions.Item label="Mẹ - Nơi ở">{selectedStudent.me_noi_o || '-'}</Descriptions.Item>
          </Descriptions>
          </>
        )}
      </Drawer>
    </div>
  );
};

export default StudentsPage;
