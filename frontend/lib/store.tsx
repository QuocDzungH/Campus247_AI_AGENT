'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Ticket, ChatInteractionMessage, TicketStatus, AuditLogEntry, TicketMessage } from './types';
import { DEMO_USERS, INITIAL_TICKETS, INITIAL_CHAT_MESSAGES } from './mock-data';

interface StoreContextType {
  currentUser: User;
  switchUser: (userId: 'SV001' | 'OF001') => void;
  tickets: Ticket[];
  chatMessages: ChatInteractionMessage[];
  isL4Active: boolean;
  activeL4TicketId: string | null;
  submitCertificateRequest: (purpose: string) => Ticket;
  triggerL4Complaint: (complaintContent: string) => Ticket;
  officerSendReply: (ticketId: string, replyText: string) => void;
  officerRequestMoreInfo: (ticketId: string, note: string) => void;
  officerCompleteTicket: (ticketId: string, note?: string) => void;
  studentSendTicketReply: (ticketId: string, content: string) => void;
  studentSendChatMessage: (content: string) => void;
  resetDemoData: () => void;
  getTicketById: (ticketId: string) => Ticket | undefined;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User>(DEMO_USERS.SV001);
  const [tickets, setTickets] = useState<Ticket[]>(INITIAL_TICKETS);
  const [chatMessages, setChatMessages] = useState<ChatInteractionMessage[]>(INITIAL_CHAT_MESSAGES);
  const [isL4Active, setIsL4Active] = useState<boolean>(false);
  const [activeL4TicketId, setActiveL4TicketId] = useState<string | null>(null);

  // Switch between demo users
  const switchUser = (userId: 'SV001' | 'OF001') => {
    setCurrentUser(DEMO_USERS[userId]);
  };

  const getTicketById = (ticketId: string): Ticket | undefined => {
    return tickets.find((t) => t.id === ticketId);
  };

  const resetDemoData = () => {
    setTickets(INITIAL_TICKETS);
    setChatMessages(INITIAL_CHAT_MESSAGES);
    setIsL4Active(false);
    setActiveL4TicketId(null);
  };

  // Submit 1 (Student confirms preview): Creates ticket into school system
  const submitCertificateRequest = (purpose: string): Ticket => {
    const timestampStr = new Date().toISOString().replace('T', ' ').substring(0, 16);
    const existing142 = tickets.find((t) => t.id === 'TKT-2026-0142');
    const newId = existing142 ? `TKT-2026-0${143 + tickets.length}` : 'TKT-2026-0142';

    const newTicket: Ticket = {
      id: newId,
      studentId: currentUser.id,
      studentName: currentUser.name,
      studentEmail: currentUser.email,
      category: 'action',
      title: 'Yêu cầu cấp Giấy xác nhận sinh viên',
      certificateType: 'Giấy xác nhận sinh viên',
      purpose: purpose.trim() || 'Bổ sung hồ sơ sinh viên',
      createdAt: timestampStr,
      updatedAt: timestampStr,
      status: 'open', // Mới tiếp nhận
      priority: 'normal',
      aiSummary: `Sinh viên ${currentUser.name} (${currentUser.id}) đã hoàn tất Submit 1 yêu cầu cấp Giấy xác nhận sinh viên. Mục đích: ${purpose}. Trạng thái học tập bình thường, không nợ học phí.`,
      aiChecklist: [
        { id: 'c1', task: 'Đối soát trạng thái sinh viên chính quy trên CSDL trường', completed: true },
        { id: 'c2', task: 'Kiểm tra xác nhận hoàn thành học phí học kỳ hiện tại', completed: true },
        { id: 'c3', task: 'Duyệt in biểu mẫu mẫu số 03/SV-NHCS và trình ký số Ban Giám hiệu', completed: false },
      ],
      aiDraftReply: `Chào bạn ${currentUser.name}, Phòng Đào tạo & Công tác Sinh viên đã tiếp nhận yêu cầu cấp Giấy xác nhận sinh viên của bạn với mục đích "${purpose}". Hồ sơ thông tin của bạn đã đầy đủ và hợp lệ. Bộ phận học vụ đang tiến hành xuất văn bản và trình ký số. Bạn sẽ nhận được thông báo khi hoàn tất xử lý.`,
      messages: [
        {
          id: `msg-${Date.now()}`,
          sender: 'student',
          senderId: currentUser.id,
          senderName: currentUser.name,
          content: `Yêu cầu cấp Giấy xác nhận sinh viên. Mục đích: ${purpose}`,
          timestamp: timestampStr,
        },
      ],
      auditLogs: [
        {
          id: `log-${Date.now()}`,
          timestamp: timestampStr,
          actor: currentUser.id,
          actorName: currentUser.name,
          action: 'Nộp yêu cầu qua cổng trực tuyến (Submit 1)',
          newStatus: 'open',
          notes: 'Sinh viên đã kiểm tra preview hồ sơ và xác nhận nộp yêu cầu vào hệ thống trường',
        },
      ],
    };

    setTickets((prev) => [newTicket, ...prev]);

    // Append confirmation card in student chat
    const successMsg: ChatInteractionMessage = {
      id: `chat-${Date.now()}`,
      sender: 'assistant',
      content: `Đã nộp yêu cầu vào hệ thống trường thành công! Mã tiếp nhận: ${newId}. Trạng thái hiện tại: Mới tiếp nhận (Chờ cán bộ tiếp nhận). Lưu ý: Giấy xác nhận chưa được cấp hoặc ký tại bước này. Cán bộ học vụ sẽ xử lý và gửi phản hồi cho bạn qua mục "Yêu cầu của tôi".`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type: 'submit1_success',
      ticketId: newId,
    };

    setChatMessages((prev) => [...prev, successMsg]);
    return newTicket;
  };

