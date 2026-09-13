import React from 'react';
import { ShieldCheck, AlertCircle, Info, X } from 'lucide-react';
import { useStore } from '../store/useStore';

export const Toast: React.FC = () => {
  const { toasts, removeToast } = useStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => {
        let borderColor = 'border-border bg-base text-textPrimary ';
        let Icon = ShieldCheck;

        if (toast.type === 'error') {
          borderColor = 'border-border bg-base text-error ';
          Icon = AlertCircle;
        } else if (toast.type === 'amber') {
          borderColor = 'border-border bg-base text-accent ';
          Icon = AlertCircle;
        } else if (toast.type === 'info') {
          borderColor = 'border-border bg-base text-textPrimary ';
          Icon = Info;
        }

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto p-3.5 rounded-lg border  font-mono flex items-start gap-3 transition-all duration-300 animate-slide-in ${borderColor}`}
          >
            <Icon className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h6 className="font-bold text-xs tracking-wider uppercase">{toast.title}</h6>
                <span className="text-[10px] opacity-60 ml-2">{toast.timestamp}</span>
              </div>
              <p className="text-xs text-textSecondary mt-1 leading-snug">{toast.message}</p>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="opacity-60 hover:opacity-100 transition-opacity p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
