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
  const candidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    path.join(basePath, "index.ts"),
  ];
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
    if (specifier.startsWith(".")) {
      return loadTypeScriptModule(resolveTypeScriptModule(specifier, resolvedEntry));
    }
    return nativeRequire(specifier);
  };
  const execute = vm.runInThisContext(
    `(function (require, module, exports, __filename, __dirname) {\n${transpiled}\n})`,
    { filename: resolvedEntry }
  );
  execute(localRequire, moduleRecord, moduleRecord.exports, resolvedEntry, path.dirname(resolvedEntry));
  return moduleRecord.exports;
}

const { DATA_MODE_KEY, getDataConfig } = loadTypeScriptModule(
  path.join(frontendDir, "lib/data/config.ts")
);
const { ConfigurationError, DataGatewayError, UnsupportedOperationError } = loadTypeScriptModule(
  path.join(frontendDir, "lib/data/errors.ts")
);
const { MockCampusDataGateway } = loadTypeScriptModule(
  path.join(frontendDir, "lib/data/mock/mock-gateway.ts")
);
const { ApiCampusDataGateway } = loadTypeScriptModule(
  path.join(frontendDir, "lib/data/api/api-gateway.ts")
);
const {
  bootstrapData,
  initializeDataState,
  statusForError,
  dataStateAfterGatewaySuccess,
  writeMockRememberedUser,
  clearMockRememberedUser,
  MOCK_REMEMBERED_USER_KEY,
} = loadTypeScriptModule(path.join(frontendDir, "lib/store.tsx"));
const { API_SESSION_STORAGE_KEY } = loadTypeScriptModule(
  path.join(frontendDir, "lib/data/api/session.ts")
);

const envKeys = [
  "NEXT_PUBLIC_DATA_MODE",
  "NEXT_PUBLIC_API_BASE_URL",
  "NEXT_PUBLIC_ENABLE_DATA_MODE_SWITCH",
];
const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
const originalWindow = globalThis.window;
const originalLocalStorage = globalThis.localStorage;

function setEnvironment(values) {
  for (const key of envKeys) {
    if (Object.prototype.hasOwnProperty.call(values, key) && values[key] !== undefined) {
      process.env[key] = values[key];
    } else {
      delete process.env[key];
    }
  }
}

function installStorage(values = {}) {
  const entries = new Map(Object.entries(values));
  const storage = {
    getItem(key) {
      return entries.has(key) ? entries.get(key) : null;
    },
    setItem(key, value) {
      entries.set(key, String(value));
    },
    removeItem(key) {
      entries.delete(key);
    },
    clear() {
      entries.clear();
    },
  };
  globalThis.window = { localStorage: storage };
  globalThis.localStorage = storage;
  return storage;
}

function removeBrowserGlobals() {
  delete globalThis.window;
  delete globalThis.localStorage;
}

async function expectDataError(action, reason) {
  await assert.rejects(action, (error) => error instanceof DataGatewayError && error.reason === reason);
}

const tests = [];
function test(name, action) {
  tests.push({ name, action });
}

test("mock mode is valid without an API URL", () => {
  removeBrowserGlobals();
  setEnvironment({ NEXT_PUBLIC_DATA_MODE: "mock", NEXT_PUBLIC_ENABLE_DATA_MODE_SWITCH: "false" });
  assert.deepEqual(getDataConfig(), { mode: "mock", apiBaseUrl: undefined, enableModeSwitch: false });
});

test("API mode requires and normalizes its URL", () => {
  removeBrowserGlobals();
  setEnvironment({
    NEXT_PUBLIC_DATA_MODE: "api",
    NEXT_PUBLIC_API_BASE_URL: "https://api.example.test/",
    NEXT_PUBLIC_ENABLE_DATA_MODE_SWITCH: "false",
  });
  assert.deepEqual(getDataConfig(), {
    mode: "api",
    apiBaseUrl: "https://api.example.test",
    enableModeSwitch: false,
  });
});

test("invalid environment mode throws ConfigurationError", () => {
  removeBrowserGlobals();
  setEnvironment({ NEXT_PUBLIC_DATA_MODE: "manager", NEXT_PUBLIC_ENABLE_DATA_MODE_SWITCH: "false" });
  assert.throws(
    () => getDataConfig(),
    (error) => error instanceof ConfigurationError && error.reason === "configuration"
  );
});

