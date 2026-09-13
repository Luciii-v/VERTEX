import React, { useEffect, useState } from 'react';
import { useStore } from './store/useStore';
import { TopBar } from './components/TopBar';
import { Sidebar } from './components/Sidebar';
import { Toast } from './components/Toast';

// Screens
import { Dashboard } from './screens/Dashboard';
import { AgentConsole } from './screens/AgentConsole';
import { DocumentLibrary } from './screens/DocumentLibrary';
import { ReportGenerator } from './screens/ReportGenerator';
import { AuditLog } from './screens/AuditLog';
import { Settings } from './screens/Settings';
import { SplashScreen } from './components/SplashScreen';
import { LoginScreen } from './components/LoginScreen';

export const App: React.FC = () => {
  const [showSplash, setShowSplash] = useState(true);
  const [authState, setAuthState] = useState<{ loading: boolean; authenticated: boolean; needsSetup: boolean }>({ loading: true, authenticated: false, needsSetup: false });
  const [startupError, setStartupError] = useState<string | null>(null);
  const { 
    currentRoute, 
    setRoute, 
    settings, 
    isLeftSidebarOpen, 
    toggleLeftSidebar,
    messages,
    approveAction,
    denyAction,
    addToast,
    appendAuditLog
  } = useStore();

  useEffect(() => {
    if (!window.electronAPI) {
      setStartupError('The secure desktop bridge did not load. Reinstall the current Vertex build.');
      setAuthState({ loading: false, authenticated: false, needsSetup: false });
      return;
    }

    let unsubscribe: () => void = () => {};
    void window.electronAPI.getAuthStatus()
      .then((status) => {
        setAuthState({ loading: false, authenticated: status.authenticated, needsSetup: status.needsSetup });
        unsubscribe = window.electronAPI.onSecurityAudit((entry) => appendAuditLog(entry as Parameters<typeof appendAuditLog>[0]));
      })
      .catch(() => {
        setStartupError('Secure session service could not be started. Restart Vertex; if it persists, reinstall version 1.0.2.');
        setAuthState({ loading: false, authenticated: false, needsSetup: false });
      });
    return () => unsubscribe();
  }, [appendAuditLog]);

  const handleLogout = async () => {
    await window.electronAPI.logout();
    const status = await window.electronAPI.getAuthStatus();
    setAuthState({ loading: false, authenticated: false, needsSetup: status.needsSetup });
  };

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';

      if (e.ctrlKey && !e.shiftKey && !e.altKey) {
        switch (e.key) {
          case '1': e.preventDefault(); setRoute('dashboard'); break;
          case '2': e.preventDefault(); setRoute('agents'); break;
          case '3': e.preventDefault(); setRoute('documents'); break;
          case '4': e.preventDefault(); setRoute('reports'); break;
          case '5': e.preventDefault(); setRoute('audit'); break;
          case '6': e.preventDefault(); setRoute('settings'); break;
        }
      }
      if (e.key === 'Escape' && isLeftSidebarOpen) {
        toggleLeftSidebar();
      }
      
      if (!isInput && (approveAction || denyAction)) {
        if (e.key === 'y' || e.key === 'Y') {
          const pendingApproval = messages.find(m => m.approvalRequest?.status === 'PENDING');
          if (pendingApproval && approveAction) approveAction(pendingApproval.approvalRequest!.id);
        } else if (e.key === 'n' || e.key === 'N') {
          const pendingApproval = messages.find(m => m.approvalRequest?.status === 'PENDING');
          if (pendingApproval && denyAction) denyAction(pendingApproval.approvalRequest!.id);
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [setRoute, isLeftSidebarOpen, toggleLeftSidebar, messages, approveAction, denyAction]);

  if (authState.loading) {
    return <div className="app-background h-screen w-screen flex items-center justify-center text-textPrimary"><p className="rounded-lg border border-border bg-panel px-5 py-3 text-sm">Starting secure session service…</p></div>;
  }

  if (startupError) {
    return <main className="app-background min-h-screen w-screen flex items-center justify-center p-6 text-textPrimary"><section className="max-w-md rounded-xl border border-error/50 bg-panel p-7"><h1 className="text-xl font-bold">Vertex could not start securely</h1><p className="mt-3 text-sm text-textSecondary">{startupError}</p></section></main>;
  }

  if (!authState.authenticated) {
    return <LoginScreen needsSetup={authState.needsSetup} onAuthenticated={() => setAuthState({ loading: false, authenticated: true, needsSetup: false })} />;
  }

  return (
    <div className={`app-background h-screen w-screen flex flex-col overflow-hidden font-mono text-textPrimary transition-colors duration-300 ${settings.theme} ${settings.enableCrtOverlay ? 'crt-overlay' : ''}`}>
      {showSplash && <SplashScreen onComplete={() => setShowSplash(false)} />}
      
      {/* Top Header Bar */}
      <TopBar onLogout={handleLogout} />

      {/* Main Container */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Sidebar */}
        <Sidebar />

        {/* Dynamic Route Screen Content */}
        <main className="app-background flex-1 overflow-hidden relative">
          {currentRoute === 'dashboard' && <Dashboard />}
          {currentRoute === 'agents' && <AgentConsole />}
          {currentRoute === 'documents' && <DocumentLibrary />}
          {currentRoute === 'reports' && <ReportGenerator />}
          {currentRoute === 'audit' && <AuditLog />}
          {currentRoute === 'settings' && <Settings />}
        </main>
      </div>

      {/* Global Toast Notification System */}
      <Toast />
    </div>
  );
};

export default App;
