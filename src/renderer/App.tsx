import React, { useEffect, useState } from 'react';
import {
  ConfigProvider, Layout, Menu, theme, Typography, Avatar, App as AntdApp,
  Spin, Dropdown, Tag, Button, Alert, Modal, Form, Input, Badge, Space, Tooltip,
} from 'antd';
import {
  HomeOutlined,
  UserOutlined,
  ApartmentOutlined,
  BookOutlined,
  StarOutlined,
  FileExcelOutlined,
  CalendarOutlined,
  WarningOutlined,
  TrophyOutlined,
  TeamOutlined,
  LogoutOutlined,
  KeyOutlined,
  DownOutlined,
  FlagOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
} from '@ant-design/icons';
import { countUnofficialParty } from './services/api';
import viVN from 'antd/locale/vi_VN';
import DashboardPage from './pages/DashboardPage';
import StudentsPage from './pages/StudentsPage';
import UnitsPage from './pages/UnitsPage';
import AcademicPage from './pages/AcademicPage';
import DisciplinePage from './pages/DisciplinePage';
import AbsencesPage from './pages/AbsencesPage';
import ViolationsPage from './pages/ViolationsPage';
import AwardsPage from './pages/AwardsPage';
import ExcelPage from './pages/ExcelPage';
import PartyMembersPage from './pages/PartyMembersPage';
import UsersPage from './pages/UsersPage';
import LoginPage from './pages/LoginPage';
import ForceChangePassword from './pages/ForceChangePassword';
import { AuthProvider, useAuth } from './auth/AuthContext';

const { Sider, Content, Header } = Layout;
const { Title } = Typography;

type PageKey =
  | 'dashboard' | 'students' | 'units' | 'academic' | 'discipline'
  | 'absences' | 'violations' | 'awards' | 'party' | 'excel' | 'users';

const themeConfig = {
  algorithm: theme.defaultAlgorithm,
  token: {
    colorPrimary: '#1677ff',
    borderRadius: 8,
    fontSize: 15,
    fontSizeHeading1: 32,
    fontSizeHeading2: 28,
    fontSizeHeading3: 24,
    fontSizeHeading4: 20,
    fontSizeHeading5: 17,
    controlHeight: 40,
    controlHeightLG: 48,
    controlHeightSM: 32,
    padding: 20,
    paddingLG: 28,
    marginLG: 28,
  },
  components: {
    Menu: { itemHeight: 48, fontSize: 15, iconSize: 18 },
    Table: { headerBg: '#f0f5ff', headerColor: '#1d1d1f', fontSize: 14, cellPaddingBlock: 14, cellPaddingInline: 16 },
    Card: { paddingLG: 28 },
    Button: { fontWeight: 500 },
    Statistic: { titleFontSize: 15, contentFontSize: 32 },
  },
};

// ============ Đổi mật khẩu (modal) ============
const ChangePasswordModal: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const { changePassword } = useAuth();
  const { message } = AntdApp.useApp();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    try {
      const v = await form.validateFields();
      setLoading(true);
      await changePassword(v.oldPassword, v.newPassword);
      message.success('Đã đổi mật khẩu');
      form.resetFields();
      onClose();
    } catch (err: any) {
      if (err.errorFields) return;
      message.error('Lỗi: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Đổi mật khẩu" open={open} onOk={submit} confirmLoading={loading}
      onCancel={onClose} okText="Đổi mật khẩu" cancelText="Hủy">
      <Form form={form} layout="vertical" requiredMark={false}>
        <Form.Item name="oldPassword" label="Mật khẩu hiện tại" rules={[{ required: true, message: 'Nhập mật khẩu hiện tại' }]}>
          <Input.Password />
        </Form.Item>
        <Form.Item name="newPassword" label="Mật khẩu mới"
          rules={[{ required: true, message: 'Nhập mật khẩu mới' }, { min: 6, message: 'Tối thiểu 6 ký tự' }]}>
          <Input.Password />
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
          <Input.Password />
        </Form.Item>
      </Form>
    </Modal>
  );
};

