import type { CertificateProposal, CertificateData, StudentDraft, StudentTask } from "./student-workspace";
import { VINUNI_SOURCES } from "./vinuni-forms";

export interface GuidanceSource {
  title: string;
  section: string;
  quote: string;
  href?: string;
}

export interface AssistantReply {
  text: string;
  source?: GuidanceSource;
  action?: { label: string; href: string };
  proposal?: CertificateProposal;
}

function normalize(text: string) {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");
}

const source = (section: string, quote: string): GuidanceSource => ({
  title: "Hướng dẫn sử dụng Campus 24/7", section, quote,
});

// Curated guidance, not live retrieval. Unsupported topics must not be invented.
export function lookupStudentGuidance(question: string): AssistantReply {
  const query = normalize(question);
  if (/(hoc bong|hoc phi|dieu \d|quy che dao tao)/.test(query)) {
    return { text: "Chưa có hướng dẫn được tổng hợp đủ cho câu hỏi này. Hãy kiểm tra cổng chính sách VinUni hoặc gửi câu hỏi trong Campus 24/7 để cán bộ phụ trách phản hồi." };
  }
  if (/(khieu nai|phuc khao|diem thi|sai diem|grade appeal)/.test(query)) {
    return { text: "Grade Appeal áp dụng điểm tổng kết học phần. Bạn cần:\n• Liên hệ giảng viên bằng email trước.\n• Chuẩn bị thông tin học phần, căn cứ, minh chứng và chứng từ thanh toán.\n• Đối chiếu hạn 5 ngày làm việc từ khi điểm chính thức đăng trên Canvas với lịch làm việc của trường.\n\nMở biểu mẫu để điền và kiểm tra. Trạng thái kết nối và cách xác nhận được hiển thị trong biểu mẫu.",
      source: { title: "VinUni — Student Grade Appeal Procedure", section: "PRC-AQA-002-V2.0 · 21/01/2026", quote: "Tóm lược: xem xét điểm tổng kết học phần, yêu cầu trao đổi trước với giảng viên và hồ sơ có minh chứng, chứng từ thanh toán.", href: VINUNI_SOURCES.appeal }, action: { label: "Nộp Grade Appeal", href: "/student/complaint" } };
  }
  if (/(ban giay|ban dien tu|pdf|cach nhan|nhan giay|xin giay|cap giay|xac nhan|bang diem|muc dich|noi nhan|noi gui|transcript)/.test(query)) {
    return { text: "Để yêu cầu tài liệu học vụ, bạn cần chọn:\n• Loại tài liệu và ngôn ngữ.\n• Bản điện tử (PDF) hoặc bản giấy, số bản và người nhận.\n\nTheo hướng dẫn Registrar, PDF gửi tới email VinUni hoặc người nhận được xác minh; bản giấy nhận tại phòng I114 hoặc chuyển phát.\n\nMở biểu mẫu để điền và kiểm tra. Trạng thái kết nối và cách xác nhận được hiển thị trong biểu mẫu.",
      source: { title: "VinUni Registrar — Request Transcripts & Certifications", section: "Loại tài liệu và cách nhận", quote: "Tóm lược: lựa chọn ngôn ngữ, định dạng, số bản và thông tin người nhận phù hợp với từng loại tài liệu.", href: VINUNI_SOURCES.documents }, action: { label: "Nộp yêu cầu tài liệu", href: "/student/certificate" } };
  }
  if (/(ho so|trang thai|theo doi|bo sung|yeu cau da gui)/.test(query)) {
    const quote = "Hồ sơ của tôi hiển thị yêu cầu đã gửi, trạng thái xử lý, kết quả và trao đổi với cán bộ. Hồ sơ cần bổ sung được hiển thị trên trang dịch vụ.";
    return { text: "Mở Hồ sơ của tôi để xem trạng thái yêu cầu đã nộp trong Campus 24/7 và phản hồi của cán bộ. Bản nháp chưa nộp nằm ở trang Dịch vụ sinh viên.",
      source: source("Theo dõi hồ sơ", quote), action: { label: "Xem hồ sơ của tôi", href: "/my-requests" } };
  }
  return { text: "Chưa có hướng dẫn được tổng hợp đủ cho câu hỏi này. Bạn có thể diễn đạt cụ thể hơn, mở cổng chính sách VinUni hoặc gửi câu hỏi trong Campus 24/7 để cán bộ hỗ trợ." };
}

export function answerStudentQuestion(question: string, task: StudentTask, draft: StudentDraft<CertificateData>): AssistantReply {
  const query = normalize(question.trim());
  const asksForChange = /^(?:hay\s+|giup (?:minh|toi|em)\s+)?(?:doi|chuyen|sua|cap nhat)\b/.test(query);
  if (task === "certificate" && asksForChange && !draft.submission) {
    let field: keyof CertificateData | undefined;
    let value = "";
    let label = "";
    if (/ban giay/.test(query)) { field = "receiveMethod"; value = "paper_stamped"; label = "Cách nhận"; }
    else if (/(dien tu|pdf)/.test(query)) { field = "receiveMethod"; value = "digital_pdf"; label = "Cách nhận"; }
    else {
      const purpose = question.match(/(?:đổi|sửa|cập nhật)\s+mục đích\s*(?:(?:thành|sang|là)\s+|:\s*)(.+)/i);
      const destination = question.match(/(?:đổi|sửa|cập nhật)\s+(?:nơi nhận|nơi gửi)\s*(?:(?:thành|sang|là)\s+|:\s*)(.+)/i);
      if (purpose) { field = "purpose"; value = purpose[1].trim(); label = "Mục đích"; }
      else if (destination) { field = "destinationOrg"; value = destination[1].trim(); label = "Nơi nhận"; }
    }
    if (field && value) {
      return { text: "Tôi đề xuất thay đổi dưới đây. Chọn Áp dụng để cập nhật bản nháp, rồi kiểm tra lại trước khi nộp hồ sơ.",
        proposal: { draftId: draft.id, field, before: draft.data[field], value, label } };
    }
  }
  if (/(gui yeu cau|gui ho so|gui giay)/.test(query)) {
    return { text: "Kiểm tra thông tin ở bước cuối rồi chọn Nộp yêu cầu. Campus 24/7 sẽ tạo mã hồ sơ để bạn theo dõi trong Hồ sơ của tôi.",
      action: { label: "Mở yêu cầu cấp giấy", href: "/student/certificate" } };
  }
  return lookupStudentGuidance(question);
}

export function receiveMethodLabel(value: string) {
  return value === "digital_pdf" ? "Bản điện tử (PDF)" : value === "paper_stamped" ? "Bản giấy" : value;
}
