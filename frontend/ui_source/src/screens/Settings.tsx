import React, { useState } from 'react';
import { 
  Cpu, 
  MessageSquare, 
  FileText, 
  ShieldCheck, 
  Layers, 
  Info, 
  Save, 
  Plus, 
  Check, 
  ExternalLink,
  Sliders,
  Database
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { GlassPanel } from '../components/GlassPanel';
import { AppSettings } from '../types';

export const Settings: React.FC = () => {
  const { settings, updateSettings, mcpTools, toggleMcpTool, addToast } = useStore();

  const [activeTab, setActiveTab] = useState<number>(1);
  const [formData, setFormData] = useState<AppSettings>(settings);

  const handleSave = () => {
    updateSettings(formData);
  };

  const tabs = [
    { id: 1, label: 'Model & Performance', icon: Cpu },
    { id: 2, label: 'Chat Behavior', icon: MessageSquare },
    { id: 3, label: 'Document Panels', icon: FileText },
    { id: 4, label: 'Security & Access', icon: ShieldCheck },
    { id: 5, label: 'MCP & Tools', icon: Layers },
    { id: 6, label: 'About Vertex', icon: Info },
  ];

  return (
    <div className="p-6 space-y-6 font-mono overflow-y-auto h-full">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h2 className="text-2xl font-bold text-textPrimary  uppercase tracking-widest">
            WORKBENCH CONFIGURATION & PARAMETERS
          </h2>
          <p className="text-xs text-textPrimary/80 mt-1">
            Configure local QWEN3.5-9B model hyperparameters, agent prompts, document defaults, RBAC matrix, and MCP integrations.
          </p>
        </div>

        <button
          onClick={handleSave}
          className="px-5 py-2 bg-textPrimary text-base hover:bg-textPrimary/90 rounded-lg font-bold text-xs flex items-center gap-2  transition-all self-start md:self-auto"
        >
          <Save className="w-4 h-4" /> SAVE CHANGES
        </button>
      </div>

      {/* Tabs Bar */}
      <div className="flex items-center gap-2 border-b border-border overflow-x-auto pb-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 rounded-t-lg text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
                isActive
                  ? 'bg-textPrimary/15 text-textPrimary border-t-2 border-x border-border '
                  : 'text-textSecondary hover:text-textPrimary hover:bg-panel border-t-2 border-transparent'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-textPrimary' : 'text-textPrimary'}`} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      <div className="max-w-4xl">
        {/* TAB 1: MODEL & PERFORMANCE */}
        {activeTab === 1 && (
          <GlassPanel variant="cyan" className="space-y-6">
            <h3 className="text-sm font-bold text-textPrimary uppercase tracking-wider flex items-center gap-2">
              <Cpu className="w-4 h-4" /> LOCAL AGENT INFERENCE MODEL
            </h3>

            <div className="space-y-4 text-xs font-mono">
              <div className="p-4 bg-base border border-border rounded-lg flex items-center justify-between">
                <div>
                  <span className="text-textSecondary text-[10px] block">CURRENT ACTIVE MODEL:</span>
                  <span className="text-base font-bold text-textPrimary">{formData.currentModel}</span>
                  <span className="text-[10px] text-textPrimary block mt-0.5">Context Window: {formData.contextWindow}</span>
                </div>
                <button
                  type="button"
                  onClick={() => addToast('MODEL SELECTION', 'QWEN3.5-9B Q4_K_M is optimized for on-premise 16GB VRAM.', 'info')}
                  className="px-3 py-1.5 bg-textPrimary/20 text-textPrimary border border-border rounded font-bold hover:bg-textPrimary/30 text-xs"
                >
                  Change Model
                </button>
              </div>

              {/* VRAM Progress */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-textSecondary">
                  <span>VRAM Allocation (16 GB Total)</span>
                  <span className="text-textPrimary font-bold">6.8 / 16.0 GB Used</span>
                </div>
                <div className="w-full h-3 bg-base rounded overflow-hidden border border-border">
                  <div className="bg-gradient-to-r from-border to-textPrimary h-full" style={{ width: '42.5%' }} />
                </div>
              </div>

              {/* Temperature Slider */}
              <div className="space-y-2 pt-3 border-t border-border">
                <div className="flex justify-between items-center">
                  <label className="font-bold text-textPrimary">Temperature (Creativity / Precision):</label>
                  <span className="text-textPrimary font-bold">{formData.temperature}</span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="2.0"
                  step="0.05"
                  value={formData.temperature}
                  onChange={(e) => setFormData({ ...formData, temperature: parseFloat(e.target.value) })}
                  className="w-full accent-[#00d4ff]"
                />
                <div className="flex justify-between text-[10px] text-textSecondary">
                  <span>0.0 (Strict Technical)</span>
                  <span>1.0 (Balanced)</span>
                  <span>2.0 (Creative)</span>
                </div>
              </div>

              {/* Max Tokens Slider */}
              <div className="space-y-2 pt-3 border-t border-border">
                <div className="flex justify-between items-center">
                  <label className="font-bold text-textPrimary">Max Generation Tokens:</label>
                  <span className="text-textPrimary font-bold">{formData.maxTokens} tokens</span>
                </div>
                <input
                  type="range"
                  min="256"
                  max="8192"
                  step="256"
                  value={formData.maxTokens}
                  onChange={(e) => setFormData({ ...formData, maxTokens: parseInt(e.target.value) })}
                  className="w-full accent-[#00ff88]"
                />
              </div>
            </div>
          </GlassPanel>
        )}

        {/* TAB 2: CHAT BEHAVIOR */}
        {activeTab === 2 && (
          <GlassPanel variant="green" className="space-y-6">
            <h3 className="text-sm font-bold text-textPrimary uppercase tracking-wider flex items-center gap-2">
              <MessageSquare className="w-4 h-4" /> AGENT PROMPT & BEHAVIOR
            </h3>

            <div className="space-y-4 text-xs font-mono">
              <div>
                <label className="block font-bold text-textPrimary mb-1.5">System Prompt Instructions:</label>
                <textarea
                  value={formData.systemPrompt}
                  onChange={(e) => setFormData({ ...formData, systemPrompt: e.target.value })}
                  rows={5}
                  className="w-full bg-base border border-border rounded-lg p-3 text-textPrimary focus:outline-none leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-border">
                <div>
                  <label className="block font-bold text-textPrimary mb-1">Response Style:</label>
                  <select
                    value={formData.responseStyle}
                    onChange={(e: any) => setFormData({ ...formData, responseStyle: e.target.value })}
                    className="w-full bg-base border border-border rounded p-2 text-textPrimary focus:outline-none"
                  >
                    <option value="Concise">Concise (Bullet points)</option>
                    <option value="Detailed">Detailed (Full Context)</option>
                    <option value="Technical">Technical (Refinery Schematics & Code)</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer pt-4">
                    <input
                      type="checkbox"
                      checked={formData.autoApproveRead}
                      onChange={(e) => setFormData({ ...formData, autoApproveRead: e.target.checked })}
                      className="accent-[#00ff88]"
                    />
                    <span className="text-textPrimary">Auto-approve read-only MCP actions</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.requireApprovalWrite}
                      disabled
                      className="accent-[#ffaa00]"
                    />
                    <span className="text-accent font-bold">Require approval for write actions (Enforced)</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.showToolCalls}
                      onChange={(e) => setFormData({ ...formData, showToolCalls: e.target.checked })}
                      className="accent-[#00d4ff]"
                    />
                    <span className="text-textPrimary">Display tool execution cards in chat</span>
                  </label>
                </div>
              </div>
            </div>
          </GlassPanel>
        )}

        {/* TAB 3: DOCUMENT PANELS */}
        {activeTab === 3 && (
          <GlassPanel variant="magenta" className="space-y-6">
            <h3 className="text-sm font-bold text-textPrimary uppercase tracking-wider flex items-center gap-2">
              <FileText className="w-4 h-4" /> REPORT GENERATION PREFERENCES
            </h3>

            <div className="space-y-4 text-xs font-mono">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-textPrimary mb-1">Default Export Format:</label>
                  <select
                    value={formData.defaultExportFormat}
                    onChange={(e: any) => setFormData({ ...formData, defaultExportFormat: e.target.value })}
                    className="w-full bg-base border border-border rounded p-2 text-textPrimary focus:outline-none"
                  >
                    <option value="PDF">PDF Document (.pdf)</option>
                    <option value="Excel">Excel Sheet (.xlsx)</option>
                    <option value="Word">Word Doc (.docx)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-textPrimary mb-1">Report Template Standard:</label>
                  <input
                    type="text"
                    value={formData.reportTemplate}
                    onChange={(e) => setFormData({ ...formData, reportTemplate: e.target.value })}
                    className="w-full bg-base border border-border rounded p-2 text-textPrimary focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-2 pt-3 border-t border-border">
                <span className="font-bold text-textPrimary block mb-2">Sections to include in compiled reports:</span>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.includeExecutiveSummary}
                      onChange={(e) => setFormData({ ...formData, includeExecutiveSummary: e.target.checked })}
                      className="accent-[#ff00ff]"
                    />
                    <span className="text-textPrimary">Executive Summary</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.includeCharts}
                      onChange={(e) => setFormData({ ...formData, includeCharts: e.target.checked })}
                      className="accent-[#ff00ff]"
                    />
                    <span className="text-textPrimary">Vibration & FFT Spectrum Charts</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.includeDataTables}
                      onChange={(e) => setFormData({ ...formData, includeDataTables: e.target.checked })}
                      className="accent-[#ff00ff]"
                    />
                    <span className="text-textPrimary">Sensor Data Tables</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.includeReferences}
                      onChange={(e) => setFormData({ ...formData, includeReferences: e.target.checked })}
                      className="accent-[#ff00ff]"
                    />
                    <span className="text-textPrimary">P&ID Citations & SOP References</span>
                  </label>
                </div>
              </div>
            </div>
          </GlassPanel>
        )}

        {/* TAB 4: SECURITY & ACCESS */}
        {activeTab === 4 && (
          <GlassPanel variant="amber" className="space-y-6">
            <h3 className="text-sm font-bold text-accent uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" /> SOVEREIGN SECURITY & RBAC PERMISSIONS
            </h3>

            <div className="space-y-4 text-xs font-mono">
              <div className="p-3 bg-base border border-border rounded flex items-center justify-between">
                <div>
                  <span className="text-accent font-bold block">Air-Gap Protection Firewall</span>
                  <span className="text-textSecondary text-[10px]">Zero outbound HTTP/TCP socket calls permitted.</span>
                </div>
                <span className="text-xs bg-accent/20 text-accent px-2 py-1 rounded font-bold border border-border">
                  ENGAGED (LOCKED)
                </span>
              </div>

              {/* RBAC Roles Matrix Table */}
              <div className="space-y-2">
                <span className="font-bold text-textPrimary block">Role-Based Access Control (RBAC) Matrix:</span>
                <table className="w-full text-left bg-base border border-border rounded overflow-hidden">
                  <thead className="bg-panel text-accent text-[10px] uppercase">
                    <tr>
                      <th className="p-2">Role</th>
                      <th className="p-2">Execute Tools</th>
                      <th className="p-2">Approve Writes</th>
                      <th className="p-2">Export Data</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10 text-textSecondary">
                    {formData.rbacRoles.map((r, idx) => (
                      <tr key={idx}>
                        <td className="p-2 font-bold text-textPrimary">{r.role}</td>
                        <td className="p-2">{r.canExecuteTools ? '✓' : '✕'}</td>
                        <td className="p-2">{r.canApproveWrites ? '✓' : '✕'}</td>
                        <td className="p-2">{r.canExportData ? '✓' : '✕'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </GlassPanel>
        )}

        {/* TAB 5: MCP & TOOLS */}
        {activeTab === 5 && (
          <GlassPanel variant="cyan" className="space-y-6">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-sm font-bold text-textPrimary uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4" /> MODEL CONTEXT PROTOCOL (MCP) SERVERS
              </h3>
              <button
                type="button"
                onClick={() => addToast('MCP SERVER', 'Added custom MCP server endpoint: localhost:9090', 'success')}
                className="px-3 py-1 bg-textPrimary text-base rounded text-xs font-bold  flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add Custom MCP Server
              </button>
            </div>

            <div className="space-y-2 text-xs font-mono">
              {mcpTools.map((tool) => (
                <div
                  key={tool.id}
                  className="p-3 bg-base border border-border rounded flex items-center justify-between"
                >
                  <div>
                    <span className="font-bold text-textPrimary">{tool.name}</span>
                    <span className="text-textSecondary text-[10px] block">{tool.description}</span>
                  </div>
                  <button
                    onClick={() => toggleMcpTool(tool.id)}
                    className={`px-3 py-1 rounded text-xs font-bold border ${
                      tool.status === 'ONLINE' || tool.status === 'ENABLED'
                        ? 'bg-textPrimary/20 text-textPrimary border-border'
                        : 'bg-base text-textSecondary border-border'
                    }`}
                  >
                    {tool.status}
                  </button>
                </div>
              ))}
            </div>
          </GlassPanel>
        )}

        {/* TAB 6: ABOUT VERTEX */}
        {activeTab === 6 && (
          <GlassPanel variant="green" glow={true} className="space-y-6 text-xs font-mono">
            <div className="flex items-center gap-4 border-b border-border pb-4">
              <div className="w-14 h-14 bg-panel border-2 border-border rounded-xl flex items-center justify-center  text-textPrimary">
                <Cpu className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-textPrimary ">VERTEX WORKBENCH v1.0</h2>
                <p className="text-textSecondary">Sovereign • On-Premise • Agentic AI Workbench</p>
              </div>
            </div>

            <div className="space-y-3 text-textSecondary leading-relaxed">
              <p>
                Vertex is an enterprise-grade sovereign AI workbench developed for <strong>SIH 26117 (MRPL)</strong>. Designed to operate completely air-gapped on industrial refinery premises, Vertex integrates open-weight multimodal model inference with Model Context Protocol (MCP) tool bindings.
              </p>

              <div className="p-4 bg-base border border-border rounded space-y-2">
                <span className="text-textPrimary font-bold block">KEY CAPABILITIES:</span>
                <div>✓ Multi-modal P&ID vector schematic parsing</div>
                <div>✓ Autonomous vibration FFT spectrum diagnostic chart generation</div>
                <div>✓ Human-in-the-loop amber security approval gates for work orders</div>
                <div>✓ 100% On-premise air-gap network isolation</div>
              </div>
            </div>
          </GlassPanel>
        )}
      </div>
    </div>
  );
};
