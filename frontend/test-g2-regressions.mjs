import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const frontendDir = path.dirname(fileURLToPath(import.meta.url));
const nativeRequire = createRequire(import.meta.url);
const moduleCache = new Map();

function resolveTypeScriptModule(specifier, parentFile) {
  const basePath = path.resolve(path.dirname(parentFile), specifier);
  const candidates = [basePath, `${basePath}.ts`, `${basePath}.tsx`, path.join(basePath, "index.ts")];
  const match = candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
  if (!match) throw new Error(`Unable to resolve ${specifier} from ${parentFile}`);
  return match;
}

function loadTypeScriptModule(entryFile) {
  const resolvedEntry = path.resolve(entryFile);
  const cached = moduleCache.get(resolvedEntry);
  if (cached) return cached.exports;
  const moduleRecord = { exports: {} };
  moduleCache.set(resolvedEntry, moduleRecord);
  const source = fs.readFileSync(resolvedEntry, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
    fileName: resolvedEntry,
  }).outputText;
  const localRequire = (specifier) => {
    if (specifier === "react/jsx-runtime") return nativeRequire("react/jsx-runtime");
    if (specifier.startsWith("@/")) {
      return loadTypeScriptModule(resolveTypeScriptModule(path.join(frontendDir, specifier.slice(2)), resolvedEntry));
    }
    if (specifier.startsWith(".")) return loadTypeScriptModule(resolveTypeScriptModule(specifier, resolvedEntry));
    return nativeRequire(specifier);
  };
  const execute = vm.runInThisContext(
    `(function (require, module, exports, __filename, __dirname) {\n${transpiled}\n})`,
    { filename: resolvedEntry }
  );
  execute(localRequire, moduleRecord, moduleRecord.exports, resolvedEntry, path.dirname(resolvedEntry));
  return moduleRecord.exports;
}

function installStorage() {
  const data = new Map();
  const storage = {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => {
      data.set(key, String(value));
    },
    removeItem: (key) => {
      data.delete(key);
    },
    clear: () => data.clear(),
  };
  globalThis.localStorage = storage;
  globalThis.window = { localStorage: storage };
  return storage;
}

const { DataGatewayError } = loadTypeScriptModule(path.join(frontendDir, "lib/data/errors.ts"));
const {
  loginThenHydrate,
  commitThenReconcile,
  alreadySubmittedTicketId,
  decideReviewedBriefVersion,
  applyBriefToTicket,
  markBriefLoadFailure,
  isBriefPollComplete,
  claimDisabled,
  assignedToOtherOfficer,
  receiveMethodDisplay,
} = loadTypeScriptModule(path.join(frontendDir, "lib/data/api/g2-flow.ts"));
const { pollUntil } = loadTypeScriptModule(path.join(frontendDir, "lib/data/api/replay.ts"));
const { mapBrief, mapWireTicket, mapChatResult } = loadTypeScriptModule(path.join(frontendDir, "lib/data/api/mappers.ts"));
const { mapChatTurnToAssistantResult } = loadTypeScriptModule(path.join(frontendDir, "lib/assistant-adapter.ts"));
const { createStudentChatStore } = loadTypeScriptModule(path.join(frontendDir, "lib/student-chat.ts"));
const { OfficerFactSheet } = loadTypeScriptModule(path.join(frontendDir, "components/staff/OfficerFactSheet.tsx"));
const { CitationList } = loadTypeScriptModule(path.join(frontendDir, "components/student/CitationList.tsx"));
const { ApiCampusDataGateway } = loadTypeScriptModule(path.join(frontendDir, "lib/data/api/api-gateway.ts"));
const { ApiClient } = loadTypeScriptModule(path.join(frontendDir, "lib/data/api/api-client.ts"));
const { createMemorySessionStore } = loadTypeScriptModule(path.join(frontendDir, "lib/data/api/session.ts"));
const { createMemoryPendingStore } = loadTypeScriptModule(path.join(frontendDir, "lib/data/api/idempotency.ts"));

const tests = [];
function test(name, action) {
  tests.push({ name, action });
}

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "X-Request-Id": "req_test" },
  });
}

test("login success then hydrate failure keeps the new user and is a connection error", async () => {
  const tokenHolder = { value: null };
  const result = await loginThenHydrate({
    isCurrent: () => true,
    login: async () => {
      tokenHolder.value = "token-B";
      return { id: "SV-DEMO-002", name: "B" };
    },
    hydrate: async () => {
      throw new DataGatewayError("network", "offline");
    },
  });
  assert.equal(result.ok, false);
  assert.equal(result.stage, "hydrate");
  assert.equal(result.user.id, "SV-DEMO-002");
  assert.equal(tokenHolder.value, "token-B");
  assert.equal(result.error.reason, "network");
});

