import React, { FormEvent, useState } from 'react';
import { AlertCircle, ArrowRight, LockKeyhole, ShieldCheck } from 'lucide-react';

interface LoginScreenProps { needsSetup: boolean; onAuthenticated: (username: string, role?: string) => void; }

export const LoginScreen: React.FC<LoginScreenProps> = ({ needsSetup, onAuthenticated }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setMessage('');
    if (needsSetup && password !== confirmPassword) return setMessage('The passwords do not match.');
    setSubmitting(true);
    const result = needsSetup ? await window.electronAPI.setInitialCredentials(username, password) : await window.electronAPI.login(username, password);
    setSubmitting(false);
    if (!result.ok) return setMessage(result.message || 'We could not sign you in.');
    if (needsSetup) { setPassword(''); setConfirmPassword(''); return setMessage('Account created. Sign in with your new credentials.'); }
    onAuthenticated(username, (result as any).role);
  };

  return <main className="app-background min-h-screen w-screen p-6 text-textPrimary md:p-10">
    <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-6xl items-center">
      <div className="grid w-full overflow-hidden rounded-2xl border border-white/10 bg-[#0a101b]/80 shadow-[0_28px_100px_rgba(0,0,0,0.5)] backdrop-blur-xl lg:grid-cols-[1.05fr_0.95fr]">
        <section className="hidden min-h-[640px] flex-col justify-between border-r border-white/10 bg-[linear-gradient(145deg,rgba(27,43,65,0.48),rgba(8,12,20,0.2))] p-10 lg:flex">
          <div><div className="flex items-center gap-3 text-sm font-semibold tracking-[0.18em] text-white"><span className="flex h-9 w-9 items-center justify-center rounded-lg border border-cyan-200/30 bg-cyan-200/10"><span className="h-3 w-3 rounded-sm border-2 border-cyan-100" /></span>VERTEX</div>
            <div className="mt-24 max-w-md"><p className="text-xs font-semibold tracking-[0.16em] text-cyan-200/80">CONTROLLED ACCESS</p><h1 className="mt-5 text-4xl font-semibold leading-tight tracking-tight text-white">Operational intelligence, protected by design.</h1><p className="mt-5 max-w-sm text-base leading-7 text-slate-400">Access to this environment is restricted to authorized personnel on the local network.</p></div>
          </div><div className="flex items-center gap-3 text-xs text-slate-500"><ShieldCheck className="h-4 w-4 text-cyan-200/70" />Air-gapped deployment · Local audit logging</div>
        </section>
        <section className="flex min-h-[640px] items-center bg-[#0b1018]/75 px-7 py-10 sm:px-12 lg:px-16"><div className="w-full max-w-sm">
          <div className="mb-10 lg:hidden"><div className="text-sm font-semibold tracking-[0.18em] text-white">VERTEX</div><p className="mt-2 text-xs text-slate-500">CONTROLLED ACCESS</p></div>
          <p className="text-xs font-semibold tracking-[0.14em] text-cyan-200/80">{needsSetup ? 'INITIAL ACCOUNT SETUP' : 'AUTHORIZED PERSONNEL ONLY'}</p><h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">{needsSetup ? 'Create operator account' : 'Sign in to Vertex'}</h2><p className="mt-3 text-sm leading-6 text-slate-400">{needsSetup ? 'Set the initial local operator credentials for this workstation.' : 'Use your assigned local credentials to continue.'}</p>
          <form onSubmit={submit} className="mt-9 space-y-5">
            <label className="block text-sm font-medium text-slate-300">Username<input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" maxLength={50} required className="mt-2 w-full rounded-lg border border-white/10 bg-black/25 px-3.5 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-200/60 focus:ring-2 focus:ring-cyan-200/10" placeholder="Enter your username" /></label>
            <label className="block text-sm font-medium text-slate-300">Password<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete={needsSetup ? 'new-password' : 'current-password'} minLength={12} maxLength={128} required className="mt-2 w-full rounded-lg border border-white/10 bg-black/25 px-3.5 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-200/60 focus:ring-2 focus:ring-cyan-200/10" placeholder="Enter your password" /></label>
            {needsSetup && <label className="block text-sm font-medium text-slate-300">Confirm password<input value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} type="password" autoComplete="new-password" minLength={12} maxLength={128} required className="mt-2 w-full rounded-lg border border-white/10 bg-black/25 px-3.5 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-200/60 focus:ring-2 focus:ring-cyan-200/10" placeholder="Repeat your password" /></label>}
            {message && <div className="flex gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-3 text-xs leading-5 text-slate-300"><AlertCircle className="h-4 w-4 shrink-0 text-cyan-200" />{message}</div>}
            <button disabled={submitting} className="flex w-full items-center justify-center gap-2 rounded-lg bg-white px-4 py-3 text-sm font-semibold text-[#0b1018] transition hover:bg-cyan-50 disabled:cursor-wait disabled:opacity-60">{submitting ? 'Signing in…' : needsSetup ? 'Create account' : 'Sign in'} <ArrowRight className="h-4 w-4" /></button>
          
          </form>
          
          {!needsSetup && (
            <div className="mt-8 border-t border-white/10 pt-6">
              <p className="text-xs font-semibold tracking-wider text-slate-500 mb-3 text-center uppercase">Hackathon Quick Login</p>
              <div className="grid grid-cols-3 gap-2">
                <button 
                  onClick={async () => { const res = await window.electronAPI.demoLogin('admin'); onAuthenticated(res.username, res.role); }}
                  type="button" 
                  className="py-2 text-[10px] font-bold text-violet-400 bg-violet-500/10 border border-violet-500/20 rounded hover:bg-violet-500/20 transition uppercase tracking-wider"
                >
                  Admin
                </button>
                <button 
                  onClick={async () => { const res = await window.electronAPI.demoLogin('engineer'); onAuthenticated(res.username, res.role); }}
                  type="button" 
                  className="py-2 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded hover:bg-emerald-500/20 transition uppercase tracking-wider"
                >
                  Engineer
                </button>
                <button 
                  onClick={async () => { const res = await window.electronAPI.demoLogin('operator'); onAuthenticated(res.username, res.role); }}
                  type="button" 
                  className="py-2 text-[10px] font-bold text-slate-400 bg-slate-500/10 border border-slate-500/20 rounded hover:bg-slate-500/20 transition uppercase tracking-wider"
                >
                  Operator
                </button>
              </div>
            </div>
          )}

          <p className="mt-8 flex items-start gap-2 text-xs leading-5 text-slate-500">
<LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0" />This workstation records sign-in activity and protected-window actions.</p>
        </div></section>
      </div>
    </div>
  </main>;
};
