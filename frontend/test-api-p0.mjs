import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import ts from "typescript";

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

const { ApiCampusDataGateway } = loadTypeScriptModule(path.join(frontendDir, "lib/data/api/api-gateway.ts"));
const { ApiClient } = loadTypeScriptModule(path.join(frontendDir, "lib/data/api/api-client.ts"));
const { createMemorySessionStore } = loadTypeScriptModule(path.join(frontendDir, "lib/data/api/session.ts"));
const { createMemoryPendingStore } = loadTypeScriptModule(path.join(frontendDir, "lib/data/api/idempotency.ts"));
const {
  mapPreview,
  mapChatResult,
  mapWireTicket,
  mapBrief,
  fieldsFromForm,
  previewFieldsToPatch,
} = loadTypeScriptModule(path.join(frontendDir, "lib/data/api/mappers.ts"));
const {
  parseRetryAfterMs,
  isProcessingBody,
  isJobAcceptedBody,
  requestUntilComplete,
} = loadTypeScriptModule(path.join(frontendDir, "lib/data/api/replay.ts"));
const { DataGatewayError, UnsupportedOperationError } = loadTypeScriptModule(
  path.join(frontendDir, "lib/data/errors.ts")
);

const originalFetch = globalThis.fetch;
const tests = [];
function test(name, action) {
  tests.push({ name, action });
}

function jsonResponse(status, body, headers = {}) {
  const initHeaders = { ...headers };
  if (body !== null && body !== undefined && !initHeaders["Content-Type"]) {
    initHeaders["Content-Type"] = "application/json";
  }
  return new Response(body === null || body === undefined ? null : JSON.stringify(body), {
    status,
    headers: initHeaders,
  });
}

function installFetch(handler) {
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    const headers = new Headers(init.headers);
    const record = { url: String(url), method: init.method || "GET", headers, body: init.body ?? null };
    calls.push(record);
    return handler(record, calls);
  };
  return calls;
}

function makeGateway(role = "student") {
  const sessionStore = createMemorySessionStore({
    access_token: "tok_p0",
    token_type: "Bearer",
    expires_at: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
    user: {
      id: role === "officer" ? "OF-DEMO-01" : "SV-DEMO-001",
      role,
      name: role === "officer" ? "Cán bộ Demo" : "Sinh viên Demo",
    },
    remember: true,
  });
  const client = new ApiClient("https://api.example.test", { pendingStore: createMemoryPendingStore() });
  client.setAccessToken("tok_p0");
  return new ApiCampusDataGateway("https://api.example.test", { client, sessionStore });
}

const previewWire = {
  id: "prv_1",
  version: 2,
  can_submit: true,
  expires_at: "2026-10-02T12:00:00+00:00",
  service_type: "student_certificate",
  fields: {
    purpose: "nộp hồ sơ vay vốn ngân hàng",
    destination_org: "Ngân hàng Chính sách Xã hội",
    receive_method: "digital_pdf",
  },
  missing_fields: [],
  invalid_fields: [],
};

const ticketWire = {
  id: "tkt_1",
  code: "TKT-2026-0400",
  status: "open",
  priority: "normal",
  conversation_id: "conv_1",
  student_id: "SV-DEMO-001",
  category: "action",
  service_type: "student_certificate",
  priority_reasons: [],
  summary: "Xin giấy xác nhận sinh viên để nộp hồ sơ vay vốn ngân hàng",
  request_data: previewWire.fields,
  handover_reason: null,
  assigned_officer_id: null,
  revision: 1,
  created_at: "2026-10-02T10:00:00+00:00",
  updated_at: "2026-10-02T10:00:00+00:00",
};

const chatResultWire = {
  conversation_id: "conv_1",
  user_message_id: "msg_u1",
  route: "L2",
  outcome: "preview_ready",
  reply: {
    id: "msg_a1",
    conversation_id: "conv_1",
    ticket_id: null,
    sender: "assistant",
    content: "Bạn hãy kiểm tra thông tin trước khi gửi.",
    created_at: "2026-10-02T10:00:01+00:00",
  },
  citations: [],
  preview: previewWire,
  ticket: null,
  conversation_state: { status: "active", ai_response_locked: false, handover_status: "none" },
};

