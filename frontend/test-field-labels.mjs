import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import ts from "typescript";
import { createRequire } from "node:module";

const root = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const modules = new Map();
function load(relative) {
  const file = path.resolve(root, relative);
  if (modules.has(file)) return modules.get(file).exports;
  const mod = { exports: {} };
  modules.set(file, mod);
  const output = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
    fileName: file,
  }).outputText;
  const localRequire = (name) => (name.startsWith(".") ? load(path.relative(root, path.resolve(path.dirname(file), name)) + ".ts") : require(name));
  vm.runInThisContext(`(function(require,module,exports){${output}\n})`, { filename: file })(localRequire, mod, mod.exports);
  return mod.exports;
}

const {
  fieldLabel,
  formatStoredValue,
  sourceLabel,
  verificationStatusLabel,
  enumLabel,
} = load("lib/field-labels.ts");
const { auditActionLabel, displayActorName, looksLikeRawId } = load("lib/audit-labels.ts");
const { confirmationParagraph, canStateEnrollment } = load("lib/certificate-document.ts");
const { mapAuditEntry } = load("lib/data/api/mappers.ts");

assert.equal(fieldLabel("student_name"), "Tên sinh viên");
assert.equal(fieldLabel("source"), "Nguồn dữ liệu");
assert.equal(fieldLabel("mssv"), "Mã số sinh viên");
assert.equal(fieldLabel("purpose"), "Mục đích xin giấy");
assert.equal(fieldLabel("destination_org"), "Cơ quan/đơn vị nhận");
assert.equal(fieldLabel("receive_method"), "Hình thức nhận");
assert.equal(formatStoredValue("receive_method", "paper_stamped"), "Bản giấy có đóng dấu");
assert.equal(formatStoredValue("receive_method", "digital_pdf"), "Bản điện tử PDF");
assert.equal(sourceLabel("profile"), "Hồ sơ sinh viên");
assert.equal(sourceLabel("student_message"), "Thông tin sinh viên cung cấp");
assert.equal(sourceLabel("policy"), "Tài liệu quy định");
assert.equal(sourceLabel("tool_result"), "Kết quả tra cứu");
assert.equal(sourceLabel("operational_identities"), "Hồ sơ nguồn đã nhập");
assert.equal(enumLabel("normal"), "Bình thường");
assert.equal(enumLabel("high"), "Cao");
assert.equal(verificationStatusLabel("imported"), "Đã nhập vào hệ thống");
assert.equal(verificationStatusLabel("unverified"), "Chưa xác minh");
assert.equal(verificationStatusLabel("officer_verified"), "Đã được cán bộ xác minh");
assert.notEqual(verificationStatusLabel("imported"), "Đã xác minh");
assert.equal(formatStoredValue("purpose", "vay vốn ngân hàng"), "vay vốn ngân hàng");
assert.equal(fieldLabel("unknown_custom_field"), "Unknown custom field");

assert.equal(auditActionLabel("create"), "Sinh viên đã gửi đơn");
assert.equal(auditActionLabel("claim"), "Cán bộ đã nhận xử lý");
assert.equal(auditActionLabel("brief_ready"), "AI đã hoàn tất bản tóm tắt hồ sơ");
assert.match(auditActionLabel("document_issue", { signature_status: "unsigned", official: false }), /chưa ký số/);
assert.equal(looksLikeRawId("usr_abc123"), true);
assert.equal(displayActorName("usr_abc123", "officer"), "Cán bộ");
assert.equal(displayActorName("Trần Thị Hà", "officer"), "Trần Thị Hà");

assert.equal(canStateEnrollment("imported"), false);
const paragraph = confirmationParagraph({
  institutionName: "VinUniversity",
  title: "GIẤY XÁC NHẬN SINH VIÊN",
  studentName: "Nguyễn Văn An",
  mssv: "20210018",
  studentStatus: "Đang học",
  verificationStatus: "imported",
  signatureStatus: "none",
  official: false,
  kind: "draft",
});
assert.match(paragraph, /Nguyễn Văn An/);
assert.doesNotMatch(paragraph, /Đang học/);

const log = mapAuditEntry({
  id: "aud_1",
  ticket_id: "tkt_1",
  actor_id: "usr_deadbeef",
  actor_type: "officer",
  actor_name: "Trần Thị Hà",
  action: "claim",
  from_status: "open",
  to_status: "open",
  request_id: "req_1",
  details: { revision: 2, sha256: "abc" },
  created_at: "2026-10-04T03:00:00Z",
});
assert.equal(log.action, "Cán bộ đã nhận xử lý");
assert.equal(log.actor, "Trần Thị Hà");
assert.equal(log.rawAction, "claim");
assert.match(log.technical, /req_1/);
assert.equal(log.details, undefined);

const unnamed = mapAuditEntry({
  id: "aud_2",
  ticket_id: "tkt_1",
  actor_id: "usr_deadbeef",
  actor_type: "officer",
  action: "document_issue",
  from_status: "pending_officer",
  to_status: "pending_officer",
  request_id: "req_2",
  details: { signature_status: "unsigned", official: false },
  created_at: "2026-10-04T03:01:00Z",
});
assert.match(unnamed.action, /chưa ký số/);
assert.equal(unnamed.actor, "Cán bộ");
assert.doesNotMatch(unnamed.actor, /usr_/);

console.log("PASS: field labels, audit language, certificate enrollment gate, and audit mapping");