// ============ Layout chính (đã đăng nhập) ============
const MainLayout: React.FC = () => {
  const { user, isAdmin, logout } = useAuth();
  const [currentPage, setCurrentPage] = useState<PageKey>('dashboard');
  const [collapsed, setCollapsed] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(0);

  const handleZoom = (delta: number) => {
    const newZoom = Math.max(-4, Math.min(zoomLevel + delta, 5));
    setZoomLevel(newZoom);
    if ((window as any).electronAPI?.setZoomLevel) {
      (window as any).electronAPI.setZoomLevel(newZoom);
    }
  };

  // Xoá unofficial party logic

  const menuItems = [
    { key: 'dashboard', icon: <HomeOutlined />, label: 'Tổng quan' },
    { key: 'units', icon: <ApartmentOutlined />, label: 'Đơn vị' },
    { key: 'students', icon: <UserOutlined />, label: 'Học viên' },
    { type: 'divider' as const },
    { key: 'academic', icon: <BookOutlined />, label: 'Điểm học tập' },
    { key: 'discipline', icon: <StarOutlined />, label: 'Điểm rèn luyện' },
    { key: 'absences', icon: <CalendarOutlined />, label: 'Công vắng' },
    { key: 'violations', icon: <WarningOutlined />, label: 'Vi phạm' },
    { key: 'awards', icon: <TrophyOutlined />, label: 'Thi đua khen thưởng' },
    { key: 'party', icon: <FlagOutlined />, label: 'Theo dõi Đảng viên' },
    { type: 'divider' as const },
    { key: 'excel', icon: <FileExcelOutlined />, label: 'Excel Import/Export' },
    ...(isAdmin ? [{ key: 'users', icon: <TeamOutlined />, label: 'Quản lý tài khoản' }] : []),
  ];

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard': return <DashboardPage onNavigate={(page) => setCurrentPage(page as PageKey)} />;
      case 'students': return <StudentsPage />;
      case 'units': return <UnitsPage />;
      case 'academic': return <AcademicPage />;
      case 'discipline': return <DisciplinePage />;
      case 'absences': return <AbsencesPage />;
      case 'violations': return <ViolationsPage />;
      case 'awards': return <AwardsPage />;
      case 'party': return <PartyMembersPage />;
      case 'excel': return <ExcelPage />;
      case 'users': return isAdmin ? <UsersPage /> : <DashboardPage onNavigate={(page) => setCurrentPage(page as PageKey)} />;
      default: return <DashboardPage onNavigate={(page) => setCurrentPage(page as PageKey)} />;
    }
  };

  const currentLabel = menuItems.find((m) => 'key' in m && m.key === currentPage) as any;

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible collapsed={collapsed} onCollapse={setCollapsed}
        theme="dark" width={260} collapsedWidth={80}
        style={{ overflow: 'auto', height: '100vh', position: 'fixed', left: 0, top: 0, bottom: 0 }}
      >
        <div style={{
          height: 72, display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 12, borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '0 16px',
        }}>
          <Avatar size={40} style={{ backgroundColor: '#1677ff', fontSize: 18, flexShrink: 0 }} icon={<UserOutlined />} />
          {!collapsed && (
            <Title level={5} style={{ color: '#fff', margin: 0, whiteSpace: 'nowrap', fontSize: 16 }}>
              Quản Lý Quân Nhân
            </Title>
          )}
        </div>
        <Menu
          theme="dark" mode="inline" selectedKeys={[currentPage]} items={menuItems}
          onClick={({ key }) => setCurrentPage(key as PageKey)}
          style={{ borderRight: 0, paddingTop: 8 }}
        />
      </Sider>

      <Layout style={{ marginLeft: collapsed ? 80 : 260, transition: 'margin-left 0.2s', height: '100vh', overflow: 'hidden' }}>
        <Header style={{
          background: '#fff', padding: '0 32px', height: 72, minHeight: 72, lineHeight: '72px',
          borderBottom: '1px solid #e8e8e8', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', flex: '0 0 72px',
        }}>
          <Title level={4} style={{ margin: 0, fontSize: 20 }}>
            {currentLabel?.label || 'Tổng quan'}
          </Title>

          <Space size={12}>
            <Space.Compact style={{ marginRight: 16 }}>
              <Tooltip title="Thu nhỏ">
                <Button icon={<ZoomOutOutlined />} onClick={() => handleZoom(-0.5)} />
              </Tooltip>
              <Button style={{ width: 64, pointerEvents: 'none', padding: '0 4px', textAlign: 'center' }}>
                {Math.round(Math.pow(1.2, zoomLevel) * 100)}%
              </Button>
              <Tooltip title="Phóng to">
                <Button icon={<ZoomInOutlined />} onClick={() => handleZoom(0.5)} />
              </Tooltip>
            </Space.Compact>

            <Dropdown
            menu={{
              items: [
                { key: 'pw', icon: <KeyOutlined />, label: 'Đổi mật khẩu', onClick: () => setPwOpen(true) },
                { type: 'divider' },
                { key: 'logout', icon: <LogoutOutlined />, label: 'Đăng xuất', danger: true, onClick: () => logout() },
              ],
            }}
          >
            <Button type="text" style={{ height: 'auto', padding: '6px 12px' }}>
              <Avatar size={32} style={{ backgroundColor: isAdmin ? '#faad14' : '#1677ff' }} icon={<UserOutlined />} />
              <span style={{ margin: '0 8px', fontWeight: 500 }}>{user?.username}</span>
              <Tag color={isAdmin ? 'gold' : 'default'} style={{ marginRight: 4 }}>
                {isAdmin ? 'Admin' : 'Chỉ xem'}
              </Tag>
              <DownOutlined style={{ fontSize: 11 }} />
            </Button>
          </Dropdown>
          </Space>
        </Header>

        <Content style={{ margin: 20, padding: 28, background: '#f5f5f5', flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
          {!isAdmin && (
            <Alert
              type="info" showIcon style={{ marginBottom: 16 }}
              title="Tài khoản chỉ xem — bạn có thể xem dữ liệu nhưng không thể thêm/sửa/xóa. Liên hệ admin nếu cần quyền chỉnh sửa."
            />
          )}
          {renderPage()}
        </Content>
      </Layout>

      <ChangePasswordModal open={pwOpen} onClose={() => setPwOpen(false)} />
    </Layout>
  );
};

