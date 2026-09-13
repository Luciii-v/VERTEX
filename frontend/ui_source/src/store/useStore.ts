import { create } from 'zustand';
import { 
  ScreenRoute, 
  UserRole, 
  SystemMetrics, 
  MCPToolItem, 
  ChatMessage, 
  DocumentItem, 
  ReportItem, 
  AuditLogEntry, 
  AppSettings,
  EmbeddedToolCall
} from '../types';
import { 
  initialMetrics, 
  initialMcpTools, 
  sampleChatMessages, 
  sampleDocuments, 
  sampleReports, 
  sampleAuditLogs, 
  initialSettings 
} from '../data/mockData';

export interface ToastItem {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'error' | 'amber' | 'info';
  timestamp: string;
}

interface AppState {
  // Navigation & User
  currentRoute: ScreenRoute;
  userRole: UserRole;
  userName: string;

  // System State
  metrics: SystemMetrics;
  mcpTools: MCPToolItem[];
  messages: ChatMessage[];
  documents: DocumentItem[];
  reports: ReportItem[];
  auditLogs: AuditLogEntry[];
  settings: AppSettings;
  toasts: ToastItem[];

  // Sidebars Collapse
  isLeftSidebarOpen: boolean;
  isRightSidebarOpen: boolean;

  // Actions
  setRoute: (route: ScreenRoute) => void;
  setUserName: (name: string) => void;
  setUserRole: (role: string) => void;
  toggleLeftSidebar: () => void;
  toggleRightSidebar: () => void;
  toggleMcpTool: (id: string) => void;
  toggleTheme: () => void;
  
  // Chat Actions
  sendMessage: (content: string, attachments?: File[]) => void;
  approveAction: (approvalId: string) => void;
  denyAction: (approvalId: string) => void;
  clearChat: () => void;

  // Document & Report Actions
  addDocument: (doc: Omit<DocumentItem, 'id' | 'uploadDate' | 'status'>) => void;
  deleteDocument: (id: string) => void;
  generateReport: (title: string, type: 'PDF' | 'Excel' | 'Word', department: 'Maintenance' | 'Engineering' | 'Operations') => void;

  // Settings Actions
  updateSettings: (newSettings: Partial<AppSettings>) => void;

  // Toast Actions
  addToast: (title: string, message: string, type?: 'success' | 'error' | 'amber' | 'info') => void;
  removeToast: (id: string) => void;
  appendAuditLog: (entry: AuditLogEntry) => void;
}

