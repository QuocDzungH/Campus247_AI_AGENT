import { redirect } from "next/navigation";

export default function CertificateReviewPage() {
  redirect("/student/assistant?intent=certificate");
}
