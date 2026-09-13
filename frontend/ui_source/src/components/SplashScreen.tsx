import React, { useEffect, useState } from 'react';

interface SplashScreenProps {
  onComplete: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete }) => {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // Start exit animation after 3 seconds
    const exitTimer = setTimeout(() => {
      setIsExiting(true);
    }, 3000);

    // Unmount component completely after exit animation completes (0.8s)
    const unmountTimer = setTimeout(() => {
      onComplete();
    }, 3800);

    return () => {
      clearTimeout(exitTimer);
      clearTimeout(unmountTimer);
    };
  }, [onComplete]);

  return (
    <div 
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-base text-textPrimary overflow-hidden font-mono ${isExiting ? 'animate-splash-exit' : ''}`}
    >
      {/* Dynamic Background Grid matching globals.css but animated */}
      <div 
        className="absolute inset-0 animate-splash-bg opacity-30 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(var(--color-border) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
          backgroundPosition: '-16px -16px'
        }}
      />

      {/* Center Content */}
      <div className="relative z-10 flex flex-col items-center w-full max-w-2xl px-4 text-center">
        {/* Main Title */}
        <h1 
          className="text-5xl md:text-7xl font-bold uppercase text-textPrimary animate-splash-text inline-block"
          style={{ letterSpacing: '0.5em', marginRight: '-0.5em' }}
        >
          VERTEX
        </h1>

        {/* Decorative Divider */}
        <div className="h-[1px] w-full max-w-md bg-textSecondary mt-6 mb-4 animate-splash-divider" style={{ transformOrigin: 'center' }} />

        {/* Tagline */}
        <div className="flex flex-col md:flex-row items-center justify-center gap-2 md:gap-4 text-xs md:text-sm text-textSecondary uppercase tracking-widest font-bold animate-splash-tagline w-full text-center">
          <span>SOVEREIGN</span>
          <span className="hidden md:inline w-1 h-1 bg-textSecondary rounded-full" />
          <span>ON-PREMISE</span>
          <span className="hidden md:inline w-1 h-1 bg-textSecondary rounded-full" />
          <span>AGENTIC AI WORKBENCH</span>
        </div>
      </div>
      
      {/* Loading Indicator at Bottom */}
      <div className="absolute bottom-12 left-0 right-0 flex flex-col items-center justify-center gap-2 animate-splash-tagline w-full" style={{ animationDelay: '1.8s' }}>
        <div className="text-[10px] text-textSecondary tracking-widest animate-pulse text-center w-full">
          INITIALIZING CORE SYSTEMS...
        </div>
        <div className="w-48 h-[2px] bg-border overflow-hidden mx-auto">
          <div className="h-full bg-accent animate-splash-loader" />
        </div>
      </div>
    </div>
  );
};
