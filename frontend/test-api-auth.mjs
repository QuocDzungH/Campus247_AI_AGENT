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

const { ApiClient, parseErrorEnvelope, reasonFromStatusAndCode, shouldConfirmPendingOnSuccess } =
  loadTypeScriptModule(path.join(frontendDir, "lib/data/api/api-client.ts"));
const { ApiCampusDataGateway } = loadTypeScriptModule(
  path.join(frontendDir, "lib/data/api/api-gateway.ts")
);
const {
  createMemorySessionStore,
  createBrowserSessionStore,
  resetBrowserSessionStoresForTests,
  API_SESSION_STORAGE_KEY,
} = loadTypeScriptModule(path.join(frontendDir, "lib/data/api/session.ts"));
const {
  createMemoryPendingStore,
  createBrowserPendingStore,
  resetBrowserPendingStoresForTests,
  AMBIGUOUS_PENDING_INTENT_CODE,
} = loadTypeScriptModule(path.join(frontendDir, "lib/data/api/idempotency.ts"));
const { bootstrapData, performGatewayLogin } = loadTypeScriptModule(path.join(frontendDir, "lib/store.tsx"));
const { DataGatewayError } = loadTypeScriptModule(path.join(frontendDir, "lib/data/errors.ts"));
const { resolveApiDemoUserId, isOfficerDemoUserId } = loadTypeScriptModule(
  path.join(frontendDir, "lib/data/api/demo-accounts.ts")
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
    const record = {
      url: String(url),
      method: init.method || "GET",
      headers,
      body: init.body ?? null,
    };
    calls.push(record);
    return handler(record, calls);
  };
  return calls;
}

const futureExpiry = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
const loginResult = {
  access_token: "tok_demo_student",
  token_type: "Bearer",
  expires_at: futureExpiry,
  user: { id: "SV-DEMO-001", role: "student", name: "Sinh viên Demo" },
};

test("login posts user_id and stores Bearer for later requests", async () => {
  const calls = installFetch((request) => {
    if (request.url.endsWith("/api/v1/auth/demo-login")) {
      assert.equal(request.method, "POST");
      assert.equal(request.body, JSON.stringify({ user_id: "SV-DEMO-001" }));
      assert.equal(request.headers.get("Authorization"), null);
      assert.equal(request.headers.get("Idempotency-Key"), null);
      return jsonResponse(200, loginResult, { "X-Request-Id": "req_login" });
    }
    if (request.url.endsWith("/api/v1/me") || request.url.endsWith("/api/v1/me/profile")) {
      assert.equal(request.headers.get("Authorization"), "Bearer tok_demo_student");
      if (request.url.endsWith("/api/v1/me/profile")) {
        return jsonResponse(200, { user_id: "SV-DEMO-001", mssv: "DEMO-001", full_name: "Sinh viên Demo", verification_status: "unverified", is_demo: true }, { "X-Request-Id": "req_profile" });
      }
      return jsonResponse(200, loginResult.user, { "X-Request-Id": "req_me" });
    }
    throw new Error(`Unexpected URL ${request.url}`);
  });

  const sessionStore = createMemorySessionStore();
  const gateway = new ApiCampusDataGateway("https://api.example.test", { sessionStore });
  const user = await gateway.login("SV-DEMO-001", { remember: true });
  assert.equal(user.id, "SV-DEMO-001");
  assert.equal(user.role, "student");
  assert.equal(sessionStore.load().access_token, "tok_demo_student");

  const me = await gateway.restoreSession();
  assert.equal(me.id, "SV-DEMO-001");
  assert.equal(calls.length, 4);
  assert.ok(calls[0].url.endsWith("/api/v1/auth/demo-login"));
  assert.ok(calls[1].url.endsWith("/api/v1/me/profile"));
  assert.ok(calls[2].url.endsWith("/api/v1/me"));
  assert.ok(calls[3].url.endsWith("/api/v1/me/profile"));
});

