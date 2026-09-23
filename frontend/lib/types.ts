export type Role = 'student' | 'officer';

export type TicketStatus = 'open' | 'pending_officer' | 'resolved';
export type TicketPriority = 'normal' | 'high';
export type TicketCategory = 'action' | 'complaint';

export interface User {
  id: string; // 'SV001' | 'OF001'
  name: string;
  role: Role;
  roleLabel: string;
  department?: string;
  cohort?: string;
  major?: string;
  email: string;
  avatarUrl?: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actor: string; // 'SV001' | 'OF001' | 'AI_SYSTEM'
  actorName: string;
  action: string;
  previousStatus?: TicketStatus;
  newStatus?: TicketStatus;
  notes?: string;
}

export interface TicketMessage {
  id: string;
  sender: 'student' | 'officer' | 'system';
  senderId: string;
  senderName: string;
  content: string;
  timestamp: string;
}

export interface AIChecklistItem {
  id: string;
  task: string;
  completed: boolean;
}

export interface Ticket {
  id: string; // e.g. "TKT-2026-0142"
  studentId: string; // "SV001"
  studentName: string; // "Nguyễn Văn An"
  studentEmail: string;
  category: TicketCategory; // 'action' (cấp giấy) | 'complaint' (khiếu nại L4)
  title: string;
  certificateType?: string; // "Giấy xác nhận sinh viên"
  purpose?: string; // e.g. "Vay vốn ngân hàng chính sách xã hội"
  createdAt: string;
  updatedAt: string;
  status: TicketStatus;
  priority: TicketPriority;
  handoverReason?: string; // Lý do bàn giao nếu là L4
  aiSummary: string; // Tóm tắt 1-2 câu của AI
  aiChecklist: AIChecklistItem[];
  aiDraftReply: string; // Dự thảo câu trả lời do AI soạn, chưa gửi
  messages: TicketMessage[];
  auditLogs: AuditLogEntry[];
}

export interface ChatInteractionMessage {
  id: string;
  sender: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  type?: 'text' | 'citation' | 'certificate_cta' | 'submit1_success' | 'l4_handover';
  citation?: {
    docTitle: string;
    article: string;
    snippet: string;
    effectiveDate: string;
  };
  ticketId?: string;
}