test("invalid localStorage mode throws ConfigurationError", () => {
  installStorage({ [DATA_MODE_KEY]: "manager" });
  setEnvironment({ NEXT_PUBLIC_DATA_MODE: "mock", NEXT_PUBLIC_ENABLE_DATA_MODE_SWITCH: "true" });
  assert.throws(
    () => getDataConfig(),
    (error) => error instanceof ConfigurationError && error.reason === "configuration"
  );
});

test("missing localStorage mode does not override environment mode", () => {
  installStorage();
  setEnvironment({
    NEXT_PUBLIC_DATA_MODE: "api",
    NEXT_PUBLIC_API_BASE_URL: "https://api.example.test",
    NEXT_PUBLIC_ENABLE_DATA_MODE_SWITCH: "true",
  });
  assert.equal(getDataConfig().mode, "api");
});

test("API runtime override validates the final mode before URL checks", () => {
  installStorage({ [DATA_MODE_KEY]: "api" });
  setEnvironment({ NEXT_PUBLIC_DATA_MODE: "mock", NEXT_PUBLIC_ENABLE_DATA_MODE_SWITCH: "true" });
  assert.throws(
    () => getDataConfig(),
    (error) => error instanceof ConfigurationError && error.reason === "configuration"
  );
});

test("configuration failure has no config or gateway", () => {
  removeBrowserGlobals();
  setEnvironment({ NEXT_PUBLIC_DATA_MODE: "invalid", NEXT_PUBLIC_ENABLE_DATA_MODE_SWITCH: "false" });
  const state = initializeDataState();
  assert.equal(state.config, null);
  assert.equal(state.gateway, null);
  assert.equal(state.status, "configuration_error");
  assert.equal(state.error.reason, "configuration");
  return expectDataError(() => bootstrapData(state.config, state.gateway), "configuration");
});

test("API adapter keeps unimplemented domain operations unsupported while bootstrap stays session-only", async () => {
  removeBrowserGlobals();
  setEnvironment({
    NEXT_PUBLIC_DATA_MODE: "api",
    NEXT_PUBLIC_API_BASE_URL: "https://api.example.test",
    NEXT_PUBLIC_ENABLE_DATA_MODE_SWITCH: "false",
  });
  const state = initializeDataState();
  assert.equal(state.config.mode, "api");
  await expectDataError(() => state.gateway.getTickets(), "unsupported");
  await expectDataError(() => state.gateway.getDemoUsers(), "unsupported");
  await expectDataError(() => state.gateway.getReviewCases(), "unsupported");
  const bootstrap = await bootstrapData(state.config, state.gateway);
  assert.equal(bootstrap.status, "ready");
  assert.equal(bootstrap.currentUser, null);
  assert.equal(bootstrap.tickets.length, 0);
  assert.equal(bootstrap.chatSessions.length, 0);
  assert.equal(bootstrap.reviewCases.length, 0);
  assert.equal(bootstrap.demoUsers.length, 0);
  assert.ok(new UnsupportedOperationError("probe").reason === "unsupported");
});

test("mock bootstrap becomes ready only after reads and SV001 login", async () => {
  removeBrowserGlobals();
  const gateway = new MockCampusDataGateway({ latencyMs: 0 });
  const result = await bootstrapData({ mode: "mock", enableModeSwitch: false }, gateway);
  assert.equal(result.status, "ready");
  assert.equal(result.currentUser.id, "SV001");
  assert.ok(result.tickets.length > 0);
  assert.ok(result.reviewCases.length > 0);
});

test("network and server reasons map to connection_error", () => {
  assert.equal(statusForError(new DataGatewayError("network", "offline")), "connection_error");
  assert.equal(statusForError(new DataGatewayError("server", "HTTP 503")), "connection_error");
});

test("successful gateway calls clear API errors in every mode", () => {
  assert.deepEqual(dataStateAfterGatewaySuccess(), { dataError: null, dataStatus: "ready" });
});

