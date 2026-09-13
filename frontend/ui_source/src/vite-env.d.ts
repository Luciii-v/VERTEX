/// <reference types="vite/client" />

interface Window {
  electronAPI: {
    getAirGapStatus: () => Promise<unknown>;
    getAuthStatus: () => Promise<{ authenticated: boolean; username: string | null; needsSetup: boolean }>;
    setInitialCredentials: (username: string, password: string) => Promise<{ ok: boolean; message?: string }>;
    login: (username: string, password: string) => Promise<{ ok: boolean; message?: string; username?: string }>;
    logout: () => Promise<{ ok: boolean }>;
    onSecurityAudit: (callback: (entry: unknown) => void) => () => void;
  };
}
