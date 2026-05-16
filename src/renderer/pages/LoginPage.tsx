import React, { useState } from 'react';
import { Card, Form, Input, Button, Tabs, Typography, Alert, App } from 'antd';
import { UserOutlined, LockOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { useAuth } from '../auth/AuthContext';

const { Title, Text } = Typography;

const LoginPage: React.FC = () => {
  const { login, register, needsSetup } = useAuth();
  const { message } = App.useApp();
  const [tab, setTab] = useState('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loginForm] = Form.useForm();
  const [regForm] = Form.useForm();

  const handleLogin = async () => {
    setError(null);
    try {
      const v = await loginForm.validateFields();
      setLoading(true);
      await login(v.username, v.password);
      message.success('Đăng nhập thành công');
    } catch (err: any) {
      if (err.errorFields) return;
      setError(err.message || 'Đăng nhập thất bại');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    setError(null);
    try {
      const v = await regForm.validateFields();
      setLoading(true);
      await register(v.username, v.password);
      message.success('Đăng ký thành công');
    } catch (err: any) {
      if (err.errorFields) return;
      setError(err.message || 'Đăng ký thất bại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #1677ff 0%, #0a3d91 100%)', padding: 16,
    }}>
      <Card style={{ width: 420, maxWidth: '100%', borderRadius: 16, boxShadow: '0 12px 40px rgba(0,0,0,0.2)' }}>
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <SafetyCertificateOutlined style={{ fontSize: 44, color: '#1677ff' }} />
          <Title level={3} style={{ margin: '12px 0 0' }}>Quản Lý Quân Nhân</Title>
          <Text type="secondary">Đăng nhập để tiếp tục</Text>
        </div>

        {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />}

        <Tabs
          activeKey={tab}
          onChange={(k) => { setTab(k); setError(null); }}
          centered
          items={[
            {
              key: 'login',
              label: 'Đăng nhập',
              children: (
                <Form form={loginForm} layout="vertical" onFinish={handleLogin} requiredMark={false}>
                  <Form.Item name="username" label="Tên đăng nhập" rules={[{ required: true, message: 'Nhập tên đăng nhập' }]}>
                    <Input prefix={<UserOutlined />} placeholder="admin" autoFocus />
                  </Form.Item>
                  <Form.Item name="password" label="Mật khẩu" rules={[{ required: true, message: 'Nhập mật khẩu' }]}>
                    <Input.Password prefix={<LockOutlined />} placeholder="••••••••" onPressEnter={handleLogin} />
                  </Form.Item>
                  <Button type="primary" block size="large" loading={loading} onClick={handleLogin}>
                    Đăng nhập
                  </Button>
                  {needsSetup && (
                    <Text type="secondary" style={{ display: 'block', marginTop: 12, fontSize: 13 }}>
                      Lần đầu sử dụng: đăng nhập <b>admin</b> / <b>admin123</b> rồi đổi mật khẩu.
                    </Text>
                  )}
                </Form>
              ),
            },
            {
              key: 'register',
              label: 'Đăng ký',
              children: (
                <Form form={regForm} layout="vertical" onFinish={handleRegister} requiredMark={false}>
                  <Form.Item name="username" label="Tên đăng nhập"
                    rules={[{ required: true, message: 'Nhập tên đăng nhập' }, { min: 3, message: 'Tối thiểu 3 ký tự' }]}>
                    <Input prefix={<UserOutlined />} placeholder="tên đăng nhập" />
                  </Form.Item>
                  <Form.Item name="password" label="Mật khẩu"
                    rules={[{ required: true, message: 'Nhập mật khẩu' }, { min: 6, message: 'Tối thiểu 6 ký tự' }]}>
                    <Input.Password prefix={<LockOutlined />} placeholder="••••••••" />
                  </Form.Item>
                  <Form.Item name="confirm" label="Nhập lại mật khẩu" dependencies={['password']}
                    rules={[
                      { required: true, message: 'Nhập lại mật khẩu' },
                      ({ getFieldValue }) => ({
                        validator: (_, value) =>
                          !value || getFieldValue('password') === value
                            ? Promise.resolve()
                            : Promise.reject(new Error('Mật khẩu không khớp')),
                      }),
                    ]}>
                    <Input.Password prefix={<LockOutlined />} placeholder="••••••••" onPressEnter={handleRegister} />
                  </Form.Item>
                  <Button type="primary" block size="large" loading={loading} onClick={handleRegister}>
                    Đăng ký
                  </Button>
                  <Text type="secondary" style={{ display: 'block', marginTop: 12, fontSize: 13 }}>
                    Tài khoản đăng ký có quyền <b>chỉ xem</b>. Liên hệ admin để được cấp quyền.
                  </Text>
                </Form>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
};

export default LoginPage;
