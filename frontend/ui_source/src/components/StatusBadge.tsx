import React from 'react';

interface StatusBadgeProps {
  statusText: string;
  variant?: 'green' | 'amber' | 'red' | 'cyan' | 'default';
  pulsing?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  statusText,
  variant = 'default',
  pulsing = true,
}) => {
  let colorClasses = 'bg-base text-textPrimary border-border';
  let dotColor = 'bg-textPrimary';

  if (variant === 'amber') {
    colorClasses = 'bg-base text-accent border-accent';
    dotColor = 'bg-accent';
  } else if (variant === 'red') {
    colorClasses = 'bg-base text-error border-error';
    dotColor = 'bg-error';
  }

  return (
    <span
      className={`inline-flex items-center gap-2 px-2 py-1 text-[10px] font-bold tracking-wider border rounded ${colorClasses}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${dotColor} ${
          pulsing ? 'animate-pulse' : ''
        }`}
      />
      {statusText}
    </span>
  );
};