export const useStore = create<AppState>((set, get) => ({
  currentRoute: 'dashboard',
  userRole: 'ENGINEER',
  userName: 'ENGINEER [L2]',

  metrics: initialMetrics,
  mcpTools: initialMcpTools,
  messages: sampleChatMessages,
  documents: sampleDocuments,
  reports: sampleReports,
  auditLogs: sampleAuditLogs,
  settings: initialSettings,
  toasts: [
    {
      id: 'toast-init',
      title: 'SOVEREIGN SYSTEM ACTIVE',
      message: 'Air-Gap Cluster online. QWEN3.5-9B sovereign system ready.',
      type: 'success',
      timestamp: new Date().toLocaleTimeString(),
    }
  ],

  isLeftSidebarOpen: true,
  isRightSidebarOpen: true,

  setRoute: (route) => set({ currentRoute: route }),
  setUserName: (name) => set({ userName: name }),
  setUserRole: (role) => set({ userRole: role as any }),
  toggleLeftSidebar: () => set((state) => ({ isLeftSidebarOpen: !state.isLeftSidebarOpen })),
  toggleRightSidebar: () => set((state) => ({ isRightSidebarOpen: !state.isRightSidebarOpen })),
  toggleTheme: () => set((state) => ({ settings: { ...state.settings, theme: state.settings.theme === 'dark' ? 'light' : 'dark' } })),

  toggleMcpTool: (id) => {
    set((state) => {
      const updatedTools = state.mcpTools.map((t) => {
        if (t.id === id) {
          const isCategoryMcp = t.category === 'MCP';
          const nextStatus = isCategoryMcp 
            ? (t.status === 'ONLINE' ? 'OFFLINE' : 'ONLINE')
            : (t.status === 'ENABLED' ? 'DISABLED' : 'ENABLED');
          return { ...t, status: nextStatus as any };
        }
        return t;
      });

      const toggledTool = updatedTools.find((t) => t.id === id);
      const actionDetails = `${toggledTool?.name} status changed to ${toggledTool?.status}`;
      
      // Log to audit
      const newAudit: AuditLogEntry = {
        id: `aud-${Date.now()}`,
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
        user: state.userName,
        action: 'TOOL_TOGGLE',
        tool: toggledTool?.name || 'MCP System',
        details: actionDetails,
        status: 'SUCCESS',
        ipAddress: '127.0.0.1 (LOCAL)',
        severity: 'INFO',
      };

      return {
        mcpTools: updatedTools,
        auditLogs: [newAudit, ...state.auditLogs],
      };
    });
  },

  sendMessage: async (content, attachments) => {
    if (!content.trim() && (!attachments || attachments.length === 0)) return;

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const userMsgId = `msg-user-${Date.now()}`;
    const attachmentNote = attachments && attachments.length > 0
      ? `\n\n*[Attached: ${attachments.map(f => f.name).join(', ')}]*`
      : '';
    
    const fullQuery = content + attachmentNote;

    const userMessage: ChatMessage = {
      id: userMsgId,
      sender: 'user',
      content: fullQuery,
      timestamp: timeStr,
    };

    const auditUserMsg: AuditLogEntry = {
      id: `aud-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      user: get().userName,
      action: 'PROMPT_SUBMITTED',
      tool: 'Agent Console',
      details: `Submitted prompt: "${content.substring(0, 45)}..."`,
      status: 'SUCCESS',
      ipAddress: '127.0.0.1 (LOCAL)',
      severity: 'INFO',
    };

    set((state) => ({
      messages: [...state.messages, userMessage],
      auditLogs: [auditUserMsg, ...state.auditLogs]
    }));

    const agentMsgId = `msg-agent-${Date.now()}`;
    const agentMessagePlaceholder: ChatMessage = {
      id: agentMsgId,
      sender: 'agent',
      content: 'Initializing inference...',
      timestamp: timeStr,
      isStreaming: true,
      progressPercent: 15,
      progressSubStep: 'Starting...',
    };

    set((state) => ({
      messages: [...state.messages, agentMessagePlaceholder],
    }));

    try {
      let authUsername = get().userName;
      let authRole = "engineer";
      try {
        if (window.electronAPI) {
          const status = (await window.electronAPI.getAuthStatus()) as any;
          if (status.authenticated) {
            authUsername = status.username || "operator";
            authRole = status.role;
          }
        }
      } catch (e) {}

      const res = await fetch("http://127.0.0.1:8000/investigate", {
          method: "POST",
          headers: {
              "Content-Type": "application/json",
              "X-User": authUsername,
              "X-Role": authRole
          },
          body: JSON.stringify({ query: fullQuery })
      });
      const reader = res.body!.getReader();
      const decoder = new TextDecoder("utf-8");
      let logs = "";
      let finalAnswer: string | null = null;
      let buffer = "";

      while (true) {
          const { value, done } = await reader.read();
          if (done) {
              if (buffer.trim()) {
                  try {
                      const parsed = JSON.parse(buffer.replace(/^data: /, "").trim());
                      if (parsed.type === "result") finalAnswer = parsed.content;
                  } catch (e) {}
              }
              break;
          }
          
          buffer += decoder.decode(value, { stream: true });
          let parts = buffer.split("\n");
          buffer = parts.pop() || "";
          
          for (let part of parts) {
              if (!part.startsWith("data: ")) continue;
              const jsonStr = part.replace("data: ", "").trim();
              if (!jsonStr) continue;
              
              try {
                  const data = JSON.parse(jsonStr);
                  if (data.type === "log") {
                      logs += data.content;
                      let progressPercent = 15;
                      let progressSubStep = "Processing...";
                      
                      if (logs.includes("[1/3] PLANNER PHASE")) {
                          progressPercent = 33;
                          progressSubStep = "Phase 1: Planning";
                      }
                      if (logs.includes("[2/3] RESEARCHER PHASE")) {
                          progressPercent = 66;
                          progressSubStep = "Phase 2: Researching";
                      }
                      if (logs.includes("[3/3] WRITER PHASE")) {
                          progressPercent = 90;
                          progressSubStep = "Phase 3: Writing";
                      }
                      
                      set((state) => ({
                          messages: state.messages.map((m) => {
                              if (m.id === agentMsgId) {
                                  return { 
                                      ...m, 
                                      content: `**Thinking...**\n\`\`\`text\n${logs}\n\`\`\``,
                                      progressPercent,
                                      progressSubStep
                                  };
                              }
                              return m;
                          })
                      }));
                  } else if (data.type === "result") {
                      finalAnswer = data.content;
                  }
              } catch (e) {
                  console.error("SSE parse error on chunk", jsonStr);
              }
          }
      }

      set((state) => ({
          messages: state.messages.map((m) => {
              if (m.id === agentMsgId) {
                  if (finalAnswer !== null) {
                      return { ...m, isStreaming: false, content: finalAnswer, progressPercent: 100, progressSubStep: 'Complete' };
                  } else {
                      return { ...m, isStreaming: false, content: `**Error/Thinking...**\n\`\`\`text\n${logs}\n\`\`\``, progressPercent: 100, progressSubStep: 'Complete' };
                  }
              }
              return m;
          })
      }));

    } catch (e) {
      set((state) => ({
          messages: state.messages.map((m) => {
              if (m.id === agentMsgId) {
                  return { ...m, isStreaming: false, content: "Error connecting to backend.", progressPercent: 0, progressSubStep: 'Failed' };
              }
              return m;
          })
      }));
    }
  },

  approveAction: (approvalId) => {
    set((state) => {
      let approvedActionText = '';
      const updatedMessages = state.messages.map((msg) => {
        if (msg.approvalRequest && msg.approvalRequest.id === approvalId) {
          approvedActionText = msg.approvalRequest.action;
          return {
            ...msg,
            approvalRequest: {
              ...msg.approvalRequest,
              status: 'APPROVED' as const,
            }
          };
        }
        return msg;
      });

      const timeStr = new Date().toISOString().replace('T', ' ').substring(0, 19);

      // Create new report if it was a report approval
      const newReport: ReportItem = {
        id: `rep-${Date.now()}`,
        title: approvedActionText || 'Approved Diagnostic Report',
        type: 'PDF',
        date: new Date().toISOString().split('T')[0],
        status: 'FINAL',
        pages: 12,
        author: `${state.userName} / VERTEX`,
        department: 'Maintenance',
        fileSize: '4.1 MB',
        summary: 'Generated following autonomous agent investigation approval.',
      };

      const auditEntry: AuditLogEntry = {
        id: `aud-${Date.now()}`,
        timestamp: timeStr,
        user: state.userName,
        action: 'APPROVAL_GRANTED',
        tool: 'Approval System',
        details: `APPROVED action: ${approvedActionText}`,
        status: 'SUCCESS',
        ipAddress: '127.0.0.1 (LOCAL)',
        severity: 'INFO',
      };

      return {
        messages: updatedMessages,
        reports: [newReport, ...state.reports],
        auditLogs: [auditEntry, ...state.auditLogs],
      };
    });

    get().addToast('ACTION APPROVED', 'Task execution and document compilation authorized.', 'success');
  },

  denyAction: (approvalId) => {
    set((state) => {
      let deniedActionText = '';
      const updatedMessages = state.messages.map((msg) => {
        if (msg.approvalRequest && msg.approvalRequest.id === approvalId) {
          deniedActionText = msg.approvalRequest.action;
          return {
            ...msg,
            approvalRequest: {
              ...msg.approvalRequest,
              status: 'DENIED' as const,
            }
          };
        }
        return msg;
      });

      const auditEntry: AuditLogEntry = {
        id: `aud-${Date.now()}`,
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
        user: state.userName,
        action: 'APPROVAL_DENIED',
        tool: 'Approval System',
        details: `DENIED action: ${deniedActionText}`,
        status: 'BLOCKED',
        ipAddress: '127.0.0.1 (LOCAL)',
        severity: 'WARNING',
      };

      return {
        messages: updatedMessages,
        auditLogs: [auditEntry, ...state.auditLogs],
      };
    });

    get().addToast('ACTION DENIED', 'Execution halted by engineer directive.', 'amber');
  },

  clearChat: () => {
    set({ messages: [] });
    get().addToast('CONSOLE CLEARED', 'Chat history purged from memory buffer.', 'info');
  },

  addDocument: (docData) => {
    const newDoc: DocumentItem = {
      ...docData,
      id: `doc-${Date.now()}`,
      uploadDate: new Date().toISOString().split('T')[0],
      status: 'INDEXED [OK]',
    };

    set((state) => ({
      documents: [newDoc, ...state.documents],
      auditLogs: [
        {
          id: `aud-${Date.now()}`,
          timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
          user: state.userName,
          action: 'DOCUMENT_UPLOAD',
          tool: 'Filesystem MCP',
          details: `Ingested document: ${newDoc.fileName} (${newDoc.fileSize})`,
          status: 'SUCCESS',
          ipAddress: '127.0.0.1 (LOCAL)',
          severity: 'INFO',
        },
        ...state.auditLogs
      ]
    }));

    get().addToast('DOCUMENT INGESTED', `${newDoc.fileName} parsed and indexed into vector DB.`, 'success');
  },

  deleteDocument: (id) => {
    set((state) => {
      const target = state.documents.find(d => d.id === id);
      return {
        documents: state.documents.filter(d => d.id !== id),
        auditLogs: [
          {
            id: `aud-${Date.now()}`,
            timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
            user: state.userName,
            action: 'DOCUMENT_DELETE',
            tool: 'Filesystem MCP',
            details: `Removed document: ${target?.fileName || id}`,
            status: 'SUCCESS',
            ipAddress: '127.0.0.1 (LOCAL)',
            severity: 'INFO',
          },
          ...state.auditLogs
        ]
      };
    });

    get().addToast('DOCUMENT DELETED', 'Item purged from index.', 'info');
  },

  generateReport: (title, type, department) => {
    const newRep: ReportItem = {
      id: `rep-${Date.now()}`,
      title,
      type,
      date: new Date().toISOString().split('T')[0],
      status: 'FINAL',
      pages: Math.floor(Math.random() * 8) + 4,
      author: `${get().userName} / VERTEX`,
      department,
      fileSize: `${(Math.random() * 3 + 1.5).toFixed(1)} MB`,
      summary: `Automated ${type} report compiled for ${department} department.`,
    };

    set((state) => ({
      reports: [newRep, ...state.reports],
      auditLogs: [
        {
          id: `aud-${Date.now()}`,
          timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
          user: state.userName,
          action: 'REPORT_GENERATED',
          tool: 'Report Builder',
          details: `Compiled ${type} report: ${title}`,
          status: 'SUCCESS',
          ipAddress: '127.0.0.1 (LOCAL)',
          severity: 'INFO',
        },
        ...state.auditLogs
      ]
    }));

    get().addToast('REPORT GENERATED', `Report "${title}" compiled successfully (${type}).`, 'success');
  },

  updateSettings: (newSettings) => {
    set((state) => ({
      settings: { ...state.settings, ...newSettings },
      auditLogs: [
        {
          id: `aud-${Date.now()}`,
          timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
          user: state.userName,
          action: 'SETTINGS_UPDATE',
          tool: 'Settings System',
          details: `Updated preferences: ${Object.keys(newSettings).join(', ')}`,
          status: 'SUCCESS',
          ipAddress: '127.0.0.1 (LOCAL)',
          severity: 'INFO',
        },
        ...state.auditLogs
      ]
    }));

    get().addToast('SETTINGS SAVED', 'System parameters updated successfully.', 'success');
  },

  addToast: (title, message, type = 'success') => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    const timestamp = new Date().toLocaleTimeString();

    set((state) => ({
      toasts: [...state.toasts, { id, title, message, type, timestamp }],
    }));

    // Auto dismiss toast after 4 seconds
    setTimeout(() => {
      get().removeToast(id);
    }, 4000);
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },

  appendAuditLog: (entry) => set((state) => ({ auditLogs: [entry, ...state.auditLogs] })),
}));