test("restore uses GET /me with stored token and does not re-login by user id", async () => {
  const calls = installFetch((request) => {
    if (request.url.includes("/api/v1/me")) {
      assert.equal(request.method, "GET");
      assert.equal(request.headers.get("Authorization"), "Bearer tok_restore");
      return jsonResponse(200, { id: "OF-DEMO-01", role: "officer", name: "Cán bộ Demo" });
    }
    if (request.url.includes("/api/v1/officer/tickets")) {
      return jsonResponse(200, { items: [], total: 0, page: 1, page_size: 100 });
    }
    if (request.url.includes("/api/v1/reviews")) {
      return jsonResponse(200, { items: [], total: 0, page: 1, page_size: 100 });
    }
    throw new Error(`Unexpected URL ${request.url}`);
  });

  const sessionStore = createMemorySessionStore({
    access_token: "tok_restore",
    token_type: "Bearer",
    expires_at: futureExpiry,
    user: { id: "OF-DEMO-01", role: "officer", name: "Cán bộ Demo" },
    remember: true,
  });
  const gateway = new ApiCampusDataGateway("https://api.example.test", { sessionStore });
  const bootstrap = await bootstrapData(
    { mode: "api", apiBaseUrl: "https://api.example.test", enableModeSwitch: false },
    gateway
  );
  assert.equal(bootstrap.status, "ready");
  assert.equal(bootstrap.currentUser.id, "OF-DEMO-01");
  assert.equal(bootstrap.currentUser.role, "officer");
  assert.equal(bootstrap.tickets.length, 0);
  assert.equal(calls.length, 3);
  assert.ok(calls[0].url.includes("/api/v1/me"));
  assert.ok(calls[1].url.includes("/api/v1/officer/tickets"));
  assert.ok(calls[2].url.includes("/api/v1/reviews"));
  assert.equal(calls.some((call) => call.url.includes("demo-login")), false);
});

test("expired or unauthorized session restore returns null without throwing", async () => {
  installFetch(() =>
    jsonResponse(401, {
      error: {
        code: "UNAUTHENTICATED",
        message: "Phiên đăng nhập đã hết hạn.",
        request_id: "req_expired",
        retryable: false,
        details: {},
      },
    })
  );
  const sessionStore = createMemorySessionStore({
    access_token: "tok_expired",
    token_type: "Bearer",
    expires_at: futureExpiry,
    user: { id: "SV-DEMO-001", role: "student", name: "Sinh viên Demo" },
    remember: true,
  });
  const gateway = new ApiCampusDataGateway("https://api.example.test", { sessionStore });
  const restored = await gateway.restoreSession();
  assert.equal(restored, null);
  assert.equal(sessionStore.load(), null);
});

test("confirmed mutations get a new Idempotency-Key; retries of unconfirmed intents reuse the pending key", async () => {
  const pendingStore = createMemoryPendingStore();
  let attempt = 0;
  const calls = installFetch((request) => {
    attempt += 1;
    if (request.url.endsWith("/api/v1/conversations") && attempt === 1) {
      throw new TypeError("network down");
    }
    return jsonResponse(201, { id: `conv_${attempt}` });
  });
  const client = new ApiClient("https://api.example.test", { pendingStore });
  client.setAccessToken("tok_demo_student");

  await assert.rejects(() => client.post("/api/v1/conversations", {}));
  await client.post("/api/v1/conversations", {});
  await client.post("/api/v1/conversations", {});
  await client.get("/api/v1/conversations");

  const retryKey = calls[0].headers.get("Idempotency-Key");
  const recoveredKey = calls[1].headers.get("Idempotency-Key");
  const newIntentKey = calls[2].headers.get("Idempotency-Key");
  assert.ok(retryKey);
  assert.equal(retryKey, recoveredKey);
  assert.notEqual(retryKey, newIntentKey);
  assert.equal(calls[0].headers.get("Authorization"), "Bearer tok_demo_student");
  assert.equal(calls[3].headers.get("Idempotency-Key"), null);
  assert.equal(calls[3].method, "GET");
});

