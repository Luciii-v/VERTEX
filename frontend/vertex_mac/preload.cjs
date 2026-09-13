"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    getAirGapStatus: () => electron_1.ipcRenderer.invoke('get-airgap-status'),
    getAuthStatus: () => electron_1.ipcRenderer.invoke('auth:status'),
    setInitialCredentials: (username, password) => electron_1.ipcRenderer.invoke('auth:setup', { username, password }),
    login: (username, password) => electron_1.ipcRenderer.invoke('auth:login', { username, password }),
    logout: () => electron_1.ipcRenderer.invoke('auth:logout'),
    onSecurityAudit: (callback) => {
        const listener = (_event, entry) => callback(entry);
        electron_1.ipcRenderer.on('security-audit', listener);
        return () => electron_1.ipcRenderer.removeListener('security-audit', listener);
    },
    usersList: () => electron_1.ipcRenderer.invoke('users:list'),
    usersAdd: (username, password, role) => electron_1.ipcRenderer.invoke('users:add', { username, password, role }),
    usersDelete: (id) => electron_1.ipcRenderer.invoke('users:delete', { id }),
    usersSetRole: (id, role) => electron_1.ipcRenderer.invoke('users:setRole', { id, role }),
    usersResetPassword: (id, newPassword) => electron_1.ipcRenderer.invoke('users:resetPassword', { id, newPassword }),
    usersLogin: (username, password) => electron_1.ipcRenderer.invoke('users:login', { username, password }),
    getWorkspaceLocations: () => electron_1.ipcRenderer.invoke('workbench:locations'),
});
