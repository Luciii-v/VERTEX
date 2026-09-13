import { 
  SystemMetrics, 
  MCPToolItem, 
  ChatMessage, 
  DocumentItem, 
  ReportItem, 
  AuditLogEntry, 
  AppSettings 
} from '../types';

export const initialMetrics: SystemMetrics = {
  gpuModel: 'QWEN3.5-9B (Q4_K_M)',
  vramUsedGB: 6.8,
  vramTotalGB: 16.0,
  gpuTempCelsius: 52,
  gpuStatus: 'HEALTHY',
  airGapCalls24h: 0,
  airGapStatus: 'LOCKED',
  lastTaskName: 'P-102A VIBRATION ANALYSIS',
  lastTaskTimestamp: '2026-09-02 12:15:00',
  lastTaskStatus: 'COMPLETED',
};

export const initialMcpTools: MCPToolItem[] = [
  { id: 'mcp-fs', name: 'Filesystem MCP', description: 'Local industrial document store', category: 'MCP', status: 'ONLINE', icon: 'Folder' },
  { id: 'mcp-pg', name: 'Postgres MCP', description: 'Refinery historian telemetry DB', category: 'MCP', status: 'ONLINE', icon: 'Database' },
  { id: 'mcp-mem0', name: 'Mem0 (Memory)', description: 'Long-term contextual agent memory', category: 'MCP', status: 'ONLINE', icon: 'Brain' },
  { id: 'mcp-cmd', name: 'Desktop Commander', description: 'Local OS shell & process executor', category: 'MCP', status: 'ONLINE', icon: 'Terminal' },
  { id: 'mcp-ctx7', name: 'Context7', description: 'Code & schema parser for industrial logic', category: 'MCP', status: 'ONLINE', icon: 'Cpu' },
  { id: 'plugin-doc', name: 'Document Parser', description: 'OCR & structure extraction for PDFs', category: 'PLUGIN', status: 'ENABLED', icon: 'FileText' },
  { id: 'plugin-pid', name: 'P&ID Analyzer', description: 'Vector schematic circuit matching', category: 'PLUGIN', status: 'ENABLED', icon: 'GitBranch' },
  { id: 'plugin-chart', name: 'Chart Generator', description: 'High-precision telemetry graphing', category: 'PLUGIN', status: 'ENABLED', icon: 'BarChart2' },
  { id: 'plugin-rep', name: 'Report Builder', description: 'Enterprise PDF/Docx generation engine', category: 'PLUGIN', status: 'ENABLED', icon: 'Layers' },
];

