import React, { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Trash2, Sparkles, Bot, User, X, FileText, Eye, ShieldAlert } from 'lucide-react';
import { useStore } from '../store/useStore';
import { RightSidebar } from '../components/RightSidebar';
import { ToolCallCard } from '../components/ToolCallCard';
import { ApprovalPrompt } from '../components/ApprovalPrompt';
import { ProgressBar } from '../components/ProgressBar';
import { DocumentItem } from '../types';

export const AgentConsole: React.FC = () => {
  const { messages, sendMessage, approveAction, denyAction, clearChat, addToast } = useStore();
  const [inputPrompt, setInputPrompt] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [previewDoc, setPreviewDoc] = useState<DocumentItem | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  useEffect(() => scrollToBottom(), [messages]);

  const handleSend = () => {
    if (!inputPrompt.trim() && attachedFiles.length === 0) return;
    sendMessage(inputPrompt, attachedFiles);
    setInputPrompt('');
    setAttachedFiles([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); handleSend(); }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      setAttachedFiles((prev) => [...prev, ...filesArray]);
      addToast('FILE ATTACHED', `Added ${filesArray.length} file(s) for agent analysis.`, 'info');
    }
  };

  return (
    <div className="flex h-full w-full overflow-hidden">
      <div className="flex-1 flex flex-col h-full bg-base relative overflow-hidden border-r border-border">
        {/* Header */}
        <div className="h-12 border-b border-border bg-panel px-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-textPrimary">
            <Bot className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">
              AGENT CONSOLE — QWEN3.5-9B
            </span>
          </div>
          <button onClick={clearChat} className="p-1.5 text-textSecondary hover:text-error border border-transparent hover:border-error transition-all text-xs flex items-center gap-1">
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">CLEAR</span>
          </button>
        </div>

        {/* Chat History */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
              <div className="w-12 h-12 border border-border bg-panel flex items-center justify-center">
                <Bot className="w-6 h-6 text-textSecondary" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-textPrimary tracking-widest uppercase">VERTEX AGENT [QWEN-3.5-9B]</h3>
                <p className="text-[11px] text-textSecondary max-w-md mt-1">Awaiting input prompt or document attachment for analysis.</p>
              </div>
              <div className="flex flex-wrap justify-center gap-2 mt-4 max-w-2xl text-[10px]">
                {["Diagnose pump P-102A vibration spike", "Analyze Heat Exchanger E-101 thermal transfer rate", "Verify ESD valve proof test status", "Generate work order draft WO-8842"].map((promptText, i) => (
                  <button key={i} onClick={() => setInputPrompt(promptText)} className="cli-button px-3 py-1.5 rounded-full border border-border text-textSecondary hover:text-textPrimary transition-all">
                    {promptText}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg) => {
              const isUser = msg.sender === 'user';
              return (
                <div key={msg.id} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-2`}>
                  <div className="flex items-center gap-2 text-[10px] text-textSecondary">
                    {isUser ? (
                      <>
                        <span>{msg.timestamp}</span>
                        <span className="font-bold text-textPrimary">ENGINEER</span>
                        <User className="w-3.5 h-3.5 text-textPrimary" />
                      </>
                    ) : (
                      <>
                        <Bot className="w-3.5 h-3.5 text-textPrimary" />
                        <span className="font-bold text-textPrimary">VERTEX AGENT</span>
                        <span>{msg.timestamp}</span>
                      </>
                    )}
                  </div>
                  <div className={`max-w-3xl p-4 text-xs leading-relaxed border ${isUser ? 'bg-base border-textPrimary text-textPrimary' : 'bg-panel border-border text-textPrimary'}`}>
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                    {msg.isStreaming && msg.progressPercent !== undefined && (
                      <div className="mt-3 pt-3 border-t border-border">
                        <ProgressBar progressPercent={msg.progressPercent} subStep={msg.progressSubStep} />
                      </div>
                    )}
                    {msg.toolCalls && msg.toolCalls.length > 0 && (
                      <div className="mt-3 space-y-2 pt-2 border-t border-border">
                        {msg.toolCalls.map((tc) => <ToolCallCard key={tc.id} toolCall={tc} />)}
                      </div>
                    )}
                    {msg.approvalRequest && <ApprovalPrompt request={msg.approvalRequest} onApprove={approveAction} onDeny={denyAction} />}
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-4 bg-panel border-t border-border shrink-0">
          {attachedFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {attachedFiles.map((file, i) => (
                <span key={i} className="px-2.5 py-1 bg-base text-textPrimary border border-border text-xs flex items-center gap-1.5">
                  <FileText className="w-3 h-3" /> {file.name}
                  <button onClick={() => setAttachedFiles(prev => prev.filter((_, idx) => idx !== i))} className="hover:text-error ml-1">×</button>
                </span>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2 bg-base border border-border focus-within:border-textPrimary p-2 transition-all">
            <input type="file" ref={fileInputRef} onChange={handleFileChange} multiple className="hidden" />
            <button onClick={() => fileInputRef.current?.click()} className="p-2 text-textSecondary hover:text-textPrimary transition-colors shrink-0">
              <Paperclip className="w-5 h-5" />
            </button>
            <textarea value={inputPrompt} onChange={(e) => setInputPrompt(e.target.value)} onKeyDown={handleKeyDown} placeholder="Command Input... █" rows={2} className="w-full bg-transparent text-xs text-textPrimary placeholder-textSecondary focus:outline-none resize-none py-1" />
            <button onClick={handleSend} disabled={!inputPrompt.trim() && attachedFiles.length === 0} className="p-2.5 cli-button-primary disabled:opacity-30 shrink-0">
              <Send className="w-4 h-4" />
            </button>
          </div>
          <div className="flex justify-between items-center text-[10px] text-textSecondary mt-2 px-1">
            <span>Ctrl+Enter to send • Shift+Enter for line break</span>
            <span className="text-textPrimary">SOVEREIGN AIR-GAP INFERENCE</span>
          </div>
        </div>
      </div>

      <RightSidebar onPreviewDocument={(doc) => setPreviewDoc(doc)} />

      {previewDoc && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-6">
          <div className="max-w-2xl w-full bg-panel border border-border p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2 text-textPrimary"><FileText className="w-5 h-5" /> <h3 className="text-sm font-bold">{previewDoc.title}</h3></div>
              <button onClick={() => setPreviewDoc(null)} className="text-textSecondary hover:text-textPrimary"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-2 text-xs text-textPrimary">
              <div className="flex items-center justify-between text-[11px] text-textSecondary bg-base p-2 border border-border">
                <span>FILE: {previewDoc.fileName}</span><span>SIZE: {previewDoc.fileSize}</span><span className="text-textPrimary">{previewDoc.status}</span>
              </div>
              <div className="p-4 bg-base border border-border text-textPrimary leading-relaxed max-h-60 overflow-y-auto">
                <p className="font-bold mb-2">[EXTRACTED CONTENT]:</p>
                {previewDoc.contentPreview}
              </div>
            </div>
            <div className="flex justify-end pt-2"><button onClick={() => setPreviewDoc(null)} className="cli-button-primary px-4 py-2 text-xs">CLOSE PREVIEW</button></div>
          </div>
        </div>
      )}
    </div>
  );
};
