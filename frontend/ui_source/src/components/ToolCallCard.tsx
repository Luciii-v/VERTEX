import React from 'react';
import { FileText, BarChart2, GitBranch, Database, CheckCircle2, Download } from 'lucide-react';
import { EmbeddedToolCall } from '../types';

interface ToolCallCardProps {
  toolCall: EmbeddedToolCall;
}

export const ToolCallCard: React.FC<ToolCallCardProps> = ({ toolCall }) => {
  let Icon = FileText;
  let accentColor = 'border-border bg-textPrimary/5 text-textPrimary';
  let badgeColor = 'bg-textPrimary/20 text-textPrimary';

  if (toolCall.type === 'chart_generation') {
    Icon = BarChart2;
    accentColor = 'border-border bg-textPrimary/5 text-textPrimary';
    badgeColor = 'bg-textPrimary/20 text-textPrimary';
  } else if (toolCall.type === 'pid_analysis') {
    Icon = GitBranch;
    accentColor = 'border-border bg-textPrimary/5 text-textPrimary';
    badgeColor = 'bg-textPrimary/20 text-textPrimary';
  } else if (toolCall.type === 'database_query') {
    Icon = Database;
    accentColor = 'border-border bg-accent/5 text-accent';
    badgeColor = 'bg-accent/20 text-accent';
  }

  return (
    <div className={`my-2 p-3 rounded-lg border  ${accentColor} transition-all duration-200 hover:border-border`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded bg-black/40 shrink-0">
            <Icon className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h5 className="text-xs font-bold font-mono tracking-wide">{toolCall.title}</h5>
              <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${badgeColor}`}>
                {toolCall.type.replace('_', ' ')}
              </span>
            </div>
            {toolCall.subtitle && (
              <p className="text-[11px] text-textSecondary font-mono mt-0.5">{toolCall.subtitle}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] text-textSecondary">{toolCall.timestamp}</span>
          <CheckCircle2 className="w-4 h-4 text-textPrimary" />
        </div>
      </div>

      {/* Embedded Chart Preview */}
      {toolCall.type === 'chart_generation' && (
        <div className="mt-3 p-3 bg-base border border-border rounded font-mono text-[11px]">
          <div className="flex justify-between text-textPrimary mb-1 font-bold">
            <span>FFT HARMONIC SPECTRUM — P-102A</span>
            <span>FREQ: 118 Hz</span>
          </div>
          {/* Simulated SVG Graph */}
          <div className="h-16 w-full flex items-end justify-between gap-1 pt-2 border-b border-border">
            {[20, 35, 28, 90, 45, 60, 30, 25, 80, 40, 15, 30, 50, 20].map((h, i) => (
              <div
                key={i}
                className="w-full bg-gradient-to-t from-border/30 to-textPrimary rounded-t hover:bg-textPrimary transition-all"
                style={{ height: `${h}%` }}
                title={`Harmonic ${i+1}: ${h} Hz`}
              />
            ))}
          </div>
          <div className="flex justify-between text-[9px] text-textSecondary mt-1">
            <span>0 Hz</span>
            <span>50 Hz</span>
            <span className="text-textPrimary font-bold">118 Hz (PEAK)</span>
            <span>200 Hz</span>
          </div>
        </div>
      )}

      {/* Embedded P&ID Schematic Circuit Preview */}
      {toolCall.type === 'pid_analysis' && (
        <div className="mt-3 p-3 bg-base border border-border rounded font-mono text-[11px] space-y-2">
          <div className="flex justify-between text-textPrimary font-bold">
            <span>P&ID HIGHLIGHT: DWG-CDU-0104</span>
            <span>LINE: 10-CDU-201-A1</span>
          </div>
          <div className="p-2 bg-panel border border-dashed border-border rounded text-center text-xs flex items-center justify-around">
            <span className="p-1 bg-textPrimary/10 text-textPrimary border border-border rounded">[Desalter D-101]</span>
            <span className="text-textPrimary">➔ ➔ ➔</span>
            <span className="p-1 bg-textPrimary/20 text-textPrimary border border-border rounded font-bold ">[Pump P-102A]</span>
            <span className="text-textPrimary">➔ ➔ ➔</span>
            <span className="p-1 bg-accent/10 text-accent border border-border rounded">[Exchanger E-101]</span>
          </div>
        </div>
      )}
    </div>
  );
};