  // L4 Handover: AI detects complaint/sensitive -> stops AI, creates handover ticket
  const triggerL4Complaint = (complaintContent: string): Ticket => {
    const timestampStr = new Date().toISOString().replace('T', ' ').substring(0, 16);
    const newId = `TKT-2026-L4-${Math.floor(100 + Math.random() * 900)}`;

    const handoverTicket: Ticket = {
      id: newId,
      studentId: currentUser.id,
      studentName: currentUser.name,
      studentEmail: currentUser.email,
      category: 'complaint',
      title: `Khiếu nại / Bàn giao khẩn cấp: ${complaintContent.substring(0, 50)}...`,
      createdAt: timestampStr,
      updatedAt: timestampStr,
      status: 'pending_officer', // Chờ cán bộ
      priority: 'high', // Ưu tiên Cao
      handoverReason: `Phát hiện khiếu nại / nhạy cảm vượt thẩm quyền AI: "${complaintContent}". Kích hoạt phanh an toàn L4, bàn giao cán bộ hỗ trợ học vụ thẩm tra hồ sơ.`,
      aiSummary: `Ca bàn giao khẩn L4: Sinh viên ${currentUser.name} khiếu nại học vụ/điểm thi. AI đã dừng tư vấn tự động và tạo hồ sơ ưu tiên Cao bàn giao Cán bộ phụ trách.`,
      aiChecklist: [
        { id: 'c1', task: 'Đọc chi tiết nội dung khiếu nại và đoạn hội thoại bàn giao của sinh viên', completed: false },
        { id: 'c2', task: 'Tra cứu dữ liệu điểm thi/học vụ gốc tại phân hệ khảo thí', completed: false },
        { id: 'c3', task: 'Phản hồi hướng dẫn giải quyết khiếu nại hoặc lịch hẹn trực tiếp', completed: false },
      ],
      aiDraftReply: `Chào bạn ${currentUser.name}, Phòng Đào tạo & Khảo thí đã tiếp nhận nội dung khiếu nại của bạn. Cán bộ chuyên trách học vụ đang trực tiếp rà soát lại dữ liệu gốc và sẽ phản hồi phương án xử lý cụ thể trong thời gian sớm nhất.`,
      messages: [
        {
          id: `msg-${Date.now()}-1`,
          sender: 'student',
          senderId: currentUser.id,
          senderName: currentUser.name,
          content: complaintContent,
          timestamp: timestampStr,
        },
        {
          id: `msg-${Date.now()}-2`,
          sender: 'system',
          senderId: 'AI_SYSTEM',
          senderName: 'Hệ thống an toàn Campus 24/7 (L4)',
          content: `Hệ thống đã nhận diện nội dung khiếu nại học vụ (${newId}). AI đã tạm dừng tư vấn trực tiếp và bàn giao hồ sơ sang hàng chờ ưu tiên CAO của Cán bộ hỗ trợ học vụ.`,
          timestamp: timestampStr,
        },
      ],
      auditLogs: [
        {
          id: `log-${Date.now()}`,
          timestamp: timestampStr,
          actor: 'AI_SYSTEM',
          actorName: 'AI Safety Router (L4)',
          action: 'Kích hoạt bàn giao khẩn cấp L4',
          newStatus: 'pending_officer',
          notes: `Bàn giao cán bộ xử lý: ${complaintContent.substring(0, 60)}...`,
        },
      ],
    };

    setIsL4Active(true);
    setActiveL4TicketId(newId);
    setTickets((prev) => [handoverTicket, ...prev]);

    // Append L4 banner into student chat
    const handoverChatMsg: ChatInteractionMessage = {
      id: `chat-${Date.now()}`,
      sender: 'assistant',
      content: `Hệ thống đã nhận diện ca khiếu nại học vụ. Trợ lý AI đã dừng trả lời tự động và bàn giao toàn bộ thông tin cho Cán bộ hỗ trợ học vụ (Mã hồ sơ: ${newId} · Ưu tiên: Cao). Mọi tin nhắn tiếp theo của bạn trong khung chat này sẽ được gửi trực tiếp cho cán bộ phụ trách.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type: 'l4_handover',
      ticketId: newId,
    };

    setChatMessages((prev) => [...prev, handoverChatMsg]);
    return handoverTicket;
  };

  // Submit 2 (Officer actions)
  // Action 1: Send Reply -> Updates status to 'pending_officer' if it was 'open'. NEVER sets 'resolved'!
  const officerSendReply = (ticketId: string, replyText: string) => {
    const timestampStr = new Date().toISOString().replace('T', ' ').substring(0, 16);
    setTickets((prev) =>
      prev.map((t) => {
        if (t.id !== ticketId) return t;
        const prevStatus = t.status;
        const newStatus: TicketStatus = prevStatus === 'open' ? 'pending_officer' : prevStatus;

        const newMsg: TicketMessage = {
          id: `msg-${Date.now()}`,
          sender: 'officer',
          senderId: 'OF001',
          senderName: 'Cán bộ hỗ trợ học vụ',
          content: replyText,
          timestamp: timestampStr,
        };

        const newAudit: AuditLogEntry = {
          id: `log-${Date.now()}`,
          timestamp: timestampStr,
          actor: 'OF001',
          actorName: 'Cán bộ hỗ trợ học vụ',
          action: 'Gửi phản hồi cho sinh viên (Submit 2 - Reply)',
          previousStatus: prevStatus,
          newStatus: newStatus,
          notes: 'Phản hồi đã gửi tới sinh viên; ticket vẫn đang xử lý, CHƯA hoàn tất',
        };

        return {
          ...t,
          status: newStatus,
          updatedAt: timestampStr,
          messages: [...t.messages, newMsg],
          auditLogs: [...t.auditLogs, newAudit],
        };
      })
    );
  };

  // Action 2: Request More Information
  const officerRequestMoreInfo = (ticketId: string, note: string) => {
    const timestampStr = new Date().toISOString().replace('T', ' ').substring(0, 16);
    setTickets((prev) =>
      prev.map((t) => {
        if (t.id !== ticketId) return t;
        const prevStatus = t.status;
        const newMsg: TicketMessage = {
          id: `msg-${Date.now()}`,
          sender: 'officer',
          senderId: 'OF001',
          senderName: 'Cán bộ hỗ trợ học vụ',
          content: `[Yêu cầu bổ sung thông tin]: ${note}`,
          timestamp: timestampStr,
        };

        const newAudit: AuditLogEntry = {
          id: `log-${Date.now()}`,
          timestamp: timestampStr,
          actor: 'OF001',
          actorName: 'Cán bộ hỗ trợ học vụ',
          action: 'Yêu cầu sinh viên bổ sung tài liệu',
          previousStatus: prevStatus,
          newStatus: 'pending_officer',
          notes: note,
        };

        return {
          ...t,
          status: 'pending_officer',
          updatedAt: timestampStr,
          messages: [...t.messages, newMsg],
          auditLogs: [...t.auditLogs, newAudit],
        };
      })
    );
  };

  // Action 3: Complete Ticket (ONLY action that sets status to 'resolved')
  const officerCompleteTicket = (ticketId: string, note?: string) => {
    const timestampStr = new Date().toISOString().replace('T', ' ').substring(0, 16);
    setTickets((prev) =>
      prev.map((t) => {
        if (t.id !== ticketId) return t;
        const prevStatus = t.status;
        const newMsg: TicketMessage = {
          id: `msg-${Date.now()}`,
          sender: 'officer',
          senderId: 'OF001',
          senderName: 'Cán bộ hỗ trợ học vụ',
          content: note || 'Hồ sơ yêu cầu của bạn đã được cán bộ học vụ phê duyệt và hoàn tất xử lý thành công.',
          timestamp: timestampStr,
        };

        const newAudit: AuditLogEntry = {
          id: `log-${Date.now()}`,
          timestamp: timestampStr,
          actor: 'OF001',
          actorName: 'Cán bộ hỗ trợ học vụ',
          action: 'Hoàn tất xử lý yêu cầu (Submit 2 - Complete)',
          previousStatus: prevStatus,
          newStatus: 'resolved',
          notes: note || 'Xác nhận hồ sơ hợp lệ và chuyển trạng thái Đã hoàn tất',
        };

        return {
          ...t,
          status: 'resolved',
          updatedAt: timestampStr,
          messages: [...t.messages, newMsg],
          auditLogs: [...t.auditLogs, newAudit],
        };
      })
    );
  };

  // Student sends reply to an existing ticket (e.g. from My Requests)
  const studentSendTicketReply = (ticketId: string, content: string) => {
    const timestampStr = new Date().toISOString().replace('T', ' ').substring(0, 16);
    setTickets((prev) =>
      prev.map((t) => {
        if (t.id !== ticketId) return t;
        const newMsg: TicketMessage = {
          id: `msg-${Date.now()}`,
          sender: 'student',
          senderId: currentUser.id,
          senderName: currentUser.name,
          content: content,
          timestamp: timestampStr,
        };

        const newAudit: AuditLogEntry = {
          id: `log-${Date.now()}`,
          timestamp: timestampStr,
          actor: currentUser.id,
          actorName: currentUser.name,
          action: 'Sinh viên gửi thông tin bổ sung',
          notes: content.substring(0, 50),
        };

        return {
          ...t,
          updatedAt: timestampStr,
          messages: [...t.messages, newMsg],
          auditLogs: [...t.auditLogs, newAudit],
        };
      })
    );
  };

  // Student sends message in chat
  const studentSendChatMessage = (content: string) => {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // 1. Add student message
    const userMsg: ChatInteractionMessage = {
      id: `chat-${Date.now()}-user`,
      sender: 'user',
      content: content,
      timestamp: timeStr,
    };
    setChatMessages((prev) => [...prev, userMsg]);

    const lower = content.toLowerCase();

    // 2. If L4 is already active, AI remains muted; message is forwarded to officer
    if (isL4Active && activeL4TicketId) {
      studentSendTicketReply(activeL4TicketId, content);
      const systemNote: ChatInteractionMessage = {
        id: `chat-${Date.now()}-sys`,
        sender: 'system',
        content: `Thông tin bổ sung của bạn đã được chuyển thẳng vào hồ sơ ${activeL4TicketId} cho cán bộ học vụ.`,
        timestamp: timeStr,
      };
      setChatMessages((prev) => [...prev, systemNote]);
      return;
    }

    // 3. Detect L4 keywords: khiếu nại, phúc khảo, chấm sai, sai điểm, mệt mỏi, bất công...
    if (
      lower.includes('khiếu nại') ||
      lower.includes('phúc khảo') ||
      lower.includes('chấm sai') ||
      lower.includes('sai điểm') ||
      lower.includes('sửa điểm')
    ) {
      triggerL4Complaint(content);
      return;
    }

    // Distinguish L1 (ask-only regulation questions) vs L2 (action intention to create certificate)
    const isAskOnly =
      lower.includes('quy chế') ||
      lower.includes('quy định') ||
      lower.includes('bao lâu') ||
      lower.includes('mất mấy ngày') ||
      lower.includes('thời gian') ||
      lower.includes('điều kiện gì') ||
      lower.includes('thủ tục như thế nào') ||
      lower.includes('nộp ở đâu') ||
      lower.includes('cần gì');

    // 4. Detect L2 request intention: xin giấy, tạo yêu cầu, làm giấy
    if (
      !isAskOnly &&
      (lower.includes('xin') ||
        lower.includes('tạo yêu cầu') ||
        lower.includes('muốn cấp') ||
        lower.includes('làm giấy') ||
        lower.includes('xác nhận sinh viên'))
    ) {
      setTimeout(() => {
        const ctaMsg: ChatInteractionMessage = {
          id: `chat-${Date.now()}-assistant`,
          sender: 'assistant',
          content: `Chào bạn, để xin Giấy xác nhận sinh viên, bạn có thể tạo yêu cầu trực tuyến ngay tại đây. Hệ thống đã tự động điền sẵn Họ tên (${currentUser.name}) và MSSV (${currentUser.id}) từ thông tin tài khoản của bạn. Vui lòng bấm nút bên dưới để kiểm tra và xác nhận hồ sơ.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          type: 'certificate_cta',
        };
        setChatMessages((prev) => [...prev, ctaMsg]);
      }, 300);
      return;
    }

    // 5. Default L1: Regulation lookup with citation (No ticket created)
    setTimeout(() => {
      let replyText =
        'Theo Quy chế Đào tạo & Công tác sinh viên hiện hành, sinh viên có quyền yêu cầu cấp các loại văn bản xác nhận học tập trực tuyến thông qua cổng Campus 24/7. Thời gian giải quyết tiêu chuẩn là 01 đến 02 ngày làm việc.';
      let citation = {
        docTitle: 'Quy chế Đào tạo & Công tác sinh viên số 452/QĐ-ĐH',
        article: 'Điều 18, Khoản 2 (Quyền hạn sinh viên & Cấp phát văn bản)',
        snippet:
          'Sinh viên đang trong thời gian học tập chính quy và không trong thời gian bị kỷ luật có quyền yêu cầu Nhà trường cấp Giấy xác nhận sinh viên, Bảng điểm học tập và các giấy tờ xác nhận liên quan.',
        effectiveDate: 'Áp dụng từ năm học 2024 - 2025',
      };

      if (lower.includes('thời gian') || lower.includes('bao lâu') || lower.includes('mất mấy ngày')) {
        replyText =
          'Thời gian xử lý cấp Giấy xác nhận sinh viên điện tử thông thường là trong vòng 24 - 48 giờ làm việc kể từ thời điểm cán bộ tiếp nhận yêu cầu hợp lệ.';
        citation = {
          docTitle: 'Quy trình giải quyết dịch vụ học vụ một cửa số 112/QĐ-ĐT',
          article: 'Mục 3.2: Thời hạn trả kết quả hồ sơ cấp văn bản sinh viên',
          snippet:
            'Đối với Giấy xác nhận sinh viên tiêu chuẩn (vay vốn, hoãn NVQS, thực tập), thời gian thụ lý và ban hành tối đa 02 ngày làm việc.',
          effectiveDate: 'Ban hành ngày 15/01/2025',
        };
      }

      const l1Msg: ChatInteractionMessage = {
        id: `chat-${Date.now()}-assistant`,
        sender: 'assistant',
        content: replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        type: 'citation',
        citation: citation,
      };
      setChatMessages((prev) => [...prev, l1Msg]);
    }, 500);
  };

  return (
    <StoreContext.Provider
      value={{
        currentUser,
        switchUser,
        tickets,
        chatMessages,
        isL4Active,
        activeL4TicketId,
        submitCertificateRequest,
        triggerL4Complaint,
        officerSendReply,
        officerRequestMoreInfo,
        officerCompleteTicket,
        studentSendTicketReply,
        studentSendChatMessage,
        resetDemoData,
        getTicketById,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
}
