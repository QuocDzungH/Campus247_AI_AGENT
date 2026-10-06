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
  resolveSubmittedTicket,
  reuseOrMintIntentKey,
  shouldCommitLoginSession,
  shouldRetainIntentKey,
  submittedPreviewResult,
  isDisplayTicketCode,
} = loadTypeScriptModule(path.join(frontendDir, "lib/data/api/g2-flow.ts"));
const { pollUntil } = loadTypeScriptModule(path.join(frontendDir, "lib/data/api/replay.ts"));
const { mapBrief, mapWireTicket, mapChatResult, mapTicketDetail, mapAuditEntry } = loadTypeScriptModule(path.join(frontendDir, "lib/data/api/mappers.ts"));
const { mapChatTurnToAssistantResult } = loadTypeScriptModule(path.join(frontendDir, "lib/assistant-adapter.ts"));
const { createStudentChatStore, exchangesFromChatMessages } = loadTypeScriptModule(path.join(frontendDir, "lib/student-chat.ts"));
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

test("logout during hydrate failure does not keep the logging-in user", async () => {
  let current = true;
  const result = await loginThenHydrate({
    isCurrent: () => current,
    login: async () => ({ id: "OF-DEMO-01", name: "Officer" }),
    hydrate: async () => {
      current = false;
      throw new DataGatewayError("network", "offline");
    },
  });
  assert.equal(result.ok, false);
  assert.equal(result.stage, "auth");
  assert.equal("user" in result, false);
});

test("repro: logout while hydrating officer does not restore OF-DEMO-01", async () => {
  let generation = 1;
  let currentUser = null;
  const result = await loginThenHydrate({
    isCurrent: () => generation === 1,
    login: async () => ({ id: "OF-DEMO-01", name: "Officer" }),
    hydrate: async () => {
      generation += 1;
      currentUser = null;
      throw new DataGatewayError("network", "offline");
    },
  });
  if (shouldCommitLoginSession(1, generation, result)) {
    currentUser = result.ok ? result.user : result.user;
  }
  assert.equal(result.ok, false);
  assert.equal(result.stage, "auth");
  assert.equal("user" in result, false);
  assert.equal(shouldCommitLoginSession(1, generation, result), false);
  assert.equal(currentUser, null);
});

test("repro: logout after officer hydrate still does not write OF-DEMO-01", async () => {
  let generation = 1;
  const result = await loginThenHydrate({
    isCurrent: () => generation === 1,
    login: async () => ({ id: "OF-DEMO-01", name: "Officer" }),
    hydrate: async () => ({ tickets: [{ id: "tkt_officer" }], chatSessions: [] }),
  });
  generation += 1;
  assert.equal(result.ok, true);
  assert.equal(result.user.id, "OF-DEMO-01");
  assert.equal(shouldCommitLoginSession(1, generation, result), false);
});

test("logout during login failure does not keep an aborted auth error", async () => {
  let current = true;
  const result = await loginThenHydrate({
    isCurrent: () => current,
    login: async () => {
      current = false;
      throw new DataGatewayError("network", "aborted");
    },
    hydrate: async () => ({ tickets: [], chatSessions: [] }),
  });
  assert.equal(result.ok, false);
  assert.equal(result.stage, "auth");
  assert.equal(result.error, undefined);
});

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

