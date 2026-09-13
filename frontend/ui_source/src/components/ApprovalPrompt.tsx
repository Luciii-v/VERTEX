import React, { useState } from 'react';
import { AlertTriangle, CheckCircle, XCircle, Eye, ShieldAlert } from 'lucide-react';
import { ApprovalRequest } from '../types';

interface ApprovalPromptProps {
  request: ApprovalRequest;
  onApprove: (id: string) => void;
  onDeny: (id: string) => void;
}

export const ApprovalPrompt: React.FC<ApprovalPromptProps> = ({
  request,
  onApprove,
  onDeny,
}) => {
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  if (request.status === 'APPROVED') {
    return (
      <div className="w-full my-3 p-3 bg-textPrimary/10 border border-border rounded-lg flex items-center justify-between text-xs text-textPrimary">
        <div className="flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-textPrimary" />
          <span className="font-bold">ACTION AUTHORIZED & EXECUTED:</span>
          <span>{request.action}</span>
        </div>
        <span className="text-textPrimary/70 text-[10px]">APPROVED AT {request.timestamp}</span>
      </div>
    );
  }

  if (request.status === 'DENIED') {
    return (
      <div className="w-full my-3 p-3 bg-error/10 border border-border rounded-lg flex items-center justify-between text-xs text-error">
        <div className="flex items-center gap-2">
          <XCircle className="w-4 h-4 text-error" />
          <span className="font-bold">ACTION REJECTED BY ENGINEER:</span>
          <span>{request.action}</span>
        </div>
        <span className="text-error/70 text-[10px]">DENIED AT {request.timestamp}</span>
      </div>
    );
  }

  return (
    <>
      <div className="w-full my-4 p-4 bg-panel border-2 border-border rounded-xl   relative overflow-hidden animate-pulse-fast">
        <div className="absolute top-0 right-0 bg-accent text-base text-[10px] font-bold px-3 py-0.5 rounded-bl tracking-widest uppercase flex items-center gap-1">
          <ShieldAlert className="w-3 h-3" /> SECURITY GATE ACTIVE
        </div>

        <div className="flex items-start gap-3">
          <div className="p-2 bg-accent/20 rounded-lg text-accent shrink-0 mt-1">
            <AlertTriangle className="w-6 h-6 animate-bounce" />
          </div>

          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-accent font-bold text-sm tracking-wider uppercase flex items-center gap-2">
                ⚠ HUMAN APPROVAL REQUIRED
              </h4>
              <span className="text-xs text-accent/70">Risk Level: <span className="font-bold text-accent">{request.riskLevel}</span></span>
            </div>

            <p className="text-sm font-semibold text-textSecondary bg-base p-2.5 rounded border border-border font-mono">
              Action: <span className="text-accent">{request.action}</span>
            </p>

            {request.includes && request.includes.length > 0 && (
              <div className="text-xs space-y-1">
                <span className="text-accent/80 uppercase tracking-wider text-[11px]">Includes Artifacts:</span>
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-1 text-textPrimary">
                  {request.includes.map((item, idx) => (
                    <li key={idx} className="flex items-center gap-1.5 bg-panel px-2 py-1 rounded border border-border">
                      <span className="text-accent">▪</span> {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-border mt-3">
              <span className="text-[11px] text-accent/60">
                Requested by: <span className="text-textSecondary">{request.requestedBy}</span> | Press <kbd className="bg-accent/20 text-accent px-1.5 py-0.5 rounded border border-border font-bold">Y</kbd> to Approve / <kbd className="bg-accent/20 text-accent px-1.5 py-0.5 rounded border border-border font-bold">N</kbd> to Deny
              </span>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setShowDetailsModal(true)}
                  className="px-3 py-1.5 text-xs text-textPrimary bg-textPrimary/10 hover:bg-textPrimary/20 border border-border rounded font-semibold transition-all flex items-center gap-1.5"
                >
                  <Eye className="w-3.5 h-3.5" /> DETAILS
                </button>

                <button
                  onClick={() => onDeny(request.id)}
                  className="px-3 py-1.5 text-xs text-error bg-error/10 hover:bg-error/20 border border-border rounded font-bold transition-all flex items-center gap-1.5"
                >
                  <XCircle className="w-3.5 h-3.5" /> [DENY]
                </button>

                <button
                  onClick={() => onApprove(request.id)}
                  className="px-4 py-1.5 text-xs text-base bg-accent hover:bg-accent/90 border border-border rounded font-bold transition-all  flex items-center gap-1.5"
                >
                  <CheckCircle className="w-3.5 h-3.5" /> [APPROVE]
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Details Modal */}
      {showDetailsModal && (
        <div className="fixed inset-0 z-50 bg-base  flex items-center justify-center p-4">
          <div className="max-w-lg w-full bg-panel border-2 border-border rounded-xl p-5 space-y-4 ">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-accent font-bold flex items-center gap-2 text-base">
                <ShieldAlert className="w-5 h-5" /> APPROVAL AUDIT MANIFEST
              </h3>
              <button onClick={() => setShowDetailsModal(false)} className="text-textSecondary hover:text-textPrimary">✕</button>
            </div>

            <div className="space-y-3 text-xs text-textSecondary font-mono">
              <p><strong className="text-textPrimary">Action ID:</strong> {request.id}</p>
              <p><strong className="text-textPrimary">Proposed Execution:</strong> {request.action}</p>
              <p><strong className="text-textPrimary">Originating Agent:</strong> {request.requestedBy}</p>
              <p><strong className="text-textPrimary">Security Clearance:</strong> Required (Write / Report Compilation)</p>
              <p><strong className="text-textPrimary">Air-Gap Compliance:</strong> 100% On-Premise Execution (No external network egress)</p>
              <div className="p-3 bg-base border border-border rounded">
                <span className="text-accent font-bold block mb-1">Attached Scope & Assets:</span>
                {request.includes.map((inc, i) => (
                  <div key={i} className="text-textPrimary">✓ {inc}</div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <button
                onClick={() => { onDeny(request.id); setShowDetailsModal(false); }}
                className="px-4 py-2 bg-error/20 text-error border border-border rounded font-bold hover:bg-error/30"
              >
                DENY ACTION
              </button>
              <button
                onClick={() => { onApprove(request.id); setShowDetailsModal(false); }}
                className="px-4 py-2 bg-accent text-base rounded font-bold hover:bg-accent/90 "
              >
                AUTHORIZE EXECUTION
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