test("API login and logout leave the remembered mock user untouched", () => {
  const storage = installStorage({ [MOCK_REMEMBERED_USER_KEY]: "SV001" });
  writeMockRememberedUser("api", false, "SV-DEMO-001");
  clearMockRememberedUser("api");
  assert.equal(storage.getItem(MOCK_REMEMBERED_USER_KEY), "SV001");
  assert.notEqual(API_SESSION_STORAGE_KEY, MOCK_REMEMBERED_USER_KEY);
  writeMockRememberedUser("mock", true, "OF001");
  assert.equal(storage.getItem(MOCK_REMEMBERED_USER_KEY), "OF001");
  clearMockRememberedUser("mock");
  assert.equal(storage.getItem(MOCK_REMEMBERED_USER_KEY), null);
});

test("API user mapper accepts only student and officer roles", () => {
  const gateway = new ApiCampusDataGateway("https://api.example.test");
  assert.throws(
    () => gateway.mapToUser({ id: "M001", name: "Manager", role: "manager" }),
    (error) => error instanceof DataGatewayError && error.reason === "validation"
  );
  const student = gateway.mapToUser({ id: "SV001", name: "Student", role: "student" });
  assert.equal(student.role, "student");
});

test("mock mutations are deterministic and update supplement domain state", async () => {
  const storage = installStorage();
  let idCounter = 0;
  const fixedNow = new Date("2026-09-29T10:11:12.000Z");
  const gateway = new MockCampusDataGateway({
    latencyMs: 0,
    now: () => fixedNow,
    generateId: (prefix) => `${prefix}-fixed-${++idCounter}`,
  });

  await gateway.sendSupplementRequest("REV-2026-001", {
    id: "sup-fixed",
    createdAt: "2026-09-29T10:00:00.000Z",
    sentAt: "2026-09-29T10:00:00.000Z",
    sentBy: "OF001",
    targetStudentId: "SV001",
    status: "sent",
    subject: "Bổ sung đề cương",
    messageBody: "Vui lòng nộp bản rõ nét.",
    requestedDocuments: ["Đề cương"],
    findingsInvolved: ["find-A-4"],
  });
  let writes = 0;
  const originalSetItem = storage.setItem;
  storage.setItem = (key, value) => {
    if (key === "campus247_mock_db_v1") writes += 1;
    originalSetItem.call(storage, key, value);
  };

  await gateway.submitStudentSupplement("REV-2026-001", {
    note: "Em gửi bản scan có xác nhận.",
    fileName: "De_cuong_fixed_v2.pdf",
    versionToActivate: 2,
  });
  assert.equal(writes, 1);

  const updated = await gateway.getReviewCase("REV-2026-001");
  assert.equal(updated.status, "in_review");
  assert.equal(updated.aiStatus, "stale_needs_update");
  assert.equal(updated.aiSummary.isStale, true);
  const request = updated.supplementRequests.find((item) => item.id === "sup-fixed");
  assert.equal(request.status, "responded");
  assert.deepEqual(request.studentReply.supplementedDocumentIds, ["DOC-SYLLABUS-OLD"]);
  assert.equal(request.studentReply.submittedAt, fixedNow.toISOString());
  const document = updated.documents.find((item) => item.id === "DOC-SYLLABUS-OLD");
  assert.equal(document.currentVersion, 2);
  assert.equal(document.versions.find((version) => version.version === 2).fileName, "De_cuong_fixed_v2.pdf");
  assert.equal(updated.auditLogs.at(-1).timestamp, fixedNow.toISOString());
});

test("review mutation errors preserve not_found and conflict reasons", async () => {
  removeBrowserGlobals();
  const gateway = new MockCampusDataGateway({ latencyMs: 0 });
  await expectDataError(
    () => gateway.submitStudentSupplement("missing-case", { note: "x", fileName: "x.pdf", versionToActivate: 1 }),
    "not_found"
  );
  await expectDataError(
    () => gateway.submitStudentSupplement("REV-2026-002", { note: "x", fileName: "x.pdf", versionToActivate: 1 }),
    "conflict"
  );
});

try {
  for (const { name, action } of tests) {
    await action();
    console.log(`PASS: ${name}`);
  }
} finally {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  if (originalWindow === undefined) delete globalThis.window;
  else globalThis.window = originalWindow;
  if (originalLocalStorage === undefined) delete globalThis.localStorage;
  else globalThis.localStorage = originalLocalStorage;
}