test("mapPreview maps snake_case P0 fields and submit flag", () => {
  const preview = mapPreview(previewWire);
  assert.equal(preview.id, "prv_1");
  assert.equal(preview.version, 2);
  assert.equal(preview.canSubmit, true);
  assert.equal(preview.fields.destinationOrg, "Ngân hàng Chính sách Xã hội");
  assert.equal(preview.fields.receiveMethod, "digital_pdf");
  assert.deepEqual(previewFieldsToPatch(preview), previewWire.fields);
});

test("fieldsFromForm sends a full snapshot and nulls blank values", () => {
  assert.deepEqual(
    fieldsFromForm({ purpose: "  vay vốn  ", destinationOrg: "", receiveMethod: "" }),
    { purpose: "vay vốn", destination_org: null, receive_method: null }
  );
});

test("mapChatResult L2 attaches preview and does not lock chat", () => {
  const turn = mapChatResult(chatResultWire);
  assert.equal(turn.route, "L2");
  assert.equal(turn.preview?.canSubmit, true);
  assert.equal(turn.conversationState.aiResponseLocked, false);
  assert.equal(turn.reply.actionCard, "submit1_prompt");
  assert.equal(turn.ticket, null);
});

test("mapChatResult L4 locks AI and maps committed ticket ref", () => {
  const turn = mapChatResult({
    ...chatResultWire,
    route: "L4",
    outcome: "handover_completed",
    preview: null,
    ticket: { id: "tkt_l4", code: "TKT-2026-0401", status: "pending_officer", priority: "high" },
    conversation_state: { status: "handover", ai_response_locked: true, handover_status: "completed" },
    reply: { ...chatResultWire.reply, content: "Đã bàn giao cán bộ." },
  });
  assert.equal(turn.route, "L4");
  assert.equal(turn.conversationState.aiResponseLocked, true);
  assert.equal(turn.ticket?.code, "TKT-2026-0401");
  assert.equal(turn.reply.actionCard, "l4_handover");
});

test("mapWireTicket keeps revision and does not copy AI checklist onto the ticket", () => {
  const ticket = mapWireTicket(ticketWire);
  assert.equal(ticket.serverRevision, 1);
  assert.equal(ticket.conversationId, "conv_1");
  assert.equal(ticket.purpose, "nộp hồ sơ vay vốn ngân hàng");
  assert.equal(ticket.checklist.length, 0);
  assert.equal(ticket.studentName, "");
});

