import React from 'react';
import { Cpu, ShieldCheck, Activity, Search, Upload, FileCheck, ArrowRight, Clock, Sparkles, Zap } from 'lucide-react';
import { useStore } from '../store/useStore';
import { GlassPanel } from '../components/GlassPanel';
import { StatusBadge } from '../components/StatusBadge';

export const Dashboard: React.FC = () => {
  const { 
    metrics, setRoute, auditLogs, addToast, clearChat, 
    isLeftSidebarOpen, toggleLeftSidebar, 
    isRightSidebarOpen, toggleRightSidebar 
  } = useStore();

  const startNewInvestigation = () => {
    clearChat();
    if (isLeftSidebarOpen) toggleLeftSidebar(); // Collapse navigation
    if (!isRightSidebarOpen) toggleRightSidebar(); // Ensure Agent Config is visible
    setRoute('agents');
    addToast('FOCUS MODE', 'Clean workspace initialized for new investigation.', 'info');
  };

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-textPrimary uppercase tracking-widest">
              OPERATIONS DASHBOARD
            </h2>
            <StatusBadge statusText="SYSTEM ONLINE" />
          </div>
          <p className="text-xs text-textSecondary mt-1">
            MRPL Industrial Refinery Node #01 • Sovereign Intelligence Platform
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={startNewInvestigation}
            className="cli-button-special px-4 py-2 rounded font-bold text-xs flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4" /> NEW INVESTIGATION
          </button>
        </div>
      </div>

      {/* 3 Telemetry Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <GlassPanel className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-textPrimary uppercase tracking-wider font-bold flex items-center gap-2">
              <Cpu className="w-4 h-4" /> GPU TELEMETRY
            </span>
            <span className="text-[10px] bg-base text-textPrimary px-2 py-0.5 border border-border">
              HEALTHY
            </span>
          </div>

          <div>
            <div className="text-lg font-bold text-textPrimary tracking-wide">{metrics.gpuModel}</div>
            <div className="text-xs text-textSecondary mt-1 flex items-center gap-3">
              <span>VRAM: <strong className="text-textPrimary">{metrics.vramUsedGB} / {metrics.vramTotalGB} GB</strong></span>
              <span>TEMP: <strong className="text-textPrimary">{metrics.gpuTempCelsius}°C</strong></span>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-textSecondary">
              <span>Memory Utilization</span>
              <span>{Math.round((metrics.vramUsedGB / metrics.vramTotalGB) * 100)}%</span>
            </div>
            <div className="w-full h-2 bg-base border border-border">
              <div
                className="h-full bg-textPrimary"
                style={{ width: `${(metrics.vramUsedGB / metrics.vramTotalGB) * 100}%` }}
              />
            </div>
          </div>
        </GlassPanel>

        <GlassPanel className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-textPrimary uppercase tracking-wider font-bold flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" /> AIR-GAP STATUS
            </span>
            <span className="text-[10px] bg-base text-textPrimary px-2 py-0.5 border border-border">
              LOCKED
            </span>
          </div>

          <div>
            <div className="text-2xl font-bold text-textPrimary">
              0 EXTERNAL CALLS
            </div>
            <p className="text-xs text-textSecondary mt-1">
              Outbound sockets strictly filtered over past 24 hours.
            </p>
          </div>

          <div className="flex items-center justify-between text-[10px] pt-2 border-t border-border text-textSecondary">
            <span>SOCKET FILTER: ACTIVE</span>
            <span className="text-textPrimary font-bold">SOVEREIGN MODE</span>
          </div>
        </GlassPanel>

        <GlassPanel className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-textPrimary uppercase tracking-wider font-bold flex items-center gap-2">
              <Activity className="w-4 h-4" /> RECENT TASK
            </span>
            <span className="text-[10px] bg-base text-textPrimary px-2 py-0.5 border border-border">
              COMPLETED
            </span>
          </div>

          <div>
            <div className="text-base font-bold text-textPrimary truncate">
              {metrics.lastTaskName}
            </div>
            <p className="text-xs text-textSecondary mt-1">
              Status: <span className="text-textPrimary font-bold">{metrics.lastTaskStatus}</span>
            </p>
          </div>

          <div className="flex items-center justify-between text-[10px] pt-2 border-t border-border text-textSecondary">
            <span>{metrics.lastTaskTimestamp}</span>
            <button 
              onClick={() => setRoute('agents')} 
              className="text-textPrimary hover:underline flex items-center gap-1 font-bold"
            >
              View Log <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </GlassPanel>
      </div>

      {/* Prominent Quick Action Triggers */}
      <div className="space-y-3">
        <h3 className="text-xs text-textPrimary uppercase tracking-wider font-bold flex items-center gap-2">
          <Zap className="w-4 h-4" /> WORKFLOW TRIGGERS
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={startNewInvestigation}
            className="p-5 cli-button-special text-left group flex flex-col justify-between h-36 rounded-lg"
          >
            <div className="flex items-center justify-between relative z-10">
              <div className="group-hover:scale-110 transition-transform">
                <Search className="w-6 h-6" />
              </div>
              <ArrowRight className="w-5 h-5 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
            </div>
            <div className="relative z-10 mt-4">
              <h4 className="text-base font-bold">NEW INVESTIGATION</h4>
              <p className="text-xs opacity-80 mt-0.5 font-normal">Prompt AI agent with P&ID and telemetry context</p>
            </div>
          </button>

          <button
            onClick={() => setRoute('documents')}
            className="p-5 cli-panel hover:bg-base border border-border hover:border-textPrimary text-left transition-all group flex flex-col justify-between h-36 active:scale-[0.98]"
          >
            <div className="flex items-center justify-between">
              <div className="text-textPrimary group-hover:scale-110 transition-transform">
                <Upload className="w-6 h-6" />
              </div>
              <ArrowRight className="w-5 h-5 text-textPrimary opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
            </div>
            <div>
              <h4 className="text-base font-bold text-textPrimary">UPLOAD DOCUMENTS</h4>
              <p className="text-xs text-textSecondary mt-0.5">Ingest P&ID drawings, SOP manuals (PDF/DWG)</p>
            </div>
          </button>

          <button
            onClick={() => setRoute('reports')}
            className="p-5 cli-panel hover:bg-base border border-border hover:border-textPrimary text-left transition-all group flex flex-col justify-between h-36 active:scale-[0.98]"
          >
            <div className="flex items-center justify-between">
              <div className="text-textPrimary group-hover:scale-110 transition-transform">
                <FileCheck className="w-6 h-6" />
              </div>
              <ArrowRight className="w-5 h-5 text-textPrimary opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
            </div>
            <div>
              <h4 className="text-base font-bold text-textPrimary">GENERATE REPORT</h4>
              <p className="text-xs text-textSecondary mt-0.5">Compile PDF/Excel refinery diagnostic reports</p>
            </div>
          </button>
        </div>
      </div>

      {/* Recent Activity Feed */}
      <GlassPanel className="space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h3 className="text-xs font-bold text-textPrimary uppercase tracking-wider flex items-center gap-2">
            <Clock className="w-4 h-4" /> RECENT ACTIVITY
          </h3>
          <button onClick={() => setRoute('audit')} className="text-xs text-textPrimary hover:underline font-bold">
            View Audit Trail ➔
          </button>
        </div>

        <div className="space-y-2">
          {auditLogs.slice(0, 5).map((log) => (
            <div
              key={log.id}
              className="p-3 bg-base border border-border hover:border-textPrimary flex items-center justify-between text-xs transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-textPrimary animate-pulse" />
                <div>
                  <span className="text-textPrimary font-bold">{log.action}</span>
                  <span className="text-textSecondary ml-2">[{log.tool}]</span>
                  <p className="text-[11px] text-textSecondary mt-0.5">{log.details}</p>
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className="text-[10px] text-textSecondary block">{log.timestamp}</span>
                <span className="text-[9px] bg-panel text-textPrimary px-1.5 py-0.5 border border-border font-bold">
                  {log.user}
                </span>
              </div>
            </div>
          ))}
        </div>
      </GlassPanel>
    </div>
  );
};
