import { contextBridge, ipcRenderer, webFrame } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args),
  setZoomLevel: (level: number) => webFrame.setZoomLevel(level),
});
