import { app, BrowserWindow, ipcMain } from 'electron';
import { spawn } from 'child_process';
import { randomUUID } from 'crypto';
import { appendFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow = null;
let activeUsername = null;
let activeRole = null;
let localBackend = null;

const backendUrl = 'http://127.0.0.1:8000/auth/status';
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const localBackendReady = async () => {
    try {
        const response = await fetch(backendUrl, { signal: AbortSignal.timeout(600) });
        return response.ok;
    } catch {
        return false;
    }
};

const ensureLocalBackend = async () => {
    if (await localBackendReady()) return;
    const packagedRoot = path.resolve(__dirname, '../../..');
    const projectRoot = existsSync(path.join(packagedRoot, '.venv', 'bin', 'python'))
        ? packagedRoot
        : path.resolve(__dirname, '../..');
    const python = path.join(projectRoot, '.venv', 'bin', 'python');
    localBackend = spawn(python, [
        '-m', 'uvicorn', 'tools.http_api:app', '--host', '127.0.0.1', '--port', '8000',
    ], {
        cwd: projectRoot,
        stdio: 'ignore',
    });
    // The sign-in screen must reflect the real database, not a transient
    // connection failure while the local-only service starts.
    for (let attempt = 0; attempt < 20; attempt += 1) {
        if (await localBackendReady()) return;
        await wait(250);
    }
};

const authHeaders = (contentType = false) => ({
    ...(contentType ? { 'Content-Type': 'application/json' } : {}),
    'X-User': activeUsername,
    'X-Role': activeRole,
});

const auditPath = () => path.join(app.getPath('userData'), 'vertex-security-audit.jsonl');

const recordSecurityEvent = async (action, status, details, username = activeUsername || 'UNAUTHENTICATED') => {
    const entry = {
        id: `sec-${randomUUID()}`,
        timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
        user: username,
        action,
        tool: 'SESSION SECURITY',
        details,
        status,
        ipAddress: 'LOCAL DESKTOP',
        severity: status === 'SUCCESS' ? 'INFO' : 'WARNING',
    };
    await appendFile(auditPath(), `${JSON.stringify(entry)}\n`, { encoding: 'utf8', mode: 0o600 });
    mainWindow?.webContents.send('security-audit', entry);
};

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1600, height: 1000, minWidth: 1200, minHeight: 800,
        backgroundColor: '#070b12', title: 'VERTEX â€” Sovereign On-Premise Agentic AI Workbench', autoHideMenuBar: true,
        webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, webSecurity: true },
    });
    mainWindow.on('minimize', (event) => {
        if (!activeUsername)
            return;
        event.preventDefault();
        void recordSecurityEvent('WINDOW_MINIMIZE_ATTEMPT', 'BLOCKED', 'Minimize blocked while an authenticated session is active.');
    });
    mainWindow.on('close', (event) => {
        if (!activeUsername)
            return;
        event.preventDefault();
        void recordSecurityEvent('WINDOW_CLOSE_ATTEMPT', 'BLOCKED', 'Close blocked while an authenticated session is active.');
    });
    if (process.env.VITE_DEV_SERVER_URL)
        mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    else
        mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));
    mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
        void recordSecurityEvent('RENDERER_LOAD_FAILURE', 'FAILED', `Renderer load failed (${errorCode}): ${errorDescription}.`);
    });
    mainWindow.webContents.on('render-process-gone', (_event, details) => {
        void recordSecurityEvent('RENDERER_PROCESS_FAILURE', 'FAILED', `Renderer process exited: ${details.reason}.`);
    });
    mainWindow.on('closed', () => { mainWindow = null; });
}
app.whenReady().then(async () => {
    await ensureLocalBackend();
    createWindow();
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0)
        createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin')
    app.quit(); });
ipcMain.handle('get-airgap-status', async () => ({ isAirGapped: true, externalCalls24h: 0, sovereignMode: 'ACTIVE' }));

ipcMain.handle('auth:status', async () => {
    try {
        const res = await fetch('http://127.0.0.1:8000/auth/status');
        const data = await res.json();
        if (activeUsername) {
            const current = await fetch('http://127.0.0.1:8000/auth/current', {
                headers: authHeaders()
            });
            if (current.ok) {
                const identity = await current.json();
                activeUsername = identity.username;
                activeRole = identity.role;
            }
        }
        return { authenticated: Boolean(activeUsername), username: activeUsername, role: activeRole, needsSetup: data.needsSetup };
    } catch {
        return { authenticated: false, username: null, needsSetup: true };
    }
});

ipcMain.handle('auth:setup', async (_event, payload) => {
    try {
        const res = await fetch('http://127.0.0.1:8000/auth/setup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: payload?.username, password: payload?.password })
        });
        const data = await res.json();
        if (data.ok) {
            await recordSecurityEvent('INITIAL_CREDENTIALS_CONFIGURED', 'SUCCESS', 'Initial local operator credentials were configured.', payload?.username);
        }
        return data;
    } catch (e) {
        return { ok: false, message: 'Backend unreachable.' };
    }
});

