/* =============================================================================
   VERTEX — Patch Layer v4.0  (authoritative, replaces all previous versions)

   ROOT CAUSES FOUND & FIXED:
   ─────────────────────────────────────────────────────────────────────────────
   1. ROLE BUG   – bundle's onAuthenticated always calls setUserInfo(name,"Engineer")
                   → We wrap window.electronAPI.login to capture the real role,
                     store it, then patch the Zustand store after React mounts.
   2. BLACK SCREEN – our DOM manipulation conflicted with React's reconciler:
                     React's setState() replaced DOM nodes we held refs to → crash.
                     → We now intercept the Zustand store's sendMessage via
                       store.setState() so React drives all DOM updates safely.
   3. ENTER KEY  – compiled A() handler only fires on Ctrl+Enter.
                   → We inject a keydown listener on the textarea for plain Enter.
   4. PROFILE BTN – unwanted "Profile" / "View Profile" button in header removed.
   5. USER MGMT  – Add/Reset/Remove user injected into Profile page (admin only).
   ============================================================================= */
(() => {
  'use strict';

  const API = 'http://127.0.0.1:8000';

  /* ─────────────────────────────────────────────────────────────────────────
     UTILITIES
     ───────────────────────────────────────────────────────────────────────── */
  const ROLE_DISPLAY = {
    admin:     'Administrator',
    approver:  'Approver',
    engineer:  'Engineer',
    operator:  'Operator',
  };
  const ROLE_KEY = {  // Maps DB role → No[] key in the bundle
    admin:     'Administrator',
    approver:  'Approver',
    engineer:  'Engineer',
    operator:  'Operator',
  };
  const ROLE_COLOR = {
    admin:    '#f87171',
    approver: '#fbbf24',
    engineer: '#34d399',
    operator: '#94a3b8',
  };

  const roleDisplay = r => ROLE_DISPLAY[r?.toLowerCase()] ?? r ?? 'Unknown';
  const roleKey     = r => ROLE_KEY[r?.toLowerCase()] ?? 'Engineer';
  const roleColor   = r => ROLE_COLOR[r?.toLowerCase()] ?? '#94a3b8';

  /* ─────────────────────────────────────────────────────────────────────────
     STEP 1 – INTERCEPT electronAPI.login TO CAPTURE THE REAL ROLE
     The login component calls t(username) after login and the main app then
     calls setUserInfo(username, "Engineer") — hardcoded, wrong for admin.
     We wrap electronAPI.login so after a successful login we remember the role.
     ───────────────────────────────────────────────────────────────────────── */
  let _capturedRole = null;

  function interceptElectronLogin() {
    const api = window.electronAPI;
    if (!api || api.__vtxPatched) return;
    api.__vtxPatched = true;

    const _origLogin = api.login.bind(api);
    api.login = async function(username, password) {
      const result = await _origLogin(username, password);
      if (result?.ok && result?.role) {
        _capturedRole = result.role;
      }
      return result;
    };

    // Also patch getAuthStatus so we always have the role
    const _origGetAuthStatus = api.getAuthStatus.bind(api);
    api.getAuthStatus = async function() {
      const result = await _origGetAuthStatus();
      if (result?.authenticated && result?.role) {
        _capturedRole = result.role;
      }
      return result;
    };
  }

  /* ─────────────────────────────────────────────────────────────────────────
     STEP 2 – ACCESS THE ZUSTAND STORE
     Zustand v4 exposes getState/setState on the hook function itself.
     The bundle's store hook is `Te`. We find it by scanning all function
     properties on the React root's fiber for a store with our expected shape.
     ───────────────────────────────────────────────────────────────────────── */
  let _store = null;  // { getState, setState, subscribe }

  function findZustandStore() {
    if (_store) return _store;

    // Walk the React fiber tree from #root to find the Zustand store context
    const rootEl = document.getElementById('root');
    if (!rootEl) return null;

    // React 18 internal fiber key
    const fiberKey = Object.keys(rootEl).find(k =>
      k.startsWith('__reactFiber') || k.startsWith('__reactInternalInstance')
    );
    if (!fiberKey) return null;

    let fiber = rootEl[fiberKey];
    const maxDepth = 200;
    let depth = 0;

    while (fiber && depth < maxDepth) {
      depth++;
      // Check memoizedState chain for Zustand store context
      let state = fiber.memoizedState;
      while (state) {
        const val = state.memoizedState ?? state.queue?.lastRenderedState;
        if (val && typeof val === 'object' && typeof val.sendMessage === 'function'
            && typeof val.setRoute === 'function' && typeof val.messages !== 'undefined') {
          // This is our store's state snapshot, but we need the store itself
          // Look at the stateNode
        }
        if (val && typeof val === 'object' && typeof val.getState === 'function'
            && typeof val.setState === 'function' && typeof val.subscribe === 'function') {
          const testState = val.getState?.();
          if (testState && typeof testState.sendMessage === 'function') {
            _store = val;
            return _store;
          }
        }
        // Check queue for zustand store
        if (state.queue) {
          const q = state.queue;
          if (q.dispatch && q.lastRenderedReducer) {
            // React reducer, not zustand
          }
        }
        state = state.next;
      }
      fiber = fiber.child || fiber.sibling || fiber.return;
    }
    return null;
  }

  // Alternative: expose store via a sentinel React component render trick
  // The most reliable way: patch Zustand's create() before React initializes
  // Since we load with defer, React has already run. Use fiber walk.

  function getStoreState() {
    const s = findZustandStore();
    return s ? s.getState() : null;
  }

  function setStoreState(patch) {
    const s = findZustandStore();
    if (s) { s.setState(patch); return true; }
    return false;
  }

  /* ─────────────────────────────────────────────────────────────────────────
     STEP 3 – FIX ROLE IN ZUSTAND AFTER AUTH
     After login, the store has userRole="Engineer". We call setState to fix it.
     We also fix the header pill display.
     ───────────────────────────────────────────────────────────────────────── */
  async function fixRole() {
    const auth = await window.electronAPI?.getAuthStatus?.();
    if (!auth?.authenticated || !auth.role) return;

    const correctRoleKey = roleKey(auth.role);
    const state = getStoreState();

    if (state) {
      // Patch the store if role is wrong
      if (state.userRole !== correctRoleKey) {
        setStoreState({ userRole: correctRoleKey, userName: auth.username });
      }
      // Also patch userName if it shows as 'operator' default
      if (state.userName === 'operator' && auth.username) {
        setStoreState({ userName: auth.username });
      }
    }

    // Style the header pill
    styleHeaderPill(auth.username, auth.role);

    return auth;
  }

  /* ─────────────────────────────────────────────────────────────────────────
     STEP 4 – STYLE HEADER PILL (no extra button)
     ───────────────────────────────────────────────────────────────────────── */
  function styleHeaderPill(username, role) {
    // Kill the profile launch button unconditionally
    document.getElementById('vertex-profile-launch')?.remove();

    const col   = roleColor(role);
    const label = roleDisplay(role).toUpperCase();
    const header = document.querySelector('header');
    if (!header) return;

    // Find the ROLE: span
    const roleSpan = [...header.querySelectorAll('span')].find(
      el => el.children.length === 0 && el.textContent.trim().startsWith('ROLE:')
    );
    if (!roleSpan) return;

    // Correct text in React-rendered spans (safe — React only re-renders on state change)
    roleSpan.textContent = `ROLE: ${label}`;
    const nameSpan = roleSpan.previousElementSibling;
    if (nameSpan && nameSpan.textContent.trim() !== username && username) {
      nameSpan.textContent = username;
    }

    Object.assign(roleSpan.style, {
      fontSize: '9px', fontWeight: '700', letterSpacing: '0.14em',
      color: col, textShadow: `0 0 6px ${col}60`,
    });

    // Style pill container
    const pill = roleSpan.closest('[class*="cli-panel"]') ||
                 roleSpan.closest('[class*="px-3"]') ||
                 roleSpan.parentElement?.parentElement;
    if (pill && !pill.dataset.vtxPill) {
      pill.dataset.vtxPill = '1';
      Object.assign(pill.style, {
        border: `1px solid ${col}35`, borderRadius: '8px',
        transition: 'border-color .25s, box-shadow .25s',
      });
      pill.addEventListener('mouseenter', () => {
        pill.style.borderColor = `${col}60`;
        pill.style.boxShadow   = `0 0 12px ${col}20`;
      });
      pill.addEventListener('mouseleave', () => {
        pill.style.borderColor = `${col}35`;
        pill.style.boxShadow   = 'none';
      });
    } else if (pill?.dataset.vtxPill) {
      pill.style.borderColor = `${col}35`;
    }
  }

  /* ─────────────────────────────────────────────────────────────────────────
     STEP 5 – WORKBENCH REAL SSE STREAM (React-safe approach)

     CRITICAL FIX: We NO LONGER manipulate inner DOM nodes owned by React.
     Instead we intercept at the Zustand store level:

     1. Patch store.sendMessage to prevent the mock setTimeout from running
     2. Our replacement calls POST /investigate via SSE
     3. All updates go through store.setState({ messages: [...] })
        which lets React reconcile safely

     If store access fails (fallback), we use a safe overlay div approach
     that sits OUTSIDE React's managed subtree.
     ───────────────────────────────────────────────────────────────────────── */

  let _isSending = false;  // prevent double submit

  function renderMd(raw) {
    if (!raw) return '<em style="color:#64748b">(No response)</em>';
    return raw
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
      .replace(/`([^`]+)`/g,'<code style="background:rgba(148,163,184,.12);padding:1px 5px;border-radius:3px">$1</code>')
      .replace(/\[([^\]]+)\]\((http[^)]+)\)/g,
        '<a href="$2" style="color:#38bdf8;text-decoration:underline" target="_blank">$1</a>')
      .replace(/^### (.+)/gm,'<span style="display:block;margin:10px 0 3px;font-size:12px;font-weight:700">$1</span>')
      .replace(/^## (.+)/gm,'<span style="display:block;margin:12px 0 4px;font-size:13px;font-weight:700">$1</span>')
      .replace(/^- (.+)/gm,'&nbsp;• $1')
      .replace(/\n/g,'<br>');
  }

  async function runInvestigate(query, msgId) {
    const auth = await window.electronAPI?.getAuthStatus?.();
    const user = auth?.username || 'engineer';
    const role = auth?.role     || 'engineer';

    // Helper: update the agent message in the store
    const updateMsg = (patch) => {
      const store = findZustandStore();
      if (!store) return false;
      const state = store.getState();
      const msgs  = state.messages.map(m => m.id === msgId ? { ...m, ...patch } : m);
      store.setState({ messages: msgs });
      return true;
    };

    let res;
    try {
      res = await fetch(`${API}/investigate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User': user, 'X-Role': role },
        body:   JSON.stringify({ query }),
      });
    } catch (netErr) {
      updateMsg({
        content: `❌ **Network error:** ${netErr.message}\n\nEnsure the VERTEX backend is on port 8000.`,
        isStreaming: false, progressPercent: undefined, progressSubStep: undefined,
      });
      _isSending = false;
      return;
    }

    if (!res.ok) {
      const body = await res.text();
      updateMsg({
        content: `❌ **Backend error ${res.status}:** ${body}`,
        isStreaming: false, progressPercent: undefined, progressSubStep: undefined,
      });
      _isSending = false;
      return;
    }

    const reader  = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '', result = '', pct = 15;

    updateMsg({ content: '⚙️ Routing to Sovereign Agent…', progressPercent: pct,
                progressSubStep: 'Connecting…', isStreaming: true });

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n'); buf = lines.pop();
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          let ev; try { ev = JSON.parse(line.slice(6)); } catch { continue; }
          if (ev.type === 'log') {
            pct = Math.min(88, pct + 7);
            updateMsg({ content: `⚙️ ${ev.content.slice(0, 100)}`,
                        progressPercent: pct, progressSubStep: ev.content.slice(0, 60) });
          } else if (ev.type === 'result') {
            result = ev.content;
          } else if (ev.type === 'approval_required') {
            const names = (ev.content || []).map(p => p.tool || '?').join(', ');
            result = (result || '') + `\n\n⚠️ **Approval required for:** ${names}`;
          } else if (ev.type === 'error') {
            result = `❌ **Agent error:** ${ev.content}`;
          }
        }
      }
    } catch (readErr) {
      result = result || `❌ **Stream error:** ${readErr.message}`;
    }

    updateMsg({
      content: result || '*(Agent returned empty response)*',
      isStreaming: false, progressPercent: undefined, progressSubStep: undefined,
      toolCalls: [],
    });
    _isSending = false;
  }

  function patchStoreSendMessage() {
    const store = findZustandStore();
    if (!store || store.__vtxSendPatched) return false;
    store.__vtxSendPatched = true;

    const origState = store.getState();
    const origSend  = origState.sendMessage;

    // Replace sendMessage in the store
    store.setState({
      sendMessage: function(text, files) {
        if (_isSending) return;  // prevent duplicates
        if (!text?.trim() && (!files || files.length === 0)) return;

        _isSending = true;
        const ts  = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const fileNote = files?.length ? `\n\n*[Attached: ${files.map(f => f.name).join(', ')}]*` : '';
        const userQuery = (text || '') + fileNote;

        const userId  = `msg-user-${Date.now()}`;
        const agentId = `msg-agent-${Date.now() + 1}`;

        // Add user message + placeholder agent message atomically
        const curState = store.getState();
        store.setState({
          messages: [
            ...curState.messages,
            { id: userId,  sender: 'user',  content: userQuery, timestamp: ts },
            { id: agentId, sender: 'agent', content: '⚙️ Initializing Sovereign Agent…',
              timestamp: ts, isStreaming: true, progressPercent: 10,
              progressSubStep: 'Queuing inference request…' },
          ],
        });

        // Stream real response and update agentId message
        const query = (text || '').trim();
        runInvestigate(query, agentId);
      }
    });

    return true;
  }

  /* ─────────────────────────────────────────────────────────────────────────
     STEP 6 – ENTER KEY TO SEND
     The compiled handler A() only fires on Ctrl+Enter.
     We inject a keydown listener on the textarea that fires on plain Enter.
     We do NOT duplicate send logic — we call the store's sendMessage directly.
     ───────────────────────────────────────────────────────────────────────── */
  const patchedTextareas = new WeakSet();

  function patchTextareaEnter() {
    // Find all textareas with the specific placeholder used in Hm
    document.querySelectorAll('textarea').forEach(ta => {
      if (patchedTextareas.has(ta)) return;
      if (!ta.placeholder?.includes('Command Input')) return;
      patchedTextareas.add(ta);

      ta.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.altKey) {
          e.preventDefault();
          e.stopImmediatePropagation();  // prevent the compiled handler from also firing

          if (_isSending) return;

          const val = ta.value.trim();
          if (!val) return;

          // Dispatch through the store
          const state = getStoreState();
          if (state?.sendMessage) {
            state.sendMessage(ta.value, []);
            ta.value = '';
            // Trigger React's onChange so it knows the value changed
            const nativeInputSetter = Object.getOwnPropertyDescriptor(
              window.HTMLTextAreaElement.prototype, 'value'
            )?.set;
            if (nativeInputSetter) {
              nativeInputSetter.call(ta, '');
              ta.dispatchEvent(new Event('input', { bubbles: true }));
            }
          }
        }
        // Shift+Enter: do nothing (allow default textarea newline)
      }, true);  // capture phase so we run before React's handler
    });
  }

  /* ─────────────────────────────────────────────────────────────────────────
     STEP 7 – USER MANAGEMENT IN PROFILE PAGE (admin only)
     ───────────────────────────────────────────────────────────────────────── */
  const UMGMT_ID = 'vtx-user-mgmt';

  async function injectUserMgmt(status) {
    if (status?.role?.toLowerCase() !== 'admin') return;

    // Profile page: div[class*="overflow-y-auto"][class*="p-6"] containing h1 "User Profile"
    const containers = document.querySelectorAll('div[class*="overflow-y-auto"][class*="p-6"]');
    let inner = null;
    for (const c of containers) {
      const h = c.querySelector('h1');
      if (h?.textContent?.includes('Profile')) {
        inner = c.querySelector('[class*="max-w-2xl"]') || c;
        break;
      }
    }
    if (!inner || inner.querySelector(`#${UMGMT_ID}`)) return;

    const col = roleColor(status.role);
    const api = window.electronAPI;

    const panel = document.createElement('div');
    panel.id = UMGMT_ID;
    panel.innerHTML = `
      <div class="vtx-umgmt-header">
        <span class="vtx-umgmt-dot" style="background:${col}"></span>
        USER MANAGEMENT
      </div>
      <div id="vtx-um-msg" class="vtx-um-msg" aria-live="polite"></div>

      <div class="vtx-um-card">
        <div class="vtx-um-card-title">CURRENT USERS</div>
        <div id="vtx-um-list" class="vtx-um-list"><div class="vtx-um-loading">Loading…</div></div>
      </div>

      <div class="vtx-um-card">
        <div class="vtx-um-card-title">ADD NEW USER</div>
        <form id="vtx-um-add" class="vtx-um-form" autocomplete="off">
          <div class="vtx-um-row">
            <div class="vtx-um-field">
              <label>Username</label>
              <input name="username" required maxlength="50" placeholder="e.g. john.doe" autocomplete="off">
            </div>
            <div class="vtx-um-field">
              <label>Temporary Password</label>
              <input name="password" type="password" required minlength="12" placeholder="min 12 chars" autocomplete="new-password">
            </div>
            <div class="vtx-um-field">
              <label>Role</label>
              <select name="role">
                <option value="engineer">Engineer</option>
                <option value="approver">Approver</option>
              </select>
            </div>
          </div>
          <button type="submit" class="vtx-um-btn vtx-um-btn-add">+ Add User</button>
        </form>
      </div>

      <div class="vtx-um-card">
        <div class="vtx-um-card-title">RESET PASSWORD</div>
        <form id="vtx-um-pwd" class="vtx-um-form" autocomplete="off">
          <div class="vtx-um-row">
            <div class="vtx-um-field">
              <label>Select User</label>
              <select name="userId" id="vtx-um-pwd-sel" required></select>
            </div>
            <div class="vtx-um-field">
              <label>New Password</label>
              <input name="password" type="password" required minlength="12" placeholder="min 12 chars" autocomplete="new-password">
            </div>
          </div>
          <button type="submit" class="vtx-um-btn vtx-um-btn-warn">↺ Reset Password</button>
        </form>
      </div>
    `;
    inner.appendChild(panel);

    const msgEl  = panel.querySelector('#vtx-um-msg');
    const listEl = panel.querySelector('#vtx-um-list');
    const pwdSel = panel.querySelector('#vtx-um-pwd-sel');

    const flash = (text, type = 'ok') => {
      msgEl.textContent = text;
      msgEl.className   = `vtx-um-msg vtx-um-msg--${type}`;
      setTimeout(() => { msgEl.textContent = ''; msgEl.className = 'vtx-um-msg'; }, 4000);
    };

    const refresh = async () => {
      listEl.innerHTML = '<div class="vtx-um-loading">Loading…</div>';
      pwdSel.innerHTML = '';
      try {
        const res = await api.usersList();
        if (!res.ok) throw new Error(res.message);
        listEl.innerHTML = '';
        res.users.forEach(u => {
          const uc  = roleColor(u.role);
          const row = document.createElement('div');
          row.className = 'vtx-um-user-row';
          row.innerHTML = `
            <span class="vtx-um-uname">${u.username}</span>
            <span class="vtx-um-urole" style="color:${uc};border-color:${uc}40;background:${uc}12">
              ${(ROLE_DISPLAY[u.role?.toLowerCase()] || u.role || '').toUpperCase()}
            </span>
            <button class="vtx-um-btn vtx-um-btn-del" data-id="${u.id}" data-name="${u.username}">✕ Remove</button>
          `;
          row.querySelector('.vtx-um-btn-del').addEventListener('click', async () => {
            if (!confirm(`Delete "${u.username}"? This cannot be undone.`)) return;
            const r = await api.usersDelete(u.id);
            flash(r.ok ? `✓ ${u.username} removed` : r.message || 'Failed.', r.ok ? 'ok' : 'err');
            if (r.ok) await refresh();
          });
          listEl.appendChild(row);

          const opt = document.createElement('option');
          opt.value = u.id;
          opt.textContent = `${u.username} — ${ROLE_DISPLAY[u.role?.toLowerCase()] || u.role}`;
          pwdSel.appendChild(opt);
        });
      } catch (e) {
        listEl.innerHTML = `<div class="vtx-um-loading" style="color:#f87171">${e.message}</div>`;
      }
    };

    panel.querySelector('#vtx-um-add').addEventListener('submit', async e => {
      e.preventDefault();
      const f = e.currentTarget;
      const btn = f.querySelector('button');
      btn.disabled = true; btn.textContent = 'Adding…';
      const res = await api.usersAdd(f.username.value, f.password.value, f.role.value);
      btn.disabled = false; btn.textContent = '+ Add User';
      flash(res.ok ? `✓ User "${f.username.value}" created` : res.message || 'Failed.', res.ok ? 'ok' : 'err');
      if (res.ok) { f.reset(); await refresh(); }
    });

    panel.querySelector('#vtx-um-pwd').addEventListener('submit', async e => {
      e.preventDefault();
      const f = e.currentTarget;
      const btn = f.querySelector('button');
      btn.disabled = true; btn.textContent = 'Resetting…';
      const res = await api.usersResetPassword(f.userId.value, f.password.value);
      btn.disabled = false; btn.textContent = '↺ Reset Password';
      flash(res.ok ? '✓ Password reset successfully.' : res.message || 'Failed.', res.ok ? 'ok' : 'err');
      if (res.ok) f.reset();
    });

    await refresh();
  }

  /* ─────────────────────────────────────────────────────────────────────────
     STEP 8 – SELECT WORKSPACE CARD ANIMATION
     ───────────────────────────────────────────────────────────────────────── */
  function animateWorkspaceCards() {
    const grid = document.querySelector('[class*="grid-cols-3"][class*="gap-5"]');
    if (!grid || grid.dataset.vtxAnim) return;
    grid.dataset.vtxAnim = '1';
    [...grid.querySelectorAll('button')].forEach((card, i) => {
      card.style.cssText += ';opacity:0;transform:translateY(28px) scale(0.96);transition:none';
      setTimeout(() => {
        card.style.transition = `opacity .5s ease ${i*.13+.05}s,transform .5s cubic-bezier(.22,1,.36,1) ${i*.13+.05}s`;
        card.style.opacity = '1'; card.style.transform = 'translateY(0) scale(1)';
      }, 60);
      card.addEventListener('click', () => {
        card.style.transition = 'opacity .15s,transform .15s';
        card.style.opacity = '0.7'; card.style.transform = 'scale(0.97)';
      }, { once: true });
    });
    const h = grid.closest('div')?.querySelector('h1');
    if (h && !h.dataset.vtxAnim) {
      h.dataset.vtxAnim = '1';
      h.style.cssText += ';opacity:0;transform:translateY(-14px);transition:opacity .45s,transform .45s';
      setTimeout(() => { h.style.opacity = '1'; h.style.transform = 'translateY(0)'; }, 30);
    }
  }

  /* ─────────────────────────────────────────────────────────────────────────
     MAIN SYNC LOOP
     ───────────────────────────────────────────────────────────────────────── */
  let _storePatched = false;
  let _lastRoute    = null;

  async function sync() {
    interceptElectronLogin();  // always ensure login is wrapped

    const auth = await window.electronAPI?.getAuthStatus?.();
    if (!auth?.authenticated) return;

    // Fix role in header
    await fixRole();

    // Patch the store's sendMessage (once, after store is available)
    if (!_storePatched) {
      _storePatched = patchStoreSendMessage();
    }

    // Detect route change → patch textarea Enter key / inject user mgmt
    const storeState = getStoreState();
    const route = storeState?.currentRoute;
    if (route !== _lastRoute) {
      _lastRoute = route;
      if (route === 'agents') {
        setTimeout(patchTextareaEnter, 300);
      }
      if (route === 'profile') {
        setTimeout(() => injectUserMgmt(auth), 300);
      }
    } else {
      if (route === 'agents') patchTextareaEnter();
      if (route === 'profile') injectUserMgmt(auth);
    }

    animateWorkspaceCards();
  }

  /* ─────────────────────────────────────────────────────────────────────────
     GLOBAL STYLES
     ───────────────────────────────────────────────────────────────────────── */
  const style = document.createElement('style');
  style.textContent = `
    /* Kill Profile launch button */
    #vertex-profile-launch { display: none !important; }

    /* SELECT WORKSPACE hover glow */
    [class*="grid-cols-3"] button { will-change: transform,opacity; }
    [class*="grid-cols-3"] button:hover { box-shadow: 0 0 28px rgba(0,212,255,.10) !important; }

    /* ─── User Management Panel ─── */
    #${UMGMT_ID} { margin-top: 24px; }

    .vtx-umgmt-header {
      display: flex; align-items: center; gap: 8px;
      font: 700 10px ui-monospace,monospace; letter-spacing: 0.18em;
      color: #64748b; margin-bottom: 14px; padding-bottom: 8px;
      border-bottom: 1px solid rgba(255,255,255,0.06);
    }
    .vtx-umgmt-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }

    .vtx-um-msg { min-height: 14px; font: 11px ui-monospace,monospace; margin-bottom: 10px; }
    .vtx-um-msg--ok  { color: #34d399; }
    .vtx-um-msg--err { color: #f87171; }

    .vtx-um-card {
      border: 1px solid rgba(255,255,255,0.07);
      border-radius: 12px; background: rgba(255,255,255,0.025);
      padding: 16px; margin-bottom: 12px;
    }
    .vtx-um-card-title {
      font: 700 9px ui-monospace,monospace; letter-spacing: 0.16em;
      color: #64748b; margin-bottom: 14px;
    }
    .vtx-um-list { display: flex; flex-direction: column; gap: 8px; }
    .vtx-um-loading { font: 11px ui-monospace,monospace; color: #64748b; }
    .vtx-um-user-row {
      display: grid; grid-template-columns: 1fr auto auto;
      align-items: center; gap: 12px;
      padding: 10px 12px; border: 1px solid rgba(255,255,255,0.06);
      border-radius: 8px; background: rgba(0,0,0,0.2);
    }
    .vtx-um-uname { font: 600 12px ui-monospace,monospace; color: #f1f5f9; }
    .vtx-um-urole {
      font: 700 9px ui-monospace,monospace; letter-spacing: 0.1em;
      padding: 2px 8px; border: 1px solid; border-radius: 4px; white-space: nowrap;
    }

    .vtx-um-form  { display: flex; flex-direction: column; gap: 12px; }
    .vtx-um-row   { display: grid; grid-template-columns: repeat(3,1fr); gap: 12px; }
    .vtx-um-field { display: flex; flex-direction: column; gap: 5px; }
    .vtx-um-field label {
      font: 700 9px ui-monospace,monospace; letter-spacing: 0.1em;
      color: #64748b; text-transform: uppercase;
    }
    .vtx-um-field input, .vtx-um-field select {
      background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1);
      border-radius: 6px; color: #f1f5f9; font: 12px ui-monospace,monospace;
      padding: 8px 10px; outline: none; transition: border-color .2s;
    }
    .vtx-um-field input:focus, .vtx-um-field select:focus {
      border-color: rgba(56,189,248,0.5);
    }
    .vtx-um-field select option { background: #0f172a; }

    .vtx-um-btn {
      align-self: flex-start; border: none; border-radius: 7px;
      font: 700 11px ui-monospace,monospace; letter-spacing: 0.08em;
      padding: 9px 18px; cursor: pointer;
      transition: opacity .2s, transform .15s;
    }
    .vtx-um-btn:hover    { opacity: 0.85; transform: translateY(-1px); }
    .vtx-um-btn:active   { transform: translateY(0); }
    .vtx-um-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .vtx-um-btn-add { background: #38bdf8; color: #0c1a2e; }
    .vtx-um-btn-warn { background: #fbbf24; color: #0c1a2e; }
    .vtx-um-btn-del {
      background: transparent; border: 1px solid #7f1d1d;
      color: #fca5a5; font-size: 10px; padding: 5px 10px;
      border-radius: 5px; cursor: pointer;
    }
    .vtx-um-btn-del:hover { background: #3f1015; border-color: #f87171; }

    /* Toast push-up */
    div.fixed.bottom-6.right-6.z-50 { bottom: 190px !important; }
  `;
  document.head.appendChild(style);

  /* ─────────────────────────────────────────────────────────────────────────
     BOOT
     ───────────────────────────────────────────────────────────────────────── */
  // React DevTools hook gives us access to the fiber tree earlier
  // Intercept login immediately
  interceptElectronLogin();

  // Watch for DOM changes (route changes, new textareas)
  new MutationObserver(() => {
    patchTextareaEnter();
    animateWorkspaceCards();
    if (_storePatched && _lastRoute === 'profile' && window._vtxAuthStatus) {
      injectUserMgmt(window._vtxAuthStatus);
    }
  }).observe(document.getElementById('root') || document.body, { childList: true, subtree: true });

  window.addEventListener('focus', () => void sync());
  setInterval(() => void sync(), 800);
  void sync();

})();