test("mapBrief ready envelope exposes version and draft without marking checklist complete", () => {
  const brief = mapBrief({
    status: "ready",
    current_ticket_revision: 2,
    brief_version: 1,
    source_ticket_revision: 2,
    artifact: {
      brief: {
        ticket_id: "tkt_1",
        source_ticket_revision: 2,
        summary: "Tóm tắt hồ sơ",
        facts: [{ key: "purpose", value: "vay vốn", source_type: "student", source_id: "msg_1", verification_status: "unverified" }],
        missing_items: [],
        checklist: [{ id: "check_profile", label: "Kiểm tra tình trạng học tập", checked: false }],
        suggested_priority: "normal",
        priority_reasons: [],
        draft_reply: "Phòng đã tiếp nhận yêu cầu.",
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
  assert.equal(brief.status, "ready");
  assert.equal(brief.briefVersion, 1);
  assert.equal(brief.draftReply, "Phòng đã tiếp nhận yêu cầu.");
  assert.equal(brief.checklist[0].checked, false);
  assert.equal(brief.facts[0].status, "unverified");
  assert.equal(brief.modelName, "stub");
  assert.equal(brief.promptVersion, "1");
  assert.equal(brief.templateVersion, "1");
  assert.equal(brief.missingItems.length, 0);
  assert.equal(brief.citations.length, 0);
});

test("replay helpers distinguish Processing from JobAccepted", () => {
  assert.equal(isProcessingBody({ status: "processing", operation_id: "op_1" }), true);
  assert.equal(isJobAcceptedBody({ job_id: "job_1", status: "pending" }), true);
  assert.equal(isProcessingBody({ job_id: "job_1", status: "pending" }), false);
  assert.equal(parseRetryAfterMs("2"), 2000);
});

test("requestUntilComplete replays 202 Processing then returns the completed body", async () => {
  let attempts = 0;
  installFetch(() => {
    attempts += 1;
    if (attempts === 1) {
      return jsonResponse(202, { status: "processing", operation_id: "op_1" }, { "Retry-After": "0" });
    }
    return jsonResponse(200, chatResultWire);
  });
  const client = new ApiClient("https://api.example.test", { pendingStore: createMemoryPendingStore() });
  client.setAccessToken("tok_p0");
  const result = await requestUntilComplete(client, "/api/v1/conversations/conv_1/messages", {
    method: "POST",
    body: { content: "xin giấy" },
  });
  assert.equal(result.status, 200);
  assert.equal(attempts, 2);
  assert.equal(result.body.route, "L2");
});

test("student P0 methods post ChatResult, full preview snapshot, and Submit1 payload", async () => {
  const calls = installFetch((request) => {
    if (request.method === "POST" && request.url.endsWith("/api/v1/conversations")) {
      return jsonResponse(201, {
        id: "conv_1",
        revision: 1,
        ticket_id: null,
        status: "active",
        ai_response_locked: false,
        handover_status: "none",
        created_at: "2026-10-02T10:00:00+00:00",
        updated_at: "2026-10-02T10:00:00+00:00",
      });
    }
    if (request.method === "POST" && request.url.includes("/conversations/conv_1/messages")) {
      assert.equal(request.body, JSON.stringify({ content: "Tôi muốn xin giấy xác nhận sinh viên" }));
      return jsonResponse(200, chatResultWire);
    }
    if (request.method === "PATCH" && request.url.endsWith("/api/v1/previews/prv_1")) {
      const body = JSON.parse(request.body);
      assert.equal(body.expected_version, 2);
      assert.deepEqual(body.fields, {
        purpose: "nộp hồ sơ thực tập",
        destination_org: "Ngân hàng Chính sách Xã hội",
        receive_method: "digital_pdf",
      });
      return jsonResponse(200, { ...previewWire, version: 3, fields: body.fields });
    }
    if (request.method === "POST" && request.url.endsWith("/api/v1/tickets")) {
      const body = JSON.parse(request.body);
      assert.deepEqual(body, { preview_id: "prv_1", preview_version: 3, confirmed: true });
      return jsonResponse(201, { ticket: { ...ticketWire, revision: 1 }, brief_status: "pending" });
    }
    throw new Error(`Unexpected URL ${request.method} ${request.url}`);
  });
  const gateway = makeGateway("student");
  const conversation = await gateway.createConversation();
  assert.equal(conversation.id, "conv_1");
  const turn = await gateway.sendConversationMessage(conversation.id, "Tôi muốn xin giấy xác nhận sinh viên");
  assert.equal(turn.preview.id, "prv_1");
  const patched = await gateway.patchPreview("prv_1", 2, {
    purpose: "nộp hồ sơ thực tập",
    destination_org: "Ngân hàng Chính sách Xã hội",
    receive_method: "digital_pdf",
  });
  assert.equal(patched.version, 3);
  const ticket = await gateway.submitPreview("prv_1", 3);
  assert.equal(ticket.code, "TKT-2026-0400");
  assert.equal(ticket.checklist.length, 0);
  assert.ok(calls.some((call) => call.headers.get("Idempotency-Key")));
});

test("officer P0 methods claim, prepare/poll brief, and Submit2", async () => {

  const calls = installFetch((request) => {
    if (request.method === "POST" && request.url.endsWith("/claim")) {
      const body = JSON.parse(request.body);
      assert.deepEqual(body, { expected_revision: 1, confirmed: true });
      return jsonResponse(200, {
        ticket: { ...ticketWire, assigned_officer_id: "OF-DEMO-01", revision: 2, status: "open" },
        audit_id: "aud_1",
      });
    }
    if (request.method === "POST" && request.url.endsWith("/prepare")) {
      const body = JSON.parse(request.body);
      assert.deepEqual(body, { expected_revision: 2 });
      return jsonResponse(202, {
        job_id: "job_1",
        ticket_id: "tkt_1",
        source_ticket_revision: 2,
        status: "pending",
      });
    }
    if (request.method === "GET" && request.url.includes("/brief")) {
      return jsonResponse(200, {
        status: "ready",
        current_ticket_revision: 2,
        brief_version: 1,
        source_ticket_revision: 2,
        artifact: {
          brief: {
            ticket_id: "tkt_1",
            source_ticket_revision: 2,
            summary: "Tóm tắt",
            facts: [],
            missing_items: [],
            checklist: [{ id: "check_profile", label: "Kiểm tra", checked: false }],
            suggested_priority: "normal",
            priority_reasons: [],
            draft_reply: "Phòng đã tiếp nhận yêu cầu.",
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
    }
    if (request.method === "POST" && request.url.endsWith("/actions")) {
      const body = JSON.parse(request.body);
      assert.deepEqual(body, {
        action: "resolve",
        content: "Đã xử lý yêu cầu giấy xác nhận.",
        expected_revision: 2,
        reviewed_brief_version: 1,
        confirmed: true,
      });
      return jsonResponse(200, {
        ticket: { ...ticketWire, status: "resolved", assigned_officer_id: "OF-DEMO-01", revision: 3 },
        message: {
          id: "msg_of",
          conversation_id: "conv_1",
          ticket_id: "tkt_1",
          sender: "officer",
          content: "Đã xử lý yêu cầu giấy xác nhận.",
          created_at: "2026-10-02T10:06:00+00:00",
        },
        audit_id: "aud_2",
      });
    }
    throw new Error(`Unexpected URL ${request.method} ${request.url}`);
  });
  const gateway = makeGateway("officer");
  const claimed = await gateway.claimTicket("tkt_1", 1);
  assert.equal(claimed.assignedOfficerId, "OF-DEMO-01");
  assert.equal(claimed.serverRevision, 2);
  const brief = await gateway.prepareBrief("tkt_1", 2);
  assert.equal(brief.status, "ready");
  assert.equal(brief.briefVersion, 1);
  const resolved = await gateway.submitOfficerAction("tkt_1", {
    action: "resolve",
    content: "Đã xử lý yêu cầu giấy xác nhận.",
    expectedRevision: 2,
    reviewedBriefVersion: 1,
  });
  assert.equal(resolved.status, "resolved");
  const prepareCall = calls.find((call) => call.url.endsWith("/prepare"));
  assert.ok(prepareCall.headers.get("Idempotency-Key"));
});

test("API gateway still rejects Partial<Ticket> createTicket", async () => {
  const gateway = makeGateway("student");
  await assert.rejects(
    () => gateway.createTicket({ id: "SV-DEMO-001", role: "student", name: "A", email: "" }, { title: "x" }),
    (error) => error instanceof UnsupportedOperationError
  );
});

test("officer getTickets uses /officer/tickets Page, student uses /tickets", async () => {
  const page = { items: [ticketWire], total: 1, page: 1, page_size: 100 };
  installFetch((request) => {
    if (request.url.includes("/api/v1/officer/tickets")) return jsonResponse(200, page);
    if (request.url.includes("/api/v1/tickets")) return jsonResponse(200, { ...page, items: [] });
    throw new Error(`Unexpected URL ${request.url}`);
  });
  const officerTickets = await makeGateway("officer").getTickets();
  assert.equal(officerTickets[0].code, "TKT-2026-0400");
  const studentTickets = await makeGateway("student").getTickets();
  assert.equal(studentTickets.length, 0);
});

test("STALE_PREVIEW stays a conflict with current_version details", async () => {
  installFetch(() =>
    jsonResponse(409, {
      error: {
        code: "STALE_PREVIEW",
        message: "Preview đã thay đổi.",
        request_id: "req_stale",
        retryable: false,
        details: { current_version: 4 },
      },
    })
  );
  const gateway = makeGateway("student");
  await assert.rejects(
    () =>
      gateway.patchPreview("prv_1", 2, {
        purpose: "x",
        destination_org: "y",
        receive_method: "digital_pdf",
      }),
    (error) =>
      error instanceof DataGatewayError &&
      error.reason === "conflict" &&
      error.code === "STALE_PREVIEW" &&
      error.details?.details?.current_version === 4
  );
});

try {
  for (const { name, action } of tests) {
    await action();
    console.log(`PASS: ${name}`);
  }
} finally {
  if (originalFetch === undefined) delete globalThis.fetch;
  else globalThis.fetch = originalFetch;
}