test("assistant entry reuses only an untouched chat and preserves previous work", () => {
  installStorage();
  const chat = createStudentChatStore("assistant-entry");
  const first = chat.getSnapshot().activeId;
  chat.start({ reuseEmpty: true });
  assert.equal(chat.getSnapshot().activeId, first);
  assert.equal(chat.getSnapshot().threads.length, 1);
  chat.input("Câu hỏi chưa gửi");
  chat.start({ reuseEmpty: true });
  const blank = chat.getSnapshot().activeId;
  assert.notEqual(blank, first);
  chat.select(first);
  chat.start({ reuseEmpty: true });
  assert.equal(chat.getSnapshot().activeId, blank);
  assert.equal(chat.getSnapshot().threads.length, 2);
  assert.equal(chat.getSnapshot().threads.find(thread => thread.id === first).input, "Câu hỏi chưa gửi");
  chat.bindForm("certificate", "draft-1");
  chat.start({ reuseEmpty: true });
  assert.notEqual(chat.getSnapshot().activeId, blank);
  const fresh = chat.getSnapshot().activeId;
  chat.bindConversation(fresh, "conv-awaiting-messages");
  chat.start({ reuseEmpty: true });
  assert.notEqual(chat.getSnapshot().activeId, fresh);
  chat.send("Xin chào", { text: "Chào bạn" });
  const history = chat.getSnapshot().activeId;
  const restored = createStudentChatStore("assistant-entry");
  restored.start({ reuseEmpty: true });
  assert.notEqual(restored.getSnapshot().activeId, history);
  assert.equal(restored.getSnapshot().threads.find(thread => thread.id === history).exchanges[0].question, "Xin chào");
});

test("new chat excludes a conversation waiting for its first suggestion response", () => {
  installStorage();
  const chat = createStudentChatStore("assistant-pending-suggestion");
  const pending = chat.getSnapshot().activeId;
  chat.start({ reuseEmpty: true, excludeIds: [pending] });
  const fresh = chat.getSnapshot().activeId;
  assert.notEqual(fresh, pending);
  chat.send("Câu hỏi gợi ý", { text: "Phản hồi chậm" }, undefined, pending);
  assert.equal(chat.getSnapshot().activeId, fresh);
  assert.equal(chat.getSnapshot().threads.find(thread => thread.id === fresh).exchanges.length, 0);
  assert.equal(chat.getSnapshot().threads.find(thread => thread.id === pending).exchanges[0].reply.text, "Phản hồi chậm");
});

