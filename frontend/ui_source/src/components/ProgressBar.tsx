import React from 'react';

interface ProgressBarProps {
  progressPercent: number;
  subStep?: string;
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progressPercent,
  subStep,
  className = '',
}) => {
  const percent = Math.min(100, Math.max(0, progressPercent));

  return (
    <div className={`w-full space-y-1.5 font-mono ${className}`}>
      <div className="flex justify-between items-center text-xs">
        <span className="text-textPrimary flex items-center gap-2">
          <span className="inline-block w-1.5 h-1.5 bg-textPrimary animate-ping" />
          {subStep || 'Processing agent task...'}
        </span>
        <span className="text-textPrimary font-bold">{percent}%</span>
      </div>
      <div className="w-full h-2.5 bg-panel border border-border rounded overflow-hidden p-0.5 relative">
        <div
          className="h-full bg-gradient-to-r from-border  to-textPrimary rounded transition-all duration-300 relative"
          style={{ width: `${percent}%` }}
        >
          <div className="absolute inset-0 bg-base animate-pulse" />
        </div>
      </div>
    </div>
  );
};
