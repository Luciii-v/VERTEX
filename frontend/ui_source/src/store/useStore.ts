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
      message: 'Air-Gap Cluster online. QWEN3.5-9B ready on 16GB VRAM.',
      type: 'success',
      timestamp: new Date().toLocaleTimeString(),
    }
  ],

  isLeftSidebarOpen: true,
  isRightSidebarOpen: true,

  setRoute: (route) => set({ currentRoute: route }),
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

  sendMessage: (content, attachments) => {
    if (!content.trim() && (!attachments || attachments.length === 0)) return;

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const userMsgId = `msg-user-${Date.now()}`;

    const attachmentNote = attachments && attachments.length > 0
      ? `\n\n*[Attached: ${attachments.map(f => f.name).join(', ')}]*`
      : '';

    const userMessage: ChatMessage = {
      id: userMsgId,
      sender: 'user',
      content: content + attachmentNote,
      timestamp: timeStr,
    };

    set((state) => ({
      messages: [...state.messages, userMessage],
    }));

    // Add audit log for user prompt
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

    set((state) => ({ auditLogs: [auditUserMsg, ...state.auditLogs] }));

    // Simulate Agent autonomous response with progress bar and tool executions
    const agentMsgId = `msg-agent-${Date.now()}`;
    const agentMessagePlaceholder: ChatMessage = {
      id: agentMsgId,
      sender: 'agent',
      content: 'Initializing sovereign agent inference engine...',
      timestamp: timeStr,
      isStreaming: true,
      progressPercent: 15,
      progressSubStep: 'Querying Filesystem MCP & P&ID Analyzer...',
    };

    set((state) => ({
      messages: [...state.messages, agentMessagePlaceholder],
    }));

    // Step 1: 1 second in - update progress
    setTimeout(() => {
      set((state) => ({
        messages: state.messages.map((m) => {
          if (m.id === agentMsgId) {
            return {
              ...m,
              progressPercent: 55,
              progressSubStep: 'Parsing telemetry tags & generating frequency graph...',
            };
          }
          return m;
        })
      }));
    }, 900);

    // Step 2: 2 seconds in - complete response with tool calls
    setTimeout(() => {
      const isQueryingPump = content.toLowerCase().includes('pump') || content.toLowerCase().includes('p-102') || content.toLowerCase().includes('vibration');
      const isQueryingHeatEx = content.toLowerCase().includes('heat') || content.toLowerCase().includes('exchanger') || content.toLowerCase().includes('e-101');
      
      let responseText = '';
      let toolCalls: EmbeddedToolCall[] = [];
      let approvalReq = undefined;

      if (isQueryingHeatEx) {
        responseText = `### Sovereign Diagnostic Analysis: Heat Exchanger E-101

**Telemetry Summary:**
- Shell Inlet Temp: **210°C** | Outlet Temp: **168°C**
- Tube Delta P: **1.4 bar** (0.4 bar above baseline rating)
- Overall Heat Transfer Coefficient (U): **420 W/m²·K** (Degraded by 12.5%)

**Root Cause Hypothesis:**
Heavy crude asphaltic deposition on tube surfaces resulting in thermal resistance buildup.

**Action Plan:**
1. Execute backwashing procedure on line #12-CDU-402.
2. Prepare online anti-fouling chemical injection program.`;

        toolCalls = [
          {
            id: `tc-e101-1`,
            type: 'file_retrieval',
            title: 'Retrieved: E-101_THERMAL_LOG_2026.PDF',
            subtitle: 'Infrared scan confirmed 8% fouling index',
            status: 'SUCCESS',
            timestamp: timeStr,
          },
          {
            id: `tc-e101-2`,
            type: 'chart_generation',
            title: 'Generated: heat_transfer_u_coefficient.png',
            subtitle: 'U-Value decline trend plotted over last 30 days',
            status: 'SUCCESS',
            timestamp: timeStr,
          }
        ];

        approvalReq = {
          id: `appr-${Date.now()}`,
          action: 'Approve online chemical injection dosage increment (+5 ppm)',
          includes: ['E-101 thermal calculation sheet', 'Chemical compatibility matrix'],
          requestedBy: 'VERTEX AGENT [PROCESS ADVISOR]',
          timestamp: timeStr,
          status: 'PENDING' as const,
          riskLevel: 'MEDIUM' as const,
        };
      } else {
        responseText = `### Sovereign Diagnostic Response

I have analyzed your query **"${content}"** against the on-premise refinery knowledge base.

**Execution Details:**
- Searched 8 indexed P&IDs and SOP documents via **Filesystem MCP**.
- Queried historian sensor telemetry via **Postgres MCP**.
- Local **QWEN3.5-9B** model inference completed in 1.4 seconds with zero external network connectivity (Air-Gap enforced).

**Diagnostic Summary:**
All system operating parameters for the requested unit are within normal operational envelopes (Green status). No critical alarms or cavitation harmonics were detected in the active telemetry stream.`;

        toolCalls = [
          {
            id: `tc-gen-1`,
            type: 'database_query',
            title: 'Queried Postgres MCP: sensor_telemetry_5m',
            subtitle: '48 records retrieved, status [NORMAL]',
            status: 'SUCCESS',
            timestamp: timeStr,
          }
        ];
      }

      set((state) => ({
        messages: state.messages.map((m) => {
          if (m.id === agentMsgId) {
            return {
              ...m,
              content: responseText,
              isStreaming: false,
              progressPercent: undefined,
              progressSubStep: undefined,
              toolCalls: toolCalls,
              approvalRequest: approvalReq,
            };
          }
          return m;
        })
      }));

      // Add to audit log
      const auditAgentMsg: AuditLogEntry = {
        id: `aud-${Date.now()}`,
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
        user: 'VERTEX AGENT',
        action: 'MODEL_INFERENCE',
        tool: 'QWEN3.5-9B',
        details: `Generated autonomous diagnostic response (${toolCalls.length} tools executed)`,
        status: 'SUCCESS',
        ipAddress: '127.0.0.1 (LOCAL)',
        severity: 'INFO',
      };
      set((state) => ({ auditLogs: [auditAgentMsg, ...state.auditLogs] }));

    }, 2000);
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
