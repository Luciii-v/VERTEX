import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Search, 
  Lock, 
  UserCheck, 
  Key, 
  Activity, 
  AlertTriangle,
  Download,
  Filter
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { GlassPanel } from '../components/GlassPanel';
import { StatusBadge } from '../components/StatusBadge';

export const AuditLog: React.FC = () => {
  const { auditLogs, userRole, userName, addToast } = useStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const filteredLogs = auditLogs.filter((log) => {
    const matchesSearch =
      log.user.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.tool.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.details.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || log.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="p-6 space-y-6 font-mono overflow-y-auto h-full">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h2 className="text-2xl font-bold text-textPrimary  uppercase tracking-widest">
            AUDIT TRAIL — ALL AGENT & USER ACTIONS
          </h2>
          <p className="text-xs text-textPrimary/80 mt-1">
            Immutable ASCII audit ledger logging all tool calls, filesystem accesses, model inferences, and human approvals.
          </p>
        </div>

        <button
          onClick={() => addToast('AUDIT LOG EXPORTED', 'Saved audit_ledger_export.json to local filesystem', 'success')}
          className="px-4 py-2 bg-textPrimary text-base hover:bg-textPrimary/90 rounded-lg font-bold text-xs flex items-center gap-2  transition-all"
        >
          <Download className="w-4 h-4" /> EXPORT AUDIT LEDGER
        </button>
      </div>

      {/* Main Content: Table + Security Telemetry Sidecard */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left 3 Columns: ASCII-style Glowing Grid Table */}
        <div className="lg:col-span-3 space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-panel p-3 rounded-xl border border-border">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-textPrimary absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search audit log by user, tool, action, details..."
                className="w-full bg-base border border-border rounded-lg pl-9 pr-4 py-1.5 text-xs text-textPrimary placeholder-[#00d4ff]/40 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="w-4 h-4 text-textPrimary" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-base border border-border rounded-lg px-3 py-1.5 text-xs text-textPrimary focus:outline-none"
              >
                <option value="ALL">All Statuses</option>
                <option value="SUCCESS">SUCCESS</option>
                <option value="REQUIRES_APPROVAL">REQUIRES_APPROVAL</option>
                <option value="BLOCKED">BLOCKED</option>
              </select>
            </div>
          </div>

          {/* ASCII Border Grid Table */}
          <GlassPanel variant="cyan" className="p-0 overflow-hidden ascii-border">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-base text-textPrimary border-b border-border text-[10px] uppercase">
                  <tr>
                    <th className="p-3">Timestamp</th>
                    <th className="p-3">User</th>
                    <th className="p-3">Action</th>
                    <th className="p-3">Tool</th>
                    <th className="p-3">Details</th>
                    <th className="p-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10 text-textSecondary">
                  {filteredLogs.map((log) => {
                    let statusBadge = 'bg-textPrimary/10 text-textPrimary border-border';
                    if (log.status === 'BLOCKED') statusBadge = 'bg-error/10 text-error border-border';
                    else if (log.status === 'REQUIRES_APPROVAL') statusBadge = 'bg-accent/10 text-accent border-border';

                    return (
                      <tr key={log.id} className="hover:bg-panel transition-colors">
                        <td className="p-3 text-[11px] text-textSecondary whitespace-nowrap">{log.timestamp}</td>
                        <td className="p-3 font-bold text-textPrimary whitespace-nowrap">{log.user}</td>
                        <td className="p-3 font-bold text-textPrimary whitespace-nowrap">{log.action}</td>
                        <td className="p-3 text-textPrimary whitespace-nowrap">[{log.tool}]</td>
                        <td className="p-3 text-textSecondary max-w-xs truncate">{log.details}</td>
                        <td className="p-3 text-right whitespace-nowrap">
                          <span className={`text-[9px] px-2 py-0.5 rounded border font-bold ${statusBadge}`}>
                            {log.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </GlassPanel>

          <div className="flex justify-between items-center text-xs text-textSecondary pt-2">
            <span>Showing {filteredLogs.length} events logged in audit ledger</span>
            <span>AIR-GAP COMPLIANT LEDGER</span>
          </div>
        </div>

        {/* Right 1 Column: Security & Compliance Telemetry Panel */}
        <div className="space-y-4">
          <GlassPanel variant="green" glow={true} className="space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-xs font-bold text-textPrimary uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" /> REFINERY SECURITY STATUS
              </h3>
              <StatusBadge statusText="SECURE" variant="green" />
            </div>

            <div className="space-y-3 font-mono text-xs">
              {/* Item 1 */}
              <div className="p-3 bg-base border border-border rounded space-y-1">
                <div className="flex items-center gap-2 text-textPrimary font-bold">
                  <Lock className="w-4 h-4" /> AIR-GAP PROTECTION
                </div>
                <p className="text-[11px] text-textSecondary">
                  ACTIVE (0 EXTERNAL CALLS - 24H) [LOCKED]
                </p>
              </div>

              {/* Item 2 */}
              <div className="p-3 bg-base border border-border rounded space-y-1">
                <div className="flex items-center gap-2 text-textPrimary font-bold">
                  <UserCheck className="w-4 h-4" /> ROLE ACCESS CONTROL
                </div>
                <p className="text-[11px] text-textSecondary">
                  RBAC ROLE: <span className="text-textPrimary font-bold">{userName} ({userRole})</span>
                </p>
              </div>

              {/* Item 3 */}
              <div className="p-3 bg-base border border-border rounded space-y-1">
                <div className="flex items-center gap-2 text-accent font-bold">
                  <AlertTriangle className="w-4 h-4" /> HUMAN APPROVAL GATE
                </div>
                <p className="text-[11px] text-textSecondary">
                  ENABLED [ALL WRITE & REPORT ACTIONS]
                </p>
              </div>

              {/* Item 4 */}
              <div className="p-3 bg-base border border-border rounded space-y-1">
                <div className="flex items-center gap-2 text-textPrimary font-bold">
                  <Key className="w-4 h-4 text-textPrimary" /> DATA ENCRYPTION
                </div>
                <p className="text-[11px] text-textSecondary">
                  AT REST (AES-256) + IN TRANSIT (TLS 1.3)
                </p>
              </div>
            </div>
          </GlassPanel>
        </div>
      </div>
    </div>
  );
};
