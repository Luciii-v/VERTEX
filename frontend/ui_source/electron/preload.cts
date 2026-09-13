import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  getAirGapStatus: () => ipcRenderer.invoke('get-airgap-status'),
  getAuthStatus: () => ipcRenderer.invoke('auth:status'),
  setInitialCredentials: (username: string, password: string) => ipcRenderer.invoke('auth:setup', { username, password }),
  login: (username: string, password: string) => ipcRenderer.invoke('auth:login', { username, password }),
  logout: () => ipcRenderer.invoke('auth:logout'),
  onSecurityAudit: (callback: (entry: unknown) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, entry: unknown) => callback(entry);
    ipcRenderer.on('security-audit', listener);
    return () => ipcRenderer.removeListener('security-audit', listener);
  },
});
