import React, { useState } from 'react';
import { Card, Form, Input, Button, Typography, Alert, App } from 'antd';
import { LockOutlined, KeyOutlined } from '@ant-design/icons';
import { useAuth } from '../auth/AuthContext';

const { Title, Text } = Typography;

const ForceChangePassword: React.FC = () => {
  const { changePassword, logout, user } = useAuth();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    try {
      const v = await form.validateFields();
      setLoading(true);
      await changePassword(v.oldPassword, v.newPassword);
      message.success('Đổi mật khẩu thành công');
    } catch (err: any) {
      if (err.errorFields) return;
      setError(err.message || 'Đổi mật khẩu thất bại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #1677ff 0%, #0a3d91 100%)', padding: 16,
    }}>
      <Card style={{ width: 420, maxWidth: '100%', borderRadius: 16 }}>
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <KeyOutlined style={{ fontSize: 40, color: '#faad14' }} />
          <Title level={4} style={{ margin: '12px 0 0' }}>Đổi mật khẩu bắt buộc</Title>
          <Text type="secondary">Tài khoản <b>{user?.username}</b> cần đổi mật khẩu trước khi sử dụng.</Text>
        </div>

        {error && <Alert type="error" showIcon title={error} style={{ marginBottom: 16 }} />}

        <Form form={form} layout="vertical" requiredMark={false}>
          <Form.Item name="oldPassword" label="Mật khẩu hiện tại" rules={[{ required: true, message: 'Nhập mật khẩu hiện tại' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="••••••••" />
          </Form.Item>
          <Form.Item name="newPassword" label="Mật khẩu mới"
            rules={[{ required: true, message: 'Nhập mật khẩu mới' }, { min: 6, message: 'Tối thiểu 6 ký tự' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="••••••••" />
          </Form.Item>
          <Form.Item name="confirm" label="Nhập lại mật khẩu mới" dependencies={['newPassword']}
            rules={[
              { required: true, message: 'Nhập lại mật khẩu mới' },
              ({ getFieldValue }) => ({
                validator: (_, value) =>
                  !value || getFieldValue('newPassword') === value
                    ? Promise.resolve()
                    : Promise.reject(new Error('Mật khẩu không khớp')),
              }),
            ]}>
            <Input.Password prefix={<LockOutlined />} placeholder="••••••••" onPressEnter={handleSubmit} />
          </Form.Item>
          <Button type="primary" block size="large" loading={loading} onClick={handleSubmit}>
            Đổi mật khẩu
          </Button>
          <Button type="link" block style={{ marginTop: 8 }} onClick={logout}>
            Đăng xuất
          </Button>
        </Form>
      </Card>
    </div>
  );
};

export default ForceChangePassword;
