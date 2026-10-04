import { redirect } from "next/navigation";

export default function ComplaintPage() {
  redirect("/student/assistant?intent=complaint");
}