test("saved guidance with in-chat form actions survives reload", () => {
  installStorage();
  const chat = createStudentChatStore("assistant-guidance-reload");
  chat.send("Xin giấy xác nhận cần thông tin gì?");
  chat.send("Khiếu nại điểm thi thế nào?");
  const restored = createStudentChatStore("assistant-guidance-reload");
  const state = restored.getSnapshot();
  assert.equal(state.issue, null);
  const exchanges = state.threads.find(thread => thread.id === state.activeId).exchanges;
  assert.equal(exchanges.length, 2);
  assert.equal(exchanges[0].reply.action.href, "/student/assistant?intent=certificate");
  assert.equal(exchanges[1].reply.action.href, "/student/assistant?intent=complaint");
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

test("delayed preview response writes to the thread that started the mutation", () => {
  installStorage();
  const chat = createStudentChatStore("g2-preview-target");
  const origin = chat.getSnapshot().activeId;
  const preview = {
    id: "prv_hold",
    version: 2,
    canSubmit: true,
    expiresAt: "2026-10-02T12:00:00Z",
    serviceType: "student_certificate",
    fields: { purpose: "origin", destinationOrg: "Bank", receiveMethod: "digital_pdf" },
    missingFields: [],
    invalidFields: [],
  };
  chat.start();
  const newer = chat.getSnapshot().activeId;
  chat.setFlow(origin, { apiPreview: preview, apiTicket: { id: "tkt_hold", code: "TKT-2026-0099" } });
  chat.setFlow(origin, { apiPendingTicketId: "tkt_hold" });
  const threads = Object.fromEntries(chat.getSnapshot().threads.map((thread) => [thread.id, thread]));
  assert.equal(threads[origin].apiPreview.id, "prv_hold");
  assert.equal(threads[origin].apiTicket.code, "TKT-2026-0099");
  assert.equal(threads[origin].apiPendingTicketId, "tkt_hold");
  assert.equal(threads[newer].apiPreview ?? null, null);
  assert.equal(threads[newer].apiTicket ?? null, null);
  assert.equal(threads[newer].apiPendingTicketId ?? undefined, undefined);
});

test("repro: held PATCH then new chat writes preview/submit/conflict to the origin thread", () => {
  installStorage();
  const chat = createStudentChatStore("g2-held-patch");
  const origin = chat.getSnapshot().activeId;
  const threadId = origin;
  chat.start();
  const newer = chat.getSnapshot().activeId;
  assert.notEqual(newer, origin);
  const delayed = {
    id: "prv_hold",
    version: 3,
    canSubmit: true,
    expiresAt: "2026-10-03T12:00:00Z",
    serviceType: "student_certificate",
    fields: { purpose: "origin after patch", destinationOrg: "Bank", receiveMethod: "digital_pdf" },
    missingFields: [],
    invalidFields: [],
  };
  chat.setFlow(threadId, { apiPreview: delayed });
  chat.setFlow(threadId, { apiPreview: { ...delayed, version: 4 } });
  chat.setFlow(threadId, { apiPreview: null, apiTicket: { id: "tkt_hold", code: "TKT-2026-0099" } });
  const threads = Object.fromEntries(chat.getSnapshot().threads.map((thread) => [thread.id, thread]));
  assert.equal(threads[origin].apiPreview, null);
  assert.equal(threads[origin].apiTicket.code, "TKT-2026-0099");
  assert.equal(threads[newer].apiPreview ?? null, null);
  assert.equal(threads[newer].apiTicket ?? null, null);
  assert.equal(chat.getSnapshot().activeId, newer);
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
  assert.match(blocked.reason, /tải lại|thủ công/i);
  assert.doesNotMatch(blocked.reason, /Submit 2|reviewed_brief_version|brief ready/i);
  const none = decideReviewedBriefVersion({ briefStatus: "none", reviewedBriefVersion: null }, { manualBrief: false });
  assert.equal(none.ok, false);
  assert.doesNotMatch(none.reason, /Submit 2|reviewed_brief_version/i);
  const pending = decideReviewedBriefVersion({ briefStatus: "pending", reviewedBriefVersion: null }, { manualBrief: false });
  assert.equal(pending.ok, false);
  assert.match(pending.reason, /đang tạo|thủ công/i);
  const ready = decideReviewedBriefVersion({ briefStatus: "ready", reviewedBriefVersion: 1 }, { manualBrief: false });
  assert.deepEqual(ready, { ok: true, reviewedBriefVersion: 1 });
  const fromOfficerBrief = decideReviewedBriefVersion(
    { briefStatus: "none", reviewedBriefVersion: null, officerBrief: { status: "ready", briefVersion: 3 } },
    { manualBrief: false }
  );
  assert.deepEqual(fromOfficerBrief, { ok: true, reviewedBriefVersion: 3 });
  const stale = decideReviewedBriefVersion({ briefStatus: "stale", reviewedBriefVersion: 1 }, { manualBrief: false });
  assert.equal(stale.ok, false);
  assert.match(stale.reason, /cũ|thay đổi|thủ công/i);
  assert.doesNotMatch(stale.reason, /Submit 2|reviewed_brief_version/i);
  const manual = decideReviewedBriefVersion({ briefStatus: "pending", reviewedBriefVersion: null, briefLoadError: "HTTP 500" }, { manualBrief: true });
  assert.deepEqual(manual, { ok: true, reviewedBriefVersion: null });
  const staleManual = decideReviewedBriefVersion({ briefStatus: "stale", reviewedBriefVersion: 1 }, { manualBrief: true });
  assert.deepEqual(staleManual, { ok: true, reviewedBriefVersion: null });
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

test("already submitted without a display code does not fabricate a ticket", () => {
  const fake = { id: "tkt_existing", code: "tkt_existing" };
  assert.equal(resolveSubmittedTicket("tkt_existing", fake, undefined), undefined);
  const cached = { id: "tkt_existing", code: "TKT-2026-0400", title: "Giấy xác nhận" };
  assert.equal(resolveSubmittedTicket("tkt_existing", fake, cached).code, "TKT-2026-0400");
  const fetched = { id: "tkt_existing", code: "TKT-2026-0401" };
  assert.equal(resolveSubmittedTicket("tkt_existing", fetched, cached).code, "TKT-2026-0401");
  assert.equal(isDisplayTicketCode("tkt_existing", "tkt_existing"), false);
  assert.equal(isDisplayTicketCode("TKT-2026-0400", "tkt_existing"), true);
  const pending = submittedPreviewResult("tkt_existing", fake, undefined);
  assert.equal(pending.status, "pending_sync");
  assert.equal(pending.ticketId, "tkt_existing");
  const ready = submittedPreviewResult("tkt_existing", fake, cached);
  assert.equal(ready.status, "submitted");
  assert.equal(ready.ticket.code, "TKT-2026-0400");
});

test("repro: 409 PREVIEW_ALREADY_SUBMITTED then GET fail does not upsert tkt_ as ticket code", () => {
  const error = new DataGatewayError("conflict", "Yêu cầu này đã được nộp.", {
    code: "PREVIEW_ALREADY_SUBMITTED",
    details: { ticket_id: "tkt_3b32a5fdf65b479380f8983122e68838" },
  });
  error.code = "PREVIEW_ALREADY_SUBMITTED";
  const ticketId = alreadySubmittedTicketId(error);
  assert.equal(ticketId, "tkt_3b32a5fdf65b479380f8983122e68838");
  const sessionTickets = [];
  const fakeDetail = { id: ticketId, code: ticketId };
  const result = submittedPreviewResult(ticketId, fakeDetail, undefined);
  if (result.status === "submitted") sessionTickets.push(result.ticket);
  assert.equal(result.status, "pending_sync");
  assert.equal(result.ticketId, ticketId);
  assert.equal(sessionTickets.length, 0);
  assert.equal(isDisplayTicketCode(ticketId, ticketId), false);
  const cached = {
    id: ticketId,
    code: "TKT-2026-0400",
    title: "Giấy xác nhận sinh viên",
    studentId: "SV-DEMO-001",
  };
  const recovered = submittedPreviewResult(ticketId, undefined, cached);
  if (recovered.status === "submitted") sessionTickets.push(recovered.ticket);
  assert.equal(recovered.status, "submitted");
  assert.equal(sessionTickets.length, 1);
  assert.equal(sessionTickets[0].code, "TKT-2026-0400");
  assert.equal(sessionTickets[0].code === sessionTickets[0].id, false);
});

test("create conversation intent key is reused until success or a non-retryable error", () => {
  const first = reuseOrMintIntentKey(null);
  assert.equal(reuseOrMintIntentKey(first), first);
  const network = new DataGatewayError("network", "lost response");
  network.retryable = true;
  assert.equal(shouldRetainIntentKey(network), true);
  const conflict = new DataGatewayError("conflict", "exists");
  conflict.retryable = false;
  assert.equal(shouldRetainIntentKey(conflict), false);
  assert.equal(shouldRetainIntentKey(undefined), false);
});

function makeConversationGateway() {
  return new ApiCampusDataGateway("https://api.example.test", {
    client: (() => {
      const client = new ApiClient("https://api.example.test", { pendingStore: createMemoryPendingStore() });
      client.setAccessToken("tok");
      return client;
    })(),
    sessionStore: createMemorySessionStore({
      access_token: "tok",
      token_type: "Bearer",
      expires_at: new Date(Date.now() + 3600_000).toISOString(),
      user: { id: "SV-DEMO-001", role: "student", name: "SV" },
      remember: true,
    }),
  });
}

async function storeStyleCreateConversation(gateway, pendingRef) {
  const key = reuseOrMintIntentKey(pendingRef.current);
  pendingRef.current = key;
  try {
    const conversation = await gateway.createConversation({ idempotencyKey: key });
    pendingRef.current = null;
    return conversation;
  } catch (error) {
    if (!shouldRetainIntentKey(error)) pendingRef.current = null;
    throw error;
  }
}

test("createConversation retry after lost response reuses Idempotency-Key", async () => {
  const keys = [];
  let attempts = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    if (String(init.method || "GET").toUpperCase() === "POST" && url.endsWith("/api/v1/conversations")) {
      keys.push(new Headers(init.headers).get("Idempotency-Key"));
      attempts += 1;
      if (attempts === 1) throw new TypeError("Failed to fetch");
      return jsonResponse(201, {
        id: "conv_same",
        revision: 1,
        ticket_id: null,
        status: "active",
        ai_response_locked: false,
        handover_status: "none",
        created_at: "2026-10-02T10:00:00+00:00",
        updated_at: "2026-10-02T10:00:00+00:00",
      });
    }
    throw new Error(url);
  };
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
      user: { id: "SV-DEMO-001", role: "student", name: "SV" },
      remember: true,
    }),
  });
  let pendingKey = reuseOrMintIntentKey(null);
  try {
    try {
      await gateway.createConversation({ idempotencyKey: pendingKey });
      assert.fail("expected lost response");
    } catch (error) {
      assert.equal(shouldRetainIntentKey(error), true);
      pendingKey = reuseOrMintIntentKey(pendingKey);
    }
    const conversation = await gateway.createConversation({ idempotencyKey: pendingKey });
    assert.equal(conversation.id, "conv_same");
    assert.equal(attempts, 2);
    assert.equal(keys.length, 2);
    assert.ok(keys[0]);
    assert.equal(keys[0], keys[1]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("repro: lost createConversation response retries with the same Idempotency-Key", async () => {
  const keys = [];
  const minted = new Map();
  let attempts = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    if (String(init.method || "GET").toUpperCase() === "POST" && url.endsWith("/api/v1/conversations")) {
      const key = new Headers(init.headers).get("Idempotency-Key");
      keys.push(key);
      attempts += 1;
      if (attempts === 1) throw new TypeError("Failed to fetch");
      if (!minted.has(key)) minted.set(key, `conv_${minted.size + 1}`);
      return jsonResponse(201, {
        id: minted.get(key),
        revision: 1,
        ticket_id: null,
        status: "active",
        ai_response_locked: false,
        handover_status: "none",
        created_at: "2026-10-03T10:00:00+00:00",
        updated_at: "2026-10-03T10:00:00+00:00",
      });
    }
    throw new Error(url);
  };
  const gateway = makeConversationGateway();
  const pendingRef = { current: null };
  try {
    try {
      await storeStyleCreateConversation(gateway, pendingRef);
      assert.fail("expected lost response");
    } catch (error) {
      assert.equal(shouldRetainIntentKey(error), true);
      assert.ok(pendingRef.current);
    }
    const conversation = await storeStyleCreateConversation(gateway, pendingRef);
    assert.equal(attempts, 2);
    assert.equal(keys.length, 2);
    assert.equal(keys[0], keys[1]);
    assert.equal(conversation.id, "conv_1");
    assert.equal(minted.size, 1);
    assert.equal(pendingRef.current, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("thread create intent key survives retry and clears after bind", () => {
  installStorage();
  const chat = createStudentChatStore("g2-create-key");
  const threadId = chat.getSnapshot().activeId;
  const first = reuseOrMintIntentKey(undefined);
  chat.setFlow(threadId, { createIntentKey: first });
  assert.equal(reuseOrMintIntentKey(chat.getSnapshot().threads[0].createIntentKey), first);
  chat.bindConversation(threadId, "conv_1");
  assert.equal(chat.getSnapshot().threads[0].conversationId, "conv_1");
  assert.equal(chat.getSnapshot().threads[0].createIntentKey, undefined);
});

test("non-retryable create failure drops the thread intent key", () => {
  installStorage();
  const chat = createStudentChatStore("g2-create-key-drop");
  const threadId = chat.getSnapshot().activeId;
  const key = reuseOrMintIntentKey(undefined);
  chat.setFlow(threadId, { createIntentKey: key });
  const conflict = new DataGatewayError("conflict", "exists");
  conflict.retryable = false;
  if (!shouldRetainIntentKey(conflict)) chat.setFlow(threadId, { createIntentKey: undefined });
  assert.equal(chat.getSnapshot().threads[0].createIntentKey, undefined);
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
  assert.match(sheet, /Mục đích xin giấy/);
  assert.match(sheet, /Cơ quan\/đơn vị nhận/);
  assert.match(sheet, /Kiểm tra tình trạng học tập/);
  assert.match(sheet, /Chưa có email nơi nhận/);
  assert.match(sheet, /Quy chế 1/);
  assert.match(sheet, /Quy chế 2/);
  assert.match(sheet, /stub/);
  assert.match(sheet, /p1/);
  assert.match(sheet, /Thông tin kỹ thuật/);
  assert.match(sheet, /Cảnh báo từ AI/);
  assert.match(sheet, /Việc cán bộ nên làm tiếp/);
  assert.doesNotMatch(sheet, /Hành động tiếp theo/);
  const audit = mapAuditEntry({
    id: "aud_g2",
    ticket_id: "tkt_1",
    actor_id: "usr_officer",
    actor_type: "officer",
    actor_name: "Trần Thị Hà",
    action: "brief_ready",
    from_status: "pending_officer",
    to_status: "pending_officer",
    request_id: "req_g2",
    details: { brief_version: 1 },
    created_at: "2026-10-04T03:00:00Z",
  });
  assert.equal(audit.action, "AI đã hoàn tất bản tóm tắt hồ sơ");
  assert.doesNotMatch(JSON.stringify(audit), /\{"brief_version"/);
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
  assert.equal(mapped.reply.sources[0].documentId, "doc_1");
  assert.equal(mapped.reply.sources[0].documentVersion, "v1");
  assert.equal(mapped.reply.sources[0].chunkId, "c1");
  assert.equal(mapped.reply.sources[1].documentId, "doc_2");
  const provenance = renderToStaticMarkup(
    React.createElement(CitationList, {
      sources: mapped.reply.sources,
    })
  );
  assert.match(provenance, /doc_1/);
  assert.match(provenance, /doc_2/);
  assert.match(provenance, /c1/);
  const history = exchangesFromChatMessages([
    { id: "u1", sender: "user", text: "Quy trình cấp giấy?", timestamp: "2026-10-03T04:00:00Z" },
    {
      id: "a1",
      sender: "bot",
      text: "Theo quy chế",
      timestamp: "2026-10-03T04:00:01Z",
      citations: [
        {
          documentId: "demo-qc-giay-001",
          documentTitle: "[Demo] Quy chế",
          documentVersion: "2026.09-demo",
          chunkId: "demo-qc-giay-001-c01",
          locator: "Điều 5 khoản 1",
          quote: "sinh viên đăng ký trên Campus 24/7",
        },
      ],
    },
  ]);
  assert.equal(history[0].reply.sources[0].documentId, "demo-qc-giay-001");
  assert.equal(history[0].reply.sources[0].documentVersion, "2026.09-demo");
  assert.equal(history[0].reply.sources[0].chunkId, "demo-qc-giay-001-c01");
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
    if (url.includes("/messages")) return jsonResponse(200, { items: [], total: 0, page: 1, page_size: 100 });
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
  ticket.officerDraft = "Nháp cán bộ đang sửa";
  const next = applyBriefToTicket(ticket, brief);
  assert.equal(next.facts[0].key, "purpose");
  assert.equal(next.checklist.length, 0);
  assert.equal(next.officerBrief.checklist[0].label, "Check");
  assert.equal(next.officerDraft, "Nháp cán bộ đang sửa");
  assert.equal(next.officerDraftDefault, "Nháp");
  const failed = markBriefLoadFailure(ticket, new DataGatewayError("server", "HTTP 500"));
  assert.equal(failed.briefStatus, undefined);
  assert.equal(failed.briefLoadError, "HTTP 500");
});

test("mapTicketDetail keeps extras, profile, and viewed verification as insufficient", () => {
  const ticket = mapTicketDetail({
    ticket: {
      id: "tkt_1",
      code: "TKT-2026-0400",
      status: "pending_officer",
      priority: "normal",
      conversation_id: "conv_1",
      student_id: "SV-DEMO-001",
      category: "action",
      service_type: "student_certificate",
      priority_reasons: [],
      summary: "Xin giấy xác nhận đang theo học",
      request_data: {
        purpose: "Ho so thuc tap",
        destination_org: "Cong ty ABC",
        receive_method: "digital_pdf",
        extras: { documentType: "ENR", copies: "2" },
      },
      handover_reason: null,
      assigned_officer_id: "OF-DEMO-01",
      revision: 3,
      created_at: "2026-10-02T10:00:00+00:00",
      updated_at: "2026-10-02T10:00:00+00:00",
      student_name: "Nguyễn Văn An",
      student_mssv: "20210018",
    },
    messages: { items: [], total: 0, page: 1, page_size: 20 },
    attachments: [{ id: "att_1", filename: "minh-chung.pdf", mime_type: "application/pdf", size_bytes: 12, field: "evidence", created_at: "2026-10-02T10:00:00+00:00" }],
    workspace: { ticket_id: "tkt_1", revision: 3, officer_draft: "Nháp cán bộ", checklist: [{ id: "chk_identity", label: "Đối chiếu họ tên", checked: true, required: true, source: "process" }] },
    verifications: [{
      id: "verif-academic",
      criterion_key: "academic_status",
      criterion_label: "Tình trạng học tập",
      condition_applied: "Quy trình cấp giấy",
      data_checked: "sis=false",
      source_system: "SIS (chưa kết nối)",
      lookup_timestamp: "2026-10-02T10:00:00+00:00",
      status: "insufficient",
      reason: "Chưa kết nối SIS",
      officer_review_status: "confirmed",
      officer_resolution: "viewed",
      connector_status: "not_configured",
      stale: false,
    }],
    student_profile: {
      user_id: "SV-DEMO-001",
      full_name: "Nguyễn Văn An",
      mssv: "20210018",
      email: "an@example.test",
      faculty: "Kỹ thuật Phần mềm",
      major: "KTPM",
      class_year: "K18",
      verification_status: "imported",
      is_demo: false,
    },
    process: {
      service_type: "student_certificate",
      label: "Giấy xác nhận sinh viên",
      process_version: "cert-process-v1",
      issues_document: true,
      template_id: "student_certificate_vn",
      template_version: "v1",
      template_status: "approved",
      validity_days: null,
      requires_academic_status: true,
      requires_financial_clearance: false,
      required_criteria: ["identity_match"],
      issue_required_criteria: ["identity_match", "academic_status"],
    },
    document_draft: {
      ticket_id: "tkt_1",
      version: 1,
      template_id: "student_certificate_vn",
      template_version: "v1",
      template_status: "approved",
      status: "draft",
      student_snapshot: { full_name: "Nguyễn Văn An", mssv: "20210018" },
      purpose: "Ho so thuc tap",
      destination_org: "Cong ty ABC",
    },
    issued_document: null,
    supplements: [],
  });
  assert.equal(ticket.studentName, "Nguyễn Văn An");
  assert.equal(ticket.studentMssv, "20210018");
  assert.ok(ticket.requestPayload.submittedFields.some((field) => field.name === "extras.documentType" && field.value === "ENR"));
  assert.ok(ticket.requestPayload.submittedFields.some((field) => field.name === "purpose"));
  assert.equal(ticket.attachments[0].name, "minh-chung.pdf");
  assert.equal(ticket.systemVerifications[0].status, "insufficient");
  assert.equal(ticket.systemVerifications[0].officerResolution, "viewed");
  assert.equal(ticket.process.templateStatus, "approved");
  assert.equal(ticket.documentDraft.status, "draft");
  assert.equal(ticket.officerDraft, "Nháp cán bộ");
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
