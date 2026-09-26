"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FileSearch,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Clock,
  ChevronRight,
  BookOpen,
  ArrowRight,
  Sparkles,
  RotateCcw,
  FileText,
  AlertTriangle,
  GraduationCap,
  Layers,
  HelpCircle,
  X,
  Building,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { useStore } from "@/lib/store";
import { ReviewCase, ReviewCaseStatus } from "@/lib/types";
import { DEMO_USERS, STANDARD_REVIEW_CRITERIA } from "@/lib/mock-data";

export default function ReviewsListPage() {
  const router = useRouter();
  const { reviewCases, createReviewCase, resetReviewDemo, currentUser, login } = useStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Switch to OF001 if current user is not officer
  useEffect(() => {
    if (currentUser.role !== "officer") {
      login("OF001");
    }
  }, [currentUser.role, login]);

  // Form State for "Tạo hồ sơ rà soát"
  const [formStudentId, setFormStudentId] = useState("SV001");
  const [formTargetCourse, setFormTargetCourse] = useState("IT3011");
  const [formPriorCourseName, setFormPriorCourseName] = useState("Cấu trúc dữ liệu");
  const [formPriorCourseCode, setFormPriorCourseCode] = useState("IT2020");
  const [formPriorInstitution, setFormPriorInstitution] = useState("Trường Đại học Bách Khoa TP.HCM (Minh họa)");
  const [formPriorCredits, setFormPriorCredits] = useState(3);
  const [formPriorGrade, setFormPriorGrade] = useState("8.5 / 10");
  const [formCriteriaPreset, setFormCriteriaPreset] = useState("standard_it");
  const [formSampleDossierPreset, setFormSampleDossierPreset] = useState<"preset_a" | "preset_b" | "preset_c">("preset_a");

  // Synchronize preset changes
  const handleSelectPreset = (preset: "preset_a" | "preset_b" | "preset_c") => {
    setFormSampleDossierPreset(preset);
    if (preset === "preset_a") {
      setFormStudentId("SV001");
      setFormTargetCourse("IT3011");
      setFormPriorCourseName("Cấu trúc dữ liệu");
      setFormPriorCourseCode("IT2020");
      setFormPriorInstitution("Trường Đại học Bách Khoa TP.HCM (Minh họa)");
      setFormPriorCredits(3);
      setFormPriorGrade("8.5 (Hệ 10) / A");
      setFormCriteriaPreset("standard_it");
    } else if (preset === "preset_b") {
      setFormStudentId("SV024");
      setFormTargetCourse("MATH101");
      setFormPriorCourseName("Toán cao cấp A1");
      setFormPriorCourseCode("TCC-A1-2023");
      setFormPriorInstitution("Trường Đại học Kinh tế TP.HCM (Minh họa)");
      setFormPriorCredits(3);
      setFormPriorGrade("8.0 (Điểm B+)");
      setFormCriteriaPreset("standard_math");
    } else {
      setFormStudentId("SV001");
      setFormTargetCourse("PHY102");
      setFormPriorCourseName("Vật lý đại cương A");
      setFormPriorCourseCode("VLDC-A");
      setFormPriorInstitution("Trường Đại học Khoa học Tự nhiên (Minh họa)");
      setFormPriorCredits(3);
      setFormPriorGrade("7.5 (Khá)");
      setFormCriteriaPreset("standard_phy");
    }
  };

  // Metrics from store
  const safeCases = reviewCases || [];
  const totalCount = safeCases.length;
  const inReviewCount = safeCases.filter((r) => r.status === "in_review").length;
  const waitingSupplementCount = safeCases.filter((r) => r.status === "waiting_supplement").length;
  const completedCount = safeCases.filter((r) => r.status === "completed").length;

  // Filter & Search
  const filteredCases = safeCases.filter((item) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchCode = item.code.toLowerCase().includes(q);
      const matchName = item.studentName.toLowerCase().includes(q);
      const matchMssv = item.studentMssv.toLowerCase().includes(q);
      const matchTarget = item.targetCourseName.toLowerCase().includes(q) || item.targetCourseCode.toLowerCase().includes(q);
      const matchPrior = item.priorCourseName.toLowerCase().includes(q);
      if (!matchCode && !matchName && !matchMssv && !matchTarget && !matchPrior) return false;
    }
    if (statusFilter !== "all" && item.status !== statusFilter) return false;
    return true;
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const targetCourseNames: Record<string, { name: string; credits: number; dept: string }> = {
      IT3011: { name: "Cấu trúc dữ liệu và giải thuật", credits: 3, dept: "Khoa Công nghệ Phần mềm" },
      MATH101: { name: "Giải tích 1", credits: 3, dept: "Khoa Khoa học Cơ bản" },
      PHY102: { name: "Vật lý đại cương 1", credits: 3, dept: "Khoa Khoa học Cơ bản" },
    };

    const targetInfo = targetCourseNames[formTargetCourse] || {
      name: "Học phần chuyên ngành",
      credits: 3,
      dept: "Khoa Đào tạo",
    };

    const newCase = createReviewCase({
      studentId: formStudentId,
      targetCourseCode: formTargetCourse,
      targetCourseName: targetInfo.name,
      targetCourseCredits: targetInfo.credits,
      targetDepartment: targetInfo.dept,
      priorCourseCode: formPriorCourseCode,
      priorCourseName: formPriorCourseName,
      priorCourseCredits: formPriorCredits,
      priorInstitution: formPriorInstitution,
      priorGrade: formPriorGrade,
      criteriaSetId: formCriteriaPreset,
      criteriaSetName:
        formCriteriaPreset === "standard_it"
          ? "Bộ tiêu chí công nhận học phần Khối ngành CNTT (Minh họa)"
          : formCriteriaPreset === "standard_math"
          ? "Bộ tiêu chí môn Toán & Khoa học Cơ bản (Minh họa)"
          : "Bộ tiêu chí môn Vật lý đại cương (Minh họa)",
    });

    setIsCreateModalOpen(false);
    router.push(`/reviews/${newCase.id}`);
  };

  return (
    <div className="min-h-screen flex flex-col bg-transparent transition-colors">
      <Navbar />

      {/* Header Banner */}
      <div className="w-full border-b border-slate-200/80 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md px-4 sm:px-6 lg:px-8 py-6">
        <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Trợ lý AI Rà soát Hồ sơ Học vụ</span>
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold border border-slate-200 dark:border-slate-700">
                Quy trình Công nhận Học phần
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Danh sách Hồ sơ Rà soát Học phần
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-3xl leading-relaxed">
              Hỗ trợ cán bộ tự động đọc và cấu trúc đề cương, đối chiếu tiêu chí tín chỉ và nội dung môn học, chỉ ra bằng chứng, phát hiện mâu thuẫn chứng từ và soạn thảo phiếu rà soát trước khi chuyển Hội đồng Học vụ xem xét.
            </p>
          </div>

          <div className="flex items-center gap-2.5 self-start md:self-auto flex-wrap">
            <button
              type="button"
              onClick={resetReviewDemo}
              title="Khôi phục trạng thái 3 hồ sơ mẫu ban đầu"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors shadow-xs"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
              <span>Khôi phục dữ liệu mẫu</span>
            </button>

            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-md shadow-indigo-500/20 transition-all hover:scale-[1.02]"
            >
              <Plus className="w-4 h-4" />
              <span>Tạo hồ sơ rà soát</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Workspace */}
      <div className="max-w-[1600px] w-full mx-auto p-4 sm:p-6 lg:p-8 flex-1 space-y-6">
        {/* 4 Metrics Cards (Real-time from Store) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl glass-surface glass-card-interactive flex items-start justify-between">
            <div className="space-y-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                TỔNG SỐ HỒ SƠ RÀ SOÁT
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white">
                {totalCount}
              </div>
              <div className="text-[10px] text-slate-500 flex items-center gap-1">
                <BookOpen className="w-3 h-3 text-indigo-500" />
                <span>Toàn bộ đợt công nhận</span>
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900/60">
              <FileSearch className="w-5 h-5" />
            </div>
          </div>

          <div className="p-4 rounded-2xl glass-surface glass-card-interactive flex items-start justify-between">
            <div className="space-y-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                CẦN CÁN BỘ KIỂM TRA
              </div>
              <div className="text-2xl font-black text-blue-600 dark:text-blue-400">
                {inReviewCount}
              </div>
              <div className="text-[10px] text-slate-500 flex items-center gap-1">
                <Clock className="w-3 h-3 text-blue-500" />
                <span>Đang trong luồng thẩm định</span>
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/60">
              <Layers className="w-5 h-5" />
            </div>
          </div>

          <div className="p-4 rounded-2xl glass-surface glass-card-interactive flex items-start justify-between">
            <div className="space-y-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                CHỜ SINH VIÊN BỔ SUNG
              </div>
              <div className="text-2xl font-black text-amber-600 dark:text-amber-400">
                {waitingSupplementCount}
              </div>
              <div className="text-[10px] text-slate-500 flex items-center gap-1">
                <AlertCircle className="w-3 h-3 text-amber-500" />
                <span>Đã gửi thông báo yêu cầu</span>
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/60">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>

          <div className="p-4 rounded-2xl glass-surface glass-card-interactive flex items-start justify-between">
            <div className="space-y-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                ĐÃ HOÀN TẤT RÀ SOÁT
              </div>
              <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                {completedCount}
              </div>
              <div className="text-[10px] text-slate-500 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                <span>Đã lập phiếu BM-RS-01</span>
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/60">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="p-4 rounded-2xl glass-surface flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo mã hồ sơ, tên sinh viên, MSSV hoặc tên môn học..."
              className="w-full pl-9 pr-4 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" />
              <span>Trạng thái:</span>
            </span>
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl text-xs">
              <button
                type="button"
                onClick={() => setStatusFilter("all")}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  statusFilter === "all"
                    ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs"
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                Tất cả ({totalCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("in_review")}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  statusFilter === "in_review"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-blue-600 dark:text-blue-400 hover:bg-white/40"
                }`}
              >
                Đang rà soát ({inReviewCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("waiting_supplement")}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  statusFilter === "waiting_supplement"
                    ? "bg-amber-600 text-white shadow-xs"
                    : "text-amber-600 dark:text-amber-400 hover:bg-white/40"
                }`}
              >
                Chờ bổ sung ({waitingSupplementCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("completed")}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  statusFilter === "completed"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-emerald-600 dark:text-emerald-400 hover:bg-white/40"
                }`}
              >
                Đã hoàn tất ({completedCount})
              </button>
            </div>
          </div>
        </div>

        {/* List Table of Dossiers */}
        <div className="rounded-3xl glass-surface border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700/60 text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider text-[10px]">
                <tr>
                  <th className="py-3.5 px-4">Mã hồ sơ</th>
                  <th className="py-3.5 px-4">Sinh viên đề nghị</th>
                  <th className="py-3.5 px-4">Cặp học phần đối chiếu</th>
                  <th className="py-3.5 px-4 text-center">Tài liệu &amp; Bản quét</th>
                  <th className="py-3.5 px-4">Trạng thái rà soát</th>
                  <th className="py-3.5 px-4 text-center">Vấn đề cần kiểm tra</th>
                  <th className="py-3.5 px-4">Cập nhật cuối</th>
                  <th className="py-3.5 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredCases.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400 text-xs">
                      Không tìm thấy hồ sơ rà soát nào phù hợp với điều kiện tìm kiếm.
                    </td>
                  </tr>
                ) : (
                  filteredCases.map((item) => {
                    const issueCount =
                      item.aiSummary.insufficientCount +
                      item.aiSummary.contradictionCount +
                      item.aiSummary.differenceCount;

                    const hasContradiction = item.aiSummary.contradictionCount > 0;
                    const hasInsufficient = item.aiSummary.insufficientCount > 0;

                    return (
                      <tr
                        key={item.id}
                        className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors group"
                      >
                        {/* Mã hồ sơ */}
                        <td className="py-3.5 px-4">
                          <Link
                            href={`/reviews/${item.id}`}
                            className="font-mono font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1.5"
                          >
                            <span>{item.code}</span>
                            {item.aiSummary.isStale && (
                              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" title="Có tài liệu mới chưa cập nhật" />
                            )}
                          </Link>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {item.criteria.length} tiêu chí
                          </div>
                        </td>

                        {/* Sinh viên */}
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-900 dark:text-white">
                            {item.studentName}
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                            {item.studentMssv} · {item.studentClassYear}
                          </div>
                        </td>

                        {/* Cặp học phần */}
                        <td className="py-3.5 px-4 max-w-sm">
                          <div className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-white">
                            <span className="text-slate-500 font-normal">Đã học:</span>
                            <span className="truncate" title={item.priorCourseName}>
                              {item.priorCourseName}
                            </span>
                            <span className="font-mono text-[10px] text-slate-400 shrink-0">
                              ({item.priorCourseCredits} TC)
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-indigo-600 dark:text-indigo-400 mt-0.5">
                            <ArrowRight className="w-3 h-3 shrink-0" />
                            <span className="font-medium text-slate-500 dark:text-slate-400">Đề nghị:</span>
                            <span className="font-semibold truncate" title={item.targetCourseName}>
                              {item.targetCourseCode} - {item.targetCourseName}
                            </span>
                            <span className="font-mono text-[10px] shrink-0">
                              ({item.targetCourseCredits} TC)
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400 truncate mt-0.5" title={item.priorInstitution}>
                            {item.priorInstitution}
                          </div>
                        </td>

                        {/* Số tài liệu */}
                        <td className="py-3.5 px-4 text-center">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold font-mono text-xs border border-slate-200 dark:border-slate-700">
                            <FileText className="w-3 h-3 text-slate-400" />
                            <span>{item.documents.length} tài liệu</span>
                          </span>
                          {item.documents.some((d) => d.versions.some((v) => v.version >= 2)) && (
                            <div className="mt-1">
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                Đã có v2 bổ sung
                              </span>
                            </div>
                          )}
                          {item.documents.some((d) => d.versions.some((v) => v.legibility === "partial_blurry")) && (
                            <div className="mt-1">
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                Scan mờ một phần
                              </span>
                            </div>
                          )}
                        </td>

                        {/* Trạng thái rà soát */}
                        <td className="py-3.5 px-4">
                          {item.status === "in_review" && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                              <span>Đang thẩm định</span>
                            </span>
                          )}
                          {item.status === "waiting_supplement" && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                              <span>Chờ sinh viên bổ sung</span>
                            </span>
                          )}
                          {item.status === "completed" && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                              <span>Đã hoàn tất rà soát</span>
                            </span>
                          )}
                        </td>

                        {/* Vấn đề cần kiểm tra */}
                        <td className="py-3.5 px-4 text-center">
                          {hasContradiction ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 font-bold border border-rose-200 dark:border-rose-800 text-[11px]">
                              <AlertTriangle className="w-3 h-3 text-rose-500" />
                              <span>Mâu thuẫn dữ liệu</span>
                            </span>
                          ) : hasInsufficient ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 font-bold border border-amber-200 dark:border-amber-800 text-[11px]">
                              <AlertCircle className="w-3 h-3 text-amber-500" />
                              <span>{item.aiSummary.insufficientCount} mục chưa đủ căn cứ</span>
                            </span>
                          ) : issueCount === 0 ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 font-semibold border border-emerald-200 dark:border-emerald-800 text-[11px]">
                              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                              <span>Đủ bằng chứng</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 font-semibold text-[11px]">
                              <span>{issueCount} điểm cần lưu ý</span>
                            </span>
                          )}
                        </td>

                        {/* Cập nhật */}
                        <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                          {item.updatedAt}
                        </td>

                        {/* Thao tác */}
                        <td className="py-3.5 px-4 text-right">
                          <Link
                            href={`/reviews/${item.id}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-600 text-indigo-700 dark:text-indigo-300 hover:text-white font-semibold text-xs border border-indigo-200 dark:border-indigo-800 transition-all shadow-xs group-hover:scale-105"
                          >
                            <span>Bàn rà soát</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Disclaimer Footer */}
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-300/60 dark:border-amber-900/60 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-2.5 leading-relaxed">
          <HelpCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Lưu ý nghiệp vụ &amp; Phân định trách nhiệm:</span> Hệ thống AI đóng vai trò đọc hiểu, trích xuất cấu trúc dữ liệu và đối chiếu minh chứng theo bộ tiêu chí minh họa. Cán bộ trực tiếp kiểm tra, điều chỉnh và xác nhận từng nhận định. Kết quả rà soát sơ bộ được đóng gói thành Phiếu rà soát (BM-RS-01) để trình Hội đồng Chuyên môn; không tự ý công nhận học phần hoặc tự động cập nhật tín chỉ trong CSDL.
          </div>
        </div>
      </div>

      {/* Modal: Tạo hồ sơ rà soát */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white text-sm font-bold">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">
                    Tạo Hồ sơ Rà soát Công nhận Học phần
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Cán bộ chủ động thiết lập hồ sơ đề nghị công nhận từ trường khác
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Presets Selection */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Chọn Bộ Kịch bản Mẫu nhanh:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => handleSelectPreset("preset_a")}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    formSampleDossierPreset === "preset_a"
                      ? "bg-indigo-50/80 dark:bg-indigo-950/60 border-indigo-500 text-indigo-900 dark:text-indigo-200 shadow-xs ring-1 ring-indigo-500"
                      : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                  }`}
                >
                  <div className="font-bold text-xs">Hồ sơ A: Cấu trúc dữ liệu</div>
                  <div className="text-[10px] text-slate-500 mt-1 leading-snug">
                    Tên môn khác nhau; v1 thiếu Đồ thị ➜ v2 bổ sung hoàn chỉnh.
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectPreset("preset_b")}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    formSampleDossierPreset === "preset_b"
                      ? "bg-indigo-50/80 dark:bg-indigo-950/60 border-indigo-500 text-indigo-900 dark:text-indigo-200 shadow-xs ring-1 ring-indigo-500"
                      : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                  }`}
                >
                  <div className="font-bold text-xs">Hồ sơ B: Môn Giải tích</div>
                  <div className="text-[10px] text-slate-500 mt-1 leading-snug">
                    Mã môn trên bảng điểm khác mã trên đề cương (Mâu thuẫn).
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectPreset("preset_c")}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    formSampleDossierPreset === "preset_c"
                      ? "bg-indigo-50/80 dark:bg-indigo-950/60 border-indigo-500 text-indigo-900 dark:text-indigo-200 shadow-xs ring-1 ring-indigo-500"
                      : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                  }`}
                >
                  <div className="font-bold text-xs">Hồ sơ C: Môn Vật lý</div>
                  <div className="text-[10px] text-slate-500 mt-1 leading-snug">
                    Đề cương trang 2-3 bị scan mờ; chỉ phân tích phần đọc được.
                  </div>
                </button>
              </div>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
              {/* Sinh viên */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  1. Chọn Sinh viên đề nghị:
                </label>
                <select
                  value={formStudentId}
                  onChange={(e) => setFormStudentId(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                >
                  <option value="SV001">Nguyễn Văn An (MSSV: 20210018 · K18 Kỹ thuật Phần mềm)</option>
                  <option value="SV024">Lê Bảo Trâm (MSSV: 20240019 · K19 Ngân hàng)</option>
                </select>
              </div>

              {/* Học phần tiếp nhận */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  2. Chọn Học phần tại trường tiếp nhận:
                </label>
                <select
                  value={formTargetCourse}
                  onChange={(e) => setFormTargetCourse(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                >
                  <option value="IT3011">IT3011 - Cấu trúc dữ liệu và giải thuật (3 TC · Khoa CNPM)</option>
                  <option value="MATH101">MATH101 - Giải tích 1 (3 TC · Khoa KHCB)</option>
                  <option value="PHY102">PHY102 - Vật lý đại cương 1 (3 TC · Khoa KHCB)</option>
                </select>
              </div>

              {/* Thông tin môn trường cũ */}
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 space-y-3">
                <div className="font-bold text-slate-900 dark:text-white text-xs flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-indigo-500" />
                  <span>3. Học phần đã học tại Trường cũ:</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Tên môn học đã học:</label>
                    <input
                      type="text"
                      value={formPriorCourseName}
                      onChange={(e) => setFormPriorCourseName(e.target.value)}
                      required
                      className="w-full p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Mã học phần:</label>
                    <input
                      type="text"
                      value={formPriorCourseCode}
                      onChange={(e) => setFormPriorCourseCode(e.target.value)}
                      required
                      className="w-full p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] text-slate-500 mb-1">Trường cũ đã tích lũy:</label>
                    <input
                      type="text"
                      value={formPriorInstitution}
                      onChange={(e) => setFormPriorInstitution(e.target.value)}
                      required
                      className="w-full p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Số tín chỉ:</label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={formPriorCredits}
                      onChange={(e) => setFormPriorCredits(Number(e.target.value))}
                      required
                      className="w-full p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Bộ tiêu chí */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  4. Chọn Bộ Tiêu chí Rà soát Minh họa:
                </label>
                <select
                  value={formCriteriaPreset}
                  onChange={(e) => setFormCriteriaPreset(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                >
                  <option value="standard_it">Bộ tiêu chí Khối ngành CNTT (6 tiêu chí chuẩn: Tín chỉ, Cấu trúc, Đồ thị, Lab, CLO)</option>
                  <option value="standard_math">Bộ tiêu chí Khối ngành Toán học (4 tiêu chí: Tín chỉ, Mã môn, Giải tích vi/tích phân)</option>
                  <option value="standard_phy">Bộ tiêu chí Khối ngành Vật lý (4 tiêu chí: Tín chỉ, Cơ học, Thí nghiệm phòng Lab)</option>
                </select>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-md shadow-indigo-500/20 flex items-center gap-1.5"
                >
                  <span>Khởi tạo hồ sơ &amp; Vào bàn rà soát</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
