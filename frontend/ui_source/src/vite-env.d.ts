/// <reference types="vite/client" />

interface Window {
  electronAPI: {
    getAirGapStatus: () => Promise<unknown>;
    getAuthStatus: () => Promise<{ authenticated: boolean; username: string | null; needsSetup: boolean }>;
    setInitialCredentials: (username: string, password: string) => Promise<{ ok: boolean; message?: string }>;
    login: (username: string, password: string) => Promise<{ ok: boolean; message?: string; username?: string }>;
    logout: () => Promise<{ ok: boolean }>;
    demoLogin: (role: string) => Promise<{ ok: boolean; username: string; role: string }>;
    onSecurityAudit: (callback: (entry: unknown) => void) => () => void;
    
    // User Management
    usersList: () => Promise<{id: string; username: string; role: string; created_at: number; updated_at: number}[]>;
    usersAdd: (username: string, password: string, role: string) => Promise<{ ok: boolean; message?: string }>;
    usersDelete: (id: string) => Promise<{ ok: boolean; message?: string }>;
    usersSetRole: (id: string, role: string) => Promise<{ ok: boolean; message?: string }>;
    usersResetPassword: (id: string, newPassword: string) => Promise<{ ok: boolean; message?: string }>;
  };
}
