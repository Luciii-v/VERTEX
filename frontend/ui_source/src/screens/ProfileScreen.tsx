import React, { useState, useEffect } from 'react';
import { User, Shield, Key, LogOut, Users, Trash2, Edit3, Plus, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { useStore } from '../store/useStore';

interface ProfileScreenProps {
  onSwitchAccount: () => void;
}

interface UserData {
  id: string;
  username: string;
  role: string;
  created_at: number;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ onSwitchAccount }) => {
  const { userName, userRole, addToast } = useStore();
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);
  const [resetId, setResetId] = useState<string | null>(null);

  // Form states
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('engineer');
  const [resetPassword, setResetPasswordVal] = useState('');

  const fetchUsers = async () => {
    if (userRole?.toLowerCase() !== 'admin') return;
    setLoading(true);
    try {
      const data = await window.electronAPI.usersList();
      if (Array.isArray(data)) {
        setUsers(data);
      } else {
        setUsers([]);
        addToast('Error', (data as any)?.message || 'Failed to fetch users', 'error');
      }
    } catch (e) {
      addToast('Error', 'Failed to fetch users', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [userRole]);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await window.electronAPI.usersAdd(newUsername, newPassword, newRole);
      if (res.ok) {
        addToast('Success', `User ${newUsername} created`, 'success');
        setShowAddUser(false);
        setNewUsername('');
        setNewPassword('');
        setNewRole('engineer');
        fetchUsers();
      } else {
        addToast('Error', res.message || 'Failed to create user', 'error');
      }
    } catch (e: any) {
      addToast('Error', e.message, 'error');
    }
  };

  const handleDeleteUser = async (id: string, username: string) => {
    if (!window.confirm(`Are you sure you want to delete ${username}?`)) return;
    try {
      const res = await window.electronAPI.usersDelete(id);
      if (res.ok) {
        addToast('Success', `User ${username} deleted`, 'success');
        fetchUsers();
      } else {
        addToast('Error', res.message || 'Failed to delete user', 'error');
      }
    } catch (e: any) {
      addToast('Error', e.message, 'error');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetId) return;
    try {
      const res = await window.electronAPI.usersResetPassword(resetId, resetPassword);
      if (res.ok) {
        addToast('Success', 'Password reset successfully', 'success');
        setResetId(null);
        setResetPasswordVal('');
      } else {
        addToast('Error', res.message || 'Failed to reset password', 'error');
      }
    } catch (e: any) {
      addToast('Error', e.message, 'error');
    }
  };

  return (
    <div className="h-full w-full p-8 overflow-y-auto">
      <div className="max-w-4xl mx-auto space-y-8">
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

        {userRole?.toLowerCase() === 'admin' && (
          <section className="bg-panel rounded-xl border border-border p-6 space-y-6">
            <header className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold tracking-wider uppercase text-textPrimary flex items-center gap-2">
                  <Users className="w-5 h-5 text-accent" />
                  User Management
                </h2>
                <p className="text-xs text-textSecondary mt-1">ADMINISTRATIVE ACCESS ONLY</p>
              </div>
              <button 
                onClick={() => setShowAddUser(!showAddUser)}
                className="flex items-center gap-2 px-3 py-1.5 bg-accent/10 text-accent border border-accent/20 rounded hover:bg-accent/20 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span className="text-xs font-bold uppercase">Add User</span>
              </button>
            </header>

            {showAddUser && (
              <form onSubmit={handleAddUser} className="p-4 bg-base/50 border border-border rounded-lg space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-wider">Create New User</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs text-textSecondary block mb-1 uppercase">Username</label>
                    <input 
                      type="text" 
                      value={newUsername} 
                      onChange={e => setNewUsername(e.target.value)} 
                      className="w-full bg-panel border border-border p-2 text-sm focus:border-accent outline-none rounded"
                      required
                      minLength={3}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-textSecondary block mb-1 uppercase">Role</label>
                    <select 
                      value={newRole} 
                      onChange={e => setNewRole(e.target.value)} 
                      className="w-full bg-panel border border-border p-2 text-sm focus:border-accent outline-none rounded"
                    >
                      <option value="operator">Operator</option>
                      <option value="engineer">Engineer</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-textSecondary block mb-1 uppercase">Initial Password</label>
                    <input 
                      type="password" 
                      value={newPassword} 
                      onChange={e => setNewPassword(e.target.value)} 
                      className="w-full bg-panel border border-border p-2 text-sm focus:border-accent outline-none rounded"
                      required
                      minLength={12}
                      placeholder="Min 12 chars"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setShowAddUser(false)} className="px-4 py-2 text-xs font-bold uppercase cli-button rounded">Cancel</button>
                  <button type="submit" className="px-4 py-2 text-xs font-bold uppercase bg-accent text-base rounded hover:opacity-90">Create User</button>
                </div>
              </form>
            )}

            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-base/50 text-textSecondary text-xs uppercase tracking-wider">
                    <th className="p-3 font-bold border-b border-border">Username</th>
                    <th className="p-3 font-bold border-b border-border">Role</th>
                    <th className="p-3 font-bold border-b border-border">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={3} className="p-4 text-center text-textSecondary text-xs">Loading users...</td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="p-4 text-center text-textSecondary text-xs">No users found.</td>
                    </tr>
                  ) : (
                    users.map(u => (
                      <tr key={u.id} className="border-b border-border/50 hover:bg-base/30">
                        <td className="p-3 font-medium capitalize">{u.username}</td>
                        <td className="p-3">
                          <span className={`text-[10px] px-2 py-1 uppercase font-bold tracking-wider rounded border ${
                            u.role === 'admin' ? 'bg-violet-500/10 text-violet-400 border-violet-500/20' : 
                            u.role === 'engineer' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 
                            'bg-slate-500/10 text-slate-400 border-slate-500/20'
                          }`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => setResetId(resetId === u.id ? null : u.id)}
                              className="p-1.5 text-textSecondary hover:text-accent transition-colors rounded hover:bg-accent/10"
                              title="Reset Password"
                            >
                              <RefreshCw className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleDeleteUser(u.id, u.username)}
                              className="p-1.5 text-textSecondary hover:text-red-400 transition-colors rounded hover:bg-red-500/10"
                              title="Delete User"
                              disabled={u.username === userName}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          
                          {resetId === u.id && (
                            <form onSubmit={handleResetPassword} className="mt-2 flex gap-2">
                              <input 
                                type="password" 
                                value={resetPassword} 
                                onChange={e => setResetPasswordVal(e.target.value)} 
                                placeholder="New password (12+ chars)" 
                                className="flex-1 bg-panel border border-border p-1 text-xs outline-none rounded"
                                required
                                minLength={12}
                              />
                              <button type="submit" className="px-2 py-1 bg-accent text-base text-[10px] font-bold rounded uppercase">Save</button>
                            </form>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </div>
  );
};
