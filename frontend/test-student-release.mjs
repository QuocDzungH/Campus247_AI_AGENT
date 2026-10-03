import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const cache = new Map();
function load(relative) {
  const file = path.resolve(root, relative);
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} }; cache.set(file, module);
  const compiled = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  }, fileName: file }).outputText;
  const localRequire = specifier => specifier.startsWith(".")
    ? load(`${path.relative(root, path.resolve(path.dirname(file), specifier))}.ts`)
    : require(specifier);
  vm.runInThisContext(`(function(require,module,exports){${compiled}\n})`, { filename: file })(localRequire, module, module.exports);
  return module.exports;
}
const { MockCampusDataGateway } = load("lib/data/mock/mock-gateway.ts");
const { DEMO_USERS } = load("lib/data/mock/fixtures.ts");
const { hasIssuedDocument, receiptHtml, collectRequests, requestStatusLabel } = load("lib/my-requests.ts");
const { validateAttachment, saveLocalAttachments } = load("lib/local-attachments.ts");
const originalWindow = globalThis.window;
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
const originalIndexedDB = globalThis.indexedDB;
const entries = new Map();
let refuseWrites = false;
Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
  getItem: key => entries.get(key) ?? null,
  setItem: (key, value) => { if (refuseWrites) throw new Error("Quota exceeded"); entries.set(key, value); },
} });
globalThis.window = {};
try {
  const gateway = new MockCampusDataGateway({ latencyMs: 0 });
  const student = await gateway.login("SV001");
  const attachment = { id: "file-unit-1", name: "evidence.pdf", size: 512, contentType: "application/pdf", field: "evidenceFiles" };
  const ticket = await gateway.createTicket(student, { type: "complaint", purpose: "Kiểm tra điểm", submissionKey: "release-unit-1", attachments: [attachment] });
  assert.deepEqual(ticket.attachments, [attachment]);
  const restoredGateway = new MockCampusDataGateway({ latencyMs: 0 });
  assert.deepEqual((await restoredGateway.getTicket(ticket.id)).attachments, [attachment]);
  const retried = await restoredGateway.createTicket(student, { type: "complaint", purpose: "Kiểm tra điểm", submissionKey: "release-unit-1", attachments: [attachment] });
  assert.equal(retried.id, ticket.id);
  console.log("PASS: attachment references survive reload and submissions are idempotent");

  await restoredGateway.addTicketMessage(ticket.id, { senderId: student.id, senderRole: "student", senderName: student.name, content: "Câu hỏi của tôi" });
  assert.match((await restoredGateway.getTicket(ticket.id)).messages.at(-1).timestamp, /^\d{4}-\d{2}-\d{2}T/);
  console.log("PASS: messages record complete dates");

  const savedBeforeFailure = entries.get("campus247_mock_db_v1");
  const countBeforeFailure = (await restoredGateway.getTickets()).length;
  refuseWrites = true;
  await assert.rejects(restoredGateway.createTicket(student, { type: "lookup", purpose: "Không thể lưu", submissionKey: "failed-storage" }), /Chưa lưu được/);
  assert.equal((await restoredGateway.getTickets()).length, countBeforeFailure);
  assert.equal(entries.get("campus247_mock_db_v1"), savedBeforeFailure);
  refuseWrites = false;
  console.log("PASS: storage failure cannot report success or replace previous data");

  const cases = await restoredGateway.getReviewCases();
  const review = cases.find(item => item.studentId === student.id && item.supplementRequests.some(request => request.status === "sent"));
  assert.ok(review);
  await restoredGateway.submitStudentSupplement(review.id, { note: "Tài liệu bổ sung", fileName: attachment.name, docTitle: "Tệp bổ sung mới", attachment });
  const updated = await restoredGateway.getReviewCase(review.id);
  assert.deepEqual(updated.documents.find(document => document.title === "Tệp bổ sung mới").versions.at(-1).attachment, attachment);
  assert.equal(updated.status, "in_review");
  console.log("PASS: supplements retain a downloadable attachment reference and update the workflow");

  const item = collectRequests([ticket], [], student.id)[0];
  const escaped = { ...item, code: '<script>alert("x")</script>' };
  const html = receiptHtml(escaped, true);
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(!/DEMO|UAT|BẢN MẪU/i.test(html));
  assert.ok(html.includes("Không phải giấy xác nhận"));
  assert.equal(requestStatusLabel(item, true), "Đã lưu hồ sơ");
  console.log("PASS: exported receipts escape user text and do not imply official issuance");

  const issued = { ...ticket, type: "certificate", status: "resolved", documentStatus: "issued", issuedCertificate: {
    status: "issued", isDemoSample: true, docNumber: "123", issuedAt: new Date().toISOString(), issuedByOfficerName: "Cán bộ",
  } };
  assert.equal(hasIssuedDocument(issued), false);
  assert.equal(hasIssuedDocument({ ...issued, issuedCertificate: { ...issued.issuedCertificate, isDemoSample: false } }), true);
  assert.equal(hasIssuedDocument({ ...issued, documentStatus: "draft" }), false);
  console.log("PASS: sample and draft certificates cannot be presented as issued documents");

  assert.equal(validateAttachment({ name: "ok.pdf", size: 100, type: "application/pdf" }), "");
  for (const invalid of [{ name: "bad.exe", size: 100, type: "application/pdf" }, { name: "zero.pdf", size: 0, type: "application/pdf" }, { name: "large.pdf", size: 11 * 1024 * 1024, type: "application/pdf" }]) assert.ok(validateAttachment(invalid));
  globalThis.indexedDB = undefined;
  await assert.rejects(saveLocalAttachments(student.id, "submission", { evidence: [new File(["content"], "ok.pdf", { type: "application/pdf" })] }), /chưa cho phép lưu tệp/);
  assert.ok(DEMO_USERS.SV001.email.endsWith("@vinuni.edu.vn"));
  console.log("PASS: invalid files and unavailable binary storage fail before a submission is accepted");

  entries.set("campus247_mock_db_v1", "{broken");
  assert.throws(() => new MockCampusDataGateway({ latencyMs: 0 }), /Không đọc được hồ sơ/);
  assert.equal(entries.get("campus247_mock_db_v1"), "{broken");
  console.log("PASS: unreadable saved data is preserved instead of reseeding over it");
} finally {
  globalThis.window = originalWindow;
  if (originalStorage) Object.defineProperty(globalThis, "localStorage", originalStorage);
  else Reflect.deleteProperty(globalThis, "localStorage");
  globalThis.indexedDB = originalIndexedDB;
}
