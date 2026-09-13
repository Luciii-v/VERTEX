import React from 'react';

interface GlassPanelProps {
  children: React.ReactNode;
  variant?: 'cyan' | 'amber' | 'green' | 'magenta' | 'red' | 'default';
  className?: string;
  glow?: boolean;
}

export const GlassPanel: React.FC<GlassPanelProps> = ({
  children,
  className = '',
}) => {
  return (
    <div
      className={`cli-panel p-4 transition-all duration-300 rounded-lg ${className}`}
    >
      {children}
    </div>
  );
};