test("two threads keep distinct preview and L4 lock state", () => {
  installStorage();
  const chat = createStudentChatStore("g2-thread-test");
  const first = chat.getSnapshot().activeId;
  chat.start();
  const second = chat.getSnapshot().activeId;
  chat.setFlow(first, {
    apiPreview: {
      id: "prv_a",
      version: 1,
      canSubmit: true,
      expiresAt: "2026-10-02T12:00:00Z",
      serviceType: "student_certificate",
      fields: { purpose: "A", destinationOrg: "Bank A", receiveMethod: "digital_pdf" },
      missingFields: [],
      invalidFields: [],
    },
    apiLocked: false,
    apiTicket: null,
  });
  chat.setFlow(second, {
    apiPreview: null,
    apiLocked: true,
    apiTicket: { id: "tkt_b", code: "TKT-B" },
  });
  const threads = Object.fromEntries(chat.getSnapshot().threads.map((thread) => [thread.id, thread]));
  assert.equal(threads[first].apiPreview.id, "prv_a");
  assert.equal(threads[first].apiLocked, false);
  assert.equal(threads[second].apiLocked, true);
  assert.equal(threads[second].apiTicket.code, "TKT-B");
  assert.equal(threads[second].apiPreview, null);
  chat.select(first);
  assert.equal(chat.getSnapshot().threads.find((thread) => thread.id === chat.getSnapshot().activeId).apiPreview.id, "prv_a");
});

test("prepare poll ignores stale brief from a previous revision", async () => {
  assert.equal(isBriefPollComplete({ status: "stale", sourceTicketRevision: 1 }, 2), false);
  assert.equal(isBriefPollComplete({ status: "ready", sourceTicketRevision: 1 }, 2), false);
  assert.equal(isBriefPollComplete({ status: "pending", sourceTicketRevision: null }, 2), false);
  assert.equal(isBriefPollComplete({ status: "ready", sourceTicketRevision: 2 }, 2), true);
  assert.equal(isBriefPollComplete({ status: "failed", sourceTicketRevision: 2 }, 2), true);
  assert.equal(isBriefPollComplete({ status: "stale", sourceTicketRevision: 2 }, 2), true);
  let reads = 0;
  const brief = await pollUntil(
    async () => {
      reads += 1;
      return reads === 1
        ? { status: "stale", sourceTicketRevision: 1 }
        : { status: "ready", sourceTicketRevision: 2 };
    },
    (value) => isBriefPollComplete(value, 2),
    { maxAttempts: 5, intervalMs: 1 }
  );
  assert.equal(brief.status, "ready");
  assert.equal(brief.sourceTicketRevision, 2);
  assert.equal(reads, 2);
});

test("brief GET error without manual mode cannot Submit 2", () => {
  const blocked = decideReviewedBriefVersion({ briefStatus: undefined, reviewedBriefVersion: null, briefLoadError: "HTTP 500" }, { manualBrief: false });
  assert.equal(blocked.ok, false);
  const none = decideReviewedBriefVersion({ briefStatus: "none", reviewedBriefVersion: null }, { manualBrief: false });
  assert.equal(none.ok, false);
  const pending = decideReviewedBriefVersion({ briefStatus: "pending", reviewedBriefVersion: null }, { manualBrief: false });
  assert.equal(pending.ok, false);
  const ready = decideReviewedBriefVersion({ briefStatus: "ready", reviewedBriefVersion: 1 }, { manualBrief: false });
  assert.deepEqual(ready, { ok: true, reviewedBriefVersion: 1 });
  const manual = decideReviewedBriefVersion({ briefStatus: "pending", reviewedBriefVersion: null, briefLoadError: "HTTP 500" }, { manualBrief: true });
  assert.deepEqual(manual, { ok: true, reviewedBriefVersion: null });
});

test("mutation commit remains success when refetch fails", async () => {
  const committed = { id: "tkt_1", code: "TKT-1", status: "open" };
  const result = await commitThenReconcile(committed, async () => {
    throw new DataGatewayError("network", "offline");
  });
  assert.equal(result.id, "tkt_1");
  assert.equal(result.status, "open");
});

test("ticket message commit stays success when detail refetch fails", async () => {
  const committed = {
    id: "tkt_1",
    messages: [{ id: "msg_u", senderRole: "student", content: "Bổ sung MSSV" }],
  };
  const result = await commitThenReconcile(committed, async () => {
    throw new DataGatewayError("network", "offline");
  });
  assert.equal(result.messages[0].id, "msg_u");
  assert.equal(result.messages.length, 1);
});

