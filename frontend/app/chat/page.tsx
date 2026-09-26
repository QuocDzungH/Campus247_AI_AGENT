"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  Send,
  Paperclip,
  Bot,
  BookOpen,
  FileText,
  AlertTriangle,
  ExternalLink,
  ShieldAlert,
  ArrowRight,
  Plus,
  Sparkles,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Submit1Modal } from "@/components/student/Submit1Modal";
import { StudentWorkspaceHub } from "@/components/student/StudentWorkspaceHub";
import { TicketSuccessCard } from "@/components/student/TicketSuccessCard";
import { useStore } from "@/lib/store";

export default function ChatPage() {
  const {
    currentUser,
    chatMessages,
    addChatMessage,
    isL4HandoverActive,
    setL4HandoverActive,
    isGate1Open,
    setGate1Open,
    gate1FormData,
    updateGate1Field,
    createTicket,
    tickets,
  } = useStore();

  const [input, setInput] = useState("");
  const [mobileTab, setMobileTab] = useState<"chat" | "workspace">("chat");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, isGate1Open]);

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
        text: "Chào bạn Nguyễn Văn An! Theo Quy chế Đào tạo L1 (Điều 14, Khoản 2) ban hành năm 2024:\n\n• Bản điện tử (PDF ký số hợp lệ): Tự động xuất sau khi Cán bộ đối soát CSDL đào tạo (tối đa 4 giờ làm việc).\n• Bản giấy (Đóng dấu mộc đỏ): Nhận tại Bộ phận Một Cửa - Phòng Đào tạo (Bàn số 3, Tòa A1) sau 24h kể từ khi cán bộ duyệt.",
        citation: {
          code: "QC-ĐT-2024-Đ14-K2",
          title: "Quy Chế Đào tạo Đại học số 245/QĐ-ĐH (Minh họa)",
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
        text: "Campus 24/7 đã tự động trích xuất lý lịch học vụ của sinh viên Nguyễn Văn An từ CSDL trường và mở Cổng Kiểm duyệt 1 (Cột bên phải).\n\nBạn có thể yêu cầu tôi sửa tiếp thông tin (ví dụ: 'đổi sang bản giấy' hoặc 'đổi lý do thành...') hoặc bấm trực tiếp nút bên dưới để chỉnh sửa.",
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
        text: "HỆ THỐNG AI ĐÃ KÍCH HOẠT CHẾ ĐỘ NGẮT TỰ ĐỘNG (L4 HANDOVER) THEO QUY CHẾ AN TOÀN HỌC THUẬT.\n\nNhận diện yêu cầu khiếu nại điểm thi môn IT3011 (trigger: DISPUTED_GRADE_EVENT). Theo nguyên tắc an toàn, Trợ lý AI không được phép can thiệp hoặc kết luận điểm số. Toàn bộ hồ sơ kèm biên bản và lịch sử đối thoại đã được niêm phong chuyển thẳng sang Bàn làm việc Cán bộ OF001 (ThS. Trần Thu Hà) để giải quyết.",
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
        text: `Đã cập nhật biểu mẫu bên phải!\n\n• Lý do & Nơi gửi: "${newReason}"\n\nBiểu mẫu ở Cột kiểm duyệt 1 (bên phải) đã đồng bộ tức thời và có hiệu ứng nháy sáng xác nhận. Bạn hãy kiểm tra lại và bấm "Xác nhận gửi hồ sơ" nhé!`,
        actionCard: "submit1_prompt",
      });
    }, 300);
  };

  const handleQuickUpdateMethod = (method: "digital_pdf" | "paper_stamped") => {
    const isPaper = method === "paper_stamped";
    addChatMessage({
      sender: "user",
      text: isPaper
        ? "Đổi phương thức nhận sang: Bản giấy (Dấu đỏ)"
        : "Đổi phương thức nhận sang: Bản điện tử (PDF ký số)",
    });
    updateGate1Field("receiveMethod", method);
    setGate1Open(true);

    setTimeout(() => {
      addChatMessage({
        sender: "bot",
        level: "L2",
        text: isPaper
          ? "Đã chuyển phương thức nhận sang: Bản giấy (Dấu đỏ)\n\n• Địa điểm: Nhận tại Bộ phận Một Cửa (Bàn số 3, Tòa A1 - Phòng Đào tạo) sau 24h kể từ khi Cán bộ duyệt.\n\nBiểu mẫu ở cột bên phải đã tự động tích chọn Bản giấy!"
          : "Đã chuyển phương thức nhận sang: Bản điện tử (PDF)\n\n• Phương thức: Nhận qua Cổng dịch vụ SV có Chữ ký số CA hợp lệ sau tối đa 4 giờ làm việc kể từ khi cán bộ đối soát CSDL đào tạo.\n\nBiểu mẫu ở cột bên phải đã tự động tích chọn Bản điện tử!",
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
          text: `Đã cập nhật biểu mẫu cấp giấy cho bạn:\n\n• Lý do & Nơi gửi: "${newReason}"\n\nBiểu mẫu ở Cột kiểm duyệt bên phải đã đồng bộ tức thời. Bạn hãy kiểm tra lại và bấm "Xác nhận gửi hồ sơ" nhé!`,
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
          text: "Đã cập nhật phương thức nhận sang: Bản giấy (Dấu đỏ) - Nhận tại Bộ phận Một Cửa (Bàn số 3, Tòa A1 - Phòng Đào tạo) sau 24h kể từ khi Cán bộ duyệt.\n\nBiểu mẫu ở cột bên phải đã tự động tích chọn Bản giấy!",
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
          text: "Đã cập nhật phương thức nhận sang: Bản điện tử (PDF có ký số CA) - Tự động xuất qua Cổng SV trong tối đa 4 giờ làm việc sau khi cán bộ đối soát.\n\nBiểu mẫu ở cột bên phải đã tự động tích chọn Bản điện tử!",
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
          text: "Tôi đã trích xuất lý lịch học vụ và mở sẵn Cổng Kiểm duyệt 1 (Cột bên phải) cho bạn.\n\nBạn có thể kiểm tra trực tiếp thông tin bên phải hoặc ra lệnh cho tôi sửa tiếp bất cứ trường nào (VD: 'đổi sang bản giấy' hoặc 'đổi lý do thành...').",
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
        text: `Cảm ơn câu hỏi của bạn về: "${userText}". Trợ lý Học vụ Campus 24/7 đang kiểm tra cơ sở dữ liệu quy chế đào tạo... Hiện tại hệ thống hỗ trợ tốt nhất cho 2 dịch vụ chính:\n\n1. Xin cấp Giấy xác nhận sinh viên (L2) - Có hỗ trợ điền và sửa form trực tiếp bằng chat!\n2. Tiếp nhận điều phối khiếu nại học vụ (L4).\n\nBạn có thể thử gõ "đổi sang bản giấy" hoặc "đổi lý do thành..." để trải nghiệm trợ lý chỉnh sửa form bên phải.`,
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
    <div className="h-screen max-h-screen flex flex-col bg-transparent transition-colors overflow-hidden">
      <div className="shrink-0">
        <Navbar />
      </div>

      {/* Subheader: Student Info Bar */}
      <div className="shrink-0 w-full border-b border-white/50 dark:border-white/10 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md px-4 sm:px-6 lg:px-8 py-2.5">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-600/10 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 font-bold flex items-center justify-center border border-blue-200/60 dark:border-blue-800/60 text-sm">
              NA
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 dark:text-white text-sm">
                  {currentUser.name}
                </span>
                <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-white/60 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border border-white/60 dark:border-slate-700 font-semibold backdrop-blur-xs">
                  {currentUser.id} · {currentUser.classYear || "K18 KTPM"}
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Tín chỉ: {currentUser.credits || "114 / 138 TC"}
                </span>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                <span>MSSV: {currentUser.mssv || currentUser.id}</span>
                <span>•</span>
                <span>{currentUser.major || "Khoa Công nghệ Phần mềm"}</span>
                <span>•</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                  Trạng thái học vụ: {currentUser.academicStatus || "Bình thường"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-blue-50/80 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800 backdrop-blur-xs">
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
              <span>Phân tích tự động: 3 Cấp độ (L1 / L2 / L4)</span>
            </div>

            <button
              type="button"
              onClick={() => {
                setGate1Open(!isGate1Open);
                setMobileTab("workspace");
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-sm shadow-blue-500/20 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isGate1Open ? "Đang mở Cổng 1" : "Tạo yêu cầu mới"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Screen Switcher (<1024px) */}
      <div className="shrink-0 lg:hidden max-w-7xl w-full mx-auto px-4 pt-2.5 flex gap-2">
        <button
          type="button"
          onClick={() => setMobileTab("chat")}
          className={`flex-1 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
            mobileTab === "chat"
              ? "bg-blue-600 text-white shadow-sm"
              : "glass-surface text-slate-600 dark:text-slate-400"
          }`}
        >
          <Bot className="w-3.5 h-3.5" />
          <span>Trợ lý AI Campus</span>
        </button>
        <button
          type="button"
          onClick={() => setMobileTab("workspace")}
          className={`flex-1 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
            mobileTab === "workspace"
              ? "bg-blue-600 text-white shadow-sm"
              : "glass-surface text-slate-600 dark:text-slate-400"
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>{isGate1Open ? "Cổng Kiểm duyệt 1 (Đơn)" : "Bàn làm việc & Hồ sơ"}</span>
        </button>
      </div>

      {/* Main Workspace Area: Consistent Two-Column Layout on Desktop */}
      <div className="flex-1 min-h-0 max-w-7xl w-full mx-auto p-3 sm:p-4 lg:p-5 flex flex-col lg:flex-row gap-4 lg:gap-6 overflow-hidden">
        {/* Left Column: Chat Workspace (Always 58% on Desktop) */}
        <div
          className={`flex-col h-full min-h-0 glass-surface rounded-3xl shadow-2xl overflow-hidden transition-all duration-300 lg:w-[58%] w-full ${
            mobileTab === "workspace" ? "hidden lg:flex" : "flex"
          }`}
        >
          {/* Chat Protocol Top Header */}
          <div className="shrink-0 p-3.5 sm:p-4 bg-white/30 dark:bg-slate-900/40 backdrop-blur-md border-b border-white/40 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">
                    Trợ Lý Học vụ Campus 24/7
                  </span>
                  <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-semibold border border-blue-200 dark:border-blue-700/50">
                    L1-L4 PROTOCOL
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  Hỗ trợ thủ tục đào tạo, cấp giấy tờ &amp; điều phối khiếu nại học tập tức thời
                </div>
              </div>
            </div>

            {/* Status Pills & Fast Switchers */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                AI Sẵn sàng 24/7
              </span>

              <button
                type="button"
                onClick={() => setGate1Open(!isGate1Open)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                  isGate1Open
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                {isGate1Open ? "Đóng Cổng 1" : "Mở Cổng 1"}
              </button>
            </div>
          </div>

          {/* Quick Scenario Chips */}
          <div className="px-4 py-2.5 bg-white/20 dark:bg-slate-900/30 border-b border-white/30 dark:border-slate-800 flex items-center gap-2 overflow-x-auto text-[11px] backdrop-blur-xs">
            <span className="text-slate-400 dark:text-slate-500 font-bold shrink-0">
              KỊCH BẢN GỢI Ý:
            </span>
            <button
              type="button"
              onClick={handleTriggerL1}
              className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white/60 dark:bg-slate-800/60 border border-white/60 dark:border-slate-700 hover:border-blue-500 text-slate-700 dark:text-slate-300 transition-all shadow-xs backdrop-blur-xs hover:bg-white/90"
            >
              <BookOpen className="w-3.5 h-3.5 text-blue-500" />
              <span>Hỏi quy chế cấp giấy xác nhận (L1)</span>
            </button>

            <button
              type="button"
              onClick={handleTriggerL2}
              className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white/60 dark:bg-slate-800/60 border border-white/60 dark:border-slate-700 hover:border-blue-500 text-slate-700 dark:text-slate-300 transition-all shadow-xs backdrop-blur-xs hover:bg-white/90"
            >
              <FileText className="w-3.5 h-3.5 text-indigo-500" />
              <span>Tạo yêu cầu cấp Giấy xác nhận (L2)</span>
            </button>

            <button
              type="button"
              onClick={handleTriggerL4}
              className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white/60 dark:bg-slate-800/60 border border-rose-200/80 dark:border-rose-900/60 hover:border-rose-500 text-rose-700 dark:text-rose-300 transition-all shadow-xs backdrop-blur-xs hover:bg-rose-50/80"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
              <span>Khiếu nại điểm thi kết thúc HP (L4)</span>
            </button>
          </div>

          {/* Chat Messages Feed */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 text-xs">
            <div className="text-center">
              <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-widest px-3 py-1 rounded-full bg-white/40 dark:bg-slate-800/40 border border-white/50 dark:border-slate-700/50 backdrop-blur-xs">
                PHIÊN GIAO DỊCH HỌC VỤ: #SEC-2026-9041 · ĐỒNG BỘ QUY CHẾ ĐHQG
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
                            VĂN BẢN THAM KHẢO (MINH HOẠ)
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
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center justify-between pt-1">
                          <span>{msg.citation.source}</span>
                          <span className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer flex items-center gap-0.5">
                            Xem văn bản gốc <ExternalLink className="w-2.5 h-2.5" />
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Submit 1 Prompt Card with Live Form Editing Chips */}
                    {msg.actionCard === "submit1_prompt" && (
                      <div className="mt-3 p-3.5 rounded-2xl bg-white/60 dark:bg-slate-900/60 backdrop-blur-md border border-white/70 dark:border-slate-700/70 shadow-sm space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white text-xs">
                            <FileText className="w-4 h-4 text-blue-600" />
                            <span>Phiếu yêu cầu: Cấp Giấy xác nhận sinh viên</span>
                          </div>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/60 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border border-white/40 dark:border-slate-700">
                            Mẫu BM-03
                          </span>
                        </div>

                        <p className="text-[11px] text-slate-600 dark:text-slate-400">
                          Biểu mẫu chuẩn dùng cho các thủ tục hành chính công, vay vốn ngân hàng, tạm hoãn nghĩa vụ quân sự và hồ sơ thực tập doanh nghiệp.
                        </p>

                        {/* Interactive Agent Quick Controls for Modifying the Form */}
                        <div className="p-2 rounded-xl bg-white/40 dark:bg-slate-800/40 backdrop-blur-xs border border-white/50 dark:border-slate-700/60 space-y-1.5">
                          <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-blue-500" />
                            <span>Yêu cầu AI sửa nhanh biểu mẫu bên phải:</span>
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
                              🏛️ Đổi: Tạm hoãn NVQS
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
                              🏦 Đổi: Vay vốn NHCSXH
                            </button>
                            <button
                              type="button"
                              onClick={() => handleQuickUpdateMethod("paper_stamped")}
                              className="px-2 py-1 rounded-md text-[10px] font-medium bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/40 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-blue-600 transition-colors"
                            >
                              📄 Nhận: Bản giấy (Dấu đỏ)
                            </button>
                            <button
                              type="button"
                              onClick={() => handleQuickUpdateMethod("digital_pdf")}
                              className="px-2 py-1 rounded-md text-[10px] font-medium bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/40 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-blue-600 transition-colors"
                            >
                              💻 Nhận: Bản điện tử (PDF)
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
                            className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold flex items-center justify-center gap-2 shadow-sm text-xs transition-all"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>Kiểm tra &amp; Gửi đơn ở Cột bên phải</span>
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
                          <span>Hồ sơ đã được chuyển tiếp sang Cán bộ hỗ trợ (L4)</span>
                        </div>
                        <p className="text-[11px] leading-relaxed text-slate-700 dark:text-slate-300">
                          Hệ thống đã tự động tạo Ticket khẩn cấp mã <strong>TKT-2026-0098</strong> và bàn giao cho <strong>ThS. Trần Thu Hà (OF001 - Phòng Đào tạo)</strong>.
                        </p>
                        <div className="pt-1 flex items-center justify-between text-[11px]">
                          <span className="text-slate-500 dark:text-slate-400">
                            SLA xử lý khẩn cấp: Trong vòng 2h15m
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
          <div className="shrink-0 p-3 sm:p-4 bg-white/30 dark:bg-slate-900/40 backdrop-blur-md border-t border-white/40 dark:border-slate-800">
            {isL4HandoverActive && (
              <div className="mb-2 p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-[11px] flex items-center justify-between backdrop-blur-xs">
                <span className="flex items-center gap-1.5 font-medium">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  Kênh đã bàn giao cho Cán bộ OF001. AI đã tạm dừng tư vấn tự động trên luồng này.
                </span>
                <span className="font-mono text-[10px] font-semibold">CHẾ ĐỘ BỔ SUNG THÔNG TIN</span>
              </div>
            )}

            <form onSubmit={handleSend} className="relative flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={
                    isL4HandoverActive
                      ? "Gửi thông tin hoặc tài liệu bổ sung cho cán bộ phụ trách..."
                      : "Nhập câu hỏi, hoặc gõ 'đổi sang bản giấy', 'đổi lý do thành...' (Ctrl + K)"
                  }
                  className="w-full pl-10 pr-20 py-2.5 sm:py-3 rounded-2xl bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm border border-white/60 dark:border-slate-700/60 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:bg-white/90 dark:focus:bg-slate-900/90 transition-all shadow-xs"
                />
                <button
                  type="button"
                  title="Đính kèm chứng từ/tài liệu"
                  className="absolute left-3 top-2.5 sm:top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <Paperclip className="w-4 h-4" />
                </button>
                <span className="absolute right-3 top-3 sm:top-3.5 text-[10px] font-mono text-slate-400 hidden sm:inline-block">
                  Enter để gửi
                </span>
              </div>

              <button
                type="submit"
                disabled={!input.trim()}
                className="py-2.5 sm:py-3 px-4 sm:px-5 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md shadow-blue-500/20 transition-all shrink-0"
              >
                <span>Gửi</span>
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>

            <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500">
              <span className="flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-blue-500" />
                <span>AI Agent hỗ trợ chỉnh sửa và đồng bộ trực tiếp biểu mẫu bên phải theo thời gian thực.</span>
              </span>
              <span className="font-mono">LLM RAG v4.2</span>
            </div>
          </div>
        </div>

        {/* Right Column: Student Workspace & Submit 1 (Always 42% on Desktop, NO layout shifts) */}
        <div
          className={`lg:w-[42%] w-full h-full min-h-0 shrink-0 transition-all duration-300 ${
            mobileTab === "chat" ? "hidden lg:flex" : "flex"
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
    </div>
  );
}