export const sampleChatMessages: ChatMessage[] = [
  {
    id: 'msg-1',
    sender: 'user',
    content: 'Initiate diagnostic scan on Crude Distillation Unit pump P-102A. Check recent vibration spikes and cross-reference with SOP-402 and heat exchanger E-101 flow rates.',
    timestamp: '14:02:10',
  },
  {
    id: 'msg-2',
    sender: 'agent',
    content: `[AGENT TASK INITIALIZED: SOVEREIGN REFINERY DIAGNOSTICS]

I am executing a parallel query across the local historian DB, document memory store, and P&ID schematic index for **Pump P-102A**.

### Step 1: Document & Data Retrieval
- Ingested **SOP-402_PUMP_MAINTENANCE.PDF**
- Querying historian telemetry for vibration sensors **VS-102A-1 (Radial)** & **VS-102A-2 (Axial)** over the last 24 hours.`,
    timestamp: '14:02:14',
    toolCalls: [
      {
        id: 'tc-1',
        type: 'file_retrieval',
        title: 'Retrieved: P-102A_DATASHEET.PDF',
        subtitle: 'Manufacturer: Sulzer | Rating: 450 GPM @ 120 PSI',
        status: 'SUCCESS',
        timestamp: '14:02:12',
      },
      {
        id: 'tc-2',
        type: 'chart_generation',
        title: 'Generated: vibration_spectrum_p102a.png',
        subtitle: 'Peak spike detected at 3.4 mm/s RMS (Threshold: 2.5 mm/s)',
        status: 'SUCCESS',
        timestamp: '14:02:13',
      }
    ]
  },
  {
    id: 'msg-3',
    sender: 'agent',
    content: `### Step 2: Schematic & Circuit Cross-Reference
Analyzing **P&ID Drawing DWG-CDU-0104**. The pump P-102A suction line connects directly from Desalter D-101 with a branch bypass to Heat Exchanger E-101.

**Diagnostic Findings:**
1. **Cavitation Risk**: Suction pressure dropped to 1.1 bar at 11:30 AM, coinciding with a 15% valve closure on CV-104.
2. **Bearing wear probability**: 78% confidence level based on FFT spectrum harmonics at 2x running speed (118 Hz).
3. **Recommended Action**: Throttle bypass valve V-102B by 10% and switch standby unit P-102B into service for inspection.`,
    timestamp: '14:02:22',
    toolCalls: [
      {
        id: 'tc-3',
        type: 'pid_analysis',
        title: 'Analyzed P&ID: Identified P-102A circuit line #10-CDU-201',
        subtitle: 'Detected bypass valve V-102B throttling anomaly',
        status: 'SUCCESS',
        timestamp: '14:02:20',
      }
    ],
    approvalRequest: {
      id: 'appr-901',
      action: 'Generate PDF report (12 pages) & queue work order draft WO-8842',
      includes: ['P&ID excerpt DWG-CDU-0104', 'Vibration FFT charts', 'SOP-402 compliance check', 'Operations recommendations'],
      requestedBy: 'VERTEX AGENT [AUTONOMOUS ENGINE]',
      timestamp: '14:02:22',
      status: 'PENDING',
      riskLevel: 'MEDIUM',
    }
  }
];

