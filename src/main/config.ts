import Store from 'electron-store';
import type { DbConfig } from '../shared/types';

const store = new (Store as any)({
  // electron-store v11 (qua `conf`) không tự suy ra được projectName khi
  // main được biên dịch sang CommonJS → phải chỉ định tường minh.
  projectName: 'quan-ly-quan-nhan',
  defaults: {
    dbConfig: {
      host: '',
      port: 4000,
      user: '',
      password: '',
      database: '',
    },
  },
  encryptionKey: 'quan-nhan-app-2026',
}) as any;

export function getDbConfig(): DbConfig {
  return store.get('dbConfig');
}

export function setDbConfig(config: DbConfig): void {
  store.set('dbConfig', config);
}
