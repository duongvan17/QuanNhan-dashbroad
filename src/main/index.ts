import { app, BrowserWindow, shell } from 'electron';
import path from 'path';
import { registerIpcHandlers } from './ipc';
import { getDbConfig } from './config';
import { connectDb, initTables, closeDb } from './database';
import { ensureUsersTable } from './auth';

let mainWindow: BrowserWindow | null = null;

const isDev = !app.isPackaged;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'Quản Lý Quân Nhân',
    icon: path.join(__dirname, '../../../public/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Open external links in browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  registerIpcHandlers();
  createWindow();

  // Auto-connect if config exists
  const config = getDbConfig();
  if (config.host && config.user) {
    try {
      await connectDb(config);
      await initTables();
      await ensureUsersTable();
      console.log('Auto-connected to database');
    } catch (err) {
      console.log('Auto-connect failed, user will need to configure manually');
    }
  }
});

app.on('window-all-closed', async () => {
  await closeDb();
  app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
