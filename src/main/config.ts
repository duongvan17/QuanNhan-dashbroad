import Store from 'electron-store';
import type { DbConfig } from '../shared/types';

const store = new (Store as any)({
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
