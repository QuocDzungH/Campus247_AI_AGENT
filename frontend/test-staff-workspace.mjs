import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const modules = new Map();
function load(relative) {
  const file = path.resolve(root, relative);
  if (modules.has(file)) return modules.get(file).exports;
  const testModule = { exports: {} }; modules.set(file, testModule);
  const output = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true }, fileName: file }).outputText;
  const localRequire = specifier => specifier.startsWith(".") ? load(`${path.relative(root, path.resolve(path.dirname(file), specifier))}.ts`) : require(specifier);
  vm.runInThisContext(`(function(require,module,exports){${output}\n})`, { filename: file })(localRequire, testModule, testModule.exports);
  return testModule.exports;
}
const { MockCampusDataGateway } = load("lib/data/mock/mock-gateway.ts");
const { actionBlock, effectiveFinding, filterTickets, reviewReadiness, reviewSnapshot, ticketQueueTypeLabel, ticketSnapshot } = load("lib/staff-policy.ts");
// Isolated in-memory storage: never access or reset an existing browser database.
const values = new Map();
globalThis.window = {};
globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
const gateway = new MockCampusDataGateway({ latencyMs: 0 });
const student = await gateway.login("SV001");
const officer = { ...await gateway.login("OF001"), id: "OF-TEST-2", name: "Cán bộ kiểm thử thứ hai" };
const payload = { schemaVersion: 1, task: "certificate", documentType: "ENG", submittedFields: [{ name: "copies", label: "Số bản", value: "2" }] };
const ticket = await gateway.createTicket(student, { type: "certificate", title: "Xác nhận chương trình tiếng Anh", certificateType: "English Proficiency", requestPayload: payload, purpose: "Nộp học bổng", submissionKey: "staff-test-payload" });
assert.deepEqual(ticket.requestPayload, payload);
assert.equal(ticket.issuedCertificate, undefined);
assert.equal(ticket.systemVerifications, undefined);
console.log("PASS: new structured forms retain fields and never generate an unrelated BM-03");

await assert.rejects(gateway.submitGate2Response(ticket.id, "respond", "Phản hồi", student), /cán bộ/);
const initial = ticketSnapshot(ticket);
await gateway.submitGate2Response(ticket.id, "respond", "Cần đối chiếu nguồn", officer, initial);
let updated = await gateway.getTicket(ticket.id);
assert.equal(updated.status, "pending_officer");
assert.equal(updated.messages.at(-1).senderId, officer.id);
assert.equal(updated.messages.at(-1).senderName, officer.name);
assert.match(updated.messages.at(-1).timestamp, /^\d{4}-\d{2}-\d{2}T/);
await assert.rejects(gateway.submitGate2Response(ticket.id, "respond", "Gửi trên dữ liệu cũ", officer, initial), /thay đổi/);
const count = updated.messages.length;
assert.equal((await gateway.getTicket(ticket.id)).messages.length, count);
console.log("PASS: responses stay open, record the actual actor, and reject stale sends without writing");

await gateway.submitGate2Response(ticket.id, "resolve", "Đã trả lời yêu cầu; chưa phát hành tài liệu", officer, ticketSnapshot(updated));
updated = await gateway.getTicket(ticket.id);
assert.equal(updated.status, "resolved");
assert.equal(updated.issuedCertificate, undefined);
await assert.rejects(gateway.submitGate2Response(ticket.id, "respond", "Gửi tiếp", officer), /hoàn tất/);
const legacy = await gateway.getTicket("TKT-2026-0142");
assert.match(actionBlock(legacy, "resolve", "Đã kiểm tra"), /mục kiểm tra/);
console.log("PASS: completion never issues a document, closed tickets reject writes, and unchecked work blocks completion");

const queue = filterTickets([updated, { ...ticket, id: "high", priority: "high", createdAt: "2026-01-02" }, { ...ticket, id: "older", createdAt: "2026-01-01" }], "", "active", "all", "certificate");
assert.deepEqual(queue.map(t => t.id), ["high", "older"]);
assert.equal(filterTickets(queue, "", "all", "all", "complaint").length, 0);
assert.equal(ticketQueueTypeLabel({ type: "complaint", complaintSubtype: "grade_appeal" }), "Khiếu nại · Điểm học phần");
assert.equal(ticketQueueTypeLabel({ type: "complaint", complaintSubtype: "other" }), "Khiếu nại");
assert.equal(ticketQueueTypeLabel({ type: "certificate" }), "Xin giấy xác nhận");
console.log("PASS: queue uses real request types, excludes completed cases, and sorts urgency then age");

let record = await gateway.getReviewCase("REV-2026-001");
assert.ok(reviewReadiness(record).unchecked.length > 0);
const report = { completedAt: new Date().toISOString(), officerId: officer.id, officerName: officer.name, decisionRecommendation: "propose_recognition", conclusionSummary: "Căn cứ kiểm tra", disclaimer: "Đề xuất sơ bộ" };
await assert.rejects(gateway.finalizeReviewCase(record.id, report, reviewSnapshot(record)), /chưa được cán bộ kiểm tra/);
const stale = reviewSnapshot(record);
for (const finding of record.findings) {
  await gateway.updateFindingReview(record.id, finding.id, { officerStatus: "edited", officerAdjustedLabel: "has_evidence", officerNote: "Đối chiếu nguồn hiện hành trong ca kiểm thử cô lập" }, officer, reviewSnapshot(record));
  record = await gateway.getReviewCase(record.id);
}
assert.equal(reviewReadiness(record).reason, "");
assert.ok(record.findings.every(f => effectiveFinding(f) === "has_evidence" && f.officerReviewedBy === officer.id && f.officerSourceVersion));
await assert.rejects(gateway.finalizeReviewCase(record.id, report, stale), /thay đổi/);
const changedSource = structuredClone(record);
changedSource.documents[0].currentVersion += 1;
assert.ok(reviewReadiness(changedSource).outdated.length > 0);
const changedFile = structuredClone(record);
changedFile.documents[0].versions[0].fileName = "different-file.pdf";
assert.ok(reviewReadiness(changedFile).outdated.length > 0);
await gateway.finalizeReviewCase(record.id, report, reviewSnapshot(record));
assert.equal((await gateway.getReviewCase(record.id)).status, "completed");
await assert.rejects(gateway.updateFindingReview(record.id, record.findings[0].id, { officerStatus: "confirmed" }, officer), /hoàn tất/);
console.log("PASS: review requires actual checks, respects adjusted findings, tracks source changes and actor, and rejects stale/closed mutations");