test("PREVIEW_ALREADY_SUBMITTED exposes ticket_id from error details", () => {
  const error = new DataGatewayError("conflict", "Yêu cầu này đã được nộp.", {
    code: "PREVIEW_ALREADY_SUBMITTED",
    details: { ticket_id: "tkt_existing" },
  });
  error.code = "PREVIEW_ALREADY_SUBMITTED";
  assert.equal(alreadySubmittedTicketId(error), "tkt_existing");
});

test("Fact Sheet and citation list render facts and every citation", () => {
  const brief = mapBrief({
    status: "ready",
    current_ticket_revision: 2,
    brief_version: 1,
    source_ticket_revision: 2,
    artifact: {
      brief: {
        ticket_id: "tkt_1",
        source_ticket_revision: 2,
        summary: "Tóm tắt hồ sơ L3",
        facts: [
          { key: "purpose", value: "vay vốn", source_type: "student", source_id: "msg_1", verification_status: "unverified" },
          { key: "destination_org", value: "NHCSXH", source_type: "student", source_id: "msg_1", verification_status: "unverified" },
        ],
        missing_items: [{ field: "email", reason: "Chưa có email nơi nhận" }],
        checklist: [{ id: "check_profile", label: "Kiểm tra tình trạng học tập", checked: false }],
        suggested_priority: "normal",
        priority_reasons: [],
        draft_reply: "Phòng đã tiếp nhận.",
        citations: [
          {
            document_id: "doc_1",
            document_title: "Quy chế 1",
            document_version: "v1",
            chunk_id: "c1",
            locator: "điều 1",
            quote: "Trích 1",
            url: null,
          },
          {
            document_id: "doc_2",
            document_title: "Quy chế 2",
            document_version: "v1",
            chunk_id: "c2",
            locator: "điều 2",
            quote: "Trích 2",
            url: null,
          },
        ],
        warnings: [{ code: "INCOMPLETE", message: "Thiếu email" }],
        quality_status: "fail",
      },
      brief_version: 1,
      source_ticket_revision: 2,
      model_name: "stub",
      prompt_version: "p1",
      template_version: "t1",
      index_version: "i1",
      created_at: "2026-10-02T10:05:00+00:00",
    },
    error: null,
  });
  assert.equal(brief.facts.length, 2);
  assert.equal(brief.citations.length, 2);
  assert.equal(brief.missingItems[0].field, "email");
  assert.equal(brief.modelName, "stub");
  const sheet = renderToStaticMarkup(React.createElement(OfficerFactSheet, { brief }));
  assert.match(sheet, /vay vốn/);
  assert.match(sheet, /NHCSXH/);
  assert.match(sheet, /Kiểm tra tình trạng học tập/);
  assert.match(sheet, /Chưa có email nơi nhận/);
  assert.match(sheet, /Quy chế 1/);
  assert.match(sheet, /Quy chế 2/);
  assert.match(sheet, /stub/);
  assert.match(sheet, /p1/);
  const citations = renderToStaticMarkup(
    React.createElement(CitationList, {
      sources: [
        { title: "Quy chế 1", section: "điều 1", quote: "Trích 1" },
        { title: "Quy chế 2", section: "điều 2", quote: "Trích 2" },
      ],
    })
  );
  assert.match(citations, /Quy chế 1/);
  assert.match(citations, /Quy chế 2/);
  const mapped = mapChatTurnToAssistantResult(
    mapChatResult({
      conversation_id: "conv_1",
      user_message_id: "msg_u",
      route: "L1",
      outcome: "answered",
      reply: {
        id: "msg_a",
        conversation_id: "conv_1",
        ticket_id: null,
        sender: "assistant",
        content: "Theo quy chế",
        created_at: "2026-10-02T10:00:00+00:00",
      },
      citations: [
        {
          document_id: "doc_1",
          document_title: "Quy chế 1",
          document_version: "v1",
          chunk_id: "c1",
          locator: "điều 1",
          quote: "Trích 1",
          url: null,
        },
        {
          document_id: "doc_2",
          document_title: "Quy chế 2",
          document_version: "v1",
          chunk_id: "c2",
          locator: "điều 2",
          quote: "Trích 2",
          url: null,
        },
      ],
      preview: null,
      ticket: null,
      conversation_state: { status: "active", ai_response_locked: false, handover_status: "none" },
    })
  );
  assert.equal(mapped.reply.sources.length, 2);
});

