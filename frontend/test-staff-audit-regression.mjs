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
  const mod = { exports: {} };
  modules.set(file, mod);
  const output = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true }, fileName: file }).outputText;
  const localRequire = name => name.startsWith(".") ? load(path.relative(root, path.resolve(path.dirname(file), name)) + ".ts") : require(name);
  vm.runInThisContext(`(function(require,module,exports){${output}\n})`, { filename: file })(localRequire, mod, mod.exports);
  return mod.exports;
}
const { MockCampusDataGateway } = load("lib/data/mock/mock-gateway.ts");
const { officerDraftFor, ticketSnapshot, reviewSnapshot } = load("lib/staff-policy.ts");
// Fresh in-memory storage and lock queue; no browser/database/file cleanup.
const values = new Map();
let tail = Promise.resolve();
let lockCalls = 0;
globalThis.window = { navigator: { locks: { request: async (_name, callback) => {
  lockCalls++;
  const result = tail.then(callback);
  tail = result.catch(() => {});
  return result;
} } } };
let failWrites = false;
globalThis.localStorage = {
  getItem: key => values.get(key) ?? null,
  setItem: (key, value) => { if (failWrites) throw new Error("Isolated quota failure"); values.set(key, value); },
};
const a = new MockCampusDataGateway({ latencyMs: 0 });
const b = new MockCampusDataGateway({ latencyMs: 0 });
const officer = await a.login("OF001");
const staleTicket = await a.getTicket("TKT-2026-0142");
await b.submitGate2Response(staleTicket.id, "respond", "Committed in B", officer, ticketSnapshot(staleTicket));
const committed = values.get("campus247_mock_db_v1");
await assert.rejects(a.submitGate2Response(staleTicket.id, "respond", "Stale A", officer, ticketSnapshot(staleTicket)), /thay đổi/);
assert.equal(values.get("campus247_mock_db_v1"), committed);
assert.equal((await a.getTicket(staleTicket.id)).messages.at(-1).content, "Committed in B");
console.log("PASS: independent gateways reject stale writes, keep committed bytes, and refresh reads");

const student = await a.login("SV001");
await Promise.all(Array.from({ length: 12 }, (_, i) => (i % 2 ? a : b).createTicket(student, { title: `Concurrent ${i}`, type: "lookup", submissionKey: `isolated-${i}`, purpose: "QA" })));
const tickets = await a.getTickets();
assert.equal(tickets.filter(t => t.submissionKey?.startsWith("isolated-")).length, 12);
assert.equal(new Set(tickets.map(t => t.id)).size, tickets.length);
assert.ok(lockCalls >= 14);
console.log("PASS: concurrent writes across instances retain unrelated records under one lock");

const beforeQuota = values.get("campus247_mock_db_v1");
failWrites = true;
await assert.rejects(b.updateOfficerDraft(staleTicket.id, "Must not commit"), /Chưa lưu/);
assert.equal(values.get("campus247_mock_db_v1"), beforeQuota);
failWrites = false;
console.log("PASS: storage failure leaves the committed database unchanged");

const otherOfficer = { ...officer, id: "OF-ISOLATED-2", name: "Cán bộ kiểm thử thứ hai" };
const originalDraft = await a.getTicket(staleTicket.id);
await a.updateOfficerDraft(staleTicket.id, "Private draft OF001", officer, officerDraftFor(originalDraft, officer.id));
await b.updateOfficerDraft(staleTicket.id, "Private draft other officer", otherOfficer, officerDraftFor(originalDraft, otherOfficer.id));
const reloaded = await new MockCampusDataGateway({ latencyMs: 0 }).getTicket(staleTicket.id);
assert.equal(officerDraftFor(reloaded, officer.id), "Private draft OF001");
assert.equal(officerDraftFor(reloaded, otherOfficer.id), "Private draft other officer");
assert.equal(reloaded.officerDraft, originalDraft.officerDraft);
await b.updateOfficerDraft(staleTicket.id, "Newer OF001 draft", officer, "Private draft OF001");
const savedDraftBytes = values.get("campus247_mock_db_v1");
await assert.rejects(a.updateOfficerDraft(staleTicket.id, "Stale draft overwrite", officer, "Private draft OF001"), /tab khác/);
assert.equal(values.get("campus247_mock_db_v1"), savedDraftBytes);
console.log("PASS: persisted drafts remain private by officer and stale draft saves cannot overwrite newer text");

const review = await a.getReviewCase("REV-2026-003");
const request = { id: "QA-audit-request", sentBy: officer.id, createdAt: "2026-10-01T09:00:00.000Z", sentAt: "2026-10-01T09:00:00.000Z", status: "sent", targetStudentId: review.studentId, subject: "Bổ sung", messageBody: "Cần bản rõ", requestedDocuments: [], findingsInvolved: [] };
await b.sendSupplementRequest(review.id, request, officer, reviewSnapshot(review));
const updated = await a.getReviewCase(review.id);
assert.equal(updated.auditLogs.length, review.auditLogs.length + 1);
assert.ok(updated.auditLogs.at(-1).actorName.includes(officer.id));
assert.match(updated.auditLogs.at(-1).timestamp, /^\d{4}-\d{2}-\d{2}T/);
await assert.rejects(a.sendSupplementRequest(review.id, { ...request, id: "stale-request" }, officer, reviewSnapshot(review)), /thay đổi/);
assert.equal((await b.getReviewCase(review.id)).supplementRequests.length, updated.supplementRequests.length);
assert.match((await a.getTicket(staleTicket.id)).auditLogs.at(-1).timestamp, /^\d{4}-\d{2}-\d{2}T/);
console.log("PASS: supplement audit records actor/full date and stale review sends are rejected");
