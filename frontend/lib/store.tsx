"use client";

import React, { createContext, useContext, useState } from "react";
import { User, Ticket, TicketStatus, TicketMessage, ChatMessage, ChatSession } from "./types";
import { DEMO_USERS, INITIAL_TICKETS, INITIAL_CHAT_SESSIONS } from "./mock-data";

interface StoreContextType {
  // Theme
  theme: "light" | "dark";
  toggleTheme: () => void;

  // Auth / Current User
  currentUser: User;
  setCurrentUser: (user: User) => void;
  login: (userId: string) => boolean;
  logout: () => void;

  // Tickets
  tickets: Ticket[];
  getTicket: (id: string) => Ticket | undefined;
  createTicket: (data: Partial<Ticket>) => Ticket;
  updateTicketStatus: (id: string, status: TicketStatus, actorName: string) => void;
  updateOfficerDraft: (id: string, draft: string) => void;
  resetOfficerDraft: (id: string) => void;
  toggleChecklistItem: (ticketId: string, itemId: string) => void;
  addTicketMessage: (
    ticketId: string,
    message: { senderId: string; senderName: string; senderRole: "student" | "officer" | "system"; content: string }
  ) => void;
  submitGate2Response: (
    ticketId: string,
    actionType: "respond" | "request_info" | "resolve",
    customContent?: string
  ) => void;
  resetAllDemoData: () => void;

