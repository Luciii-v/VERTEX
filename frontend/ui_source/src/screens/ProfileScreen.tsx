import React from 'react';
import { User, Shield, Key, LogOut } from 'lucide-react';
import { useStore } from '../store/useStore';

interface ProfileScreenProps {
  onSwitchAccount: () => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ onSwitchAccount }) => {
  const { userName, userRole } = useStore();
  
  return (
    <div className="h-full w-full p-8 overflow-y-auto">
      <div className="max-w-2xl mx-auto space-y-8">
        <header className="flex items-center justify-between border-b border-border pb-6">
          <div>
            <h1 className="text-xl font-bold tracking-wider uppercase text-textPrimary flex items-center gap-3">
              <User className="w-6 h-6 text-violet-400" />
              User Profile
            </h1>
            <p className="mt-1 text-xs text-textSecondary uppercase tracking-widest">ACCOUNT & PREFERENCES</p>
          </div>
        </header>

        <section className="bg-panel rounded-xl border border-border p-6 space-y-6">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 rounded-full bg-violet-500/20 flex items-center justify-center border border-violet-500/30">
              <User className="w-10 h-10 text-violet-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold capitalize">{userName || 'Unknown User'}</h2>
              <div className="flex items-center gap-2 mt-2">
                <Shield className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-emerald-400 tracking-widest uppercase">Clearance: {userRole || 'NONE'}</span>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-border grid gap-4">
            <div className="flex justify-between items-center p-4 rounded-lg bg-base/50 border border-border">
              <div className="flex items-center gap-3">
                <Key className="w-5 h-5 text-textSecondary" />
                <div>
                  <p className="text-sm font-bold">Authentication</p>
                  <p className="text-xs text-textSecondary">Local Air-Gapped Verification</p>
                </div>
              </div>
              <span className="text-xs bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded border border-emerald-500/20 font-bold">ACTIVE</span>
            </div>
          </div>
          
          <div className="pt-6 flex justify-end">
             <button onClick={onSwitchAccount} className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-400 border border-red-500/20 rounded hover:bg-red-500/20 transition-colors">
               <LogOut className="w-4 h-4" />
               <span className="text-sm font-bold uppercase tracking-wider">Switch Account</span>
             </button>
          </div>
        </section>
      </div>
    </div>
  );
};