test("missing receive_method stays empty and claim locks when assigned to another officer", () => {
  const ticket = mapWireTicket({
    id: "tkt_1",
    code: "TKT-2026-0400",
    status: "pending_officer",
    priority: "normal",
    conversation_id: "conv_1",
    student_id: "SV-DEMO-001",
    category: "action",
    service_type: "student_certificate",
    priority_reasons: [],
    summary: "Xin giấy",
    request_data: { purpose: "vay", destination_org: "NH", receive_method: null },
    handover_reason: null,
    assigned_officer_id: "OF-DEMO-02",
    revision: 2,
    created_at: "2026-10-02T10:00:00+00:00",
    updated_at: "2026-10-02T10:00:00+00:00",
  });
  assert.equal(ticket.receiveMethod, "");
  assert.equal(ticket.studentName, "");
  assert.equal(receiveMethodDisplay(ticket.receiveMethod), "Chưa có dữ liệu");
  assert.equal(claimDisabled(ticket), true);
  assert.equal(assignedToOtherOfficer(ticket, "OF-DEMO-01"), true);
  assert.equal(assignedToOtherOfficer(ticket, "OF-DEMO-02"), false);
});

test("getTicketDetail does not turn brief HTTP 500 into none", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes("/tickets/tkt_1?") || url.endsWith("/tickets/tkt_1")) {
      return jsonResponse(200, {
        ticket: {
          id: "tkt_1",
          code: "TKT-1",
          status: "pending_officer",
          priority: "normal",
          conversation_id: "conv_1",
          student_id: "SV-DEMO-001",
          category: "action",
          service_type: "student_certificate",
          priority_reasons: [],
          summary: "Xin giấy",
          request_data: null,
          handover_reason: null,
          assigned_officer_id: "OF-DEMO-01",
          revision: 2,
          created_at: "2026-10-02T10:00:00+00:00",
          updated_at: "2026-10-02T10:00:00+00:00",
        },
        messages: { items: [], total: 0, page: 1, page_size: 100 },
      });
    }
    if (url.includes("/audit")) return jsonResponse(200, { items: [], total: 0, page: 1, page_size: 100 });
    if (url.includes("/brief")) {
      return jsonResponse(500, {
        error: { code: "PERSISTENCE_UNAVAILABLE", message: "DB down", request_id: "req_x", retryable: true },
      });
    }
    throw new Error(url);
  };
  try {
    const gateway = new ApiCampusDataGateway("https://api.example.test", {
      client: (() => {
        const client = new ApiClient("https://api.example.test", { pendingStore: createMemoryPendingStore() });
        client.setAccessToken("tok");
        return client;
      })(),
      sessionStore: createMemorySessionStore({
        access_token: "tok",
        token_type: "Bearer",
        expires_at: new Date(Date.now() + 3600_000).toISOString(),
        user: { id: "OF-DEMO-01", role: "officer", name: "CB" },
        remember: true,
      }),
    });
    const ticket = await gateway.getTicketDetail("tkt_1");
    assert.notEqual(ticket.briefStatus, "none");
    assert.ok(ticket.briefLoadError);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("applyBriefToTicket keeps facts off the mutation checklist used by resolve", () => {
  const ticket = mapWireTicket({
    id: "tkt_1",
    code: "TKT-1",
    status: "pending_officer",
    priority: "normal",
    conversation_id: "conv_1",
    student_id: "SV-DEMO-001",
    category: "action",
    service_type: "student_certificate",
    priority_reasons: [],
    summary: "Xin giấy",
    request_data: { purpose: "vay", destination_org: "NH", receive_method: "digital_pdf" },
    handover_reason: null,
    assigned_officer_id: "OF-DEMO-01",
    revision: 2,
    created_at: "2026-10-02T10:00:00+00:00",
    updated_at: "2026-10-02T10:00:00+00:00",
  });
  const brief = mapBrief({
    status: "ready",
    current_ticket_revision: 2,
    brief_version: 1,
    source_ticket_revision: 2,
    artifact: {
      brief: {
        ticket_id: "tkt_1",
        source_ticket_revision: 2,
        summary: "Tóm tắt",
        facts: [{ key: "purpose", value: "vay", source_type: "student", source_id: "m", verification_status: "unverified" }],
        missing_items: [],
        checklist: [{ id: "c1", label: "Check", checked: false }],
        suggested_priority: "normal",
        priority_reasons: [],
        draft_reply: "Nháp",
        citations: [],
        warnings: [],
        quality_status: "pass",
      },
      brief_version: 1,
      source_ticket_revision: 2,
      model_name: "stub",
      prompt_version: "1",
      template_version: "1",
      index_version: null,
      created_at: "2026-10-02T10:05:00+00:00",
    },
    error: null,
  });
  const next = applyBriefToTicket(ticket, brief);
  assert.equal(next.facts[0].key, "purpose");
  assert.equal(next.checklist.length, 0);
  assert.equal(next.officerBrief.checklist[0].label, "Check");
  const failed = markBriefLoadFailure(ticket, new DataGatewayError("server", "HTTP 500"));
  assert.equal(failed.briefStatus, undefined);
  assert.equal(failed.briefLoadError, "HTTP 500");
});

try {
  for (const { name, action } of tests) {
    await action();
    console.log(`PASS: ${name}`);
  }
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
