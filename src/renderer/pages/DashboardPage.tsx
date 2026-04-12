import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Typography, Space } from 'antd';
import {
  UserOutlined, ApartmentOutlined, TeamOutlined, TrophyOutlined,
  BookOutlined, WarningOutlined, CalendarOutlined, StarOutlined,
} from '@ant-design/icons';
import { getUnits, getStudents } from '../services/api';

const { Title, Paragraph } = Typography;

const DashboardPage: React.FC = () => {
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalTieuDoan: 0,
    totalDaiDoi: 0,
    totalTrungDoi: 0,
  });
  const [connected, setConnected] = useState(false);

  useEffect(() => { loadStats(); }, []);

  const loadStats = async () => {
    try {
      const [units, studentsRes] = await Promise.all([
        getUnits(),
        getStudents({ page: 1, pageSize: 1 }),
      ]);
      setConnected(true);
      setStats({
        totalStudents: studentsRes.total,
        totalTieuDoan: units.filter((u: any) => u.type === 'tieu_doan').length,
        totalDaiDoi: units.filter((u: any) => u.type === 'dai_doi').length,
        totalTrungDoi: units.filter((u: any) => u.type === 'trung_doi').length,
      });
    } catch {
      setConnected(false);
    }
  };

  const statCards = [
    { title: 'Tổng Học viên', value: stats.totalStudents, icon: <UserOutlined />, color: '#1677ff', bg: '#e6f4ff' },
    { title: 'Tiểu đoàn', value: stats.totalTieuDoan, icon: <ApartmentOutlined />, color: '#52c41a', bg: '#f6ffed' },
    { title: 'Đại đội', value: stats.totalDaiDoi, icon: <TeamOutlined />, color: '#faad14', bg: '#fffbe6' },
    { title: 'Trung đội', value: stats.totalTrungDoi, icon: <TrophyOutlined />, color: '#eb2f96', bg: '#fff0f6' },
  ];

  const features = [
    { icon: <UserOutlined style={{ fontSize: 28, color: '#1677ff' }} />, title: 'Quản lý Học viên', desc: 'Thêm, sửa, xóa, tìm kiếm thông tin học viên' },
    { icon: <BookOutlined style={{ fontSize: 28, color: '#52c41a' }} />, title: 'Điểm học tập', desc: 'Nhập điểm theo môn, tín chỉ, tự tính TB' },
    { icon: <StarOutlined style={{ fontSize: 28, color: '#faad14' }} />, title: 'Điểm rèn luyện', desc: 'Điểm 4 tuần, tự tính tháng & xếp loại' },
    { icon: <CalendarOutlined style={{ fontSize: 28, color: '#13c2c2' }} />, title: 'Công vắng', desc: 'Theo dõi ngày vắng, tổng công' },
    { icon: <WarningOutlined style={{ fontSize: 28, color: '#ff4d4f' }} />, title: 'Vi phạm', desc: 'Khiển trách, cảnh cáo, kỷ luật' },
    { icon: <TrophyOutlined style={{ fontSize: 28, color: '#eb2f96' }} />, title: 'Thi đua khen thưởng', desc: 'Điểm năm, tổng kết, xếp loại tự động' },
  ];

  return (
    <div>
      <Title level={3} style={{ marginBottom: 24 }}>Tổng quan</Title>

      <Row gutter={[20, 20]} style={{ marginBottom: 28 }}>
        {statCards.map((s, i) => (
          <Col xs={24} sm={12} lg={6} key={i}>
            <Card hoverable style={{ borderRadius: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{
                  width: 56, height: 56, borderRadius: 12, background: s.bg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 26, color: s.color,
                }}>
                  {s.icon}
                </div>
                <div>
                  <div style={{ color: '#666', fontSize: 14 }}>{s.title}</div>
                  <div style={{ fontSize: 32, fontWeight: 700, color: s.color, lineHeight: 1.2 }}>{s.value}</div>
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {!connected && (
        <Card style={{ marginBottom: 24, borderColor: '#faad14', background: '#fffbe6' }}>
          <Title level={5} style={{ color: '#d48806', margin: 0 }}>
            Chưa kết nối Database
          </Title>
          <Paragraph style={{ marginBottom: 0, marginTop: 8 }}>
            Vào <strong>Cài đặt</strong> trong menu bên trái để cấu hình kết nối TiDB Cloud.
          </Paragraph>
        </Card>
      )}

      <Title level={4} style={{ marginBottom: 16 }}>Chức năng hệ thống</Title>
      <Row gutter={[20, 20]}>
        {features.map((f, i) => (
          <Col xs={24} sm={12} lg={8} key={i}>
            <Card hoverable style={{ borderRadius: 12, height: '100%' }}>
              <Space align="start" size={16}>
                <div style={{
                  width: 52, height: 52, borderRadius: 10,
                  background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {f.icon}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}>{f.title}</div>
                  <div style={{ color: '#666', fontSize: 14 }}>{f.desc}</div>
                </div>
              </Space>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
};

export default DashboardPage;
