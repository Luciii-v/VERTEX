import React from 'react';
import { 
  LayoutDashboard, 
  Activity,
  Bot, 
  FileText, 
  BarChart, 
  ShieldCheck, 
  Settings, 
  ChevronLeft, 
  ChevronRight,
  Database,
  Folder,
  Brain,
  Terminal,
  Cpu,
  GitBranch,
  BarChart2,
  Layers,
  Power
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { ScreenRoute } from '../types';

export const Sidebar: React.FC = () => {
  const { 
    userRole,
    currentRoute, 
    setRoute, 
    isLeftSidebarOpen, 
    toggleLeftSidebar, 
    mcpTools, 
    toggleMcpTool 
  } = useStore();

  const navItems: { route: ScreenRoute; label: string; icon: any; shortcut: string }[] = [
    { route: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, shortcut: 'Ctrl+1' },
    { route: 'orchestrator', label: 'Orchestrator', icon: Activity, shortcut: 'Ctrl+O' },
    { route: 'agents', label: 'Agent Console', icon: Bot, shortcut: 'Ctrl+2' },
    ...((userRole && userRole.toLowerCase() === 'admin') ? [{ route: 'documents' as ScreenRoute, label: 'Documents', icon: FileText, shortcut: 'Ctrl+3' }] : []),
    { route: 'reports', label: 'Reports', icon: BarChart, shortcut: 'Ctrl+4' },
    { route: 'audit', label: 'Audit Trail', icon: ShieldCheck, shortcut: 'Ctrl+5' },
    { route: 'settings', label: 'Settings', icon: Settings, shortcut: 'Ctrl+6' },
  ];

  const getToolIcon = (iconName: string) => {
    switch (iconName) {
      case 'Folder': return Folder;
      case 'Database': return Database;
      case 'Brain': return Brain;
      case 'Terminal': return Terminal;
      case 'Cpu': return Cpu;
      case 'FileText': return FileText;
      case 'GitBranch': return GitBranch;
      case 'BarChart2': return BarChart2;
      default: return Layers;
    }
  };

  return (
    <aside
      className={`bg-base border-r border-border flex flex-col transition-all duration-300  select-none shrink-0 relative z-30 ${
        isLeftSidebarOpen ? 'w-64' : 'w-16'
      }`}
    >
      {/* Sidebar Collapse Toggle Button */}
      <button
        onClick={toggleLeftSidebar}
        className="absolute -right-3 top-5 bg-panel border border-border text-textPrimary hover:text-textPrimary rounded-full p-1 z-40 transition-all "
        title={isLeftSidebarOpen ? 'Collapse Navigation (Esc)' : 'Expand Navigation'}
      >
        {isLeftSidebarOpen ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
      </button>

      {/* Navigation Section */}
      <div className="p-3 space-y-1">
        <div className={`px-2 py-1 text-[10px] text-textSecondary uppercase tracking-widest font-mono ${!isLeftSidebarOpen && 'hidden'}`}>
          MAIN NAVIGATION
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentRoute === item.route;

          return (
            <button
              key={item.route}
              onClick={() => setRoute(item.route)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-mono transition-all group ${
                isActive
                  ? 'bg-textPrimary/15 border border-border text-textPrimary  font-bold'
                  : 'text-textSecondary hover:bg-panel hover:text-textPrimary border border-transparent'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-textPrimary' : 'text-textPrimary group-hover:scale-110'} transition-transform`} />
              {isLeftSidebarOpen && (
                <div className="flex items-center justify-between w-full">
                  <span>{item.label}</span>
                  <span className="text-[9px] text-textSecondary group-hover:text-textSecondary font-mono">{item.shortcut}</span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Divider */}
      <div className="my-2 border-t border-border mx-3" />

      {/* MCP Tools & Plugins Section */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 font-mono">
        {isLeftSidebarOpen ? (
          <>
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] text-textPrimary uppercase tracking-wider font-bold">
                ACTIVE MCP & PLUGINS
              </span>
              <span className="text-[9px] bg-textPrimary/10 text-textPrimary px-1.5 py-0.5 rounded border border-border">
                {mcpTools.filter(t => t.status === 'ONLINE' || t.status === 'ENABLED').length} / {mcpTools.length} ACTIVE
              </span>
            </div>

            <div className="space-y-1.5">
              {mcpTools.map((tool) => {
                const IconComponent = getToolIcon(tool.icon);
                const isOnline = tool.status === 'ONLINE' || tool.status === 'ENABLED';

                return (
                  <div
                    key={tool.id}
                    onClick={() => toggleMcpTool(tool.id)}
                    className={`p-2 rounded-lg border text-xs cursor-pointer transition-all flex items-center justify-between ${
                      isOnline
                        ? 'bg-panel border-border text-textPrimary hover:border-border'
                        : 'bg-base border-border text-textSecondary hover:border-border'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <IconComponent className={`w-3.5 h-3.5 shrink-0 ${isOnline ? 'text-textPrimary' : 'text-textSecondary'}`} />
                      <div className="truncate">
                        <span className="block text-[11px] truncate font-bold">{tool.name}</span>
                        <span className="text-[9px] text-textSecondary block truncate">{tool.description}</span>
                      </div>
                    </div>

                    <button
                      className={`p-1 rounded shrink-0 transition-colors ${
                        isOnline
                          ? 'text-textPrimary bg-textPrimary/10'
                          : 'text-textSecondary bg-base'
                      }`}
                      title={isOnline ? 'Deactivate Tool' : 'Activate Tool'}
                    >
                      <Power className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="space-y-2 flex flex-col items-center pt-2">
            {mcpTools.slice(0, 5).map((tool) => {
              const IconComponent = getToolIcon(tool.icon);
              const isOnline = tool.status === 'ONLINE' || tool.status === 'ENABLED';
              return (
                <div
                  key={tool.id}
                  onClick={() => toggleMcpTool(tool.id)}
                  className={`p-2 rounded border cursor-pointer ${
                    isOnline ? 'border-border text-textPrimary' : 'border-border text-textSecondary'
                  }`}
                  title={`${tool.name}: ${tool.status}`}
                >
                  <IconComponent className="w-4 h-4" />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer System Lock Status */}
      <div className="p-3 border-t border-border text-[10px] font-mono text-center text-textSecondary">
        {isLeftSidebarOpen ? (
          <div>
            <div>MRPL REFINERY NODE #01</div>
            <div className="text-textPrimary font-bold text-[9px] mt-0.5">AIR-GAP FIREWALL: ENGAGED</div>
          </div>
        ) : (
          <div className="text-textPrimary">●</div>
        )}
      </div>
    </aside>
  );
};