test("pending Idempotency-Key survives a new client after reload", async () => {
  const memory = new Map();
  const originalSession = globalThis.sessionStorage;
  globalThis.sessionStorage = {
    getItem(key) {
      return memory.has(key) ? memory.get(key) : null;
    },
    setItem(key, value) {
      memory.set(key, String(value));
    },
    removeItem(key) {
      memory.delete(key);
    },
    clear() {
      memory.clear();
    },
    key() {
      return null;
    },
    length: 0,
  };
  resetBrowserPendingStoresForTests();
  const storageKey = "campus247_api_pending_idempotency_reload";
  try {
    const calls = installFetch(() => {
      throw new TypeError("network down");
    });
    const beforeReload = new ApiClient("https://api.example.test", {
      pendingStore: createBrowserPendingStore(storageKey),
    });
    beforeReload.setAccessToken("tok_demo_student");
    await assert.rejects(() => beforeReload.post("/api/v1/conversations", {}));
    const keyBeforeReload = calls[0].headers.get("Idempotency-Key");

    resetBrowserPendingStoresForTests();
    const afterReload = new ApiClient("https://api.example.test", {
      pendingStore: createBrowserPendingStore(storageKey),
    });
    afterReload.setAccessToken("tok_demo_student");
    globalThis.fetch = async (url, init = {}) => {
      const headers = new Headers(init.headers);
      calls.push({ url: String(url), method: init.method || "GET", headers, body: init.body ?? null });
      return jsonResponse(201, { id: "conv_retry" });
    };
    await afterReload.post("/api/v1/conversations", {});
    assert.equal(calls[1].headers.get("Idempotency-Key"), keyBeforeReload);
  } finally {
    resetBrowserPendingStoresForTests();
    if (originalSession === undefined) delete globalThis.sessionStorage;
    else globalThis.sessionStorage = originalSession;
  }
});

test("ErrorEnvelope nested fields are parsed instead of a top-level message", async () => {
  installFetch(() =>
    jsonResponse(
      422,
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Dữ liệu gửi lên không hợp lệ.",
          request_id: "req_422",
          retryable: false,
          details: { field_errors: [{ field: "user_id", reason: "required" }] },
        },
        message: "ignore-top-level",
      },
      { "X-Request-Id": "req_422", "Retry-After": "2" }
    )
  );
  const client = new ApiClient("https://api.example.test");
  await assert.rejects(
    () => client.post("/api/v1/auth/demo-login", { user_id: "missing" }, { skipAuth: true, skipIdempotency: true }),
    (error) =>
      error instanceof DataGatewayError &&
      error.reason === "validation" &&
      error.message === "Dữ liệu gửi lên không hợp lệ." &&
      error.code === "VALIDATION_ERROR" &&
      error.requestId === "req_422" &&
      error.status === 422 &&
      error.retryAfter === "2"
  );
  assert.equal(reasonFromStatusAndCode(409, "STALE_REVISION"), "conflict");
  assert.equal(parseErrorEnvelope({ message: "top" }), null);
});

test("logout sends empty body and clears the stored token", async () => {
  const calls = installFetch((request) => {
    if (request.url.endsWith("/auth/logout")) {
      assert.equal(request.method, "POST");
      assert.equal(request.body, "{}");
      assert.equal(request.headers.get("Authorization"), "Bearer tok_demo_student");
      assert.equal(request.headers.get("Idempotency-Key"), null);
      return new Response(null, { status: 204, headers: { "X-Request-Id": "req_logout" } });
    }
    throw new Error(`Unexpected URL ${request.url}`);
  });
  const sessionStore = createMemorySessionStore({
    access_token: "tok_demo_student",
    token_type: "Bearer",
    expires_at: futureExpiry,
    user: { id: "SV-DEMO-001", role: "student", name: "Sinh viên Demo" },
    remember: true,
  });
  const gateway = new ApiCampusDataGateway("https://api.example.test", { sessionStore });
  await gateway.endSession();
  assert.equal(sessionStore.load(), null);
  assert.equal(calls.length, 1);
});

