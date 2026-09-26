export type UserRole = "student" | "officer";

export interface User {
  id: string; // "SV001", "OF001", "SV024"
  name: string;
  role: UserRole;
  email: string;
  mssv?: string;
  classYear?: string;
  major?: string;
  title?: string;
  department?: string;
  credits?: string;
  academicStatus?: string;
}

export type TicketStatus = "open" | "pending_officer" | "resolved";
export type TicketPriority = "normal" | "high";
export type TicketType = "certificate" | "transcript" | "complaint";

export interface TicketMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole | "system" | "ai";
  content: string;
  timestamp: string;
  attachments?: { name: string; url?: string; size?: string }[];
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  source: string; // e.g. "Cổng 1 (Sinh viên)", "Campus AI Engine v4.2", "Bàn làm việc Cán bộ"
  action: string;
  actor: string;
  details?: string;
}

export interface FactItem {
  id: string;
  key: string;
  source: string;
  value: string;
  status: "verified" | "unverified" | "disputed";
  statusText: string;
  notes?: string;
}

export interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  checked: boolean;
}

export interface Ticket {
  id: string; // e.g. "TKT-2026-0142", "TKT-2026-0098", "TKT-2026-0139"
  code: string;
  title: string;
  type: TicketType;
  studentId: string;
  studentName: string;
  studentMssv: string;
  studentMajor: string;
  studentClassYear: string;
  studentEmail: string;
  status: TicketStatus;
  priority: TicketPriority;
  priorityReason?: string;
  createdAt: string;
  submittedAt: string;
  slaDeadline: string;
  slaRemaining?: string;
  
  // Declaration fields from Gate 1
  certificateType: string;
  receiveMethod: "digital_pdf" | "paper_stamped";
  destinationOrg: string;
  purpose: string;
  notes?: string;

  // AI Preparation for Officer (L3)
  aiSummary: {
    target: string;
    context: string;
    categorySla: string;
    confidence: string;
    nextBestAction: string;
    nextBestActionReason: string;
  };
  
  facts: FactItem[];
  checklist: ChecklistItem[];
  sopReference: string;
  sopDeadline: string;
  
  // Officer Draft for Submit 2
  officerDraft: string;
  officerDraftDefault: string;
  assignedOfficerId?: string;
  assignedOfficerName?: string;
  
  // L4 Special Fields
  isL4?: boolean;
  l4TriggerReason?: string;
  l4EvidenceVerification?: {
    source1StudentClaim: string;
    source2DbSync: {
      grade: string;
      scale: string;
      room: string;
      lecturer: string;
      syncTime: string;
    };
    source3ExamMinutes: {
      fileName: string;
      scanTime: string;
      verifier: string;
      note: string;
    };
    gradeDiff: {
      oldGrade: number;
      suggestedGrade: number;
      diffText: string;
    };
  };

  messages: TicketMessage[];
  auditLogs: AuditLogEntry[];
}

export interface ChatMessage {
  id: string;
  sender: "user" | "bot" | "system";
  text: string;
  timestamp: string;
  level?: "L1" | "L2" | "L4";
  citation?: {
    code: string;
    title: string;
    quote: string;
    source: string;
  };
  actionCard?: "submit1_prompt" | "submit1_success" | "l4_handover";
  ticketId?: string;
  ticketData?: Partial<Ticket>;
}

export interface ChatSession {
  id: string;
  title: string;
  preview: string;
  updatedAt: string;
  tag: "L1" | "L2" | "L4" | "Chung";
  messages: ChatMessage[];
  isL4HandoverActive?: boolean;
  gate1FormData?: {
    fullName: string;
    mssv: string;
    classYear: string;
    department: string;
    reason: string;
    destinationOrg: string;
    receiveMethod: "digital_pdf" | "paper_stamped";
    academicStatus: string;
  };
}

