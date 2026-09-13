import { app, BrowserWindow, ipcMain, type Event } from 'electron';
import { createHash, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import { appendFile, readFile, rename, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const scrypt = promisify(scryptCallback);
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 5 * 60 * 1000;

interface Credentials { username: string; salt: string; passwordHash: string; failedAttempts: number; lockedUntil: number | null; }

let mainWindow: BrowserWindow | null = null;
let activeUsername: string | null = null;

const credentialsPath = () => path.join(app.getPath('userData'), 'vertex-credentials.json');
const auditPath = () => path.join(app.getPath('userData'), 'vertex-security-audit.jsonl');

const readCredentials = async (): Promise<Credentials | null> => {
  try { return JSON.parse(await readFile(credentialsPath(), 'utf8')) as Credentials; } catch { return null; }
};

const writeCredentials = async (credentials: Credentials) => {
  const target = credentialsPath();
  const temporary = `${target}.${randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(credentials), { encoding: 'utf8', mode: 0o600 });
  await rename(temporary, target);
};

const recordSecurityEvent = async (action: string, status: 'SUCCESS' | 'BLOCKED' | 'FAILED', details: string, username = activeUsername || 'UNAUTHENTICATED') => {
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

const derivePasswordHash = async (password: string, salt: string) =>
  (await scrypt(password, salt, 64) as Buffer).toString('hex');

const validUsername = (username: string) => /^[A-Za-z0-9._-]{3,50}$/.test(username);
const validPassword = (password: string, username: string) => {
  const blocked = ['password', '12345678', 'qwerty123', 'admin123', 'letmein', username.toLowerCase()];
  return password.length >= 12 && password.length <= 128 && !blocked.includes(password.toLowerCase());
};

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600, height: 1000, minWidth: 1200, minHeight: 800,
    backgroundColor: '#070b12', title: 'VERTEX — Sovereign On-Premise Agentic AI Workbench', autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, webSecurity: true },
  });

  mainWindow.on('minimize', (event: Event) => {
    if (!activeUsername) return;
    event.preventDefault();
    void recordSecurityEvent('WINDOW_MINIMIZE_ATTEMPT', 'BLOCKED', 'Minimize blocked while an authenticated session is active.');
  });
  mainWindow.on('close', (event: Event) => {
    if (!activeUsername) return;
    event.preventDefault();
    void recordSecurityEvent('WINDOW_CLOSE_ATTEMPT', 'BLOCKED', 'Close blocked while an authenticated session is active.');
  });

  if (process.env.VITE_DEV_SERVER_URL) mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  else mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    void recordSecurityEvent('RENDERER_LOAD_FAILURE', 'FAILED', `Renderer load failed (${errorCode}): ${errorDescription}.`);
  });
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    void recordSecurityEvent('RENDERER_PROCESS_FAILURE', 'FAILED', `Renderer process exited: ${details.reason}.`);
  });
  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

ipcMain.handle('get-airgap-status', async () => ({ isAirGapped: true, externalCalls24h: 0, sovereignMode: 'ACTIVE' }));
ipcMain.handle('auth:status', async () => {
  const credentials = await readCredentials();
  return { authenticated: Boolean(activeUsername), username: activeUsername, needsSetup: !credentials };
});
ipcMain.handle('auth:setup', async (_event, payload: { username?: string; password?: string }) => {
  const username = String(payload?.username || '').trim();
  const password = String(payload?.password || '');
  if (await readCredentials()) return { ok: false, message: 'Initial access has already been configured.' };
  if (!validUsername(username) || !validPassword(password, username)) return { ok: false, message: 'Use a 3-50 character username and a unique password of 12-128 characters.' };
  const salt = randomUUID();
  await writeCredentials({ username, salt, passwordHash: await derivePasswordHash(password, salt), failedAttempts: 0, lockedUntil: null });
  await recordSecurityEvent('INITIAL_CREDENTIALS_CONFIGURED', 'SUCCESS', 'Initial local operator credentials were configured.', username);
  return { ok: true };
});
ipcMain.handle('auth:login', async (_event, payload: { username?: string; password?: string }) => {
  const username = String(payload?.username || '').trim();
  const password = String(payload?.password || '');
  const credentials = await readCredentials();
  const genericError = 'Invalid username or password.';
  if (!credentials) return { ok: false, message: 'Initial access has not been configured.' };
  if (credentials.lockedUntil && credentials.lockedUntil > Date.now()) {
    await recordSecurityEvent('LOGIN_BLOCKED', 'BLOCKED', 'Login rejected because the local account is temporarily locked.', username);
    return { ok: false, message: genericError };
  }
  const candidateHash = await derivePasswordHash(password, credentials.salt);
  const usernameMatches = timingSafeEqual(
    createHash('sha256').update(username).digest(),
    createHash('sha256').update(credentials.username).digest(),
  );
  const passwordMatches = timingSafeEqual(Buffer.from(candidateHash, 'hex'), Buffer.from(credentials.passwordHash, 'hex'));
  if (!usernameMatches || !passwordMatches) {
    credentials.failedAttempts += 1;
    if (credentials.failedAttempts >= MAX_FAILED_ATTEMPTS) credentials.lockedUntil = Date.now() + LOCKOUT_MS;
    await writeCredentials(credentials);
    await recordSecurityEvent('LOGIN_FAILURE', 'FAILED', `Rejected credential attempt ${credentials.failedAttempts} of ${MAX_FAILED_ATTEMPTS}.`, username);
    return { ok: false, message: genericError };
  }
  credentials.failedAttempts = 0; credentials.lockedUntil = null;
  await writeCredentials(credentials);
  activeUsername = credentials.username;
  await recordSecurityEvent('LOGIN_SUCCESS', 'SUCCESS', 'Authenticated desktop session established.', activeUsername);
  return { ok: true, username: activeUsername };
});
ipcMain.handle('auth:logout', async () => {
  if (activeUsername) await recordSecurityEvent('LOGOUT', 'SUCCESS', 'Authenticated desktop session ended by the user.');
  activeUsername = null;
  return { ok: true };
});