// ============ Màn hình lỗi kết nối DB (server tạm thời down / mạng) ============
const DbErrorScreen: React.FC = () => {
  const { refreshStatus } = useAuth();
  const [retrying, setRetrying] = useState(false);
  const handleRetry = async () => {
    setRetrying(true);
    try { await refreshStatus(); } finally { setRetrying(false); }
  };
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #1677ff 0%, #0a3d91 100%)', padding: 16,
    }}>
      <Alert
        type="error" showIcon style={{ maxWidth: 520 }}
        title="Không kết nối được Database"
        description="Có thể do mạng tạm thời gián đoạn hoặc máy chủ TiDB chưa sẵn sàng. Vui lòng kiểm tra kết nối mạng rồi thử lại."
        action={<Button type="primary" onClick={handleRetry} loading={retrying}>Thử lại</Button>}
      />
    </div>
  );
};

// ============ Điều phối theo trạng thái auth ============
const AppContent: React.FC = () => {
  const { loading, dbConnected, user } = useAuth();

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin size="large" />
        <span style={{ marginLeft: 12, color: '#888' }}>Đang tải...</span>
      </div>
    );
  }
  if (!dbConnected) return <DbErrorScreen />;
  if (!user) return <LoginPage />;
  if (user.must_change_password) return <ForceChangePassword />;
  return <MainLayout />;
};

const App: React.FC = () => (
  <ConfigProvider locale={viVN} theme={themeConfig}>
    <AntdApp>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </AntdApp>
  </ConfigProvider>
);

export default App;
