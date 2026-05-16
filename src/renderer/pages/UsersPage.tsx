import React, { useEffect, useState, useCallback } from 'react';
import {
  Card, Table, Button, Modal, Form, Input, Select, Space, Typography,
  Popconfirm, App, Tag, Tooltip,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, KeyOutlined, TeamOutlined, CrownOutlined, UserOutlined,
} from '@ant-design/icons';
import { getUsers, createUser, deleteUser, setUserRole, resetUserPassword } from '../services/api';
import { useAuth } from '../auth/AuthContext';
import type { User, UserRole } from '../../shared/types';
import dayjs from 'dayjs';

const { Title } = Typography;

const UsersPage: React.FC = () => {
  const { message } = App.useApp();
  const { user: me } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [pwTarget, setPwTarget] = useState<User | null>(null);
  const [form] = Form.useForm();
  const [pwForm] = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setUsers(await getUsers());
    } catch (err: any) {
      message.error('Lỗi: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    try {
      const v = await form.validateFields();
      await createUser({ username: v.username, password: v.password, role: v.role });
      message.success('Đã tạo tài khoản');
      setCreateOpen(false);
      form.resetFields();
      load();
    } catch (err: any) {
      if (err.errorFields) return;
      message.error('Lỗi: ' + err.message);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteUser(id);
      message.success('Đã xóa');
      load();
    } catch (err: any) {
      message.error('Lỗi: ' + err.message);
    }
  };

  const handleSetRole = async (id: number, role: UserRole) => {
    try {
      await setUserRole(id, role);
      message.success('Đã đổi quyền');
      load();
    } catch (err: any) {
      message.error('Lỗi: ' + err.message);
    }
  };

  const handleResetPw = async () => {
    try {
      const v = await pwForm.validateFields();
      await resetUserPassword(pwTarget!.id, v.newPassword);
      message.success(`Đã đặt lại mật khẩu cho ${pwTarget!.username}`);
      setPwOpen(false);
      pwForm.resetFields();
    } catch (err: any) {
      if (err.errorFields) return;
      message.error('Lỗi: ' + err.message);
    }
  };

  const columns = [
    { title: 'STT', width: 60, render: (_: any, __: any, i: number) => i + 1 },
    {
      title: 'Tên đăng nhập', dataIndex: 'username', width: 220,
      render: (v: string, r: User) => (
        <Space>
          {r.role === 'admin' ? <CrownOutlined style={{ color: '#faad14' }} /> : <UserOutlined style={{ color: '#999' }} />}
          <strong>{v}</strong>
          {me?.id === r.id && <Tag color="blue">Bạn</Tag>}
        </Space>
      ),
    },
    {
      title: 'Quyền', dataIndex: 'role', width: 200, align: 'center' as const,
      render: (role: UserRole, r: User) => (
        <Select
          size="small"
          value={role}
          style={{ width: 150 }}
          disabled={me?.id === r.id}
          onChange={(val) => handleSetRole(r.id, val)}
          options={[
            { value: 'admin', label: 'Admin (toàn quyền)' },
            { value: 'user', label: 'User (chỉ xem)' },
          ]}
        />
      ),
    },
    {
      title: 'Trạng thái', dataIndex: 'must_change_password', width: 160, align: 'center' as const,
      render: (v: boolean) => v
        ? <Tag color="orange">Cần đổi mật khẩu</Tag>
        : <Tag color="green">Hoạt động</Tag>,
    },
    {
      title: 'Ngày tạo', dataIndex: 'created_at', width: 140,
      render: (v: string) => v ? dayjs(v).format('DD/MM/YYYY') : '-',
    },
    {
      title: 'Thao tác', width: 120, align: 'center' as const,
      render: (_: any, r: User) => (
        <Space>
          <Tooltip title="Đặt lại mật khẩu">
            <Button size="small" icon={<KeyOutlined />} onClick={() => { setPwTarget(r); pwForm.resetFields(); setPwOpen(true); }} />
          </Tooltip>
          <Popconfirm
            title="Xóa tài khoản này?"
            onConfirm={() => handleDelete(r.id)}
            disabled={me?.id === r.id}
          >
            <Button size="small" danger icon={<DeleteOutlined />} disabled={me?.id === r.id} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16, justifyContent: 'space-between', width: '100%' }}>
        <Title level={4} style={{ margin: 0 }}>
          <TeamOutlined /> Quản lý tài khoản
        </Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setCreateOpen(true); }}>
          Tạo tài khoản
        </Button>
      </Space>

      <Card styles={{ body: { padding: 0 } }}>
        <Table columns={columns} dataSource={users} rowKey="id" loading={loading}
          size="middle" pagination={false} scroll={{ x: 900 }} />
      </Card>

      <Modal title="Tạo tài khoản" open={createOpen} onOk={handleCreate}
        onCancel={() => setCreateOpen(false)} okText="Tạo" cancelText="Hủy">
        <Form form={form} layout="vertical" requiredMark={false}>
          <Form.Item name="username" label="Tên đăng nhập"
            rules={[{ required: true, message: 'Nhập tên đăng nhập' }, { min: 3, message: 'Tối thiểu 3 ký tự' }]}>
            <Input placeholder="tên đăng nhập" />
          </Form.Item>
          <Form.Item name="password" label="Mật khẩu"
            rules={[{ required: true, message: 'Nhập mật khẩu' }, { min: 6, message: 'Tối thiểu 6 ký tự' }]}>
            <Input.Password placeholder="••••••••" />
          </Form.Item>
          <Form.Item name="role" label="Quyền" initialValue="user" rules={[{ required: true }]}>
            <Select options={[
              { value: 'user', label: 'User (chỉ xem)' },
              { value: 'admin', label: 'Admin (toàn quyền)' },
            ]} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={`Đặt lại mật khẩu: ${pwTarget?.username || ''}`} open={pwOpen} onOk={handleResetPw}
        onCancel={() => setPwOpen(false)} okText="Đặt lại" cancelText="Hủy">
        <Form form={pwForm} layout="vertical" requiredMark={false}>
          <Form.Item name="newPassword" label="Mật khẩu mới"
            rules={[{ required: true, message: 'Nhập mật khẩu mới' }, { min: 6, message: 'Tối thiểu 6 ký tự' }]}>
            <Input.Password placeholder="••••••••" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default UsersPage;
