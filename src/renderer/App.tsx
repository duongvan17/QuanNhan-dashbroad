import React, { useState } from 'react';
import { ConfigProvider, Layout, Menu, theme, Typography, Avatar, App as AntdApp } from 'antd';
import {
  HomeOutlined,
  UserOutlined,
  ApartmentOutlined,
  BookOutlined,
  StarOutlined,
  FileExcelOutlined,
  SettingOutlined,
  CalendarOutlined,
  WarningOutlined,
  TrophyOutlined,
} from '@ant-design/icons';
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
import SettingsPage from './pages/SettingsPage';

const { Sider, Content, Header } = Layout;
const { Title } = Typography;

type PageKey = 'dashboard' | 'students' | 'units' | 'academic' | 'discipline' | 'absences' | 'violations' | 'awards' | 'excel' | 'settings';

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
  { type: 'divider' as const },
  { key: 'excel', icon: <FileExcelOutlined />, label: 'Excel Import/Export' },
  { key: 'settings', icon: <SettingOutlined />, label: 'Cài đặt' },
];

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<PageKey>('dashboard');
  const [collapsed, setCollapsed] = useState(false);

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard': return <DashboardPage />;
      case 'students': return <StudentsPage />;
      case 'units': return <UnitsPage />;
      case 'academic': return <AcademicPage />;
      case 'discipline': return <DisciplinePage />;
      case 'absences': return <AbsencesPage />;
      case 'violations': return <ViolationsPage />;
      case 'awards': return <AwardsPage />;
      case 'excel': return <ExcelPage />;
      case 'settings': return <SettingsPage />;
      default: return <DashboardPage />;
    }
  };

  return (
    <ConfigProvider
      locale={viVN}
      theme={{
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
          Menu: {
            itemHeight: 48,
            fontSize: 15,
            iconSize: 18,
          },
          Table: {
            headerBg: '#f0f5ff',
            headerColor: '#1d1d1f',
            fontSize: 14,
            cellPaddingBlock: 14,
            cellPaddingInline: 16,
          },
          Card: {
            paddingLG: 28,
          },
          Button: {
            fontWeight: 500,
          },
          Statistic: {
            titleFontSize: 15,
            contentFontSize: 32,
          },
        },
      }}
    >
      <AntdApp component={false}>
      <Layout style={{ minHeight: '100vh' }}>
        <Sider
          collapsible
          collapsed={collapsed}
          onCollapse={setCollapsed}
          theme="dark"
          width={260}
          collapsedWidth={80}
          style={{
            overflow: 'auto',
            height: '100vh',
            position: 'fixed',
            left: 0,
            top: 0,
            bottom: 0,
          }}
        >
          <div style={{
            height: 72,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            padding: '0 16px',
          }}>
            <Avatar
              size={40}
              style={{ backgroundColor: '#1677ff', fontSize: 18, flexShrink: 0 }}
              icon={<UserOutlined />}
            />
            {!collapsed && (
              <Title level={5} style={{ color: '#fff', margin: 0, whiteSpace: 'nowrap', fontSize: 16 }}>
                Quản Lý Quân Nhân
              </Title>
            )}
          </div>
          <Menu
            theme="dark"
            mode="inline"
            selectedKeys={[currentPage]}
            items={menuItems}
            onClick={({ key }) => setCurrentPage(key as PageKey)}
            style={{ borderRight: 0, paddingTop: 8 }}
          />
        </Sider>

        <Layout style={{ marginLeft: collapsed ? 80 : 260, transition: 'margin-left 0.2s', height: '100vh', overflow: 'hidden' }}>
          <Header style={{
            background: '#fff',
            padding: '0 32px',
            height: 72,
            minHeight: 72,
            lineHeight: '72px',
            borderBottom: '1px solid #e8e8e8',
            display: 'flex',
            alignItems: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            flex: '0 0 72px',
          }}>
            <Title level={4} style={{ margin: 0, fontSize: 20 }}>
              {menuItems.find((m) => m.key === currentPage)?.label || 'Tổng quan'}
            </Title>
          </Header>
          <Content style={{
            margin: 20,
            padding: 28,
            background: '#f5f5f5',
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
          }}>
            {renderPage()}
          </Content>
        </Layout>
      </Layout>
      </AntdApp>
    </ConfigProvider>
  );
};

export default App;
