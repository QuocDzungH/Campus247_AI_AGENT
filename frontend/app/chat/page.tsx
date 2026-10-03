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
        <main className="max-w-2xl mx-auto w-full p-8 text-center">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Trợ lý Học vụ dành cho sinh viên</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Tài khoản cán bộ có thể xử lý hồ sơ tại Hàng chờ.</p>
          <Link href="/dashboard" className="inline-flex mt-5 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold">Mở Hàng chờ cán bộ</Link>
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
      <div className="shrink-0 w-full border-b border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-900/95 px-4 sm:px-6 lg:px-8 py-2">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 text-[13px]">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-medium text-gray-900 dark:text-white truncate">
              {currentUser.name}
            </span>
            <span className="text-gray-400">·</span>
            <span className="text-gray-500 dark:text-gray-400 truncate">
              {currentUser.mssv || currentUser.id} · {currentUser.major || "Khoa CNPM"}
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              setGate1Open(!isGate1Open);
              setMobileTab("workspace");
            }}
            className={`inline-flex min-h-[44px] items-center gap-1.5 px-3.5 py-1.5 rounded-lg border font-medium text-[13px] transition-colors shrink-0 ${
              isGate1Open
                ? "border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300"
                : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
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
          className={`flex-1 min-h-[44px] py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
            mobileTab === "chat"
              ? "bg-blue-600 text-white shadow-sm"
              : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
          }`}
        >
          <Bot className="w-3.5 h-3.5" />
          <span>Trợ lý AI</span>
        </button>
        <button
          type="button"
          onClick={() => setMobileTab("workspace")}
          className={`flex-1 min-h-[44px] py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
            mobileTab === "workspace"
              ? "bg-blue-600 text-white shadow-sm"
              : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
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
          className={`relative flex flex-col h-full min-h-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden transition-all duration-300 w-full ${
            mobileTab === "workspace" ? "hidden xl:flex" : "flex"
          } xl:w-[55%]`}
        >
          {/* Collapsible History Drawer Backdrop */}
          {isHistoryOpen && (
            <div
              className="absolute inset-0 bg-slate-950/20 backdrop-blur-[2px] z-30 transition-opacity"
              onClick={() => setIsHistoryOpen(false)}
            />
          )}

          {/* Collapsible Chat History Drawer */}
          <div
            className={`absolute inset-y-0 left-0 z-40 w-72 sm:w-80 flex flex-col bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border-r border-white/60 dark:border-slate-800 shadow-2xl transition-transform duration-300 ease-out ${
              isHistoryOpen ? "translate-x-0" : "-translate-x-full pointer-events-none"
            }`}
            hidden={!isHistoryOpen}
            aria-hidden={!isHistoryOpen}
          >
            {/* Drawer Header */}
            <div className="p-3.5 border-b border-white/40 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <History className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-xs text-slate-900 dark:text-white">Lịch sử chat</h3>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">Các phiên tư vấn AI</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsHistoryOpen(false)}
                aria-label="Đóng lịch sử chat"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Đóng lịch sử"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Actions: New Chat & Search */}
            <div className="p-3 border-b border-white/30 dark:border-slate-800/80 space-y-2.5">
              <button
                type="button"
                onClick={handleNewChat}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-sm shadow-blue-500/20 transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Cuộc trò chuyện mới</span>
              </button>

              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  aria-label="Tìm kiếm phiên chat"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder="Tìm kiếm phiên chat..."
                  className="w-full pl-8 pr-7 py-1.5 text-xs rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-900 dark:text-white placeholder:text-slate-400"
                />
                {historySearch && (
                  <button
                    type="button"
                    onClick={() => setHistorySearch("")}
                    aria-label="Xóa tìm kiếm phiên chat"
                    className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 text-xs"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>

            {/* Session List */}
            <div className="flex-1 overflow-y-auto overscroll-contain p-2.5 space-y-1 text-xs">
              {filteredSessions.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  Không tìm thấy cuộc trò chuyện nào
                </div>
              ) : (
                filteredSessions.map((sess) => {
                  const isActive = sess.id === activeSessionId;
                  const tagColors: Record<string, string> = {
                    L1: "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800",
                    L2: "bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800",
                    L4: "bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800",
                    Chung: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700",
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
                      className={`group relative p-2.5 rounded-xl border transition-all cursor-pointer ${
                        isActive
                          ? "bg-blue-50/90 dark:bg-blue-950/50 border-blue-300 dark:border-blue-700 shadow-xs"
                          : "bg-transparent hover:bg-white/60 dark:hover:bg-slate-800/60 border-transparent hover:border-slate-200 dark:hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1.5 mb-1">
                        <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded border font-semibold ${badgeClass}`}>
                          {tagLabel}
                        </span>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-slate-400">{formatDate(sess.updatedAt)}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSessionToDelete(sess.id);
                            }}
                            aria-label={`Xóa phiên chat ${sess.title}`}
                            className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition-all"
                            title="Xoá phiên chat"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      <div className={`font-medium truncate text-xs ${isActive ? "text-blue-700 dark:text-blue-300" : "text-slate-900 dark:text-white"}`}>
                        {sess.title}
                      </div>

                      <div className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                        {sess.preview}
                      </div>

                      <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-400">
                        <span className="flex items-center gap-1">
                          <MessageSquare className="w-3 h-3 text-slate-400" />
                          {sess.messages.length} tin nhắn
                        </span>
                        {sess.isL4HandoverActive && (
                          <span className="text-amber-700 dark:text-amber-300 font-medium">Đã bàn giao cán bộ</span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Drawer Footer: Explain Difference with Lịch Sử Học Vụ */}
            <div className="p-3 border-t border-white/40 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 space-y-2">
              <div className="flex items-start gap-2 text-[11px] text-slate-600 dark:text-slate-400">
                <BookOpen className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    Khác gì với Lịch sử học vụ?
                  </span>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                    Lịch sử chat là các trao đổi với trợ lý. Để xem hồ sơ và yêu cầu đã gửi kèm trạng thái xử lý:
                  </p>
                </div>
              </div>
              <Link
                href="/my-requests"
                className="w-full py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold flex items-center justify-between transition-colors shadow-xs"
              >
                <span className="flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-blue-600" />
                  <span>Mở Lịch sử học vụ</span>
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
              </Link>
            </div>
          </div>

          {/* Chat Header */}
          <div className="shrink-0 p-3 sm:p-4 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setIsHistoryOpen(!isHistoryOpen)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[13px] font-medium transition-colors ${
                  isHistoryOpen
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                }`}
                title="Mở lịch sử chat"
              >
                <History className="w-4 h-4" />
                <span className="hidden sm:inline">Lịch sử</span>
                <span className="text-[11px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-medium">
                  {(chatSessions || []).length}
                </span>
              </button>

              <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <div className="font-semibold text-gray-900 dark:text-white text-[14px]">
                  Trợ lý Học vụ
                </div>
                <div className="text-[12px] text-gray-500 dark:text-gray-400">
                  Hỗ trợ thủ tục đào tạo &amp; cấp giấy tờ
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleNewChat}
                className="hidden sm:flex min-h-[44px] items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[13px] font-medium border border-transparent text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                title="Tạo cuộc trò chuyện mới"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Trò chuyện mới</span>
              </button>

              <button
                type="button"
                onClick={() => setGate1Open(!isGate1Open)}
                className={`min-h-[44px] px-2.5 py-1.5 rounded-lg text-[13px] font-medium transition-colors ${
                  isGate1Open
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                }`}
              >
                {isGate1Open ? "Đóng biểu mẫu" : "Mở biểu mẫu"}
              </button>
            </div>
          </div>

          {/* Quick Scenario Chips */}
          <div role="group" aria-label="Gợi ý thao tác nhanh" className="px-4 py-2 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700 flex flex-nowrap sm:flex-wrap items-center gap-2 overflow-x-auto sm:overflow-visible overscroll-contain text-[12px]">
            <span className="text-gray-500 dark:text-gray-400 font-medium shrink-0">
              Bạn có thể bắt đầu với:
            </span>
            <button
              type="button"
              onClick={handleTriggerL1}
              className="shrink-0 min-h-[44px] flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-blue-400 text-gray-700 dark:text-gray-300 transition-colors"
            >
              <BookOpen className="w-3.5 h-3.5 text-blue-500" />
              <span>Tra cứu quy chế</span>
            </button>

            <button
              type="button"
              onClick={handleTriggerL2}
              className="shrink-0 min-h-[44px] flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-blue-400 text-gray-700 dark:text-gray-300 transition-colors"
            >
              <FileText className="w-3.5 h-3.5 text-indigo-500" />
              <span>Tạo yêu cầu cấp giấy</span>
            </button>

            <button
              type="button"
              onClick={handleTriggerL4}
              className="shrink-0 min-h-[44px] flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-blue-400 text-gray-700 dark:text-gray-300 transition-colors"
            >
              <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
              <span>Khiếu nại điểm thi</span>
            </button>
          </div>

          {/* Chat Messages Feed */}
          <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-4 text-[13px]">
            <div className="text-center">
              <span className="text-[11px] text-gray-400 dark:text-gray-500 px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-800">
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
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
                    msg.sender === "user"
                      ? "bg-blue-600 text-white font-bold text-xs"
                      : "bg-gradient-to-tr from-indigo-600 to-blue-500 text-white"
                  }`}
                >
                  {msg.sender === "user" ? "SV" : <Bot className="w-4 h-4" />}
                </div>

                <div className="space-y-2">
                  <div
                    className={`p-4 rounded-2xl leading-relaxed whitespace-pre-line text-xs ${
                      msg.sender === "user"
                        ? "bg-blue-600 text-white rounded-tr-none shadow-md shadow-blue-500/20"
                        : "bg-white/70 dark:bg-slate-800/70 backdrop-blur-md text-slate-800 dark:text-slate-200 rounded-tl-none border border-white/60 dark:border-slate-700/60 shadow-sm"
                    }`}
                  >
                    {msg.text}

                    {/* Citation block for L1 */}
                    {msg.citation && (
                      <div className="mt-3 p-3 rounded-xl bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm border border-white/60 dark:border-slate-700/70 text-slate-800 dark:text-slate-200 space-y-1.5 shadow-xs">
                        <div className="flex items-center justify-between text-[11px] font-bold text-blue-700 dark:text-blue-300">
                          <span className="flex items-center gap-1.5">
                            <BookOpen className="w-3.5 h-3.5" />
                            Văn bản tham khảo
                          </span>
                          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/60">
                            {msg.citation.code}
                          </span>
                        </div>
                        <div className="font-semibold text-xs text-slate-900 dark:text-white">
                          {msg.citation.title}
                        </div>
                        <blockquote className="text-[11px] italic text-slate-600 dark:text-slate-400 border-l-2 border-blue-500 pl-2 my-1">
                          &ldquo;{msg.citation.quote}&rdquo;
                        </blockquote>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center pt-1">
                          <span>Nguồn: {msg.citation.source}</span>
                        </div>
                      </div>
                    )}

                    {/* Prompt card with live form editing chips */}
                    {msg.actionCard === "submit1_prompt" && (
                      <div className="mt-3 p-3.5 rounded-2xl bg-white/60 dark:bg-slate-900/60 backdrop-blur-md border border-white/70 dark:border-slate-700/70 shadow-none space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white text-xs">
                            <FileText className="w-4 h-4 text-blue-600" />
                            <span>Phiếu yêu cầu: Cấp Giấy xác nhận sinh viên</span>
                          </div>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                            Mã biểu mẫu: BM-03
                          </span>
                        </div>

                        <p className="text-[11px] text-slate-600 dark:text-slate-400">
                          Biểu mẫu chuẩn dùng cho các thủ tục hành chính công, vay vốn ngân hàng, tạm hoãn nghĩa vụ quân sự và hồ sơ thực tập doanh nghiệp.
                        </p>

                        {/* Interactive Agent Quick Controls for Modifying the Form */}
                        <div className="p-2 rounded-xl bg-white/40 dark:bg-slate-800/40 backdrop-blur-xs border border-white/50 dark:border-slate-700/60 space-y-1.5">
                          <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-blue-500" />
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
                              className="px-2 py-1 rounded-md text-[10px] font-medium bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/40 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-blue-600 transition-colors"
                            >
                              Mục đích: Tạm hoãn nghĩa vụ quân sự
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleQuickUpdateReason(
                                  "Nộp Ngân hàng Chính sách Xã hội Chi nhánh Q. Thủ Đức (Học kỳ 2)"
                                )
                              }
                              className="px-2 py-1 rounded-md text-[10px] font-medium bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/40 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-blue-600 transition-colors"
                            >
                              Mục đích: Vay vốn ngân hàng
                            </button>
                            <button
                              type="button"
                              onClick={() => handleQuickUpdateMethod("paper_stamped")}
                              className="px-2 py-1 rounded-md text-[10px] font-medium bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/40 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-blue-600 transition-colors"
                            >
                              Cách nhận: Bản giấy
                            </button>
                            <button
                              type="button"
                              onClick={() => handleQuickUpdateMethod("digital_pdf")}
                              className="px-2 py-1 rounded-md text-[10px] font-medium bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/40 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-blue-600 transition-colors"
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
                            className="flex-1 min-h-[44px] py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-blue-50 dark:bg-slate-800 dark:hover:bg-blue-950/30 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold flex items-center justify-center gap-2 text-xs transition-colors"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>Mở lại biểu mẫu</span>
                          </button>
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                          <ShieldAlert className="w-3 h-3 text-amber-500 shrink-0" />
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
                      <div className="mt-3 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-900 dark:text-rose-200 space-y-2.5">
                        <div className="flex items-center gap-2 font-bold text-rose-700 dark:text-rose-300 text-xs">
                          <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                          <span>Hồ sơ đã được chuyển cho cán bộ phụ trách</span>
                        </div>
                        <p className="text-[11px] leading-relaxed text-slate-700 dark:text-slate-300">
                          Hệ thống đã tạo yêu cầu mã <strong>TKT-2026-0098</strong> và bàn giao cho <strong>ThS. Trần Thu Hà - Phòng Đào tạo</strong>.
                        </p>
                        <div className="pt-1 flex items-center justify-between text-[11px]">
                          <span className="text-slate-500 dark:text-slate-400">
                            Thời gian xử lý dự kiến: trong vòng 2 giờ 15 phút
                          </span>
                          <Link
                            href="/my-requests"
                            className="font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                          >
                            <span>Xem tiến độ thụ lý</span>
                            <ArrowRight className="w-3 h-3" />
                          </Link>
                        </div>
                      </div>
                    )}
                  </div>

                  <div
                    className={`text-[10px] text-slate-400 dark:text-slate-500 ${
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
          <div className="shrink-0 p-3 sm:p-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-white/30 dark:bg-slate-900/40 backdrop-blur-md border-t border-white/40 dark:border-slate-800">
            {isL4HandoverActive && (
              <div className="mb-2 p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-[11px] flex items-center justify-between backdrop-blur-xs">
                <span className="flex items-center gap-1.5 font-medium">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-500 shrink-0" />
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
                  className="w-full pl-10 pr-20 py-2.5 sm:py-3 min-h-[44px] rounded-2xl bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm border border-white/60 dark:border-slate-700/60 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:bg-white/90 dark:focus:bg-slate-900/90 transition-all shadow-xs"
                />
                <button
                  type="button"
                  aria-label="Đính kèm chứng từ hoặc tài liệu"
                  title="Đính kèm chứng từ/tài liệu"
                  className="absolute left-3 top-3.5 sm:top-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <Paperclip className="w-4 h-4" />
                </button>
                <span className="absolute right-3 top-3 sm:top-3.5 text-[10px] font-mono text-slate-500 dark:text-slate-400 hidden sm:inline-block">
                  Enter để gửi
                </span>
              </div>

              <button
                type="submit"
                disabled={!input.trim()}
                className="py-2.5 sm:py-3 px-4 sm:px-5 min-h-[44px] rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md shadow-blue-500/20 transition-all shrink-0"
              >
                <span>Gửi</span>
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>

            <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-blue-500" />
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
          className="w-full max-w-sm"
        >
          <div className="p-6 bg-white dark:bg-slate-900 rounded-3xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-500">
              <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-950/50 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <h2 id="delete-session-dialog-title" className="text-base font-bold text-slate-900 dark:text-white">
                Xóa phiên trò chuyện?
              </h2>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Hành động này sẽ xóa vĩnh viễn tin nhắn trong phiên chat này và không thể hoàn tác.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              {deleteSessionError && (
                <div role="alert" className="text-xs text-red-500 mr-auto">{deleteSessionError}</div>
              )}
              <button
                type="button"
                onClick={() => setSessionToDelete(null)}
                disabled={isDeletingSession}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleDeleteSession}
                disabled={isDeletingSession}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed focus-visible:opacity-100"
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