ipcMain.handle('auth:login', async (_event, payload) => {
    try {
        const res = await fetch('http://127.0.0.1:8000/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: payload?.username, password: payload?.password })
        });
        const data = await res.json();
        if (data.ok) {
            activeUsername = data.username;
            activeRole = data.role;
            await recordSecurityEvent('LOGIN_SUCCESS', 'SUCCESS', 'Authenticated desktop session established.', activeUsername);
        } else {
            await recordSecurityEvent('LOGIN_FAILURE', 'FAILED', data.message || 'Login failed.', payload?.username);
        }
        return data;
    } catch (e) {
        return { ok: false, message: 'Backend unreachable.' };
    }
});

// User management IPC
ipcMain.handle('users:list', async () => {
    if (!activeUsername)
        return { ok: false, message: 'Not authenticated.' };
    try {
        const res = await fetch('http://127.0.0.1:8000/users', {
            headers: authHeaders()
        });
        return await res.json();
    } catch {
        return { ok: false, message: 'Backend unreachable.' };
    }
});

ipcMain.handle('users:add', async (_event, payload) => {
    if (!activeUsername)
        return { ok: false, message: 'Not authenticated.' };
    try {
        const res = await fetch(`http://127.0.0.1:8000/users?role=${payload?.role || 'engineer'}`, {
            method: 'POST',
            headers: authHeaders(true),
            body: JSON.stringify({ username: payload?.username, password: payload?.password })
        });
        const data = await res.json();
        if (data.ok) await recordSecurityEvent('USER_CREATED', 'SUCCESS', `Admin created user: ${payload?.username}`);
        return data;
    } catch {
        return { ok: false, message: 'Backend unreachable.' };
    }
});

ipcMain.handle('users:delete', async (_event, payload) => {
    if (!activeUsername)
        return { ok: false, message: 'Not authenticated.' };
    try {
        const res = await fetch(`http://127.0.0.1:8000/users/${payload?.id}`, {
            method: 'DELETE',
            headers: authHeaders()
        });
        const data = await res.json();
        if (data.ok) await recordSecurityEvent('USER_DELETED', 'SUCCESS', `Admin deleted user ID: ${payload?.id}`);
        return data;
    } catch {
        return { ok: false, message: 'Backend unreachable.' };
    }
});

ipcMain.handle('users:setRole', async (_event, payload) => {
    if (!activeUsername)
        return { ok: false, message: 'Not authenticated.' };
    try {
        const res = await fetch(`http://127.0.0.1:8000/users/${payload?.id}/role`, {
            method: 'POST',
            headers: authHeaders(true),
            body: JSON.stringify({ role: payload?.role })
        });
        return await res.json();
    } catch {
        return { ok: false, message: 'Backend unreachable.' };
    }
});

ipcMain.handle('users:resetPassword', async (_event, payload) => {
    if (!activeUsername)
        return { ok: false, message: 'Not authenticated.' };
    try {
        const res = await fetch(`http://127.0.0.1:8000/users/${payload?.id}/reset`, {
            method: 'POST',
            headers: authHeaders(true),
            body: JSON.stringify({ password: payload?.newPassword })
        });
        const data = await res.json();
        if (data.ok) await recordSecurityEvent('USER_PASSWORD_RESET', 'SUCCESS', `Admin reset password for user ID: ${payload?.id}`);
        return data;
    } catch {
        return { ok: false, message: 'Backend unreachable.' };
    }
});

ipcMain.handle('users:login', async (_event, payload) => {
    try {
        const res = await fetch('http://127.0.0.1:8000/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: payload?.username, password: payload?.password })
        });
        const data = await res.json();
        if (data.ok) {
            activeUsername = data.username;
            activeRole = data.role;
        }
        return data;
    } catch (e) {
        return { ok: false, message: 'Backend unreachable.' };
    }
});

ipcMain.handle('workbench:locations', async () => {
    if (!activeUsername)
        return { ok: false, message: 'Not authenticated.' };
    try {
        const res = await fetch('http://127.0.0.1:8000/workspace/locations', {
            headers: authHeaders()
        });
        const data = await res.json();
        return res.ok ? { ok: true, ...data } : { ok: false, message: data.detail || 'Could not read workspace locations.' };
    } catch {
        return { ok: false, message: 'Backend unreachable.' };
    }
});

ipcMain.handle('auth:logout', async () => {
    if (activeUsername)
        await recordSecurityEvent('LOGOUT', 'SUCCESS', 'Authenticated desktop session ended by the user.');
    activeUsername = null;
    activeRole = null;
    return { ok: true };
});
