import React from 'react';
import { 
  FileText, 
  Download, 
  ShieldCheck, 
  Layers, 
  ChevronRight, 
  ChevronLeft,
  Eye,
  Key,
  Cpu,
  UploadCloud,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { DocumentItem } from '../types';

interface RightSidebarProps {
  onPreviewDocument?: (doc: DocumentItem) => void;
}

export const RightSidebar: React.FC<RightSidebarProps> = ({ onPreviewDocument }) => {
  const { 
    isRightSidebarOpen, 
    toggleRightSidebar, 
    documents, 
    addToast
  } = useStore();

  return (
    <aside
      className={`bg-base border-l border-border flex flex-col transition-all duration-300 select-none shrink-0 relative z-30 font-mono ${
        isRightSidebarOpen ? 'w-[320px]' : 'w-12'
      }`}
    >
      {/* Sidebar Collapse Toggle Button */}
      <button
        onClick={toggleRightSidebar}
        className="absolute -left-3 top-5 bg-panel border border-border text-textPrimary hover:text-textPrimary rounded-full p-1 z-40 transition-all"
        title={isRightSidebarOpen ? 'Collapse Agent Configuration' : 'Expand Agent Configuration'}
      >
        {isRightSidebarOpen ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
      </button>

      {!isRightSidebarOpen ? (
        <div className="flex flex-col items-center pt-6 gap-6 text-textSecondary text-xs">
          <Cpu className="w-4 h-4 text-textPrimary" />
          <Key className="w-4 h-4 text-textPrimary" />
          <UploadCloud className="w-4 h-4 text-textPrimary" />
          <ShieldCheck className="w-4 h-4 text-textPrimary" />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Header */}
          <div className="border-b border-border pb-3 flex items-center justify-between">
            <h3 className="text-xs font-bold text-textPrimary uppercase tracking-wider flex items-center gap-2">
              <Cpu className="w-4 h-4" /> AGENT CONFIGURATION
            </h3>
            <span className="text-[9px] bg-border/20 text-textPrimary px-2 py-0.5 rounded border border-border">
              SOVEREIGN
            </span>
          </div>

          {/* 1. MODEL & API CONFIGURATION */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-textSecondary uppercase tracking-wider flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5" /> LOCAL MODEL ENGINE
            </h4>
            
            <div className="space-y-2 text-xs">
              <div>
                <label className="text-[10px] text-textSecondary mb-1 block uppercase">Active LLM Instance</label>
                <select className="w-full bg-panel border border-border text-textPrimary p-2 focus:outline-none focus:border-textPrimary transition-colors appearance-none cursor-pointer">
                  <option>QWEN-3.5-9B (Local, Quantized)</option>
                  <option>Llama-3-8B-Instruct</option>
                  <option>Mistral-7B-v0.2</option>
                  <option>Vertex-Industrial-Base (Custom)</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] text-textSecondary mb-1 block uppercase">External API Key (Fallback)</label>
                <div className="flex gap-2">
                  <input 
                    type="password" 
                    placeholder="sk-..." 
                    className="flex-1 bg-panel border border-border text-textPrimary p-2 focus:outline-none focus:border-textPrimary placeholder:text-textSecondary/50"
                  />
                  <button className="cli-button px-3 border border-border flex items-center justify-center">
                    <CheckCircle className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 2. DOCUMENT UPLOAD / CONTEXT INGESTION */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-textSecondary uppercase tracking-wider flex items-center gap-1.5">
              <UploadCloud className="w-3.5 h-3.5" /> INGEST CONTEXT
            </h4>
            
            <button 
              onClick={() => addToast('UPLOAD TRIGGERED', 'Opening local file system dialog...', 'info')}
              className="w-full cli-button p-4 border border-dashed border-textSecondary hover:border-textPrimary flex flex-col items-center justify-center gap-2 group transition-all"
            >
              <UploadCloud className="w-6 h-6 text-textSecondary group-hover:text-textPrimary transition-colors" />
              <div className="text-center">
                <span className="block text-xs font-bold">UPLOAD PDF / P&ID / DWG</span>
                <span className="block text-[10px] text-textSecondary mt-0.5">Drag & drop or click to browse</span>
              </div>
            </button>
          </div>

          {/* 3. PERMIT BAR / CLEARANCE HIERARCHY */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-textSecondary uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" /> CLEARANCE HIERARCHY
            </h4>
            
            <div className="p-3 bg-panel border border-border space-y-3">
              <div className="flex justify-between items-center text-[10px] uppercase font-bold">
                <span className="text-textSecondary">Operator</span>
                <span className="text-textPrimary">Engineer</span>
                <span className="text-accent">Admin</span>
              </div>
              
              <div className="relative w-full h-2 bg-base border border-border rounded-full overflow-hidden">
                <div className="absolute top-0 left-0 h-full bg-textPrimary w-2/3" />
                <div className="absolute top-0 left-1/3 w-px h-full bg-base" />
                <div className="absolute top-0 left-2/3 w-px h-full bg-base" />
              </div>
              
              <div className="text-[10px] text-textSecondary leading-tight flex items-start gap-1.5">
                <AlertTriangle className="w-3 h-3 shrink-0 text-textPrimary" />
                <p>Current clearance: <span className="text-textPrimary font-bold">ENGINEER</span>. Agent will auto-halt on WRITE actions requiring ADMIN permit.</p>
              </div>
            </div>
          </div>

          {/* 4. RETRIEVED DOCUMENTS SUMMARY (Keeping essential parts) */}
          <div className="space-y-3 pt-2 border-t border-border">
            <h4 className="text-xs font-bold text-textSecondary uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" /> ACTIVE KNOWLEDGE BASE
            </h4>
            
            <div className="space-y-2">
              {documents.slice(0, 2).map((doc) => (
                <div key={doc.id} className="p-2 bg-panel border border-border flex items-start justify-between gap-2 text-xs">
                  <div className="min-w-0">
                    <span className="font-bold text-textPrimary text-[11px] block truncate">{doc.title}</span>
                    <span className="text-[9px] text-textSecondary block mt-0.5">{doc.fileName}</span>
                  </div>
                  <button onClick={() => onPreviewDocument && onPreviewDocument(doc)} className="p-1 hover:text-textPrimary text-textSecondary transition-colors" title="Preview Document">
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
          
        </div>
      )}
    </aside>
  );
};
