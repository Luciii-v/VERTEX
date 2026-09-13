import React, { useState } from 'react';
import { 
  FileCheck, 
  Download, 
  Eye, 
  Send, 
  Plus, 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  X,
  FileSpreadsheet,
  FileCode,
  CheckCircle,
  Clock,
  Layers,
  Sparkles
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { ReportItem } from '../types';
import { GlassPanel } from '../components/GlassPanel';

export const ReportGenerator: React.FC = () => {
  const { reports, generateReport, addToast } = useStore();

  const [selectedReport, setSelectedReport] = useState<ReportItem | null>(reports[0] || null);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [targetTeam, setTargetTeam] = useState<'Maintenance' | 'Engineering' | 'Operations'>('Maintenance');

  // Generate modal form state
  const [newReportTitle, setNewReportTitle] = useState('');
  const [newReportType, setNewReportType] = useState<'PDF' | 'Excel' | 'Word'>('PDF');
  const [newReportDept, setNewReportDept] = useState<'Maintenance' | 'Engineering' | 'Operations'>('Maintenance');

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReportTitle.trim()) return;
    generateReport(newReportTitle, newReportType, newReportDept);
    setShowGenerateModal(false);
    setNewReportTitle('');
  };

  const handleSendToTeam = () => {
    if (!selectedReport) return;
    addToast(
      'REPORT DISPATCHED',
      `Sent "${selectedReport.title}" to ${targetTeam} Department via secure internal bus.`,
      'success'
    );
  };

  return (
    <div className="p-6 space-y-6 font-mono overflow-y-auto h-full">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h2 className="text-2xl font-bold text-textPrimary  uppercase tracking-widest">
            AUTOMATED REFINERY REPORT ENGINE
          </h2>
          <p className="text-xs text-textPrimary/80 mt-1">
            Autonomous multi-page PDF, Excel, and Word diagnostic reports compiled from telemetry, P&IDs, and SOPs.
          </p>
        </div>

        <button
          onClick={() => setShowGenerateModal(true)}
          className="px-4 py-2 bg-textPrimary text-base hover:bg-textPrimary/90 rounded-lg font-bold text-xs flex items-center gap-2  transition-all"
        >
          <Sparkles className="w-4 h-4" /> GENERATE NEW REPORT (Ctrl+G)
        </button>
      </div>

      {/* Main Content Layout (Table + Preview Card) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Report List Table */}
        <div className="lg:col-span-2 space-y-4">
          <GlassPanel variant="cyan" className="p-0 overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="text-xs font-bold text-textPrimary uppercase tracking-wider flex items-center gap-2">
                <FileCheck className="w-4 h-4" /> COMPILED REFINERY REPORTS ({reports.length})
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-base text-textPrimary uppercase border-b border-border text-[10px]">
                  <tr>
                    <th className="p-3">Title</th>
                    <th className="p-3">Type</th>
                    <th className="p-3">Dept</th>
                    <th className="p-3">Date</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10 text-textSecondary">
                  {reports.map((rep) => {
                    const isSelected = selectedReport?.id === rep.id;
                    return (
                      <tr
                        key={rep.id}
                        onClick={() => setSelectedReport(rep)}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-textPrimary/15 font-bold text-textPrimary'
                            : 'hover:bg-panel'
                        }`}
                      >
                        <td className="p-3">
                          <div className="font-bold text-textPrimary max-w-xs truncate">{rep.title}</div>
                          <span className="text-[9px] text-textSecondary">{rep.author}</span>
                        </td>
                        <td className="p-3">
                          <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                            rep.type === 'PDF' ? 'bg-error/20 text-error' :
                            rep.type === 'Excel' ? 'bg-textPrimary/20 text-textPrimary' :
                            'bg-textPrimary/20 text-textPrimary'
                          }`}>
                            {rep.type}
                          </span>
                        </td>
                        <td className="p-3 text-[11px] text-textSecondary">{rep.department}</td>
                        <td className="p-3 text-[11px] text-textSecondary">{rep.date}</td>
                        <td className="p-3">
                          <span className="text-[9px] bg-textPrimary/10 text-textPrimary px-1.5 py-0.5 rounded border border-border">
                            {rep.status}
                          </span>
                        </td>
                        <td className="p-3 text-right space-x-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedReport(rep);
                              setShowPdfModal(true);
                            }}
                            className="p-1.5 text-textPrimary hover:bg-textPrimary/20 rounded"
                            title="Open Full PDF Viewer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              addToast('EXPORT COMPLETE', `Saved ${rep.title} (${rep.type})`, 'success');
                            }}
                            className="p-1.5 text-textSecondary hover:text-textPrimary hover:bg-base rounded"
                            title="Download Report File"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </GlassPanel>
        </div>

        {/* Right 1 Column: Selected Report Preview & Dispatch Sidecard */}
        <div className="space-y-4">
          {selectedReport ? (
            <GlassPanel variant="magenta" glow={true} className="space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h4 className="text-xs font-bold text-textPrimary uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-4 h-4" /> REPORT PREVIEW & EXPORT
                </h4>
                <button
                  onClick={() => setShowPdfModal(true)}
                  className="text-[10px] text-textPrimary hover:underline flex items-center gap-1"
                >
                  Full Viewer <Maximize2 className="w-3 h-3" />
                </button>
              </div>

              <div className="space-y-2 text-xs">
                <h3 className="text-sm font-bold text-textPrimary">{selectedReport.title}</h3>
                <div className="flex items-center gap-2 text-[10px] text-textSecondary font-mono">
                  <span>Pages: <strong className="text-textPrimary">{selectedReport.pages}</strong></span>
                  <span>•</span>
                  <span>Size: <strong className="text-textPrimary">{selectedReport.fileSize}</strong></span>
                  <span>•</span>
                  <span>Author: <strong className="text-textPrimary">{selectedReport.author}</strong></span>
                </div>

                <p className="text-xs text-textSecondary bg-base p-3 rounded border border-border font-mono leading-relaxed">
                  <span className="text-textPrimary font-bold block mb-1">EXECUTIVE SUMMARY:</span>
                  {selectedReport.summary}
                </p>
              </div>

              {/* Multi-format Download Options */}
              <div className="space-y-2 pt-2 border-t border-border">
                <span className="text-[10px] text-textSecondary uppercase tracking-wider block">EXPORT FORMATS</span>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => addToast('PDF EXPORT', `Downloaded ${selectedReport.title}.pdf`, 'success')}
                    className="p-2 bg-error/10 hover:bg-error/20 border border-border rounded text-center text-xs text-error font-bold flex flex-col items-center gap-1"
                  >
                    <Download className="w-3.5 h-3.5" /> PDF
                  </button>
                  <button
                    onClick={() => addToast('EXCEL EXPORT', `Downloaded ${selectedReport.title}.xlsx`, 'success')}
                    className="p-2 bg-textPrimary/10 hover:bg-textPrimary/20 border border-border rounded text-center text-xs text-textPrimary font-bold flex flex-col items-center gap-1"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" /> EXCEL
                  </button>
                  <button
                    onClick={() => addToast('WORD EXPORT', `Downloaded ${selectedReport.title}.docx`, 'success')}
                    className="p-2 bg-textPrimary/10 hover:bg-textPrimary/20 border border-border rounded text-center text-xs text-textPrimary font-bold flex flex-col items-center gap-1"
                  >
                    <FileCode className="w-3.5 h-3.5" /> WORD
                  </button>
                </div>
              </div>

              {/* Dispatch to Team Dropdown */}
              <div className="space-y-2 pt-2 border-t border-border">
                <span className="text-[10px] text-textPrimary uppercase tracking-wider block">SEND TO REFINERY TEAM</span>
                <div className="flex gap-2">
                  <select
                    value={targetTeam}
                    onChange={(e: any) => setTargetTeam(e.target.value)}
                    className="flex-1 bg-base border border-border rounded px-2 py-1.5 text-xs text-textPrimary font-mono"
                  >
                    <option value="Maintenance">Maintenance Team</option>
                    <option value="Engineering">Engineering Team</option>
                    <option value="Operations">Operations Team</option>
                  </select>
                  <button
                    onClick={handleSendToTeam}
                    className="px-3 py-1.5 bg-textPrimary text-base rounded font-bold text-xs hover:bg-textPrimary/90 flex items-center gap-1 shrink-0 "
                  >
                    <Send className="w-3.5 h-3.5" /> SEND
                  </button>
                </div>
              </div>
            </GlassPanel>
          ) : (
            <div className="p-6 bg-panel border border-border rounded-lg text-center text-xs text-textSecondary">
              Select a report from the table to preview details and export.
            </div>
          )}
        </div>
      </div>

      {/* Embedded Full PDF Document Viewer Modal */}
      {showPdfModal && selectedReport && (
        <div className="fixed inset-0 z-50 bg-base  flex items-center justify-center p-6">
          <div className="max-w-4xl w-full h-[85vh] bg-panel border-2 border-border rounded-xl flex flex-col overflow-hidden ">
            {/* Modal Top Controls */}
            <div className="h-14 bg-base border-b border-border px-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-textPrimary" />
                <div>
                  <h3 className="text-sm font-bold text-textPrimary">{selectedReport.title}</h3>
                  <span className="text-[10px] text-textSecondary font-mono">Page 1 of {selectedReport.pages} • {selectedReport.fileSize}</span>
                </div>
              </div>

              {/* Zoom controls & Close */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 bg-panel p-1 rounded border border-border">
                  <button onClick={() => setZoomLevel(prev => Math.max(50, prev - 10))} className="p-1 text-textSecondary hover:text-textPrimary">
                    <ZoomOut className="w-4 h-4" />
                  </button>
                  <span className="text-xs text-textPrimary px-2 font-bold">{zoomLevel}%</span>
                  <button onClick={() => setZoomLevel(prev => Math.min(200, prev + 10))} className="p-1 text-textSecondary hover:text-textPrimary">
                    <ZoomIn className="w-4 h-4" />
                  </button>
                </div>

                <button
                  onClick={() => setShowPdfModal(false)}
                  className="p-1.5 text-textSecondary hover:text-textPrimary bg-base hover:bg-base rounded"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body: PDF Canvas & Thumbnails Side */}
            <div className="flex-1 flex overflow-hidden">
              {/* Left Sidebar: Page Thumbnails */}
              <div className="w-44 bg-base border-r border-border p-3 space-y-3 overflow-y-auto hidden sm:block shrink-0">
                <span className="text-[10px] text-textSecondary uppercase tracking-wider block font-bold">PAGES</span>
                {Array.from({ length: selectedReport.pages }).map((_, idx) => (
                  <div
                    key={idx}
                    className={`p-2 rounded border cursor-pointer text-center text-xs ${
                      idx === 0
                        ? 'border-border bg-textPrimary/10 text-textPrimary font-bold'
                        : 'border-border bg-panel text-textSecondary hover:text-textPrimary'
                    }`}
                  >
                    <div className="h-16 bg-base rounded border border-border mb-1 flex items-center justify-center text-[10px]">
                      PAGE {idx + 1}
                    </div>
                    Page {idx + 1}
                  </div>
                ))}
              </div>

              {/* Main Document Content Canvas */}
              <div className="flex-1 bg-base p-6 overflow-y-auto flex justify-center">
                <div
                  className="bg-panel border border-border rounded-lg p-8 shadow-2xl space-y-6 max-w-2xl w-full text-xs font-mono transition-all"
                  style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }}
                >
                  {/* Header of simulated PDF */}
                  <div className="border-b border-border pb-4 flex justify-between items-start">
                    <div>
                      <h1 className="text-base font-bold text-textPrimary">MANGALORE REFINERY & PETROCHEMICALS LTD</h1>
                      <h2 className="text-xs text-textPrimary">{selectedReport.title}</h2>
                    </div>
                    <span className="text-[10px] bg-textPrimary/20 text-textPrimary px-2 py-0.5 rounded border border-border">
                      SOVEREIGN COMPLIANT
                    </span>
                  </div>

                  <div className="space-y-3 text-textSecondary">
                    <p className="font-bold text-textPrimary">1.0 EXECUTIVE DIAGNOSIS SUMMARY</p>
                    <p className="leading-relaxed text-textSecondary">{selectedReport.summary}</p>
                  </div>

                  <div className="p-4 bg-base border border-border rounded space-y-2">
                    <span className="text-textPrimary font-bold block">2.0 TELEMETRY & SCHEMATIC HARMONICS</span>
                    <div className="h-20 bg-panel border border-dashed border-border rounded flex items-center justify-center text-textPrimary text-[11px]">
                      [EMBEDDED FFT GRAPH & SCHEMATIC CIRCUIT EXCERPT]
                    </div>
                  </div>

                  <div className="border-t border-border pt-4 text-[10px] text-textSecondary flex justify-between">
                    <span>Generated by VERTEX Sovereign AI Workbench</span>
                    <span>Refinery Node #01</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Generate Report Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 bg-base  flex items-center justify-center p-6">
          <form
            onSubmit={handleGenerate}
            className="max-w-md w-full bg-panel border-2 border-border rounded-xl p-5 space-y-4 "
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-sm font-bold text-textPrimary flex items-center gap-2">
                <Sparkles className="w-5 h-5" /> GENERATE REFINERY REPORT
              </h3>
              <button onClick={() => setShowGenerateModal(false)} type="button" className="text-textSecondary hover:text-textPrimary">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs font-mono">
              <div>
                <label className="block text-textSecondary mb-1">Report Title:</label>
                <input
                  type="text"
                  value={newReportTitle}
                  onChange={(e) => setNewReportTitle(e.target.value)}
                  placeholder="e.g. CDU-II Crude Column Inspection Synthesis"
                  required
                  className="w-full bg-base border border-border rounded p-2 text-textPrimary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-textSecondary mb-1">Export Format:</label>
                <select
                  value={newReportType}
                  onChange={(e: any) => setNewReportType(e.target.value)}
                  className="w-full bg-base border border-border rounded p-2 text-textPrimary focus:outline-none"
                >
                  <option value="PDF">PDF Document (.pdf)</option>
                  <option value="Excel">Excel Spreadsheet (.xlsx)</option>
                  <option value="Word">Word Document (.docx)</option>
                </select>
              </div>

              <div>
                <label className="block text-textSecondary mb-1">Target Department:</label>
                <select
                  value={newReportDept}
                  onChange={(e: any) => setNewReportDept(e.target.value)}
                  className="w-full bg-base border border-border rounded p-2 text-textPrimary focus:outline-none"
                >
                  <option value="Maintenance">Maintenance Department</option>
                  <option value="Engineering">Engineering Department</option>
                  <option value="Operations">Operations Department</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setShowGenerateModal(false)}
                className="px-4 py-2 bg-panel text-textSecondary rounded border border-border hover:text-textPrimary text-xs"
              >
                CANCEL
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-textPrimary text-base rounded font-bold hover:bg-textPrimary/90 text-xs "
              >
                COMPILE REPORT
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