export const sampleDocuments: DocumentItem[] = [
  {
    id: 'doc-1',
    title: 'P-102A Centrifugal Pump Datasheet & Manual',
    fileName: 'P-102A_DATASHEET.PDF',
    category: 'Manual',
    uploadDate: '2026-08-28',
    fileSize: '4.2 MB',
    tags: ['P-102A', 'CDU', 'Pump', 'Sulzer'],
    status: 'INDEXED [OK]',
    contentPreview: 'Sulzer Process Pump Model HPH 100-300. Max operating temperature: 280°C. Bearing lubrication type: Synthetic ISO VG 68.',
  },
  {
    id: 'doc-2',
    title: 'CDU-II Process Flow Schematic Diagram',
    fileName: 'DWG-CDU-0104_REV4.DWG',
    category: 'P&ID',
    uploadDate: '2026-08-25',
    fileSize: '18.5 MB',
    tags: ['P&ID', 'CDU-II', 'Schematic', 'Desalter'],
    status: 'INDEXED [OK]',
    contentPreview: 'Piping & Instrumentation Diagram for Crude Distillation Unit II. Line 10-CDU-201-A1. Valve configuration CV-104 and V-102B.',
  },
  {
    id: 'doc-3',
    title: 'Standard Operating Procedure: High Vibration Protocol',
    fileName: 'SOP-402_PUMP_MAINTENANCE.PDF',
    category: 'SOP',
    uploadDate: '2026-08-15',
    fileSize: '1.8 MB',
    tags: ['SOP', 'Vibration', 'Maintenance', 'Safety'],
    status: 'INDEXED [OK]',
    contentPreview: 'Procedure for handling centrifugal pump vibration exceeding 3.0 mm/s. Step 1: Verify suction strainers. Step 2: Switch to standby pump.',
  },
  {
    id: 'doc-4',
    title: 'Heat Exchanger E-101 Thermal Inspection Log',
    fileName: 'E-101_THERMAL_LOG_2026.PDF',
    category: 'Report',
    uploadDate: '2026-08-30',
    fileSize: '3.1 MB',
    tags: ['E-101', 'Heat Exchanger', 'Thermal', 'Fouling'],
    status: 'INDEXED [OK]',
    contentPreview: 'Infrared thermography scan indicates 8% thermal resistance increase due to crude fouling on shell side tubes.',
  },
  {
    id: 'doc-5',
    title: 'Emergency Shutdown Valves (ESD) Testing Procedure',
    fileName: 'SOP-808_ESD_VALVES.PDF',
    category: 'SOP',
    uploadDate: '2026-07-20',
    fileSize: '2.4 MB',
    tags: ['ESD', 'Safety', 'Valves', 'SOP'],
    status: 'INDEXED [OK]',
    contentPreview: 'Quarterly proof testing requirements for ESD-101, ESD-102, and ESD-103 pneumatically actuated ball valves.',
  },
  {
    id: 'doc-6',
    title: 'Work Order WO-8790: Flange Replacement CDU-104',
    fileName: 'WO-8790_FLANGE_REPLACEMENT.DOCX',
    category: 'Work Order',
    uploadDate: '2026-09-01',
    fileSize: '850 KB',
    tags: ['Work Order', 'Flange', 'CDU-104', 'Maintenance'],
    status: 'INDEXED [OK]',
    contentPreview: 'Replaced 12-inch Class 300 RTJ gasket on crude inlet manifold. Torque applied: 350 ft-lbs.',
  },
  {
    id: 'doc-7',
    title: 'FCCU Catalyst Regeneration Telemetry Log',
    fileName: 'FCCU_CATALYST_LOG_AUG26.XLSX',
    category: 'Report',
    uploadDate: '2026-09-01',
    fileSize: '5.6 MB',
    tags: ['FCCU', 'Catalyst', 'Telemetry', 'Excel'],
    status: 'PENDING OCR',
    contentPreview: 'Hourly delta P measurements across catalyst bed and regenerator flue gas analyzer data.',
  },
  {
    id: 'doc-8',
    title: 'MRPL Refinery Site Air-Gap Security Audit 2026',
    fileName: 'MRPL_AIRGAP_SECURITY_REPORT.PDF',
    category: 'Report',
    uploadDate: '2026-08-10',
    fileSize: '7.2 MB',
    tags: ['Security', 'Air-Gap', 'MRPL', 'Compliance'],
    status: 'INDEXED [OK]',
    contentPreview: 'Zero outbound socket attempts logged over 365 calendar days. Sovereign on-premise AI cluster validated.',
  }
];

export const sampleReports: ReportItem[] = [
  {
    id: 'rep-101',
    title: 'P-102A Comprehensive Vibration & Failure Diagnosis',
    type: 'PDF',
    date: '2026-09-02',
    status: 'FINAL',
    pages: 12,
    author: 'VERTEX AGENT [L2 AUTONOMOUS]',
    department: 'Maintenance',
    fileSize: '3.4 MB',
    summary: 'Detailed root-cause analysis of pump P-102A bearing cavitation and suction pressure anomalies with P&ID line diagrams and FFT frequency charts.',
  },
  {
    id: 'rep-102',
    title: 'CDU-II Heat Exchanger Efficiency & Fouling Matrix',
    type: 'Excel',
    date: '2026-09-01',
    status: 'FINAL',
    pages: 4,
    author: 'ENGINEER [L2] / VERTEX',
    department: 'Engineering',
    fileSize: '1.9 MB',
    summary: 'Thermal transfer coefficient trends across E-101 through E-108 heat exchangers over Q3 2026.',
  },
  {
    id: 'rep-103',
    title: 'Refinery Daily Integrity Telemetry & Risk Assessment',
    type: 'PDF',
    date: '2026-09-02',
    status: 'FINAL',
    pages: 8,
    author: 'VERTEX AGENT [AUTONOMOUS ENGINE]',
    department: 'Operations',
    fileSize: '2.8 MB',
    summary: 'Automated morning synthesis of 1,420 sensor tags across CDU, VDU, FCCU, and Hydrocracker units.',
  },
  {
    id: 'rep-104',
    title: 'Work Order Recommendation WO-8842: Pump P-102A Maintenance',
    type: 'Word',
    date: '2026-09-02',
    status: 'DRAFT',
    pages: 3,
    author: 'VERTEX AGENT [L2 AUTONOMOUS]',
    department: 'Maintenance',
    fileSize: '620 KB',
    summary: 'Draft work order specifying mechanical seal replacement, suction strainer cleaning, and laser alignment for P-102A.',
  },
  {
    id: 'rep-105',
    title: 'MRPL SIH 26117 Sovereign Air-Gap Compliance Certificate',
    type: 'PDF',
    date: '2026-08-30',
    status: 'FINAL',
    pages: 5,
    author: 'CHIEF SECURITY OFFICER',
    department: 'Engineering',
    fileSize: '1.2 MB',
    summary: 'Sovereignty verification document confirming 100% on-premise inference with zero external network connectivity.',
  }
];

