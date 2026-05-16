import React, { useEffect, useState } from 'react';
import { Card, Form, Input, InputNumber, Button, Alert, Space, Typography, Divider, Tabs, Steps, Tag, Collapse } from 'antd';
import {
  DatabaseOutlined, CheckCircleOutlined, LoadingOutlined,
  CloudOutlined, HddOutlined, LaptopOutlined, GlobalOutlined,
  SafetyOutlined, RocketOutlined, InfoCircleOutlined,
} from '@ant-design/icons';
import { getDbConfig, testConnection, initDatabase } from '../services/api';
import type { DbConfig } from '../../shared/types';

const { Title, Text, Paragraph } = Typography;

// ============ Component copy text ============
const CopyText: React.FC<{ text: string }> = ({ text }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <code
      onClick={handleCopy}
      style={{
        background: '#f5f5f5',
        padding: '3px 8px',
        borderRadius: 4,
        cursor: 'pointer',
        border: '1px solid #d9d9d9',
        fontSize: 13,
        userSelect: 'all',
        position: 'relative',
      }}
      title="Click để copy"
    >
      {text}
      {copied && <span style={{ color: '#52c41a', marginLeft: 6, fontSize: 12 }}>Copied!</span>}
    </code>
  );
};

// ============ Step item helper ============
const StepContent: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ padding: '8px 0 16px 0', fontSize: 14, lineHeight: 1.8 }}>{children}</div>
);

