import { redirect } from "next/navigation";

export default function ComplaintReviewPage() {
  redirect("/student/assistant?intent=complaint");
}
