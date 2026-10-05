"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { formatDate } from "@/lib/format-date";
import {
  Send,
  Paperclip,
  Bot,
  BookOpen,
  FileText,
  ShieldAlert,
  ArrowRight,
  Plus,
  Sparkles,
  History,
  Trash2,
  Search,
  X,
  MessageSquare,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Submit1Modal } from "@/components/student/Submit1Modal";
import { StudentWorkspaceHub } from "@/components/student/StudentWorkspaceHub";
import { TicketSuccessCard } from "@/components/student/TicketSuccessCard";
import { useStore } from "@/lib/store";
import { LoadingState } from "@/components/shared/LoadingState";
import { DataAccessState } from "@/components/shared/DataAccessState";
import { AccessibleDialog } from "@/components/shared/AccessibleDialog";

export default function ChatPage() {
  const {
    currentUser,
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
    updateGate1Field,
    createTicket,
    tickets,
    isDataLoading,
  } = useStore();

  const [input, setInput] = useState("");
  const [mobileTab, setMobileTab] = useState<"chat" | "workspace">("chat");
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historySearch, setHistorySearch] = useState("");
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  const [isDeletingSession, setIsDeletingSession] = useState(false);
  const [deleteSessionError, setDeleteSessionError] = useState<string | null>(null);

  const handleDeleteSession = async () => {
    if (!sessionToDelete || isDeletingSession) return;
    setIsDeletingSession(true);
    setDeleteSessionError(null);
    try {
      await deleteChatSession(sessionToDelete);
      setSessionToDelete(null);
    } catch (error) {
      setDeleteSessionError(error instanceof Error ? error.message : "Đã có lỗi xảy ra");
    } finally {
      setIsDeletingSession(false);
    }
  };
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, isGate1Open]);

  if (isDataLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-transparent">
        <Navbar />
        <LoadingState title="Đang tải Trợ lý Học vụ..." description="Đang đồng bộ phiên tư vấn của bạn." />
      </div>
    );
  }

  if (!currentUser) return <DataAccessState requiredRole="student" />;

  if (currentUser.role !== "student") {
    return (
      <div className="min-h-screen flex flex-col bg-transparent">
        <Navbar />
        <main className="max-w-2xl mx-auto w-full p-8 text-center space-y-4">
          <h1 className="font-serif text-2xl font-normal text-[#1C1917] dark:text-[#FAFAF9]">Trợ lý Học vụ dành cho sinh viên</h1>
          <p className="text-sm text-[#78716C] dark:text-[#A8A29E]">Tài khoản cán bộ có thể xử lý hồ sơ tại Hàng chờ.</p>
          <Link href="/dashboard" className="inline-flex min-h-[44px] items-center px-5 py-2.5 rounded-none bg-[#78716C] hover:bg-[#57534E] dark:bg-[#A8A29E] dark:hover:bg-[#D6D3D1] text-[#FAFAF9] dark:text-[#1C1917] text-sm font-medium transition-colors">Mở Hàng chờ cán bộ</Link>
        </main>
      </div>
    );
  }

  const sessions = chatSessions || [];
  const filteredSessions = sessions.filter((s) => {
    if (!historySearch.trim()) return true;
    const query = historySearch.toLowerCase();
    return (
      s.title?.toLowerCase().includes(query) ||
      s.preview?.toLowerCase().includes(query) ||
      (s.tag && s.tag.toLowerCase().includes(query))
    );
  });

  const handleSelectSession = (sessionId: string) => {
    selectChatSession(sessionId);
    setIsHistoryOpen(false);
  };

  const handleNewChat = () => {
    createNewChatSession();
    setIsHistoryOpen(false);
  };

  // Handle Scenario Chips
  const handleTriggerL1 = () => {
    addChatMessage({
      sender: "user",
      text: "Quy định về việc xin cấp Giấy xác nhận sinh viên tạm hoãn NVQS hoặc vay vốn ngân hàng chính sách như thế nào?",
    });

    setTimeout(() => {
      addChatMessage({
        sender: "bot",
        level: "L1",
        text: "Chào bạn Nguyễn Văn An! Theo Quy chế Đào tạo (Điều 14, Khoản 2) ban hành năm 2024:\n\n• Bản điện tử (PDF ký số hợp lệ): Tự động xuất sau khi cán bộ đối soát dữ liệu đào tạo, tối đa 4 giờ làm việc.\n• Bản giấy: Nhận tại Bộ phận Một Cửa - Phòng Đào tạo (Bàn số 3, Tòa A1) sau 24 giờ kể từ khi cán bộ duyệt.",
        citation: {
          code: "QC-ĐT-2024-Đ14-K2",
          title: "Quy Chế Đào tạo Đại học số 245/QĐ-ĐH",
          quote:
            "Sinh viên nộp yêu cầu trực tuyến qua Cổng dịch vụ Campus 24/7. Thời gian xử lý dự kiến: 24–48 giờ làm việc. Phòng Đào tạo & CTSV sẽ thực hiện đối soát tự động tình trạng hồ sơ trước khi cán bộ duyệt.",
          source: "Trích xuất từ Cơ sở tri thức Học vụ V5.2",
        },
      });
    }, 400);
  };

  const handleTriggerL2 = () => {
    addChatMessage({
      sender: "user",
      text: "Mình muốn tạo yêu cầu cấp Giấy xác nhận tạm hoãn NVQS / Vay vốn ngân hàng cho kỳ này.",
    });

    setTimeout(() => {
      addChatMessage({
        sender: "bot",
        level: "L2",
        text: "Campus 24/7 đã tự động điền thông tin học vụ của bạn và mở biểu mẫu ở bên phải.\n\nBạn có thể yêu cầu tôi sửa tiếp thông tin, ví dụ: 'đổi sang bản giấy' hoặc 'đổi lý do thành...', hoặc mở biểu mẫu để tự chỉnh sửa.",
        actionCard: "submit1_prompt",
      });
      setGate1Open(true);
      setMobileTab("workspace");
    }, 400);
  };

  const handleTriggerL4 = () => {
    addChatMessage({
      sender: "user",
      text: "Mình khiếu nại điểm thi môn Cấu trúc Dữ liệu (IT3011). Điểm trên cổng hiển thị 5.5 trong khi giảng viên chấm phúc khảo trực tiếp tại phòng thi là 7.5 và đã có biên bản ký nhận.",
    });

    setTimeout(() => {
      setL4HandoverActive(true);

      // Create or update L4 ticket
      const existingL4 = tickets.find((t) => t.isL4);
      if (!existingL4) {
        createTicket({
          id: "TKT-2026-0098",
          code: "TKT-2026-0098",
          title: "Khiếu nại điểm thi môn Cấu trúc Dữ liệu (IT3011)",
          type: "complaint",
          priority: "high",
          priorityReason:
            "Khiếu nại sai lệch điểm thi kết thúc học phần môn IT3011 giữa hệ thống (5.5) và bài thi gốc (7.5). Đã ngắt AI và đóng gói Fact Sheet cho Hội đồng Khảo thí.",
          isL4: true,
        });
      }

      addChatMessage({
        sender: "bot",
        level: "L4",
        text: "Yêu cầu khiếu nại điểm thi môn IT3011 cần được cán bộ phụ trách kiểm tra trực tiếp. Trợ lý AI không can thiệp hoặc kết luận điểm số. Hồ sơ, biên bản và lịch sử trao đổi đã được chuyển cho ThS. Trần Thu Hà - Phòng Đào tạo để giải quyết.",
        actionCard: "l4_handover",
        ticketId: "TKT-2026-0098",
      });
    }, 400);
  };

  // Quick Agent Actions for Form Modification
  const handleQuickUpdateReason = (newReason: string) => {
    addChatMessage({
      sender: "user",
      text: `Đổi lý do xin giấy sang: "${newReason}"`,
    });
    updateGate1Field("reason", newReason);
    setGate1Open(true);

    setTimeout(() => {
      addChatMessage({
        sender: "bot",
        level: "L2",
        text: `Đã cập nhật biểu mẫu bên phải!\n\n• Lý do và nơi gửi: "${newReason}"\n\nBạn hãy kiểm tra lại thông tin rồi chọn "Gửi yêu cầu".`,
        actionCard: "submit1_prompt",
      });
    }, 300);
  };

  const handleQuickUpdateMethod = (method: "digital_pdf" | "paper_stamped") => {
    const isPaper = method === "paper_stamped";
    addChatMessage({
      sender: "user",
      text: isPaper
        ? "Đổi phương thức nhận sang: Bản giấy"
        : "Đổi phương thức nhận sang: Bản điện tử (PDF ký số)",
    });
    updateGate1Field("receiveMethod", method);
    setGate1Open(true);

    setTimeout(() => {
      addChatMessage({
        sender: "bot",
        level: "L2",
        text: isPaper
          ? "Đã chuyển phương thức nhận sang: Bản giấy\n\n• Địa điểm: Nhận tại Bộ phận Một Cửa (Bàn số 3, Tòa A1 - Phòng Đào tạo) sau 24 giờ kể từ khi cán bộ duyệt.\n\nBiểu mẫu bên phải đã được cập nhật."
          : "Đã chuyển phương thức nhận sang: Bản điện tử (PDF)\n\n• Phương thức: Nhận qua Cổng dịch vụ sinh viên sau tối đa 4 giờ làm việc kể từ khi cán bộ đối soát dữ liệu đào tạo.\n\nBiểu mẫu bên phải đã được cập nhật.",
        actionCard: "submit1_prompt",
      });
    }, 300);
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userText = input.trim();
    setInput("");

    addChatMessage({
      sender: "user",
      text: userText,
    });

    if (isL4HandoverActive) {
      // In L4 mode: AI is locked. Message is sent directly to officer
      setTimeout(() => {
        addChatMessage({
          sender: "system",
          text: "Tin nhắn bổ sung của bạn đã được chuyển tới Cán bộ phụ trách (ThS. Trần Thu Hà). Cán bộ sẽ phản hồi qua mục 'Yêu cầu của tôi'.",
        });
      }, 500);
      return;
    }

    const lower = userText.toLowerCase();

    // 1. Check if user is requesting to change reason / purpose of certificate
    const explicitReasonMatch =
      userText.match(/(?:đổi|sửa|thay|cập nhật)\s+(?:lý do|mục đích)(?:\s+(?:thành|sang|là|:))?\s*(.+)/i) ||
      userText.match(/(?:lý do|mục đích)(?:\s+(?:là|:))\s*(.+)/i);

    if (explicitReasonMatch && explicitReasonMatch[1]) {
      const newReason = explicitReasonMatch[1].trim();
      updateGate1Field("reason", newReason);
      setGate1Open(true);
      setTimeout(() => {
        addChatMessage({
          sender: "bot",
          level: "L2",
          text: `Đã cập nhật biểu mẫu cấp giấy cho bạn:\n\n• Lý do và nơi gửi: "${newReason}"\n\nBạn hãy kiểm tra lại thông tin ở bên phải rồi chọn "Gửi yêu cầu".`,
          actionCard: "submit1_prompt",
        });
      }, 350);
      return;
    }

    // 2. Check if user mentions changing receive method
    if (
      lower.includes("bản giấy") ||
      lower.includes("dấu đỏ") ||
      lower.includes("mộc đỏ") ||
      lower.includes("bàn 3") ||
      lower.includes("bản cứng")
    ) {
      updateGate1Field("receiveMethod", "paper_stamped");
      setGate1Open(true);
      setTimeout(() => {
        addChatMessage({
          sender: "bot",
          level: "L2",
          text: "Đã cập nhật phương thức nhận sang: Bản giấy - Nhận tại Bộ phận Một Cửa (Bàn số 3, Tòa A1 - Phòng Đào tạo) sau 24 giờ kể từ khi cán bộ duyệt.\n\nBiểu mẫu bên phải đã được cập nhật.",
          actionCard: "submit1_prompt",
        });
      }, 350);
      return;
    }

    if (
      lower.includes("bản điện tử") ||
      lower.includes("pdf") ||
      lower.includes("ký số") ||
      lower.includes("online") ||
      lower.includes("cổng sv")
    ) {
      updateGate1Field("receiveMethod", "digital_pdf");
      setGate1Open(true);
      setTimeout(() => {
        addChatMessage({
          sender: "bot",
          level: "L2",
          text: "Đã cập nhật phương thức nhận sang: Bản điện tử (PDF có ký số) - Tự động xuất qua Cổng dịch vụ sinh viên trong tối đa 4 giờ làm việc sau khi cán bộ đối soát.\n\nBiểu mẫu bên phải đã được cập nhật.",
          actionCard: "submit1_prompt",
        });
      }, 350);
      return;
    }

    // 3. Keyword detection for L4 Handover
    if (
      lower.includes("khiếu nại") ||
      lower.includes("sửa điểm") ||
      lower.includes("phúc khảo") ||
      lower.includes("sai điểm")
    ) {
      handleTriggerL4();
      return;
    }

    // 4. Keyword detection for creating/opening certificate request
    if (
      lower.includes("xin giấy") ||
      lower.includes("cấp giấy") ||
      lower.includes("xác nhận sinh viên") ||
      lower.includes("tạo đơn") ||
      lower.includes("mở form")
    ) {
      // Check if specific purpose is mentioned
      if (lower.includes("tạm hoãn") || lower.includes("nghĩa vụ quân sự") || lower.includes("nvqs")) {
        updateGate1Field(
          "reason",
          "Nộp Ban Chỉ huy Quân sự địa phương xin tạm hoãn gọi nhập ngũ năm 2026"
        );
      } else if (lower.includes("thực tập") || lower.includes("doanh nghiệp")) {
        updateGate1Field(
          "reason",
          "Nộp Đơn vị tiếp nhận Thực tập tốt nghiệp doanh nghiệp (Học kỳ 2)"
        );
      } else if (lower.includes("học bổng")) {
        updateGate1Field(
          "reason",
          "Nộp Hồ sơ xét duyệt Học bổng Khuyến khích Tài năng học kỳ 2"
        );
      } else {
        updateGate1Field(
          "reason",
          "Nộp Ngân hàng Chính sách Xã hội Chi nhánh Q. Thủ Đức (Học kỳ 2)"
        );
      }

      setGate1Open(true);
      setTimeout(() => {
        addChatMessage({
          sender: "bot",
          level: "L2",
          text: "Tôi đã điền sẵn thông tin học vụ và mở biểu mẫu ở bên phải cho bạn.\n\nBạn có thể kiểm tra trực tiếp hoặc nhờ tôi sửa bất kỳ trường nào, ví dụ: 'đổi sang bản giấy' hoặc 'đổi lý do thành...'.",
          actionCard: "submit1_prompt",
        });
      }, 350);
      return;
    }

    // 5. Default L1 Consultation
    setTimeout(() => {
      addChatMessage({
        sender: "bot",
        level: "L1",
        text: `Cảm ơn câu hỏi của bạn về: "${userText}". Trợ lý Học vụ Campus 24/7 đang kiểm tra quy chế đào tạo... Hiện tại hệ thống hỗ trợ tốt nhất cho 2 dịch vụ chính:\n\n1. Xin cấp Giấy xác nhận sinh viên - Có hỗ trợ điền và sửa biểu mẫu trực tiếp bằng chat.\n2. Tiếp nhận và điều phối khiếu nại học vụ.\n\nBạn có thể thử gõ "đổi sang bản giấy" hoặc "đổi lý do thành..." để trợ lý cập nhật biểu mẫu bên phải.`,
      });
    }, 400);
  };

  const handleGate1Success = (ticketId: string) => {
    setGate1Open(false);
    addChatMessage({
      sender: "bot",
      level: "L2",
      text: "Yêu cầu cấp Giấy xác nhận sinh viên của bạn đã được tiếp nhận thành công vào hệ thống!",
      actionCard: "submit1_success",
      ticketId,
    });
  };

  return (
    <div className="min-h-screen h-[100dvh] flex flex-col bg-transparent transition-colors overflow-hidden">
      <div className="shrink-0">
        <Navbar />
      </div>

      {/* Subheader: Student Info Bar */}
      <div className="shrink-0 w-full border-b border-[#E7E5E4] dark:border-[#292524] bg-[#F5F5F4]/95 dark:bg-[#1C1917]/95 px-4 sm:px-6 lg:px-8 py-2">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 text-[13px]">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-medium text-[#1C1917] dark:text-[#FAFAF9] truncate">
              {currentUser.name}
            </span>
            <span className="text-[#78716C] dark:text-[#A8A29E]">·</span>
            <span className="text-[#78716C] dark:text-[#A8A29E] truncate">
              {currentUser.mssv || currentUser.id} · {currentUser.major || "Khoa CNPM"}
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              setGate1Open(!isGate1Open);
              setMobileTab("workspace");
            }}
            className={`inline-flex min-h-[44px] items-center gap-1.5 px-3.5 py-1.5 rounded-none border font-medium text-[13px] transition-colors shrink-0 ${
              isGate1Open
                ? "border-[#78716C] dark:border-[#A8A29E] bg-[#E7E5E4] dark:bg-[#292524] text-[#1C1917] dark:text-[#FAFAF9]"
                : "border-[#E7E5E4] dark:border-[#292524] bg-[#FAFAF9] dark:bg-[#141210] text-[#57534E] dark:text-[#A8A29E] hover:bg-[#F5F5F4] dark:hover:bg-[#1C1917]"
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{isGate1Open ? "Đang mở biểu mẫu" : "Yêu cầu mới"}</span>
          </button>
        </div>
      </div>

      {/* Mobile and tablet screen switcher (<1280px) */}
      <div className="shrink-0 xl:hidden max-w-7xl w-full mx-auto px-4 pt-2.5 flex gap-2">
        <button
          type="button"
          onClick={() => setMobileTab("chat")}
          className={`flex-1 min-h-[44px] py-2 rounded-none text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
            mobileTab === "chat"
              ? "bg-[#78716C] text-[#FAFAF9] dark:bg-[#A8A29E] dark:text-[#1C1917]"
              : "bg-[#FAFAF9] dark:bg-[#141210] border border-[#E7E5E4] dark:border-[#292524] text-[#57534E] dark:text-[#A8A29E]"
          }`}
        >
          <Bot className="w-3.5 h-3.5" />
          <span>Trợ lý AI</span>
        </button>
        <button
          type="button"
          onClick={() => setMobileTab("workspace")}
          className={`flex-1 min-h-[44px] py-2 rounded-none text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
            mobileTab === "workspace"
              ? "bg-[#78716C] text-[#FAFAF9] dark:bg-[#A8A29E] dark:text-[#1C1917]"
              : "bg-[#FAFAF9] dark:bg-[#141210] border border-[#E7E5E4] dark:border-[#292524] text-[#57534E] dark:text-[#A8A29E]"
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>{isGate1Open ? "Biểu mẫu yêu cầu" : "Hồ sơ & biểu mẫu"}</span>
        </button>
      </div>

      {/* Main Workspace Area: Consistent Two-Column Layout on Desktop */}
      <div className="flex-1 min-h-0 max-w-7xl w-full mx-auto p-3 sm:p-4 lg:p-5 flex flex-col xl:flex-row gap-4 xl:gap-6 overflow-hidden">
        {/* Left Column: Chat Workspace */}
        <div
          className={`relative flex flex-col h-full min-h-0 bg-[#FAFAF9] dark:bg-[#141210] border border-[#E7E5E4] dark:border-[#292524] rounded-none shadow-none overflow-hidden transition-all duration-300 w-full ${
            mobileTab === "workspace" ? "hidden xl:flex" : "flex"
          } xl:w-[55%]`}
        >
          {/* Collapsible History Drawer Backdrop */}
          {isHistoryOpen && (
            <div
              className="absolute inset-0 bg-[#141210]/40 z-30 transition-opacity"
              onClick={() => setIsHistoryOpen(false)}
            />
          )}

          {/* Collapsible Chat History Drawer */}
          <div
            className={`absolute inset-y-0 left-0 z-40 w-72 sm:w-80 flex flex-col bg-[#F5F5F4] dark:bg-[#1C1917] border-r border-[#E7E5E4] dark:border-[#292524] shadow-none transition-transform duration-300 ease-out ${
              isHistoryOpen ? "translate-x-0" : "-translate-x-full pointer-events-none"
            }`}
            hidden={!isHistoryOpen}
            aria-hidden={!isHistoryOpen}
          >
            {/* Drawer Header */}
            <div className="p-3.5 border-b border-[#E7E5E4] dark:border-[#292524] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-none border border-[#78716C] bg-[#1C1917] text-[#FAFAF9] dark:bg-[#FAFAF9] dark:text-[#1C1917] flex items-center justify-center">
                  <History className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-serif text-xs font-normal text-[#1C1917] dark:text-[#FAFAF9]">Lịch sử chat</h3>
                  <p className="text-[10px] text-[#78716C] dark:text-[#A8A29E]">Các phiên tư vấn AI</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsHistoryOpen(false)}
                aria-label="Đóng lịch sử chat"
                className="p-1.5 rounded-none text-[#78716C] hover:text-[#1C1917] dark:hover:text-[#FAFAF9] hover:bg-[#E7E5E4] dark:hover:bg-[#292524] transition-colors"
                title="Đóng lịch sử"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Actions: New Chat & Search */}
            <div className="p-3 border-b border-[#E7E5E4] dark:border-[#292524] space-y-2.5">
              <button
                type="button"
                onClick={handleNewChat}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-none bg-[#78716C] hover:bg-[#57534E] dark:bg-[#A8A29E] dark:hover:bg-[#D6D3D1] text-[#FAFAF9] dark:text-[#1C1917] font-medium text-xs transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Cuộc trò chuyện mới</span>
              </button>

              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#78716C] dark:text-[#A8A29E]" />
                <input
                  type="text"
                  aria-label="Tìm kiếm phiên chat"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder="Tìm kiếm phiên chat..."
                  className="w-full pl-8 pr-7 py-1.5 text-xs rounded-none bg-[#FAFAF9] dark:bg-[#141210] border border-[#E7E5E4] dark:border-[#292524] focus:outline-none focus:border-[#78716C] text-[#1C1917] dark:text-[#FAFAF9] placeholder:text-[#78716C]"
                />
                {historySearch && (
                  <button
                    type="button"
                    onClick={() => setHistorySearch("")}
                    aria-label="Xóa tìm kiếm phiên chat"
                    className="absolute right-2 top-2 text-[#78716C] hover:text-[#1C1917] text-xs"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>

            {/* Session List */}
            <div className="flex-1 overflow-y-auto overscroll-contain p-2.5 space-y-1 text-xs">
              {filteredSessions.length === 0 ? (
                <div className="text-center py-8 text-[#78716C] dark:text-[#A8A29E] text-xs">
                  Không tìm thấy cuộc trò chuyện nào
                </div>
              ) : (
                filteredSessions.map((sess) => {
                  const isActive = sess.id === activeSessionId;
                  const tagColors: Record<string, string> = {
                    L1: "border border-[#78716C] text-[#78716C] dark:border-[#A8A29E] dark:text-[#A8A29E]",
                    L2: "border border-[#57534E] text-[#57534E] dark:border-[#78716C] dark:text-[#78716C]",
                    L4: "border border-[#B45309] text-[#B45309] dark:border-[#FBBF24] dark:text-[#FBBF24]",
                    Chung: "border border-[#E7E5E4] text-[#78716C] dark:border-[#292524] dark:text-[#A8A29E]",
                  };
                  const badgeClass = tagColors[sess.tag || "Chung"] || tagColors.Chung;
                  const tagLabel =
                    sess.tag === "L1"
                      ? "Tra cứu quy chế"
                      : sess.tag === "L2"
                      ? "Cấp giấy"
                      : sess.tag === "L4"
                      ? "Khiếu nại"
                      : "Chung";

                  return (
                    <div
                      key={sess.id}
                      onClick={() => handleSelectSession(sess.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          handleSelectSession(sess.id);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      aria-pressed={isActive}
                      aria-label={`Mở phiên chat ${sess.title}`}
                      className={`group relative p-2.5 rounded-none border transition-colors cursor-pointer ${
                        isActive
                          ? "bg-[#E7E5E4] dark:bg-[#292524] border-[#78716C] dark:border-[#A8A29E]"
                          : "bg-transparent hover:bg-[#FAFAF9] dark:hover:bg-[#141210] border-transparent hover:border-[#E7E5E4] dark:hover:border-[#292524]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1.5 mb-1">
                        <span className={`text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.2 rounded-none font-medium ${badgeClass}`}>
                          {tagLabel}
                        </span>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-[#78716C] dark:text-[#A8A29E]">{formatDate(sess.updatedAt)}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSessionToDelete(sess.id);
                            }}
                            aria-label={`Xóa phiên chat ${sess.title}`}
                            className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 p-1 text-[#78716C] hover:text-[#B91C1C] hover:bg-[#FEE2E2] dark:hover:bg-[#450A0A]/40 rounded-none transition-colors"
                            title="Xoá phiên chat"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      <div className={`font-medium truncate text-xs ${isActive ? "text-[#1C1917] dark:text-[#FAFAF9]" : "text-[#1C1917] dark:text-[#FAFAF9]"}`}>
                        {sess.title}
                      </div>

                      <div className="text-[11px] text-[#78716C] dark:text-[#A8A29E] line-clamp-1 mt-0.5">
                        {sess.preview}
                      </div>

                      <div className="mt-1.5 flex items-center justify-between text-[10px] text-[#78716C] dark:text-[#A8A29E]">
                        <span className="flex items-center gap-1">
                          <MessageSquare className="w-3 h-3 text-[#78716C] dark:text-[#A8A29E]" />
                          {sess.messages.length} tin nhắn
                        </span>
                        {sess.isL4HandoverActive && (
                          <span className="text-[#B45309] dark:text-[#FBBF24] font-medium">Đã bàn giao cán bộ</span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Drawer Footer: Explain Difference with Lịch Sử Học Vụ */}
            <div className="p-3 border-t border-[#E7E5E4] dark:border-[#292524] bg-[#F5F5F4] dark:bg-[#1C1917] space-y-2">
              <div className="flex items-start gap-2 text-[11px] text-[#78716C] dark:text-[#A8A29E]">
                <BookOpen className="w-3.5 h-3.5 text-[#78716C] dark:text-[#A8A29E] shrink-0 mt-0.5" />
                <div>
                  <span className="font-serif font-normal text-xs text-[#1C1917] dark:text-[#FAFAF9]">
                    Khác gì với Lịch sử học vụ?
                  </span>
                  <p className="text-[10px] text-[#78716C] dark:text-[#A8A29E] mt-0.5 leading-snug">
                    Lịch sử chat là các trao đổi với trợ lý. Để xem hồ sơ và yêu cầu đã gửi kèm trạng thái xử lý:
                  </p>
                </div>
              </div>
              <Link
                href="/my-requests"
                className="w-full py-2 px-3 rounded-none bg-[#FAFAF9] hover:bg-[#E7E5E4] dark:bg-[#141210] dark:hover:bg-[#292524] border border-[#E7E5E4] dark:border-[#292524] text-[#1C1917] dark:text-[#FAFAF9] text-xs font-medium flex items-center justify-between transition-colors shadow-none"
              >
                <span className="flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-[#78716C] dark:text-[#A8A29E]" />
                  <span>Mở Lịch sử học vụ</span>
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-[#78716C] dark:text-[#A8A29E]" />
              </Link>
            </div>
          </div>

          {/* Chat Header */}
          <div className="shrink-0 p-3 sm:p-4 bg-[#F5F5F4] dark:bg-[#1C1917] border-b border-[#E7E5E4] dark:border-[#292524] flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setIsHistoryOpen(!isHistoryOpen)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-none border text-[13px] font-medium transition-colors ${
                  isHistoryOpen
                    ? "bg-[#78716C] text-[#FAFAF9] border-[#78716C] dark:bg-[#A8A29E] dark:text-[#1C1917] dark:border-[#A8A29E]"
                    : "bg-[#FAFAF9] dark:bg-[#141210] border-[#E7E5E4] dark:border-[#292524] text-[#57534E] dark:text-[#A8A29E] hover:bg-[#F5F5F4] dark:hover:bg-[#1C1917]"
                }`}
                title="Mở lịch sử chat"
              >
                <History className="w-4 h-4" />
                <span className="hidden sm:inline">Lịch sử</span>
                <span className="text-[11px] px-1.5 py-0.5 rounded-none bg-[#E7E5E4] dark:bg-[#292524] text-[#1C1917] dark:text-[#FAFAF9] font-mono">
                  {(chatSessions || []).length}
                </span>
              </button>

              <div className="w-8 h-8 rounded-none border border-[#78716C] bg-[#1C1917] text-[#FAFAF9] dark:bg-[#FAFAF9] dark:text-[#1C1917] flex items-center justify-center font-bold">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <div className="font-serif font-normal text-base text-[#1C1917] dark:text-[#FAFAF9]">
                  Trợ lý Học vụ
                </div>
                <div className="text-[12px] text-[#78716C] dark:text-[#A8A29E]">
                  Hỗ trợ thủ tục đào tạo &amp; cấp giấy tờ
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleNewChat}
                className="hidden sm:flex min-h-[44px] items-center gap-1.5 px-2.5 py-1.5 rounded-none text-[13px] font-medium text-[#78716C] dark:text-[#A8A29E] hover:bg-[#E7E5E4] dark:hover:bg-[#292524] transition-colors"
                title="Tạo cuộc trò chuyện mới"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Trò chuyện mới</span>
              </button>

              <button
                type="button"
                onClick={() => setGate1Open(!isGate1Open)}
                className={`min-h-[44px] px-2.5 py-1.5 rounded-none text-[13px] font-medium transition-colors ${
                  isGate1Open
                    ? "bg-[#78716C] text-[#FAFAF9] dark:bg-[#A8A29E] dark:text-[#1C1917]"
                    : "bg-[#FAFAF9] dark:bg-[#141210] border border-[#E7E5E4] dark:border-[#292524] text-[#57534E] dark:text-[#A8A29E] hover:bg-[#F5F5F4] dark:hover:bg-[#1C1917]"
                }`}
              >
                {isGate1Open ? "Đóng biểu mẫu" : "Mở biểu mẫu"}
              </button>
            </div>
          </div>

          {/* Quick Scenario Chips */}
          <div role="group" aria-label="Gợi ý thao tác nhanh" className="px-4 py-2 bg-[#FAFAF9] dark:bg-[#141210] border-b border-[#E7E5E4] dark:border-[#292524] flex flex-nowrap sm:flex-wrap items-center gap-2 overflow-x-auto sm:overflow-visible overscroll-contain text-[12px]">
            <span className="text-[#78716C] dark:text-[#A8A29E] font-medium shrink-0">
              Bạn có thể bắt đầu với:
            </span>
            <button
              type="button"
              onClick={handleTriggerL1}
              className="shrink-0 min-h-[44px] flex items-center gap-1.5 px-2.5 py-1.5 rounded-none bg-[#F5F5F4] dark:bg-[#1C1917] border border-[#E7E5E4] dark:border-[#292524] hover:border-[#78716C] dark:hover:border-[#A8A29E] text-[#1C1917] dark:text-[#FAFAF9] transition-colors"
            >
              <BookOpen className="w-3.5 h-3.5 text-[#78716C] dark:text-[#A8A29E]" />
              <span>Tra cứu quy chế</span>
            </button>

            <button
              type="button"
              onClick={handleTriggerL2}
              className="shrink-0 min-h-[44px] flex items-center gap-1.5 px-2.5 py-1.5 rounded-none bg-[#F5F5F4] dark:bg-[#1C1917] border border-[#E7E5E4] dark:border-[#292524] hover:border-[#78716C] dark:hover:border-[#A8A29E] text-[#1C1917] dark:text-[#FAFAF9] transition-colors"
            >
              <FileText className="w-3.5 h-3.5 text-[#78716C] dark:text-[#A8A29E]" />
              <span>Tạo yêu cầu cấp giấy</span>
            </button>

            <button
              type="button"
              onClick={handleTriggerL4}
              className="shrink-0 min-h-[44px] flex items-center gap-1.5 px-2.5 py-1.5 rounded-none bg-[#F5F5F4] dark:bg-[#1C1917] border border-[#E7E5E4] dark:border-[#292524] hover:border-[#78716C] dark:hover:border-[#A8A29E] text-[#1C1917] dark:text-[#FAFAF9] transition-colors"
            >
              <MessageSquare className="w-3.5 h-3.5 text-[#78716C] dark:text-[#A8A29E]" />
              <span>Khiếu nại điểm thi</span>
            </button>
          </div>

          {/* Chat Messages Feed */}
          <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-4 text-[13px]">
            <div className="text-center">
              <span className="text-[11px] font-mono text-[#78716C] dark:text-[#A8A29E] px-3 py-1 rounded-none bg-[#E7E5E4] dark:bg-[#292524]">
                Phiên tư vấn học vụ
              </span>
            </div>

            {chatMessages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 max-w-[90%] sm:max-w-[85%] ${
                  msg.sender === "user" ? "ml-auto flex-row-reverse" : ""
                }`}
              >
                {/* Avatar */}
                <div
                  className={`w-8 h-8 rounded-none flex items-center justify-center shrink-0 ${
                    msg.sender === "user"
                      ? "bg-[#78716C] text-[#FAFAF9] font-mono text-xs"
                      : "border border-[#78716C] bg-[#1C1917] text-[#FAFAF9] dark:bg-[#FAFAF9] dark:text-[#1C1917]"
                  }`}
                >
                  {msg.sender === "user" ? "SV" : <Bot className="w-4 h-4" />}
                </div>

                <div className="space-y-2">
                  <div
                    className={`p-4 rounded-none leading-relaxed whitespace-pre-line text-xs ${
                      msg.sender === "user"
                        ? "bg-[#78716C] text-[#FAFAF9] dark:bg-[#A8A29E] dark:text-[#1C1917]"
                        : "bg-[#F5F5F4] dark:bg-[#1C1917] text-[#1C1917] dark:text-[#FAFAF9] border border-[#E7E5E4] dark:border-[#292524]"
                    }`}
                  >
                    {msg.text}

                    {/* Citation block for L1 */}
                    {msg.citation && (
                      <div className="mt-3 p-3 rounded-none bg-[#FAFAF9] dark:bg-[#141210] border border-[#E7E5E4] dark:border-[#292524] border-l-2 border-l-[#78716C] text-[#1C1917] dark:text-[#FAFAF9] space-y-1.5 shadow-none">
                        <div className="flex items-center justify-between text-[11px] font-medium text-[#78716C] dark:text-[#A8A29E]">
                          <span className="flex items-center gap-1.5">
                            <BookOpen className="w-3.5 h-3.5" />
                            Văn bản tham khảo
                          </span>
                          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-none bg-[#E7E5E4] dark:bg-[#292524] text-[#1C1917] dark:text-[#FAFAF9]">
                            {msg.citation.code}
                          </span>
                        </div>
                        <div className="font-serif font-normal text-xs text-[#1C1917] dark:text-[#FAFAF9]">
                          {msg.citation.title}
                        </div>
                        <blockquote className="text-[11px] italic text-[#57534E] dark:text-[#D6D3D1] border-l-2 border-[#78716C] pl-2 my-1">
                          &ldquo;{msg.citation.quote}&rdquo;
                        </blockquote>
                        <div className="text-[10px] text-[#78716C] dark:text-[#A8A29E] flex items-center pt-1">
                          <span>Nguồn: {msg.citation.source}</span>
                        </div>
                      </div>
                    )}

                    {/* Prompt card with live form editing chips */}
                    {msg.actionCard === "submit1_prompt" && (
                      <div className="mt-3 p-3.5 rounded-none bg-[#FAFAF9] dark:bg-[#141210] border border-[#E7E5E4] dark:border-[#292524] shadow-none space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 font-serif text-xs font-normal text-[#1C1917] dark:text-[#FAFAF9]">
                            <FileText className="w-4 h-4 text-[#78716C] dark:text-[#A8A29E]" />
                            <span>Phiếu yêu cầu: Cấp Giấy xác nhận sinh viên</span>
                          </div>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-none bg-[#F5F5F4] dark:bg-[#1C1917] text-[#78716C] dark:text-[#A8A29E] border border-[#E7E5E4] dark:border-[#292524]">
                            Mã biểu mẫu: BM-03
                          </span>
                        </div>

                        <p className="text-[11px] text-[#57534E] dark:text-[#D6D3D1]">
                          Biểu mẫu chuẩn dùng cho các thủ tục hành chính công, vay vốn ngân hàng, tạm hoãn nghĩa vụ quân sự và hồ sơ thực tập doanh nghiệp.
                        </p>

                        {/* Interactive Agent Quick Controls for Modifying the Form */}
                        <div className="p-2 rounded-none bg-[#F5F5F4] dark:bg-[#1C1917] border border-[#E7E5E4] dark:border-[#292524] space-y-1.5">
                          <span className="text-[10px] font-mono uppercase tracking-wider text-[#78716C] dark:text-[#A8A29E] flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-[#78716C] dark:text-[#A8A29E]" />
                            <span>Điều chỉnh nhanh biểu mẫu:</span>
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                handleQuickUpdateReason(
                                  "Nộp Ban Chỉ huy Quân sự địa phương xin tạm hoãn gọi nhập ngũ năm 2026"
                                )
                              }
                              className="px-2 py-1 rounded-none text-[10px] font-medium bg-[#FAFAF9] dark:bg-[#141210] hover:bg-[#E7E5E4] dark:hover:bg-[#292524] border border-[#E7E5E4] dark:border-[#292524] text-[#1C1917] dark:text-[#FAFAF9] transition-colors"
                            >
                              Mục đích: Tạm hoãn NVQS
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleQuickUpdateReason(
                                  "Nộp Ngân hàng Chính sách Xã hội Chi nhánh Q. Thủ Đức (Học kỳ 2)"
                                )
                              }
                              className="px-2 py-1 rounded-none text-[10px] font-medium bg-[#FAFAF9] dark:bg-[#141210] hover:bg-[#E7E5E4] dark:hover:bg-[#292524] border border-[#E7E5E4] dark:border-[#292524] text-[#1C1917] dark:text-[#FAFAF9] transition-colors"
                            >
                              Mục đích: Vay vốn ngân hàng
                            </button>
                            <button
                              type="button"
                              onClick={() => handleQuickUpdateMethod("paper_stamped")}
                              className="px-2 py-1 rounded-none text-[10px] font-medium bg-[#FAFAF9] dark:bg-[#141210] hover:bg-[#E7E5E4] dark:hover:bg-[#292524] border border-[#E7E5E4] dark:border-[#292524] text-[#1C1917] dark:text-[#FAFAF9] transition-colors"
                            >
                              Cách nhận: Bản giấy
                            </button>
                            <button
                              type="button"
                              onClick={() => handleQuickUpdateMethod("digital_pdf")}
                              className="px-2 py-1 rounded-none text-[10px] font-medium bg-[#FAFAF9] dark:bg-[#141210] hover:bg-[#E7E5E4] dark:hover:bg-[#292524] border border-[#E7E5E4] dark:border-[#292524] text-[#1C1917] dark:text-[#FAFAF9] transition-colors"
                            >
                              Cách nhận: Bản điện tử (PDF)
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setGate1Open(true);
                              setMobileTab("workspace");
                            }}
                            className="flex-1 min-h-[44px] py-2.5 px-4 rounded-none bg-[#FAFAF9] hover:bg-[#E7E5E4] dark:bg-[#141210] dark:hover:bg-[#292524] border border-[#E7E5E4] dark:border-[#292524] text-[#1C1917] dark:text-[#FAFAF9] font-medium flex items-center justify-center gap-2 text-xs transition-colors"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>Mở lại biểu mẫu</span>
                          </button>
                        </div>
                        <div className="text-[10px] text-[#78716C] dark:text-[#A8A29E] flex items-center gap-1">
                          <ShieldAlert className="w-3 h-3 text-[#78716C] dark:text-[#A8A29E] shrink-0" />
                          <span>Mọi thay đổi trong chat được đồng bộ trực tiếp sang biểu mẫu.</span>
                        </div>
                      </div>
                    )}

                    {/* Submit 1 Success Card */}
                    {msg.actionCard === "submit1_success" && (
                      <div className="mt-3">
                        <TicketSuccessCard
                          ticketId={msg.ticketId || "TKT-2026-0142"}
                          ticketCode={msg.ticketId || "TKT-2026-0142"}
                          title="Cấp Giấy xác nhận sinh viên (BM-03)"
                        />
                      </div>
                    )}

                    {/* L4 Handover Card */}
                    {msg.actionCard === "l4_handover" && (
                      <div className="mt-3 p-4 rounded-none bg-[#F5F5F4] dark:bg-[#1C1917] border border-[#B45309]/30 dark:border-[#B45309]/50 text-[#1C1917] dark:text-[#FAFAF9] space-y-2.5">
                        <div className="flex items-center gap-2 font-medium text-[#B45309] dark:text-[#FBBF24] text-xs">
                          <ShieldAlert className="w-4 h-4 text-[#B45309] dark:text-[#FBBF24] shrink-0" />
                          <span>Hồ sơ đã được chuyển cho cán bộ phụ trách</span>
                        </div>
                        <p className="text-[11px] leading-relaxed text-[#57534E] dark:text-[#D6D3D1]">
                          Hệ thống đã tạo yêu cầu mã <strong>TKT-2026-0098</strong> và bàn giao cho <strong>ThS. Trần Thu Hà - Phòng Đào tạo</strong>.
                        </p>
                        <div className="pt-1 flex items-center justify-between text-[11px]">
                          <span className="text-[#78716C] dark:text-[#A8A29E]">
                            Thời gian xử lý dự kiến: trong vòng 2 giờ 15 phút
                          </span>
                          <Link
                            href="/my-requests"
                            className="font-medium text-[#78716C] dark:text-[#A8A29E] hover:text-[#1C1917] dark:hover:text-[#FAFAF9] underline-offset-4 hover:underline flex items-center gap-1"
                          >
                            <span>Xem tiến độ thụ lý</span>
                            <ArrowRight className="w-3 h-3" />
                          </Link>
                        </div>
                      </div>
                    )}
                  </div>

                  <div
                    className={`text-[10px] text-[#78716C] dark:text-[#A8A29E] ${
                      msg.sender === "user" ? "text-right" : "text-left"
                    }`}
                  >
                    {msg.timestamp}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat Composer */}
          <div className="shrink-0 p-3 sm:p-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-[#F5F5F4] dark:bg-[#1C1917] border-t border-[#E7E5E4] dark:border-[#292524]">
            {isL4HandoverActive && (
              <div className="mb-2 p-2 rounded-none bg-[#FAFAF9] dark:bg-[#141210] border border-[#B45309]/30 dark:border-[#B45309]/50 text-[#B45309] dark:text-[#FBBF24] text-[11px] flex items-center justify-between">
                <span className="flex items-center gap-1.5 font-medium">
                  <ShieldAlert className="w-3.5 h-3.5 text-[#B45309] dark:text-[#FBBF24] shrink-0" />
                  Kênh đã bàn giao cho cán bộ phụ trách. Trợ lý AI đã tạm dừng tư vấn tự động trên luồng này.
                </span>
                <span className="font-mono text-[10px] font-semibold">CHẾ ĐỘ BỔ SUNG THÔNG TIN</span>
              </div>
            )}

            <form onSubmit={handleSend} className="relative flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  aria-label={isL4HandoverActive ? "Gửi thông tin bổ sung" : "Nhập câu hỏi cho trợ lý học vụ"}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={
                    isL4HandoverActive
                      ? "Gửi thông tin hoặc tài liệu bổ sung cho cán bộ phụ trách..."
                      : "Nhập câu hỏi hoặc viết 'đổi sang bản giấy', 'sửa lý do thành...' (Ctrl + K)"
                  }
                  className="w-full pl-10 pr-20 py-2.5 sm:py-3 min-h-[44px] rounded-none bg-[#FAFAF9] dark:bg-[#141210] border border-[#E7E5E4] dark:border-[#292524] focus:outline-none focus:border-[#78716C] dark:focus:border-[#A8A29E] text-xs text-[#1C1917] dark:text-[#FAFAF9] placeholder:text-[#78716C] dark:placeholder:text-[#A8A29E] transition-colors shadow-none"
                />
                <button
                  type="button"
                  aria-label="Đính kèm chứng từ hoặc tài liệu"
                  title="Đính kèm chứng từ/tài liệu"
                  className="absolute left-3 top-3.5 sm:top-4 text-[#78716C] hover:text-[#1C1917] dark:hover:text-[#FAFAF9]"
                >
                  <Paperclip className="w-4 h-4" />
                </button>
                <span className="absolute right-3 top-3 sm:top-3.5 text-[10px] font-mono text-[#78716C] dark:text-[#A8A29E] hidden sm:inline-block">
                  Enter để gửi
                </span>
              </div>

              <button
                type="submit"
                disabled={!input.trim()}
                className="py-2.5 sm:py-3 px-4 sm:px-5 min-h-[44px] rounded-none bg-[#78716C] hover:bg-[#57534E] dark:bg-[#A8A29E] dark:hover:bg-[#D6D3D1] disabled:opacity-50 text-[#FAFAF9] dark:text-[#1C1917] font-medium text-xs flex items-center gap-1.5 transition-colors shrink-0 shadow-none"
              >
                <span>Gửi</span>
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>

            <div className="mt-2 flex items-center justify-between text-[10px] text-[#78716C] dark:text-[#A8A29E]">
              <span className="flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-[#78716C] dark:text-[#A8A29E]" />
                <span>Tin nhắn sẽ đồng bộ với biểu mẫu bên phải.</span>
              </span>
              <span className="font-mono" title="AI tham khảo dựa trên cơ sở tri thức; cần kiểm tra trước khi gửi hồ sơ.">
                Kiểm tra trước khi gửi
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Student Workspace */}
        <div
          className={`xl:w-[45%] w-full h-full min-h-0 shrink-0 transition-all duration-300 ${
            mobileTab === "chat" ? "hidden xl:flex" : "flex"
          } flex-col overflow-hidden`}
        >
          {isGate1Open ? (
            <Submit1Modal
              onSuccess={handleGate1Success}
              onCancel={() => setGate1Open(false)}
            />
          ) : (
            <StudentWorkspaceHub
              onOpenGate1={() => {
                setGate1Open(true);
                setMobileTab("workspace");
              }}
              onSelectPreset={(reason, method) => {
                updateGate1Field("reason", reason);
                if (method) updateGate1Field("receiveMethod", method);
                setGate1Open(true);
                setMobileTab("workspace");
              }}
            />
          )}
        </div>
      </div>

      {sessionToDelete && (
        <AccessibleDialog
          open={Boolean(sessionToDelete)}
          onClose={() => setSessionToDelete(null)}
          preventClose={isDeletingSession}
          labelledBy="delete-session-dialog-title"
          className="w-full max-w-sm rounded-none border border-[#E7E5E4] dark:border-[#292524] shadow-none"
        >
          <div className="p-6 bg-[#FAFAF9] dark:bg-[#1C1917] rounded-none space-y-4">
            <div className="flex items-center gap-3 text-[#B91C1C] dark:text-[#EF4444]">
              <div className="w-10 h-10 rounded-none bg-[#FEF2F2] dark:bg-[#450A0A]/40 border border-[#B91C1C]/30 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <h2 id="delete-session-dialog-title" className="font-serif text-base font-normal text-[#1C1917] dark:text-[#FAFAF9]">
                Xóa phiên trò chuyện?
              </h2>
            </div>
            <p className="text-sm text-[#78716C] dark:text-[#A8A29E]">
              Hành động này sẽ xóa vĩnh viễn tin nhắn trong phiên chat này và không thể hoàn tác.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              {deleteSessionError && (
                <div role="alert" className="text-xs text-[#B91C1C] dark:text-[#EF4444] mr-auto">{deleteSessionError}</div>
              )}
              <button
                type="button"
                onClick={() => setSessionToDelete(null)}
                disabled={isDeletingSession}
                className="px-4 py-2 rounded-none border border-[#E7E5E4] dark:border-[#292524] text-sm font-medium text-[#57534E] dark:text-[#D6D3D1] hover:bg-[#F5F5F4] dark:hover:bg-[#292524] transition-colors disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleDeleteSession}
                disabled={isDeletingSession}
                className="px-4 py-2 rounded-none bg-[#B91C1C] hover:bg-[#991B1B] text-white text-sm font-medium transition-colors shadow-none disabled:opacity-50 disabled:cursor-not-allowed focus-visible:opacity-100"
              >
                {isDeletingSession ? "Đang xóa..." : "Đồng ý xóa"}
              </button>
            </div>
          </div>
        </AccessibleDialog>
      )}
    </div>
  );
}
