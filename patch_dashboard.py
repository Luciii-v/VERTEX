import re

with open('frontend/vertex_mac/dist/assets/index-DxwHuhzu.js', 'r') as f:
    content = f.read()

start_idx = content.find('Um=()=>{')
end_idx = content.find('Vm=({', start_idx)

if start_idx == -1 or end_idx == -1:
    print("❌ Could not find Um or Vm components")
    exit(1)

new_Um = """Um=()=>{
    const { userRole, userName, setRoute } = Te();
    const [users, setUsers] = R.useState([]);
    const [approvals, setApprovals] = R.useState([]);
    const [view, setView] = R.useState("main");

    const refresh = () => {
        if (userRole === "Administrator") window.electronAPI.invoke('users:list').then(setUsers);
        if (userRole === "Administrator" || userRole === "Approver") {
            fetch("http://127.0.0.1:8000/approvals").then(r=>r.json()).then(data=>setApprovals(data)).catch(console.error);
        }
    };

    R.useEffect(() => { refresh(); }, [userRole, view]);

    R.useEffect(() => {
        window._dashView = setView;
        window._dashRoute = setRoute;
        window._dashApprove = (id) => {
            fetch(`http://127.0.0.1:8000/approvals/${id}/approve`, {
                method:"POST", headers: {"X-User": userName, "X-Role": userRole}
            }).then(refresh);
        };
        window._dashReject = (id) => {
            fetch(`http://127.0.0.1:8000/approvals/${id}/reject`, {
                method:"POST", headers: {"X-User": userName, "X-Role": userRole}
            }).then(refresh);
        };
        window._dashAddUser = () => {
            const u = prompt("Username:");
            if(!u) return;
            const p = prompt("Password:");
            const r = prompt("Role (Approver/Engineer):");
            if(u&&p&&r) window.electronAPI.invoke('users:add', {username:u, password:p, role:r}).then(refresh);
        };
        window._dashDeleteUser = (id) => {
            if(confirm("Delete user?")) window.electronAPI.invoke('users:delete', {id}).then(refresh);
        };
        window._dashResetPwd = (id) => {
            const p = prompt("New password:");
            if(p) window.electronAPI.invoke('users:resetPassword', {id, newPassword:p}).then(refresh);
        };
        return () => {
            delete window._dashView;
            delete window._dashRoute;
            delete window._dashApprove;
            delete window._dashReject;
            delete window._dashAddUser;
            delete window._dashDeleteUser;
            delete window._dashResetPwd;
        };
    }, [userName, userRole]);

    let html = `<div class="p-6 space-y-6 overflow-y-auto h-full text-textPrimary font-mono select-text">
        <div class="flex items-center justify-between border-b border-border pb-4">
            <div>
                <h2 class="text-xl font-bold uppercase tracking-widest text-textPrimary">VERTEX DASHBOARD</h2>
                <p class="text-xs text-textSecondary mt-1">Signed in as: <strong class="text-textPrimary">${userName}</strong> | Role: <strong class="text-textPrimary">${userRole}</strong></p>
            </div>
            <div>
                <button onclick="window._dashView('main')" class="px-4 py-2 bg-panel border border-border text-xs font-bold rounded hover:bg-base text-textPrimary transition-all">🏠 Home</button>
            </div>
        </div>
    `;

    if (view === "main") {
        html += `<div class="grid grid-cols-1 md:grid-cols-3 gap-6">`;
        
        html += `
            <div class="cli-panel p-5 rounded-lg border border-border flex flex-col justify-between hover:border-textPrimary transition-colors">
                <div>
                    <h3 class="text-sm font-bold uppercase mb-2 text-textPrimary">AI Workbench</h3>
                    <p class="text-xs text-textSecondary mb-4">Use the sovereign agentic AI for file generation and analysis.</p>
                </div>
                <button onclick="window._dashRoute('agents')" class="w-full py-2.5 bg-textPrimary/10 border border-textPrimary text-textPrimary text-xs font-bold rounded hover:bg-textPrimary hover:text-base transition-all">Open Workbench ➔</button>
            </div>
            <div class="cli-panel p-5 rounded-lg border border-border flex flex-col justify-between hover:border-textPrimary transition-colors">
                <div>
                    <h3 class="text-sm font-bold uppercase mb-2 text-textPrimary">Documents</h3>
                    <p class="text-xs text-textSecondary mb-4">Upload and analyze refinery P&IDs and SOP documents.</p>
                </div>
                <button onclick="window._dashRoute('documents')" class="w-full py-2.5 bg-base border border-border text-xs rounded hover:border-textPrimary text-textPrimary transition-all">Upload Files</button>
            </div>
            <div class="cli-panel p-5 rounded-lg border border-border flex flex-col justify-between">
                <div>
                    <h3 class="text-sm font-bold uppercase mb-2 text-textPrimary">Generated Outputs</h3>
                    <p class="text-xs text-textSecondary mb-4">View files generated by the AI agent.</p>
                </div>
                <div class="w-full py-2.5 bg-base border border-border text-xs rounded text-center text-textSecondary font-bold">workspace_data/outputs/</div>
            </div>
        `;

        html += `</div><div class="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">`;

        if (userRole === "Administrator" || userRole === "Approver") {
            const count = approvals.length;
            html += `
                <div class="cli-panel p-5 rounded-lg border border-border flex flex-col justify-between hover:border-accent transition-colors">
                    <div>
                        <h3 class="text-sm font-bold uppercase mb-2 text-accent">Pending Approvals</h3>
                        <p class="text-xs text-textSecondary mb-4">${count} protected action${count===1?'':'s'} awaiting review.</p>
                    </div>
                    <button onclick="window._dashView('approvals')" class="w-full py-2.5 bg-accent/10 border border-accent text-accent text-xs font-bold rounded hover:bg-accent hover:text-base transition-all">Review Actions</button>
                </div>
            `;
        }

        if (userRole === "Administrator") {
            html += `
                <div class="cli-panel p-5 rounded-lg border border-border flex flex-col justify-between hover:border-error transition-colors">
                    <div>
                        <h3 class="text-sm font-bold uppercase mb-2 text-error">User Management</h3>
                        <p class="text-xs text-textSecondary mb-4">Manage accounts, roles, and reset passwords.</p>
                    </div>
                    <button onclick="window._dashView('users')" class="w-full py-2.5 bg-error/10 border border-error text-error text-xs font-bold rounded hover:bg-error hover:text-base transition-all">Manage Users</button>
                </div>
                <div class="cli-panel p-5 rounded-lg border border-border flex flex-col justify-between hover:border-textPrimary transition-colors">
                    <div>
                        <h3 class="text-sm font-bold uppercase mb-2 text-textPrimary">Audit Trail</h3>
                        <p class="text-xs text-textSecondary mb-4">View sovereign activity logs and executed tools.</p>
                    </div>
                    <button onclick="window._dashRoute('audit')" class="w-full py-2.5 bg-base border border-border text-xs rounded text-textPrimary hover:border-textPrimary transition-all">View Audit Controls</button>
                </div>
            `;
        }

        html += `</div>`;
    } 
    else if (view === "approvals" && (userRole === "Administrator" || userRole === "Approver")) {
        html += `<h3 class="text-lg font-bold mb-4 text-accent uppercase tracking-widest border-b border-border pb-2">Pending Approvals</h3>`;
        if (approvals.length === 0) {
            html += `<p class="text-sm text-textSecondary">No pending approvals at this time.</p>`;
        } else {
            html += `<div class="space-y-4">`;
            approvals.forEach(app => {
                html += `
                    <div class="p-5 border border-border rounded-lg bg-panel hover:border-accent transition-colors">
                        <div class="flex justify-between items-start mb-3">
                            <div>
                                <span class="text-xs font-bold bg-base px-2.5 py-1 rounded border border-border text-textPrimary">ID: ${app.request_id}</span>
                                <span class="text-xs ml-3 text-textSecondary">Tool Requested: <strong class="text-textPrimary">${app.tool}</strong></span>
                            </div>
                            <div class="text-[10px] bg-base px-2 py-1 rounded border border-border text-textSecondary">Requested by: <strong class="text-textPrimary">${app.user}</strong> (${app.role})</div>
                        </div>
                        <div class="text-[11px] bg-base p-3 rounded mb-4 overflow-x-auto border border-border text-textSecondary whitespace-pre-wrap"><pre>${JSON.stringify(app.arguments, null, 2)}</pre></div>
                        <div class="flex gap-3">
                            <button onclick="window._dashApprove('${app.request_id}')" class="px-5 py-2 bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/50 rounded text-xs font-bold hover:bg-[#22c55e] hover:text-base transition-all">✓ Approve Execution</button>
                            <button onclick="window._dashReject('${app.request_id}')" class="px-5 py-2 bg-error/10 text-error border border-error/50 rounded text-xs font-bold hover:bg-error hover:text-base transition-all">✕ Reject</button>
                        </div>
                    </div>
                `;
            });
            html += `</div>`;
        }
    }
    else if (view === "users" && userRole === "Administrator") {
        html += `
            <div class="flex justify-between items-center mb-4 border-b border-border pb-2">
                <h3 class="text-lg font-bold text-error uppercase tracking-widest">User Management</h3>
                <button onclick="window._dashAddUser()" class="px-4 py-2 bg-textPrimary text-base font-bold text-xs rounded hover:opacity-80 transition-opacity">+ Add New User</button>
            </div>
            <div class="overflow-hidden border border-border rounded-lg shadow-lg">
                <table class="w-full text-left text-sm">
                    <thead class="bg-base border-b border-border text-xs uppercase text-textSecondary font-bold">
                        <tr><th class="p-4">Username</th><th class="p-4">Role</th><th class="p-4 text-right">Actions</th></tr>
                    </thead>
                    <tbody class="divide-y divide-border bg-panel">
        `;
        users.forEach(u => {
            html += `
                <tr class="hover:bg-base/50 transition-colors">
                    <td class="p-4 text-textPrimary font-bold">${u.username}</td>
                    <td class="p-4 text-textSecondary">
                        <span class="px-2 py-1 bg-base border border-border rounded text-[10px]">${u.role}</span>
                    </td>
                    <td class="p-4 flex justify-end gap-2">
                        <button onclick="window._dashResetPwd('${u.id}')" class="px-3 py-1.5 bg-base border border-border rounded text-xs text-textSecondary hover:text-textPrimary hover:border-textPrimary transition-colors">Reset Password</button>
                        ${u.role !== 'Administrator' ? `<button onclick="window._dashDeleteUser('${u.id}')" class="px-3 py-1.5 bg-error/10 text-error border border-error/50 rounded text-xs hover:bg-error hover:text-base transition-all">Delete</button>` : ''}
                    </td>
                </tr>
            `;
        });
        html += `</tbody></table></div>`;
    }

    html += `</div>`;
    
    return R.createElement('div', { dangerouslySetInnerHTML: { __html: html }, className: "w-full h-full" });
},"""

content = content[:start_idx] + new_Um + content[end_idx:]

with open('frontend/vertex_mac/dist/assets/index-DxwHuhzu.js', 'w') as f:
    f.write(content)

print("✅ Patched Dashboard (Um) with role-based UI.")