  // Chat Assistant State & Sessions
  chatSessions: ChatSession[];
  activeSessionId: string;
  selectChatSession: (sessionId: string) => void;
  createNewChatSession: () => void;
  deleteChatSession: (sessionId: string) => void;
  chatMessages: ChatMessage[];
  addChatMessage: (msg: Omit<ChatMessage, "id" | "timestamp">) => void;
  isL4HandoverActive: boolean;
  setL4HandoverActive: (active: boolean) => void;
  isGate1Open: boolean;
  setGate1Open: (open: boolean) => void;
  gate1FormData: {
    fullName: string;
    mssv: string;
    classYear: string;
    department: string;
    reason: string;
    destinationOrg: string;
    receiveMethod: "digital_pdf" | "paper_stamped";
    academicStatus: string;
  };
  setGate1FormData: React.Dispatch<
    React.SetStateAction<{
      fullName: string;
      mssv: string;
      classYear: string;
      department: string;
      reason: string;
      destinationOrg: string;
      receiveMethod: "digital_pdf" | "paper_stamped";
      academicStatus: string;
    }>
  >;
  lastUpdatedField: "reason" | "receiveMethod" | null;
  updateGate1Field: (field: "reason" | "receiveMethod" | "destinationOrg", value: any) => void;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY_TICKETS = "campus247_tickets_v2";
const LOCAL_STORAGE_KEY_THEME = "campus247_theme_v2";
const LOCAL_STORAGE_KEY_USER = "campus247_user_v2";

export function StoreProvider({ children }: { children: React.ReactNode }) {
  // Theme state: Default Light as required
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window !== "undefined") {
      try {
        const savedTheme = localStorage.getItem(LOCAL_STORAGE_KEY_THEME) as "light" | "dark" | null;
        if (savedTheme === "dark") {
          document.documentElement.classList.add("dark");
          return "dark";
        }
      } catch (e) {
        console.error(e);
      }
    }
    return "light";
  });

  // User state
  const [currentUser, setCurrentUser] = useState<User>(() => {
    if (typeof window !== "undefined") {
      try {
        const savedUser = localStorage.getItem(LOCAL_STORAGE_KEY_USER);
        if (savedUser) {
          const parsed = JSON.parse(savedUser);
          if (parsed?.id && DEMO_USERS[parsed.id]) {
            return DEMO_USERS[parsed.id];
          }
        }
      } catch (e) {
        console.error(e);
      }
    }
    return DEMO_USERS.SV001;
  });

  // Tickets state
  const [tickets, setTickets] = useState<Ticket[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const savedTickets = localStorage.getItem(LOCAL_STORAGE_KEY_TICKETS);
        if (savedTickets) {
          return JSON.parse(savedTickets);
        }
      } catch (e) {
        console.error(e);
      }
    }
    return INITIAL_TICKETS;
  });

  // Chat Assistant & Sessions state
  const [chatSessions, setChatSessions] = useState<ChatSession[]>(() => {
    return INITIAL_CHAT_SESSIONS || [];
  });
  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    return INITIAL_CHAT_SESSIONS?.[0]?.id || "sess-bm03-vayvon";
  });

  const [isL4HandoverActive, setL4HandoverActive] = useState<boolean>(() => {
    return !!INITIAL_CHAT_SESSIONS?.[0]?.isL4HandoverActive;
  });
  const [isGate1Open, setGate1Open] = useState(false);
  const [gate1FormData, setGate1FormData] = useState(() => {
    return (
      INITIAL_CHAT_SESSIONS?.[0]?.gate1FormData || {
        fullName: "Nguyễn Văn An",
        mssv: "20210018",
        classYear: "Khóa 18 (2021 - 2025) · K18 KTPM",
        department: "Khoa Công nghệ Phần mềm",
        reason: "Nộp Ngân hàng Chính sách Xã hội Chi nhánh Q. Thủ Đức (Học kỳ 2)",
        destinationOrg: "Ngân hàng Chính sách Xã hội Chi nhánh Q. Thủ Đức",
        receiveMethod: "digital_pdf" as "digital_pdf" | "paper_stamped",
        academicStatus: "Bình thường",
      }
    );
  });

  const [lastUpdatedField, setLastUpdatedField] = useState<"reason" | "receiveMethod" | null>(null);

  const updateGate1Field = (field: "reason" | "receiveMethod" | "destinationOrg", value: any) => {
    setGate1FormData((prev) => ({
      ...prev,
      [field]: value,
      ...(field === "reason" && (!prev.destinationOrg || prev.destinationOrg.includes("Ngân hàng"))
        ? { destinationOrg: value }
        : {}),
    }));
    if (field === "reason" || field === "receiveMethod") {
      setLastUpdatedField(field);
      setTimeout(() => {
        setLastUpdatedField(null);
      }, 3500);
    }
  };

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => {
    return INITIAL_CHAT_SESSIONS?.[0]?.messages || [];
  });

  const selectChatSession = (sessionId: string) => {
    const session = chatSessions.find((s) => s.id === sessionId);
    if (!session) return;
    setActiveSessionId(sessionId);
    setChatMessages(session.messages || []);
    setL4HandoverActive(!!session.isL4HandoverActive);
    if (session.gate1FormData) {
      setGate1FormData(session.gate1FormData);
    }
  };

  const createNewChatSession = () => {
    const newId = `sess-${Date.now()}`;
    const initialMsg: ChatMessage = {
      id: `cm-${Date.now()}`,
      sender: "bot",
      text: "Xin chào! Tôi là Trợ lý Học vụ Campus 24/7. Tôi có thể hỗ trợ bạn tra cứu quy chế học vụ (L1), tự động soạn thảo biểu mẫu BM-03 (L2), hoặc tiếp nhận chuyển tiếp khiếu nại đào tạo (L4). Bạn đang cần hỗ trợ vấn đề gì hôm nay?",
      timestamp: "Vừa xong",
    };
    const newSession: ChatSession = {
      id: newId,
      title: "Cuộc hội thoại mới",
      preview: "Bắt đầu cuộc trao đổi mới với Trợ lý AI...",
      updatedAt: "Vừa xong",
      tag: "Chung",
      messages: [initialMsg],
      isL4HandoverActive: false,
    };
    setChatSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(newId);
    setChatMessages([initialMsg]);
    setL4HandoverActive(false);
    setGate1Open(false);
  };

  const deleteChatSession = (sessionId: string) => {
    setChatSessions((prev) => {
      const remaining = prev.filter((s) => s.id !== sessionId);
      if (activeSessionId === sessionId) {
        if (remaining.length > 0) {
          setActiveSessionId(remaining[0].id);
          setChatMessages(remaining[0].messages || []);
          setL4HandoverActive(!!remaining[0].isL4HandoverActive);
          if (remaining[0].gate1FormData) {
            setGate1FormData(remaining[0].gate1FormData);
          }
        } else {
          createNewChatSession();
        }
      }
      return remaining;
    });
  };

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === "light" ? "dark" : "light";
      if (next === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY_THEME, next);
      } catch (e) {
        console.error(e);
      }
      return next;
    });
  };

  const login = (userId: string): boolean => {
    const user = DEMO_USERS[userId];
    if (user) {
      setCurrentUser(user);
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY_USER, JSON.stringify(user));
      } catch (e) {
        console.error(e);
      }
      return true;
    }
    return false;
  };

  const logout = () => {
    // Keep tickets intact!
    setCurrentUser(DEMO_USERS.SV001);
    try {
      localStorage.removeItem(LOCAL_STORAGE_KEY_USER);
    } catch (e) {
      console.error(e);
    }
  };

  const saveTickets = (newTickets: Ticket[]) => {
    setTickets(newTickets);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_TICKETS, JSON.stringify(newTickets));
    } catch (e) {
      console.error(e);
    }
  };

  const getTicket = (id: string) => {
    return tickets.find((t) => t.id === id || t.code === id);
  };

  const createTicket = (data: Partial<Ticket>): Ticket => {
    const newId = `TKT-2026-0${Math.floor(143 + Math.random() * 850)}`;
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(
      now.getSeconds()
    ).padStart(2, "0")}`;
    const dateStr = `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(
      2,
      "0"
    )}/${now.getFullYear()}`;
    const timestamp = `${timeStr} · ${dateStr}`;

    const newTicket: Ticket = {
      id: newId,
      code: newId,
      title: data.title || "Cấp Giấy xác nhận sinh viên (BM-03)",
      type: data.type || "certificate",
      studentId: currentUser.id,
      studentName: currentUser.name,
      studentMssv: currentUser.mssv || currentUser.id,
      studentMajor: currentUser.major || "K18 Kỹ thuật Phần mềm",
      studentClassYear: currentUser.classYear || "Khóa 18 (2021 - 2025)",
      studentEmail: currentUser.email,
      status: "open",
      priority: data.priority || "normal",
      priorityReason: data.priorityReason || "Hồ sơ tạo từ Cổng 1, sinh viên đã xác thực thông tin khai báo.",
      createdAt: now.toISOString(),
      submittedAt: timestamp,
      slaDeadline: data.slaDeadline || "24h - 48h",
      certificateType: data.certificateType || "Giấy xác nhận sinh viên chính quy (BM-03)",
      receiveMethod: data.receiveMethod || "digital_pdf",
      destinationOrg: data.destinationOrg || "Ngân hàng Chính sách Xã hội",
      purpose: data.purpose || "Bổ sung hồ sơ vay vốn học tập",
      aiSummary: {
        target: `Sinh viên cần cấp ${data.certificateType || "Giấy xác nhận sinh viên"} cho mục đích: ${data.purpose || "Vay vốn chính sách"}.`,
        context: "Hồ sơ được gửi trực tuyến qua Cổng 1; chưa có ghi nhận nợ đọng hoặc cảnh cáo học vụ.",
        categorySla: "Ca cấp giấy tiêu chuẩn (L2). SLA phản hồi: 24h - 48h.",
        confidence: "98.5%",
        nextBestAction: "Kiểm tra tình trạng sinh viên và học phí trên hệ thống đào tạo trước khi phản hồi tiếp nhận.",
        nextBestActionReason: "Đảm bảo tuân thủ Điều 14 Quy chế Đào tạo & CTSV.",
      },
      facts: [
        {
          id: `f-${Date.now()}-1`,
          key: "Mục đích sử dụng giấy",
          source: "Lời khai SV tại Cổng 1",
          value: data.purpose || "Bổ sung hồ sơ vay vốn NHCSXH",
          status: "unverified",
          statusText: "Chưa kiểm chứng (Lời khai SV)",
        },
        {
          id: `f-${Date.now()}-2`,
          key: "Định danh khai báo",
          source: "[SSO Profile]",
          value: `${currentUser.name} · ${currentUser.mssv || currentUser.id}`,
          status: "verified",
          statusText: "Khớp tài khoản đăng nhập",
        },
        {
          id: `f-${Date.now()}-3`,
          key: "Tình trạng học tập",
          source: "[CSDL Đào tạo]",
          value: "Chưa xác minh trên CSDL",
          status: "unverified",
          statusText: "Chưa kiểm tra CSDL",
        },
        {
          id: `f-${Date.now()}-4`,
          key: "Nghĩa vụ tài chính",
          source: "[Kế hoạch - TC]",
          value: "Chưa đối soát nợ học phí",
          status: "unverified",
          statusText: "Chưa đối soát nợ",
        },
      ],
      checklist: [
        {
          id: `c-${Date.now()}-1`,
          label: "1. Đối soát trạng thái sinh viên trên CSDL trường",
          description: "Kiểm tra trạng thái 'Đang học chính quy', không bị tạm hoãn/đình chỉ.",
          checked: false,
        },
        {
          id: `c-${Date.now()}-2`,
          label: "2. Kiểm tra xác nhận hoàn thành nghĩa vụ học phí học kỳ",
          description: "Tra cứu cổng KHTC: Không có ghi chú nợ học phí kỳ hiện tại.",
          checked: false,
        },
        {
          id: `c-${Date.now()}-3`,
          label: "3. Kiểm tra tính hợp lệ của mục đích xin giấy",
          description: "Mục đích vay vốn NHCSXH đúng biểu mẫu BM-03 theo quy định CTSV.",
          checked: false,
        },
      ],
      sopReference: "SOP-CTSV-01 (Mẫu tham khảo)",
      sopDeadline: "Thời hạn xử lý: Trong vòng 48 giờ làm việc.",
      officerDraftDefault: `Chào bạn ${currentUser.name}, Phòng Đào tạo & CTSV đã tiếp nhận yêu cầu ${data.title || "cấp Giấy xác nhận sinh viên"} của bạn. Hồ sơ đang được đối soát với CSDL Đào tạo. Bản điện tử có ký số sẽ được gửi lại cho bạn qua Cổng SV trong vòng 24-48h làm việc.`,
      officerDraft: `Chào bạn ${currentUser.name}, Phòng Đào tạo & CTSV đã tiếp nhận yêu cầu ${data.title || "cấp Giấy xác nhận sinh viên"} của bạn. Hồ sơ đang được đối soát với CSDL Đào tạo. Bản điện tử có ký số sẽ được gửi lại cho bạn qua Cổng SV trong vòng 24-48h làm việc.`,
      assignedOfficerId: "OF001",
      assignedOfficerName: "ThS. Trần Thu Hà",
      messages: [
        {
          id: `msg-${Date.now()}-sys`,
          senderId: "system",
          senderName: "Hệ thống AI tự động",
          senderRole: "system",
          content: "Hồ sơ tạo thành công từ Cổng 1 và đã chuyển vào hàng chờ Cán bộ Phòng Đào tạo & CTSV.",
          timestamp: timeStr,
        },
      ],
      auditLogs: [
        {
          id: `aud-${Date.now()}-1`,
          timestamp: timestamp,
          source: "Cổng 1 (Sinh viên)",
          action: `Sinh viên nộp yêu cầu ${data.title || "Cấp giấy xác nhận sinh viên"}`,
          actor: `${currentUser.name} (${currentUser.mssv || currentUser.id})`,
        },
        {
          id: `aud-${Date.now()}-2`,
          timestamp: timestamp,
          source: "Campus AI Engine v4.2",
          action: "Trích xuất dữ liệu, gắn cờ SOP-CTSV-01, khởi tạo Fact Sheet và phân loại L2 - Bình thường",
          actor: "AI Engine v4.2",
        },
      ],
    };

    const updated = [newTicket, ...tickets];
    saveTickets(updated);
    return newTicket;
  };

  const updateTicketStatus = (id: string, status: TicketStatus, actorName: string) => {
    const updated = tickets.map((t) => {
      if (t.id === id) {
        const now = new Date();
        const timestamp = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(
          2,
          "0"
        )} · ${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}`;
        const newLog = {
          id: `aud-${Date.now()}`,
          timestamp,
          source: "Bàn làm việc Cán bộ",
          action: `Cập nhật trạng thái sang: ${status === "open" ? "Mới tiếp nhận" : status === "pending_officer" ? "Chờ cán bộ" : "Đã hoàn tất"}`,
          actor: actorName,
        };
        return {
          ...t,
          status,
          auditLogs: [...t.auditLogs, newLog],
        };
      }
      return t;
    });
    saveTickets(updated);
  };

  const updateOfficerDraft = (id: string, draft: string) => {
    const updated = tickets.map((t) => {
      if (t.id === id) {
        return { ...t, officerDraft: draft };
      }
      return t;
    });
    saveTickets(updated);
  };

  const resetOfficerDraft = (id: string) => {
    const updated = tickets.map((t) => {
      if (t.id === id) {
        return { ...t, officerDraft: t.officerDraftDefault };
      }
      return t;
    });
    saveTickets(updated);
  };

  const toggleChecklistItem = (ticketId: string, itemId: string) => {
    const updated = tickets.map((t) => {
      if (t.id === ticketId) {
        return {
          ...t,
          checklist: t.checklist.map((c) => (c.id === itemId ? { ...c, checked: !c.checked } : c)),
        };
      }
      return t;
    });
    saveTickets(updated);
  };

  const addTicketMessage = (
    ticketId: string,
    message: { senderId: string; senderName: string; senderRole: "student" | "officer" | "system"; content: string }
  ) => {
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const newMsg: TicketMessage = {
      id: `msg-${Date.now()}`,
      ...message,
      timestamp: timeStr,
    };
    const updated = tickets.map((t) => {
      if (t.id === ticketId) {
        return {
          ...t,
          messages: [...t.messages, newMsg],
        };
      }
      return t;
    });
    saveTickets(updated);
  };

  const submitGate2Response = (
    ticketId: string,
    actionType: "respond" | "request_info" | "resolve",
    customContent?: string
  ) => {
    const ticket = tickets.find((t) => t.id === ticketId);
    if (!ticket) return;

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const timestampFull = `${timeStr} · ${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(
      2,
      "0"
    )}`;

    let messageContent = customContent || ticket.officerDraft;
    let nextStatus: TicketStatus = ticket.status;
    let auditAction = "";

    if (actionType === "respond") {
      // Rule: Gửi phản hồi KHÔNG tự động chuyển sang resolved! Chuyển sang pending_officer
      nextStatus = "pending_officer";
      auditAction = "Cán bộ gửi phản hồi nghiệp vụ qua Cổng Kiểm duyệt 2 (Trạng thái: Chờ cán bộ)";
    } else if (actionType === "request_info") {
      nextStatus = "pending_officer";
      messageContent =
        customContent ||
        "Phòng Đào tạo & CTSV yêu cầu bạn gửi bổ sung ảnh chụp Thẻ sinh viên hoặc Giấy tờ chứng minh đối tượng chính sách để cán bộ hoàn tất hồ sơ.";
      auditAction = "Cán bộ gửi yêu cầu bổ sung hồ sơ chứng từ cho sinh viên";
    } else if (actionType === "resolve") {
      nextStatus = "resolved";
      messageContent =
        customContent ||
        "Hồ sơ đã được thẩm định đạt yêu cầu. Văn bản điện tử có ký số CA đã được phát hành thành công. Sinh viên có thể tải văn bản PDF tại trang này.";
      auditAction = "Cán bộ thẩm định đạt yêu cầu và phê duyệt hoàn tất hồ sơ (Resolved)";
    }

    const newMsg: TicketMessage = {
      id: `msg-${Date.now()}`,
      senderId: "OF001",
      senderName: "Trần Thu Hà (OF001)",
      senderRole: "officer",
      content: messageContent,
      timestamp: timeStr,
    };

    const newAuditLog = {
      id: `aud-${Date.now()}`,
      timestamp: timestampFull,
      source: "Cổng Kiểm duyệt Cán bộ (Submit 2)",
      action: auditAction,
      actor: "ThS. Trần Thu Hà (OF001)",
    };

    const updated = tickets.map((t) => {
      if (t.id === ticketId) {
        return {
          ...t,
          status: nextStatus,
          messages: [...t.messages, newMsg],
          auditLogs: [...t.auditLogs, newAuditLog],
        };
      }
      return t;
    });

    saveTickets(updated);
  };

  const addChatMessage = (msg: Omit<ChatMessage, "id" | "timestamp">) => {
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")} SA`;
    const newMsg: ChatMessage = {
      id: `cm-${Date.now()}`,
      timestamp: timeStr,
      ...msg,
    };

    setChatMessages((prev) => {
      const updatedMessages = [...prev, newMsg];

      // Sync into active chat session
      setChatSessions((prevSessions) => {
        return prevSessions.map((session) => {
          if (session.id === activeSessionId) {
            let sessionTag = session.tag;
            if (msg.level) {
              sessionTag = msg.level;
            }
            let updatedTitle = session.title;
            if (session.title === "Cuộc hội thoại mới" && msg.sender === "user") {
              updatedTitle = msg.text.slice(0, 38) + (msg.text.length > 38 ? "..." : "");
            }
            return {
              ...session,
              title: updatedTitle,
              tag: sessionTag,
              preview: msg.text.slice(0, 60),
              updatedAt: "Vừa xong",
              messages: updatedMessages,
              isL4HandoverActive: msg.actionCard === "l4_handover" ? true : session.isL4HandoverActive,
            };
          }
          return session;
        });
      });

      return updatedMessages;
    });
  };

  const resetAllDemoData = () => {
    try {
      localStorage.removeItem(LOCAL_STORAGE_KEY_TICKETS);
      localStorage.removeItem(LOCAL_STORAGE_KEY_USER);
      setTickets(INITIAL_TICKETS);
      setCurrentUser(DEMO_USERS.SV001);
      setL4HandoverActive(false);
      setGate1Open(false);
      setChatSessions(INITIAL_CHAT_SESSIONS);
      setActiveSessionId(INITIAL_CHAT_SESSIONS[0].id);
      setChatMessages(INITIAL_CHAT_SESSIONS[0].messages || []);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <StoreContext.Provider
      value={{
        theme,
        toggleTheme,
        currentUser,
        setCurrentUser,
        login,
        logout,
        tickets,
        getTicket,
        createTicket,
        updateTicketStatus,
        updateOfficerDraft,
        resetOfficerDraft,
        toggleChecklistItem,
        addTicketMessage,
        submitGate2Response,
        resetAllDemoData,
        chatSessions,
        activeSessionId,
        selectChatSession,
        createNewChatSession,
        deleteChatSession,
        chatMessages,
        addChatMessage,
        isL4HandoverActive,
        setL4HandoverActive,
        isGate1Open,
        setGate1Open,
        gate1FormData,
        setGate1FormData,
        lastUpdatedField,
        updateGate1Field,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error("useStore must be used within a StoreProvider");
  }
  return context;
}