export const sampleAuditLogs: AuditLogEntry[] = [
  { id: 'aud-001', timestamp: '2026-09-02 14:02:22', user: 'VERTEX AGENT', action: 'APPROVAL_REQUESTED', tool: 'Report Builder', details: 'Requested approval for PDF Report (12 pages) WO-8842', status: 'REQUIRES_APPROVAL', ipAddress: '127.0.0.1 (LOCAL)', severity: 'WARNING' },
  { id: 'aud-002', timestamp: '2026-09-02 14:02:20', user: 'VERTEX AGENT', action: 'TOOL_EXECUTION', tool: 'P&ID Analyzer', details: 'Parsed vector schematic DWG-CDU-0104 for line #10-CDU-201', status: 'SUCCESS', ipAddress: '127.0.0.1 (LOCAL)', severity: 'INFO' },
  { id: 'aud-003', timestamp: '2026-09-02 14:02:13', user: 'VERTEX AGENT', action: 'TOOL_EXECUTION', tool: 'Chart Generator', details: 'Rendered vibration FFT spectrum chart for P-102A', status: 'SUCCESS', ipAddress: '127.0.0.1 (LOCAL)', severity: 'INFO' },
  { id: 'aud-004', timestamp: '2026-09-02 14:02:12', user: 'VERTEX AGENT', action: 'FILE_READ', tool: 'Filesystem MCP', details: 'Retrieved document P-102A_DATASHEET.PDF (4.2 MB)', status: 'SUCCESS', ipAddress: '127.0.0.1 (LOCAL)', severity: 'INFO' },
  { id: 'aud-005', timestamp: '2026-09-02 13:45:10', user: 'ENGINEER [L2]', action: 'USER_LOGIN', tool: 'Auth System', details: 'Successful RBAC authentication for user rank ENGINEER [L2]', status: 'SUCCESS', ipAddress: '127.0.0.1 (LOCAL)', severity: 'INFO' },
  { id: 'aud-006', timestamp: '2026-09-02 13:10:05', user: 'VERTEX AGENT', action: 'MODEL_INFERENCE', tool: 'QWEN3.5-9B', details: 'Completed 1,840 token generation (Prompt: Vibration analysis)', status: 'SUCCESS', ipAddress: '127.0.0.1 (LOCAL)', severity: 'INFO' },
  { id: 'aud-007', timestamp: '2026-09-02 12:30:00', user: 'SYSTEM_DAEMON', action: 'AIRGAP_CHECK', tool: 'Security Kernel', details: 'Verified 0 outbound socket calls in past 24h. Socket filter LOCKED.', status: 'SUCCESS', ipAddress: '127.0.0.1 (LOCAL)', severity: 'INFO' },
  { id: 'aud-008', timestamp: '2026-09-02 11:15:40', user: 'ENGINEER [L2]', action: 'CONFIG_CHANGE', tool: 'Settings', details: 'Updated GPU max tokens slider to 4096 and set temperature to 0.2', status: 'SUCCESS', ipAddress: '127.0.0.1 (LOCAL)', severity: 'INFO' },
  { id: 'aud-009', timestamp: '2026-09-02 10:05:12', user: 'VERTEX AGENT', action: 'DATABASE_QUERY', tool: 'Postgres MCP', details: 'Executed query on historian table sensor_telemetry_5m', status: 'SUCCESS', ipAddress: '127.0.0.1 (LOCAL)', severity: 'INFO' },
  { id: 'aud-010', timestamp: '2026-09-02 09:12:00', user: 'OPERATOR [L1]', action: 'OUTBOUND_BLOCKED', tool: 'Network Firewall', details: 'Blocked unauthorized external HTTP connection attempt (Air-Gap Protection)', status: 'BLOCKED', ipAddress: '192.168.1.45', severity: 'ALERT' },
];

