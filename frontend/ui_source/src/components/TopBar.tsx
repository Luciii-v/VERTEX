import React from 'react';
import { Cpu, ShieldCheck, UserCheck, Settings, LogOut, Sliders, Menu, Sun, Moon } from 'lucide-react';
import { useStore } from '../store/useStore';
import { StatusBadge } from './StatusBadge';

interface TopBarProps {
  onLogout: () => Promise<void>;
}

export const TopBar: React.FC<TopBarProps> = ({ onLogout }) => {
  const { 
    currentRoute, 
    setRoute, 
    userName, 
    userRole, 
    settings, 
    updateSettings,
    toggleLeftSidebar,
    toggleTheme,
    addToast
  } = useStore();

  const handleLogout = async () => {
    await onLogout();
    addToast('SESSION TERMINATED', 'Engineer session ended. Re-authentication required for L2 role.', 'info');
  };

  return (
    <header className="h-16 cli-panel border-x-0 border-t-0 px-4 flex items-center justify-between sticky top-0 z-40 select-none">
      {/* Left: Logo & Tagline */}
      <div className="flex items-center gap-3">
        <button 
          onClick={toggleLeftSidebar} 
          className="p-1.5 text-textSecondary hover:text-textPrimary rounded border border-border transition-all md:hidden"
          title="Toggle Navigation Sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setRoute('dashboard')}>
          <div className="w-10 h-10 rounded-lg border border-border bg-base flex items-center justify-center">
            <Cpu className="w-6 h-6 text-textPrimary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-widest text-textPrimary uppercase">
                VERTEX
              </h1>
              <span className="text-[10px] bg-border/30 text-textPrimary px-1.5 py-0.2 rounded border border-border">
                v1.0
              </span>
            </div>
            <p className="text-[10px] text-textSecondary tracking-wider uppercase">
              Sovereign • Agentic AI Workbench
            </p>
          </div>
        </div>
      </div>

      {/* Center: Air-Gap Status Badge */}
      <div className="hidden md:flex items-center gap-3">
        <StatusBadge
          statusText="SOVEREIGN MODE [AIR-GAPPED]"
          pulsing={true}
        />
        <span className="text-[11px] text-textSecondary border-l border-border pl-3">
          0 EXTERNAL CALLS (24H)
        </span>
      </div>

      {/* Right: User Profile & Actions */}
      <div className="flex items-center gap-3">
        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 cli-button rounded"
          title="Toggle Theme"
        >
          {settings.theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* CRT Scanline Toggle */}
        <button
          onClick={() => {
            updateSettings({ enableCrtOverlay: !settings.enableCrtOverlay });
          }}
          className={`p-2 rounded border transition-all text-xs flex items-center gap-1.5 ${
            settings.enableCrtOverlay
              ? 'bg-textPrimary text-base border-textPrimary'
              : 'cli-button'
          }`}
          title="Toggle CRT Scanline HUD Effect"
        >
          <Sliders className="w-4 h-4" />
          <span className="hidden lg:inline text-[11px]">CRT</span>
        </button>

        {/* User Role Card */}
        <div className="flex items-center gap-2 px-3 py-1.5 cli-panel rounded-lg text-xs">
          <UserCheck className="w-4 h-4 text-textPrimary" />
          <div>
            <span className="text-textPrimary font-bold block text-[11px] leading-tight">{userName}</span>
            <span className="text-textSecondary text-[9px] block leading-tight">ROLE: {userRole}</span>
          </div>
        </div>

        {/* Settings Trigger */}
        <button
          onClick={() => setRoute('settings')}
          className={`p-2 rounded border transition-all ${
            currentRoute === 'settings'
              ? 'bg-textPrimary border-textPrimary text-base'
              : 'cli-button'
          }`}
          title="System Settings (Ctrl+6)"
        >
          <Settings className="w-4 h-4" />
        </button>

        {/* Logout Trigger */}
        <button
          onClick={handleLogout}
          className="p-2 cli-button text-error hover:border-error hover:bg-error hover:text-textPrimary rounded transition-all"
          title="Lock & Exit Session"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
