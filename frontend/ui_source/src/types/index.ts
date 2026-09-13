export type ScreenRoute = 'dashboard' | 'agents' | 'documents' | 'reports' | 'audit' | 'settings' | 'profile' | 'orchestrator';
export type UserRole = 'OPERATOR' | 'ENGINEER' | 'ADMIN';
export type AppTheme = 'dark' | 'light';

export interface SystemMetrics {
  gpuModel: string;
  vramUsedGB: number;
  vramTotalGB: number;
  gpuTempCelsius: number;
  gpuStatus: 'HEALTHY' | 'WARNING' | 'CRITICAL';
  airGapCalls24h: number;
  airGapStatus: 'LOCKED' | 'WARNING' | 'UNLOCKED';
  lastTaskName: string;
  lastTaskTimestamp: string;
  lastTaskStatus: 'COMPLETED' | 'IN_PROGRESS' | 'FAILED';
}

export interface MCPToolItem {
  id: string;
  name: string;
  description: string;
  category: 'MCP' | 'PLUGIN';
  status: 'ONLINE' | 'OFFLINE' | 'ENABLED' | 'DISABLED';
  icon: string;
}

export interface EmbeddedToolCall {
  id: string;
  type: 'file_retrieval' | 'chart_generation' | 'pid_analysis' | 'database_query';
  title: string;
  subtitle?: string;
  previewUrl?: string;
  details?: Record<string, string>;
  status: 'SUCCESS' | 'PENDING' | 'FAILED';
  timestamp: string;
}

export interface ApprovalRequest {
  id: string;
  action: string;
  includes: string[];
  requestedBy: string;
  timestamp: string;
  status: 'PENDING' | 'APPROVED' | 'DENIED';
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'agent' | 'system';
  content: string;
  timestamp: string;
  toolCalls?: EmbeddedToolCall[];
  approvalRequest?: ApprovalRequest;
  isStreaming?: boolean;
  progressPercent?: number;
  progressSubStep?: string;
}

export interface DocumentItem {
  id: string;
  title: string;
  fileName: string;
  category: 'SOP' | 'P&ID' | 'Manual' | 'Work Order' | 'Report';
  uploadDate: string;
  fileSize: string;
  tags: string[];
  status: 'INDEXED [OK]' | 'PENDING OCR' | 'FAILED';
  thumbnailUrl?: string;
  contentPreview?: string;
}

export interface ReportItem {
  id: string;
  title: string;
  type: 'PDF' | 'Excel' | 'Word';
  date: string;
  status: 'FINAL' | 'DRAFT' | 'REVIEW';
  pages: number;
  author: string;
  department: 'Maintenance' | 'Engineering' | 'Operations';
  fileSize: string;
  summary: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  tool: string;
  details: string;
  status: 'SUCCESS' | 'BLOCKED' | 'REQUIRES_APPROVAL' | 'FAILED';
  ipAddress: string;
  severity: 'INFO' | 'WARNING' | 'ALERT';
}

export interface AppSettings {
  // Model & Performance
  currentModel: string;
  temperature: number;
  maxTokens: number;
  contextWindow: string;

  // Chat Behavior
  systemPrompt: string;
  responseStyle: 'Concise' | 'Detailed' | 'Technical';
  autoApproveRead: boolean;
  requireApprovalWrite: boolean;
  showToolCalls: boolean;
  streamResponses: boolean;

  // Document Panels
  defaultExportFormat: 'PDF' | 'Excel' | 'Word';
  includeExecutiveSummary: boolean;
  includeCharts: boolean;
  includeDataTables: boolean;
  includeReferences: boolean;
  reportTemplate: string;

  // Security & Access
  airGapMode: boolean;
  auditRetentionDays: number;
  rbacRoles: {
    role: UserRole;
    canExecuteTools: boolean;
    canApproveWrites: boolean;
    canExportData: boolean;
  }[];

  // Visuals
  enableCrtOverlay: boolean;
  theme: AppTheme;
}