// Generate additional 40 realistic audit log entries for full 50+ list
for (let i = 11; i <= 50; i++) {
  const hour = Math.floor(Math.random() * 24).toString().padStart(2, '0');
  const min = Math.floor(Math.random() * 60).toString().padStart(2, '0');
  const sec = Math.floor(Math.random() * 60).toString().padStart(2, '0');
  const tools = ['Postgres MCP', 'Filesystem MCP', 'P&ID Analyzer', 'Document Parser', 'Chart Generator', 'Mem0 (Memory)', 'QWEN3.5-9B'];
  const actions = ['TOOL_EXECUTION', 'FILE_READ', 'DATABASE_QUERY', 'MODEL_INFERENCE', 'SECURITY_AUDIT'];
  const tool = tools[i % tools.length];
  const action = actions[i % actions.length];

  sampleAuditLogs.push({
    id: `aud-0${i < 100 ? (i < 10 ? '0' + i : i) : i}`,
    timestamp: `2026-09-01 ${hour}:${min}:${sec}`,
    user: i % 4 === 0 ? 'ENGINEER [L2]' : 'VERTEX AGENT',
    action: action,
    tool: tool,
    details: `Executed sovereign operational task #${1000 + i} on refinery node #${(i % 5) + 1}`,
    status: 'SUCCESS',
    ipAddress: '127.0.0.1 (LOCAL)',
    severity: 'INFO',
  });
}

export const initialSettings: AppSettings = {
  currentModel: 'QWEN3.5-9B (Q4_K_M)',
  temperature: 0.2,
  maxTokens: 4096,
  contextWindow: '262K (262,144 tokens)',
  systemPrompt: `You are VERTEX, a sovereign, air-gapped agentic AI workbench built for industrial oil refinery operations at MRPL (SIH 26117).
You specialize in process engineering diagnostics, P&ID schematic analysis, telemetry anomaly detection, and automated report generation.
Always maintain high technical precision, cite exact tag IDs (e.g., P-102A, E-101), and strictly observe air-gap safety protocols. Require engineer approval before generating formal work orders or executing write commands.`,
  responseStyle: 'Technical',
  autoApproveRead: true,
  requireApprovalWrite: true,
  showToolCalls: true,
  streamResponses: true,
  defaultExportFormat: 'PDF',
  includeExecutiveSummary: true,
  includeCharts: true,
  includeDataTables: true,
  includeReferences: true,
  reportTemplate: 'MRPL Industrial Enterprise Standard v2.4',
  airGapMode: true,
  auditRetentionDays: 90,
  rbacRoles: [
    { role: 'OPERATOR', canExecuteTools: true, canApproveWrites: false, canExportData: true },
    { role: 'ENGINEER', canExecuteTools: true, canApproveWrites: true, canExportData: true },
    { role: 'ADMIN', canExecuteTools: true, canApproveWrites: true, canExportData: true },
  ],
  enableCrtOverlay: true,
  theme: 'dark',
};