const SettingsPage: React.FC = () => {
  const [form] = Form.useForm<DbConfig>();
  const [testing, setTesting] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [activeGuide, setActiveGuide] = useState('tidb');

  useEffect(() => { loadConfig(); }, []);

  const loadConfig = async () => {
    try {
      const config = await getDbConfig();
      form.setFieldsValue(config);
    } catch { /* */ }
  };

  const handleTest = async () => {
    try {
      const values = await form.validateFields();
      setTesting(true);
      setResult(null);
      const res = await testConnection(values);
      setResult(res);
    } catch (err: any) {
      setResult({ success: false, message: err.message });
    } finally {
      setTesting(false);
    }
  };

  const handleConnect = async () => {
    try {
      const values = await form.validateFields();
      setConnecting(true);
      setResult(null);
      const res = await initDatabase(values);
      setResult(res);
    } catch (err: any) {
      setResult({ success: false, message: err.message });
    } finally {
      setConnecting(false);
    }
  };

  const fillExample = (config: Partial<DbConfig>) => {
    form.setFieldsValue(config);
  };

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '8px 0' }}>
      {/* ========== PHẦN 1: FORM KẾT NỐI ========== */}
      <Title level={3} style={{ marginBottom: 4 }}>
        <DatabaseOutlined /> Cấu hình Database
      </Title>
      <Text type="secondary" style={{ fontSize: 15 }}>
        Nhập thông tin kết nối MySQL / TiDB Cloud. Tất cả các máy cài app dùng chung 1 database.
      </Text>

      <Divider style={{ margin: '16px 0' }} />

      <Card>
        <Form form={form} layout="vertical" autoComplete="off" size="large">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
            <Form.Item name="host" label="Host" rules={[{ required: true, message: 'Nhập host' }]}>
              <Input placeholder="gateway01.ap-southeast-1.prod.aws.tidbcloud.com" />
            </Form.Item>
            <Form.Item name="port" label="Port" rules={[{ required: true, message: 'Nhập port' }]}>
              <InputNumber style={{ width: '100%' }} placeholder="4000" min={1} max={65535} />
            </Form.Item>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
            <Form.Item name="user" label="User" rules={[{ required: true, message: 'Nhập user' }]}>
              <Input placeholder="username" />
            </Form.Item>
            <Form.Item name="password" label="Password" rules={[{ required: true, message: 'Nhập password' }]}>
              <Input.Password placeholder="password" />
            </Form.Item>
          </div>

          <Form.Item name="database" label="Database" rules={[{ required: true, message: 'Nhập tên database' }]}>
            <Input placeholder="quan_nhan_db" />
          </Form.Item>

          {result && (
            <Form.Item>
              <Alert
                type={result.success ? 'success' : 'error'}
                title={result.message}
                showIcon
                icon={result.success ? <CheckCircleOutlined /> : undefined}
              />
            </Form.Item>
          )}

          <Form.Item style={{ marginBottom: 0 }}>
            <Space size="middle">
              <Button onClick={handleTest} loading={testing} size="large"
                icon={testing ? <LoadingOutlined /> : <SafetyOutlined />}>
                Test kết nối
              </Button>
              <Button type="primary" onClick={handleConnect} loading={connecting} size="large"
                icon={<RocketOutlined />}>
                Kết nối & Khởi tạo Database
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      {/* ========== PHẦN 2: HƯỚNG DẪN ========== */}
      <Divider style={{ margin: '32px 0 16px 0' }} />

      <Title level={4} style={{ marginBottom: 16 }}>
        <InfoCircleOutlined /> Hướng dẫn cài đặt Database
      </Title>

      <Tabs
        activeKey={activeGuide}
        onChange={setActiveGuide}
        size="large"
        type="card"
        items={[
          {
            key: 'tidb',
            label: <span><CloudOutlined /> TiDB Cloud (Miễn phí)</span>,
            children: (
              <Card style={{ borderTop: 0, borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
                <Alert
                  type="success"
                  style={{ marginBottom: 20 }}
                  showIcon
                  title="Khuyến nghị cho hầu hết người dùng"
                  description="TiDB Cloud miễn phí 5GB, không cần cài đặt server, nhiều máy kết nối qua internet. Phù hợp khi các máy ở nhiều nơi khác nhau."
                />

                <Steps
                  orientation="vertical"
                  current={-1}
                  items={[
                    {
                      title: <Text strong style={{ fontSize: 16 }}>Tạo tài khoản TiDB Cloud</Text>,
                      content: (
                        <StepContent>
                          <ul style={{ paddingLeft: 20, margin: 0 }}>
                            <li>Truy cập <Text strong>tidbcloud.com</Text></li>
                            <li>Đăng ký bằng <Tag>Google</Tag> hoặc <Tag>GitHub</Tag> (nhanh nhất)</li>
                            <li>Xác nhận email nếu cần</li>
                          </ul>
                        </StepContent>
                      ),
                    },
                    {
                      title: <Text strong style={{ fontSize: 16 }}>Tạo Cluster miễn phí</Text>,
                      content: (
                        <StepContent>
                          <ul style={{ paddingLeft: 20, margin: 0 }}>
                            <li>Click <Tag color="blue">Create Cluster</Tag></li>
                            <li>Chọn <Text strong>Serverless</Text> (Free tier)</li>
                            <li>Region: chọn <Tag color="green">Singapore (ap-southeast-1)</Tag> - gần Việt Nam nhất</li>
                            <li>Cluster name: nhập <CopyText text="quan-nhan-db" /></li>
                            <li>Click <Tag color="blue">Create</Tag> → đợi 1-2 phút</li>
                          </ul>
                        </StepContent>
                      ),
                    },
                    {
                      title: <Text strong style={{ fontSize: 16 }}>Lấy thông tin kết nối</Text>,
                      content: (
                        <StepContent>
                          <ul style={{ paddingLeft: 20, margin: 0 }}>
                            <li>Vào cluster → click <Tag color="blue">Connect</Tag></li>
                            <li>Mục <Text strong>Connect With</Text>: chọn <Tag>General</Tag></li>
                            <li>Mục <Text strong>Connection Type</Text>: chọn <Tag>Public</Tag></li>
                            <li>Click <Tag color="orange">Generate Password</Tag> → <Text type="danger" strong>LƯU LẠI PASSWORD!</Text></li>
                            <li>
                              Bạn sẽ thấy thông tin:
                              <div style={{ background: '#f6f8fa', padding: 16, borderRadius: 8, marginTop: 8, fontFamily: 'monospace', fontSize: 13, lineHeight: 2 }}>
                                Host: <Text strong>gateway01.ap-southeast-1.prod.aws.tidbcloud.com</Text><br />
                                Port: <Text strong>4000</Text><br />
                                User: <Text strong>xxxxxxxxxxxx.root</Text><br />
                                Password: <Text strong>●●●●●●●●</Text><br />
                              </div>
                            </li>
                          </ul>
                        </StepContent>
                      ),
                    },
                    {
                      title: <Text strong style={{ fontSize: 16 }}>Tạo Database</Text>,
                      content: (
                        <StepContent>
                          <ul style={{ paddingLeft: 20, margin: 0 }}>
                            <li>Trong trang Connect, click tab <Tag>SQL Editor</Tag> (hoặc vào mục <Text strong>Chat2Query</Text>)</li>
                            <li>Chạy lệnh: <CopyText text="CREATE DATABASE quan_nhan;" /></li>
                            <li>Hoặc dùng database mặc định <CopyText text="test" /></li>
                          </ul>
                        </StepContent>
                      ),
                    },
                    {
                      title: <Text strong style={{ fontSize: 16 }}>Điền vào form phía trên</Text>,
                      content: (
                        <StepContent>
                          <ul style={{ paddingLeft: 20, margin: 0 }}>
                            <li>Copy thông tin Host, Port, User, Password vào form trên</li>
                            <li>Database: nhập <CopyText text="quan_nhan" /> hoặc <CopyText text="test" /></li>
                            <li>Bấm <Text strong>Test kết nối</Text> → sau đó <Text strong>Kết nối & Khởi tạo Database</Text></li>
                          </ul>
                          <Button
                            type="dashed"
                            style={{ marginTop: 12 }}
                            onClick={() => fillExample({ host: 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com', port: 4000, user: '', password: '', database: 'quan_nhan' })}
                          >
                            Điền mẫu TiDB Cloud
                          </Button>
                        </StepContent>
                      ),
                    },
                    {
                      title: <Text strong style={{ fontSize: 16 }}>Cài trên các máy khác</Text>,
                      content: (
                        <StepContent>
                          <Alert type="info" showIcon style={{ marginBottom: 8 }}
                            title="Tất cả các máy nhập CÙNG thông tin kết nối → dùng chung 1 database"
                          />
                          <ul style={{ paddingLeft: 20, margin: 0 }}>
                            <li>Cài app trên máy khác</li>
                            <li>Mở app → vào <Text strong>Cài đặt</Text></li>
                            <li>Nhập <Text type="danger" strong>ĐÚNG</Text> thông tin Host, Port, User, Password, Database như trên</li>
                            <li>Bấm <Text strong>Kết nối & Khởi tạo</Text> → xong!</li>
                            <li>Dữ liệu sẽ đồng bộ realtime giữa tất cả các máy</li>
                          </ul>
                        </StepContent>
                      ),
                    },
                  ]}
                />

                <Divider />
                <Collapse
                  ghost
                  items={[{
                    key: 'tidb-notes',
                    label: <Text strong>Lưu ý quan trọng về TiDB Cloud</Text>,
                    children: (
                      <ul style={{ paddingLeft: 20, lineHeight: 2.2, fontSize: 14 }}>
                        <li><Tag color="green">Free tier</Tag> 5GB storage, 50 triệu dòng - đủ dùng cho quản lý quân nhân</li>
                        <li><Tag color="blue">Tốc độ</Tag> Nhanh nhất khi chọn region Singapore</li>
                        <li><Tag color="orange">Bảo mật</Tag> Dữ liệu được mã hóa SSL khi truyền</li>
                        <li><Tag color="red">Quan trọng</Tag> Nếu cluster Serverless không hoạt động trong 30 ngày, TiDB sẽ tạm dừng (hibernate). Chỉ cần mở lại là chạy tiếp, không mất dữ liệu</li>
                        <li><Tag color="purple">Mạng</Tag> Cần có internet để kết nối. Nếu mất mạng, app sẽ không truy cập được dữ liệu</li>
                      </ul>
                    ),
                  }]}
                />
              </Card>
            ),
          },
          {
            key: 'mysql',
            label: <span><HddOutlined /> MySQL Server (Tự cài)</span>,
            children: (
              <Card style={{ borderTop: 0, borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
                <Alert
                  type="info"
                  style={{ marginBottom: 20 }}
                  showIcon
                  title="Phù hợp khi các máy cùng mạng LAN (cùng cơ quan, đơn vị)"
                  description="Cài MySQL trên 1 máy chủ, các máy khác cùng mạng LAN kết nối tới. Không cần internet, tốc độ nhanh hơn."
                />

                <Title level={5} style={{ marginTop: 0 }}>
                  <LaptopOutlined /> Trên máy chủ (máy làm server)
                </Title>

                <Steps
                  orientation="vertical"
                  current={-1}
                  items={[
                    {
                      title: <Text strong style={{ fontSize: 16 }}>Cài MySQL Server</Text>,
                      content: (
                        <StepContent>
                          <Paragraph>Tải MySQL Community Server:</Paragraph>
                          <ul style={{ paddingLeft: 20, margin: 0 }}>
                            <li>Truy cập <Text strong>dev.mysql.com/downloads/mysql/</Text></li>
                            <li>Chọn <Tag>Windows (x86, 64-bit), MSI Installer</Tag></li>
                            <li>Tải về và cài đặt, chọn <Tag color="blue">Developer Default</Tag> hoặc <Tag color="blue">Server Only</Tag></li>
                            <li>Trong quá trình cài, đặt <Text type="danger" strong>root password</Text> → LƯU LẠI!</li>
                          </ul>
                        </StepContent>
                      ),
                    },
                    {
                      title: <Text strong style={{ fontSize: 16 }}>Tạo Database</Text>,
                      content: (
                        <StepContent>
                          <Paragraph>Mở <Text strong>MySQL Command Line Client</Text> hoặc <Text strong>MySQL Workbench</Text>, đăng nhập bằng root:</Paragraph>
                          <div style={{ background: '#1e1e1e', color: '#d4d4d4', padding: 16, borderRadius: 8, fontFamily: 'monospace', fontSize: 13, lineHeight: 2 }}>
                            <div><span style={{ color: '#569cd6' }}>CREATE DATABASE</span> quan_nhan <span style={{ color: '#569cd6' }}>CHARACTER SET</span> utf8mb4;</div>
                          </div>
                        </StepContent>
                      ),
                    },
                    {
                      title: <Text strong style={{ fontSize: 16 }}>Tạo User cho app (khuyến nghị)</Text>,
                      content: (
                        <StepContent>
                          <Paragraph>Tạo user riêng thay vì dùng root:</Paragraph>
                          <div style={{ background: '#1e1e1e', color: '#d4d4d4', padding: 16, borderRadius: 8, fontFamily: 'monospace', fontSize: 13, lineHeight: 2 }}>
                            <div><span style={{ color: '#569cd6' }}>CREATE USER</span> <span style={{ color: '#ce9178' }}>'quannhan'</span>@<span style={{ color: '#ce9178' }}>'%'</span> <span style={{ color: '#569cd6' }}>IDENTIFIED BY</span> <span style={{ color: '#ce9178' }}>'MatKhauManh@123'</span>;</div>
                            <div><span style={{ color: '#569cd6' }}>GRANT ALL PRIVILEGES ON</span> quan_nhan.* <span style={{ color: '#569cd6' }}>TO</span> <span style={{ color: '#ce9178' }}>'quannhan'</span>@<span style={{ color: '#ce9178' }}>'%'</span>;</div>
                            <div><span style={{ color: '#569cd6' }}>FLUSH PRIVILEGES</span>;</div>
                          </div>
                          <Alert type="warning" showIcon style={{ marginTop: 12 }}
                            title={<span>Ký tự <CopyText text="'%'" /> cho phép kết nối từ mọi máy. Nếu muốn giới hạn chỉ mạng LAN, đổi thành <CopyText text="'192.168.1.%'" /></span>}
                          />
                        </StepContent>
                      ),
                    },
                    {
                      title: <Text strong style={{ fontSize: 16 }}>Mở Firewall cho port 3306</Text>,
                      content: (
                        <StepContent>
                          <Paragraph>Để các máy khác kết nối được, cần mở port MySQL:</Paragraph>
                          <div style={{ background: '#1e1e1e', color: '#d4d4d4', padding: 16, borderRadius: 8, fontFamily: 'monospace', fontSize: 13, lineHeight: 2 }}>
                            <div style={{ color: '#6a9955' }}>:: Chạy CMD với quyền Administrator</div>
                            <div>netsh advfirewall firewall add rule name=<span style={{ color: '#ce9178' }}>"MySQL"</span></div>
                            <div>  dir=in action=allow protocol=TCP localport=3306</div>
                          </div>
                          <Paragraph style={{ marginTop: 8 }}>Hoặc mở bằng giao diện:</Paragraph>
                          <ul style={{ paddingLeft: 20, margin: 0 }}>
                            <li>Mở <Text strong>Windows Defender Firewall</Text></li>
                            <li>Click <Text strong>Advanced Settings</Text> → <Text strong>Inbound Rules</Text></li>
                            <li>Click <Text strong>New Rule</Text> → <Tag>Port</Tag> → TCP → nhập <CopyText text="3306" /></li>
                            <li>Chọn <Tag color="green">Allow the connection</Tag> → Next → đặt tên "MySQL" → Finish</li>
                          </ul>
                        </StepContent>
                      ),
                    },
                    {
                      title: <Text strong style={{ fontSize: 16 }}>Xác định IP máy chủ</Text>,
                      content: (
                        <StepContent>
                          <Paragraph>Mở CMD trên máy chủ, chạy:</Paragraph>
                          <div style={{ background: '#1e1e1e', color: '#d4d4d4', padding: 16, borderRadius: 8, fontFamily: 'monospace', fontSize: 13, lineHeight: 2 }}>
                            <div>ipconfig</div>
                            <div style={{ color: '#6a9955' }}>:: Tìm dòng IPv4 Address, ví dụ: 192.168.1.100</div>
                          </div>
                          <Alert type="info" showIcon style={{ marginTop: 8 }}
                            title="Ghi lại địa chỉ IP này (ví dụ 192.168.1.100) để nhập vào các máy khác"
                          />
                        </StepContent>
                      ),
                    },
                    {
                      title: <Text strong style={{ fontSize: 16 }}>Điền form trên máy chủ</Text>,
                      content: (
                        <StepContent>
                          <div style={{ background: '#f6f8fa', padding: 16, borderRadius: 8, fontFamily: 'monospace', fontSize: 13, lineHeight: 2.2 }}>
                            Host: <Text strong>localhost</Text> (hoặc <Text strong>127.0.0.1</Text>)<br />
                            Port: <Text strong>3306</Text><br />
                            User: <Text strong>quannhan</Text> (hoặc root)<br />
                            Password: <Text strong>MatKhauManh@123</Text><br />
                            Database: <Text strong>quan_nhan</Text>
                          </div>
                          <Button type="dashed" style={{ marginTop: 12 }}
                            onClick={() => fillExample({ host: 'localhost', port: 3306, user: 'quannhan', password: '', database: 'quan_nhan' })}>
                            Điền mẫu MySQL (máy chủ)
                          </Button>
                        </StepContent>
                      ),
                    },
                  ]}
                />

                <Divider />

                <Title level={5}>
                  <GlobalOutlined /> Trên các máy khác (cùng mạng LAN)
                </Title>

                <Steps
                  orientation="vertical"
                  current={-1}
                  items={[
                    {
                      title: <Text strong style={{ fontSize: 16 }}>Kiểm tra cùng mạng</Text>,
                      content: (
                        <StepContent>
                          <ul style={{ paddingLeft: 20, margin: 0 }}>
                            <li>Đảm bảo máy khách và máy chủ kết nối <Text strong>cùng mạng WiFi / LAN</Text></li>
                            <li>Thử ping máy chủ: mở CMD → <CopyText text="ping 192.168.1.100" /> (thay IP máy chủ)</li>
                          </ul>
                        </StepContent>
                      ),
                    },
                    {
                      title: <Text strong style={{ fontSize: 16 }}>Cài app & điền thông tin</Text>,
                      content: (
                        <StepContent>
                          <Paragraph>Cài app trên máy khác, mở lên, vào <Text strong>Cài đặt</Text> và điền:</Paragraph>
                          <div style={{ background: '#f6f8fa', padding: 16, borderRadius: 8, fontFamily: 'monospace', fontSize: 13, lineHeight: 2.2 }}>
                            Host: <Text strong type="danger">192.168.1.100</Text> (IP máy chủ, KHÔNG phải localhost)<br />
                            Port: <Text strong>3306</Text><br />
                            User: <Text strong>quannhan</Text><br />
                            Password: <Text strong>MatKhauManh@123</Text><br />
                            Database: <Text strong>quan_nhan</Text>
                          </div>
                          <Button type="dashed" style={{ marginTop: 12 }}
                            onClick={() => fillExample({ host: '192.168.1.100', port: 3306, user: 'quannhan', password: '', database: 'quan_nhan' })}>
                            Điền mẫu MySQL (máy khách)
                          </Button>
                        </StepContent>
                      ),
                    },
                    {
                      title: <Text strong style={{ fontSize: 16 }}>Kết nối & sử dụng</Text>,
                      content: (
                        <StepContent>
                          <ul style={{ paddingLeft: 20, margin: 0 }}>
                            <li>Bấm <Text strong>Test kết nối</Text> → nếu OK → bấm <Text strong>Kết nối & Khởi tạo</Text></li>
                            <li>Xong! Tất cả các máy dùng chung 1 database, dữ liệu đồng bộ ngay</li>
                          </ul>
                        </StepContent>
                      ),
                    },
                  ]}
                />

                <Divider />
                <Collapse
                  ghost
                  items={[{
                    key: 'mysql-notes',
                    label: <Text strong>Lưu ý quan trọng về MySQL</Text>,
                    children: (
                      <ul style={{ paddingLeft: 20, lineHeight: 2.2, fontSize: 14 }}>
                        <li><Tag color="blue">Mạng LAN</Tag> Tất cả máy phải cùng mạng WiFi/LAN. Nếu máy chủ tắt → các máy khác không truy cập được</li>
                        <li><Tag color="green">Tốc độ</Tag> Nhanh hơn TiDB Cloud vì kết nối trực tiếp trong mạng LAN</li>
                        <li><Tag color="orange">IP tĩnh</Tag> Nên đặt IP tĩnh cho máy chủ để các máy khác không phải đổi host khi IP thay đổi</li>
                        <li><Tag color="red">Backup</Tag> Nên backup database định kỳ. Dùng MySQL Workbench → Export hoặc lệnh: <CopyText text="mysqldump -u root -p quan_nhan > backup.sql" /></li>
                        <li><Tag color="purple">Khởi động cùng Windows</Tag> MySQL thường tự chạy khi bật máy. Kiểm tra trong <Text strong>Services</Text> → "MySQL80"</li>
                      </ul>
                    ),
                  }]}
                />
              </Card>
            ),
          },
        ]}
      />

      {/* ========== SO SÁNH ========== */}
      <Card style={{ marginTop: 24 }} title={<Text strong style={{ fontSize: 16 }}>So sánh TiDB Cloud vs MySQL tự cài</Text>}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: '#f0f5ff' }}>
              <th style={{ padding: '12px 16px', textAlign: 'left', borderBottom: '2px solid #d9d9d9' }}>Tiêu chí</th>
              <th style={{ padding: '12px 16px', textAlign: 'center', borderBottom: '2px solid #d9d9d9' }}><CloudOutlined /> TiDB Cloud</th>
              <th style={{ padding: '12px 16px', textAlign: 'center', borderBottom: '2px solid #d9d9d9' }}><HddOutlined /> MySQL tự cài</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['Chi phí', 'Miễn phí (5GB)', 'Miễn phí'],
              ['Cài đặt', 'Không cần cài, tạo online', 'Cần cài MySQL Server trên 1 máy'],
              ['Kết nối', 'Qua internet (mọi nơi)', 'Cùng mạng LAN (cùng chỗ)'],
              ['Tốc độ', 'Tốt (có thể chậm hơn LAN)', 'Rất nhanh (mạng nội bộ)'],
              ['Máy chủ tắt', 'Vẫn hoạt động (cloud)', 'Không truy cập được'],
              ['Backup', 'Tự động', 'Phải tự backup'],
              ['Phù hợp', 'Máy ở nhiều nơi khác nhau', 'Các máy cùng 1 đơn vị/phòng'],
            ].map(([label, tidb, mysql], i) => (
              <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={{ padding: '10px 16px', fontWeight: 500 }}>{label}</td>
                <td style={{ padding: '10px 16px', textAlign: 'center' }}>{tidb}</td>
                <td style={{ padding: '10px 16px', textAlign: 'center' }}>{mysql}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
};

export default SettingsPage;