test("logout clears the local session before the server responds", async () => {
  let release;
  const hung = new Promise((resolve) => {
    release = resolve;
  });
  installFetch(() => hung.then(() => new Response(null, { status: 204 })));
  const sessionStore = createMemorySessionStore({
    access_token: "tok_demo_student",
    token_type: "Bearer",
    expires_at: futureExpiry,
    user: { id: "SV-DEMO-001", role: "student", name: "Sinh viên Demo" },
    remember: true,
  });
  const gateway = new ApiCampusDataGateway("https://api.example.test", { sessionStore });
  const pending = gateway.endSession();
  assert.equal(sessionStore.load(), null);
  release();
  await pending;
});

test("browser session keeps an in-memory fallback when storage writes fail", () => {
  const failingStorage = {
    getItem() {
      throw new Error("denied");
    },
    setItem() {
      throw new Error("quota");
    },
    removeItem() {
      throw new Error("denied");
    },
    clear() {},
    key() {
      return null;
    },
    length: 0,
  };
  const originalLocal = globalThis.localStorage;
  const originalSession = globalThis.sessionStorage;
  globalThis.localStorage = failingStorage;
  globalThis.sessionStorage = failingStorage;
  resetBrowserSessionStoresForTests();
  try {
    const first = createBrowserSessionStore(`${API_SESSION_STORAGE_KEY}:quota`);
    first.save({
      access_token: "tok_memory",
      token_type: "Bearer",
      expires_at: futureExpiry,
      user: { id: "SV-DEMO-001", role: "student", name: "Sinh viên Demo" },
      remember: true,
    });
    assert.equal(first.load().access_token, "tok_memory");
    const second = createBrowserSessionStore(`${API_SESSION_STORAGE_KEY}:quota`);
    assert.equal(second.load().access_token, "tok_memory");
  } finally {
    resetBrowserSessionStoresForTests();
    if (originalLocal === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = originalLocal;
    if (originalSession === undefined) delete globalThis.sessionStorage;
    else globalThis.sessionStorage = originalSession;
  }
});

test("confirming one intent keeps another pending key that shares the payload", async () => {
  const pendingStore = createMemoryPendingStore();
  let releaseA;
  const holdA = new Promise((resolve) => {
    releaseA = resolve;
  });
  const calls = installFetch((request) => {
    if (request.headers.get("Idempotency-Key") === "intent-a") {
      return holdA.then(() => jsonResponse(201, { id: "conv_a" }));
    }
    throw new TypeError("lost response");
  });
  const client = new ApiClient("https://api.example.test", { pendingStore });
  client.setAccessToken("tok_demo_student");
  const pendingA = client.post("/api/v1/conversations", {}, { idempotencyKey: "intent-a" });
  await assert.rejects(() => client.post("/api/v1/conversations", {}, { idempotencyKey: "intent-b" }));
  releaseA();
  await pendingA;

  globalThis.fetch = async (url, init = {}) => {
    const headers = new Headers(init.headers);
    calls.push({ url: String(url), method: init.method || "GET", headers, body: init.body ?? null });
    return jsonResponse(201, { id: "conv_b" });
  };
  await client.post("/api/v1/conversations", {});
  assert.equal(calls[2].headers.get("Idempotency-Key"), "intent-b");
});

test("unkeyed retry is rejected when two pending intents share the payload", async () => {
  const pendingStore = createMemoryPendingStore();
  const calls = installFetch(() => {
    throw new TypeError("lost response");
  });
  const client = new ApiClient("https://api.example.test", { pendingStore });
  client.setAccessToken("tok_demo_student");

  await assert.rejects(() => client.post("/api/v1/conversations", {}, { idempotencyKey: "intent-a" }));
  await assert.rejects(() => client.post("/api/v1/conversations", {}, { idempotencyKey: "intent-b" }));
  assert.equal(calls.length, 2);
  assert.equal(calls[0].headers.get("Idempotency-Key"), "intent-a");
  assert.equal(calls[1].headers.get("Idempotency-Key"), "intent-b");

  await assert.rejects(
    () => client.post("/api/v1/conversations", {}),
    (error) =>
      error instanceof DataGatewayError &&
      error.reason === "conflict" &&
      error.code === AMBIGUOUS_PENDING_INTENT_CODE &&
      error.retryable === false
  );
  assert.equal(calls.length, 2, "ambiguous retry must not send an HTTP request");

  let keyedAttempts = 0;
  globalThis.fetch = async (url, init = {}) => {
    const headers = new Headers(init.headers);
    calls.push({ url: String(url), method: init.method || "GET", headers, body: init.body ?? null });
    keyedAttempts += 1;
    return jsonResponse(201, { id: `conv_${keyedAttempts}` });
  };

  await client.post("/api/v1/conversations", {}, { idempotencyKey: "intent-a" });
  await client.post("/api/v1/conversations", {}, { idempotencyKey: "intent-b" });
  assert.equal(calls[2].headers.get("Idempotency-Key"), "intent-a");
  assert.equal(calls[3].headers.get("Idempotency-Key"), "intent-b");
  assert.equal(calls.length, 4);
});

test("a superseded login attempt does not call login or overwrite the newer session", async () => {
  const sessionStore = createMemorySessionStore({
    access_token: "tok_pre",
    token_type: "Bearer",
    expires_at: futureExpiry,
    user: { id: "SV-DEMO-001", role: "student", name: "Sinh viên Demo" },
    remember: true,
  });
  const client = new ApiClient("https://api.example.test");
  const gateway = new ApiCampusDataGateway("https://api.example.test", { client, sessionStore });

  let releaseLogout;
  const holdLogout = new Promise((resolve) => {
    releaseLogout = resolve;
  });
  const loginUserIds = [];
  installFetch((request) => {
    if (request.url.endsWith("/auth/logout")) {
      return holdLogout.then(() => new Response(null, { status: 204 }));
    }
    if (request.url.endsWith("/auth/demo-login")) {
      const userId = JSON.parse(request.body).user_id;
      loginUserIds.push(userId);
      if (userId === "OF-DEMO-01") {
        return jsonResponse(200, {
          access_token: "tok_b",
          token_type: "Bearer",
          expires_at: futureExpiry,
          user: { id: "OF-DEMO-01", role: "officer", name: "Cán bộ Demo" },
        });
      }
      return jsonResponse(200, {
        access_token: "tok_a",
        token_type: "Bearer",
        expires_at: futureExpiry,
        user: { id: "SV-DEMO-001", role: "student", name: "Sinh viên Demo" },
      });
    }
    throw new Error(`Unexpected URL ${request.url}`);
  });

  let authGeneration = 0;
  const attemptA = ++authGeneration;
  const pendingA = performGatewayLogin(gateway, "SV-DEMO-001", {
    remember: true,
    mode: "api",
    isCurrent: () => attemptA === authGeneration,
  });
  const attemptB = ++authGeneration;
  const userB = await performGatewayLogin(gateway, "OF-DEMO-01", {
    remember: true,
    mode: "api",
    isCurrent: () => attemptB === authGeneration,
  });
  releaseLogout();
  const userA = await pendingA;

  assert.equal(userA, null);
  assert.equal(userB.id, "OF-DEMO-01");
  assert.deepEqual(loginUserIds, ["OF-DEMO-01"]);
  assert.equal(sessionStore.load().access_token, "tok_b");
  assert.equal(client.getAccessToken(), "tok_b");
});

test("overlapping login HTTP does not persist a superseded token", async () => {
  let releaseA;
  const holdA = new Promise((resolve) => {
    releaseA = resolve;
  });
  const sessionStore = createMemorySessionStore();
  const client = new ApiClient("https://api.example.test");
  const gateway = new ApiCampusDataGateway("https://api.example.test", { client, sessionStore });
  installFetch((request) => {
    const userId = JSON.parse(request.body).user_id;
    if (userId === "SV-DEMO-001") {
      return holdA.then(() =>
        jsonResponse(200, {
          access_token: "tok_a",
          token_type: "Bearer",
          expires_at: futureExpiry,
          user: { id: "SV-DEMO-001", role: "student", name: "Sinh viên Demo" },
        })
      );
    }
    return jsonResponse(200, {
      access_token: "tok_b",
      token_type: "Bearer",
      expires_at: futureExpiry,
      user: { id: "OF-DEMO-01", role: "officer", name: "Cán bộ Demo" },
    });
  });

  const pendingA = gateway.login("SV-DEMO-001", { remember: true });
  const userB = await gateway.login("OF-DEMO-01", { remember: true });
  releaseA();
  const userA = await pendingA;

  assert.equal(userB.id, "OF-DEMO-01");
  assert.equal(userA.id, "SV-DEMO-001");
  assert.equal(sessionStore.load().access_token, "tok_b");
  assert.equal(sessionStore.load().user.id, "OF-DEMO-01");
  assert.equal(client.getAccessToken(), "tok_b");
});

test("401 on a stale tab token does not clear a newer session from another tab", async () => {
  const memory = new Map();
  const storage = {
    getItem(key) {
      return memory.has(key) ? memory.get(key) : null;
    },
    setItem(key, value) {
      memory.set(key, String(value));
    },
    removeItem(key) {
      memory.delete(key);
    },
    clear() {
      memory.clear();
    },
    key() {
      return null;
    },
    length: 0,
  };
  const originalLocal = globalThis.localStorage;
  const originalSession = globalThis.sessionStorage;
  globalThis.localStorage = storage;
  globalThis.sessionStorage = {
    ...storage,
    getItem() {
      return null;
    },
    setItem() {},
    removeItem() {},
  };
  resetBrowserSessionStoresForTests();
  const storeKey = `${API_SESSION_STORAGE_KEY}:cross-tab`;
  try {
    const store = createBrowserSessionStore(storeKey);
    const oldSession = {
      access_token: "tok_old",
      token_type: "Bearer",
      expires_at: futureExpiry,
      user: { id: "SV-DEMO-001", role: "student", name: "Sinh viên Demo" },
      remember: true,
    };
    const newSession = {
      ...oldSession,
      access_token: "tok_new",
      user: { id: "OF-DEMO-01", role: "officer", name: "Cán bộ Demo" },
    };
    store.save(oldSession);
    storage.setItem(storeKey, JSON.stringify(newSession));
    assert.equal(store.load().access_token, "tok_old");

    installFetch((request) => {
      const authorization = request.headers.get("Authorization");
      if (authorization === "Bearer tok_old") {
        return jsonResponse(401, {
          error: {
            code: "UNAUTHENTICATED",
            message: "Phiên đăng nhập đã hết hạn.",
            request_id: "req_stale_tab",
            retryable: false,
            details: {},
          },
        });
      }
      return jsonResponse(200, newSession.user);
    });
    const gateway = new ApiCampusDataGateway("https://api.example.test", { sessionStore: store });
    const restored = await gateway.restoreSession();
    assert.equal(restored, null);
    assert.equal(JSON.parse(storage.getItem(storeKey)).access_token, "tok_new");
  } finally {
    resetBrowserSessionStoresForTests();
    if (originalLocal === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = originalLocal;
    if (originalSession === undefined) delete globalThis.sessionStorage;
    else globalThis.sessionStorage = originalSession;
  }
});

test("stale 401 on restoreSession does not clear a newer token on the same gateway", async () => {
  const pendingStore = createMemoryPendingStore();
  const sessionStore = createMemorySessionStore({
    access_token: "tok_old",
    token_type: "Bearer",
    expires_at: futureExpiry,
    user: { id: "SV-DEMO-001", role: "student", name: "Sinh viên Demo" },
    remember: true,
  });
  const client = new ApiClient("https://api.example.test", { pendingStore });
  const gateway = new ApiCampusDataGateway("https://api.example.test", { client, sessionStore });

  let releaseMe;
  const holdMe = new Promise((resolve) => {
    releaseMe = resolve;
  });
  const calls = installFetch((request) => {
    if (request.url.endsWith("/api/v1/me") && request.headers.get("Authorization") === "Bearer tok_old") {
      return holdMe.then(() =>
        jsonResponse(401, {
          error: {
            code: "UNAUTHENTICATED",
            message: "Phiên đăng nhập đã hết hạn.",
            request_id: "req_stale_restore",
            retryable: false,
          },
        })
      );
    }
    if (request.url.endsWith("/api/v1/auth/demo-login")) {
      return jsonResponse(200, {
        access_token: "tok_new",
        token_type: "Bearer",
        expires_at: futureExpiry,
        user: { id: "OF-DEMO-01", role: "officer", name: "Cán bộ Demo" },
      });
    }
    if (request.url.endsWith("/api/v1/conversations")) {
      throw new TypeError("lost response");
    }
    throw new Error(`Unexpected URL ${request.url}`);
  });

  const restorePending = gateway.restoreSession();
  await gateway.login("OF-DEMO-01", { remember: true });
  await assert.rejects(() => client.post("/api/v1/conversations", {}));
  const pendingKey = calls.find((call) => String(call.url).endsWith("/api/v1/conversations")).headers.get(
    "Idempotency-Key"
  );

  releaseMe();
  const restored = await restorePending;
  assert.equal(restored, null);
  assert.equal(sessionStore.load().access_token, "tok_new");
  assert.equal(client.getAccessToken(), "tok_new");

  globalThis.fetch = async (url, init = {}) => {
    const headers = new Headers(init.headers);
    calls.push({ url: String(url), method: init.method || "GET", headers, body: init.body ?? null });
    return jsonResponse(201, { id: "conv_retry" });
  };
  await client.post("/api/v1/conversations", {});
  assert.equal(calls.at(-1).headers.get("Idempotency-Key"), pendingKey);
});

test("202 JobAccepted confirms the Idempotency-Key; 202 Processing keeps it", async () => {
  assert.equal(
    shouldConfirmPendingOnSuccess(202, {
      job_id: "job_1",
      ticket_id: "tkt_1",
      source_ticket_revision: 1,
      status: "pending",
    }),
    true
  );
  assert.equal(
    shouldConfirmPendingOnSuccess(202, {
      operation_id: "op_1",
      status: "processing",
      poll_after_ms: 2000,
    }),
    false
  );

  const pendingStore = createMemoryPendingStore();
  const calls = installFetch((request) => {
    if (request.url.endsWith("/prepare")) {
      return jsonResponse(202, {
        job_id: "job_1",
        ticket_id: "tkt_1",
        source_ticket_revision: 1,
        status: "pending",
      });
    }
    if (request.url.endsWith("/busy")) {
      return jsonResponse(202, {
        operation_id: "op_1",
        status: "processing",
        poll_after_ms: 2000,
      });
    }
    throw new Error(`Unexpected URL ${request.url}`);
  });
  const client = new ApiClient("https://api.example.test", { pendingStore });
  client.setAccessToken("tok_officer");

  await client.post("/api/v1/officer/tickets/tkt_1/prepare", { expected_revision: 1 });
  const acceptedKey = calls[0].headers.get("Idempotency-Key");
  await client.post("/api/v1/officer/tickets/tkt_1/prepare", { expected_revision: 1 });
  assert.notEqual(calls[1].headers.get("Idempotency-Key"), acceptedKey);

  await client.post("/api/v1/busy", { expected_revision: 1 });
  const processingKey = calls[2].headers.get("Idempotency-Key");
  await client.post("/api/v1/busy", { expected_revision: 1 });
  assert.equal(calls[3].headers.get("Idempotency-Key"), processingKey);
});

test("API demo accounts map seed IDs and keep officer routing", () => {
  assert.equal(resolveApiDemoUserId("SV001"), "SV-DEMO-001");
  assert.equal(resolveApiDemoUserId("sv-demo-001"), "SV-DEMO-001");
  assert.equal(resolveApiDemoUserId("OF-DEMO-03"), "OF-DEMO-03");
  assert.equal(resolveApiDemoUserId("unknown"), null);
  assert.equal(isOfficerDemoUserId("OF-DEMO-01"), true);
  assert.equal(isOfficerDemoUserId("SV-DEMO-001"), false);
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
