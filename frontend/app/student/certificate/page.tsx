import { redirect } from "next/navigation";

export default function CertificatePage() {
  redirect("/student/assistant?intent=certificate");
}
