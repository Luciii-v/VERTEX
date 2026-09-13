import React from 'react';
import { LayoutDashboard, MessageSquare, User, ArrowRight, Activity } from 'lucide-react';
import { ScreenRoute } from '../types';

interface SelectWorkspaceProps {
  onSelect: (route: ScreenRoute) => void;
}

const workspaces = [
  {
    route: 'dashboard' as ScreenRoute,
    icon: LayoutDashboard,
    title: 'Dashboard',
    subtitle: 'OPERATIONAL OVERVIEW',
    description: 'System health, documents, reports, and MCP tool integrations.',
    accent: 'border-slate-400/40 hover:border-slate-400/80',
    iconBg: 'bg-slate-400/10 border-slate-400/30',
    iconColor: 'text-slate-300',
    badge: 'FULL ACCESS',
    badgeColor: 'text-slate-300 border-slate-400/40 bg-slate-400/10'
  },
  {
    route: 'agents' as ScreenRoute,
    icon: MessageSquare,
    title: 'Qwen Chat',
    subtitle: 'AGENT CONSOLE — QWEN3.5-9B',
    description: 'On-premise AI inference. Submit queries, attach documents, get autonomous analysis.',
    accent: 'border-cyan-400/40 hover:border-cyan-400/80',
    iconBg: 'bg-cyan-400/10 border-cyan-400/30',
    iconColor: 'text-cyan-300',
    badge: 'SOVEREIGN INFERENCE',
    badgeColor: 'text-cyan-300 border-cyan-400/40 bg-cyan-400/10'
  },
  {
    route: 'profile' as ScreenRoute,
    icon: User,
    title: 'Profile',
    subtitle: 'ACCOUNT & PREFERENCES',
    description: 'View your role, permissions, switch account, and toggle dark/light mode.',
    accent: 'border-violet-400/40 hover:border-violet-400/80',
    iconBg: 'bg-violet-400/10 border-violet-400/30',
    iconColor: 'text-violet-300',
    badge: 'USER SETTINGS',
    badgeColor: 'text-violet-300 border-violet-400/40 bg-violet-400/10'
  },
  {
    route: 'orchestrator' as ScreenRoute,
    icon: Activity,
    title: 'Orchestrator',
    subtitle: 'LONG-HORIZON AUTONOMY',
    description: 'Create multi-step tasks, monitor agent progress, and view checkpoints.',
    accent: 'border-emerald-400/40 hover:border-emerald-400/80',
    iconBg: 'bg-emerald-400/10 border-emerald-400/30',
    iconColor: 'text-emerald-300',
    badge: 'AUTONOMOUS',
    badgeColor: 'text-emerald-300 border-emerald-400/40 bg-emerald-400/10'
  }
];

export const SelectWorkspace: React.FC<SelectWorkspaceProps> = ({ onSelect }) => {
  return (
    <div className="app-background h-screen w-screen flex flex-col items-center justify-center p-8 text-textPrimary font-mono overflow-hidden">
      <div className="text-center mb-10 space-y-2">
        <p className="text-[10px] tracking-[0.35em] text-textSecondary uppercase">VERTEX — SOVEREIGN ON-PREMISE AGENTIC AI WORKBENCH</p>
        <h1 className="text-2xl font-bold tracking-[0.12em] uppercase">SELECT WORKSPACE</h1>
        <div className="w-24 h-[1px] bg-border mx-auto mt-3"></div>
      </div>
      
      <div className="grid grid-cols-3 gap-5 w-full max-w-4xl">
        {workspaces.map(({ route, icon: Icon, title, subtitle, description, accent, iconBg, iconColor, badge, badgeColor }) => (
          <button 
            key={route}
            onClick={() => onSelect(route)}
            className={`group relative flex flex-col text-left p-6 rounded-xl border bg-panel/80 transition-all duration-200 cursor-pointer hover:bg-panel hover:-translate-y-0.5 hover:shadow-xl ${accent}`}
          >
            <div className={`flex h-12 w-12 items-center justify-center rounded-lg border mb-5 ${iconBg}`}>
              <Icon className={`h-6 w-6 ${iconColor}`} />
            </div>
            
            <span className={`text-[9px] font-bold tracking-widest uppercase px-2 py-0.5 rounded border w-fit mb-3 whitespace-nowrap ${badgeColor}`}>
              {badge}
            </span>
            
            <h2 className="text-sm font-bold tracking-wider uppercase text-textPrimary mb-0.5 whitespace-nowrap">{title}</h2>
            <p className="text-[10px] text-textSecondary mb-3 tracking-wider">{subtitle}</p>
            <p className="text-[11px] text-textSecondary leading-relaxed flex-1">{description}</p>
            
            <div className="flex items-center gap-1.5 mt-5 text-[10px] text-textSecondary group-hover:text-textPrimary transition-colors">
              <span className="tracking-widest uppercase">OPEN</span>
              <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
            </div>
          </button>
        ))}
      </div>
      
      <p className="mt-10 text-[10px] text-textSecondary tracking-widest">AIR-GAP FIREWALL: ENGAGED &nbsp;&middot;&nbsp; LOCAL INFERENCE ONLY</p>
    </div>
  );
};
