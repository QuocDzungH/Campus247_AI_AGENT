"use client";

import { use } from "react";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { LoadingState } from "@/components/shared/LoadingState";
import { DataAccessState } from "@/components/shared/DataAccessState";
import { useStore } from "@/lib/store";
import { StaffReviewWorkspace } from "@/components/staff/StaffReviews";

interface PageProps {
  params: Promise<{ reviewId: string }>;
}

export default function ReviewWorkstationPage({ params }: PageProps) {
  const { reviewId } = use(params);
  const { getReviewCase, currentUser, isDataLoading } = useStore();
  const record = getReviewCase(reviewId);

  if (isDataLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-transparent">
        <Navbar />
        <LoadingState title="Đang tải hồ sơ rà soát…" />
      </div>
    );
  }

  if (currentUser?.role !== "officer") {
    return <DataAccessState requiredRole="officer" />;
  }

  if (!record) {
    return (
      <div className="min-h-screen flex flex-col bg-transparent">
        <Navbar />
        <main className="mx-auto max-w-2xl p-8 text-center space-y-4">
          <h1 className="font-serif text-2xl font-normal text-[#1C1917] dark:text-[#FAFAF9]">
            Không tìm thấy hồ sơ rà soát
          </h1>
          <Link
            className="inline-flex min-h-[44px] items-center px-5 py-2.5 rounded-none bg-[#78716C] hover:bg-[#57534E] dark:bg-[#A8A29E] dark:hover:bg-[#D6D3D1] text-[#FAFAF9] dark:text-[#1C1917] text-sm font-medium transition-colors"
            href="/reviews"
          >
            Quay lại danh sách
          </Link>
        </main>
      </div>
    );
  }

  return <StaffReviewWorkspace key={`${currentUser.id}:${record.id}`} record={record} />;
}
