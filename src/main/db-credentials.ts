import type { DbConfig } from '../shared/types';

// ============================================================================
// CẢNH BÁO BẢO MẬT
// ----------------------------------------------------------------------------
// Credentials nằm tường minh trong source -> sẽ được đóng gói vào asar trong
// .exe; ai unpack đều đọc được. Đồng thời nằm trong git history.
// Tất cả khách dùng chung 1 cluster TiDB -> dữ liệu của các đơn vị KHÔNG cách
// ly nhau. Chấp nhận trade-off này theo yêu cầu: khách không muốn cấu hình DB.
// Nếu sau này muốn cách ly, đổi sang đăng nhập web/API thay vì hit DB trực tiếp.
// ============================================================================
export const DB_CONFIG: DbConfig = {
  host: 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com',
  port: 4000,
  user: 'PiV7j6KayxDaq1o.root',
  password: '8xgAWo6NRnQ2iW9H',
  database: 'test',
};
