import type { ReactNode } from "react";
import { StudentPortal } from "@/components/student/StudentPortal";

export default function StudentLayout({ children }: { children: ReactNode }) {
  return <StudentPortal>{children}</StudentPortal>;
}
