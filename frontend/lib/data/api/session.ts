import { ApiSession, WireUser } from "./types";

export const API_SESSION_STORAGE_KEY = "campus247_api_session_v1";

export interface SessionStore {
  load(): ApiSession | null;
  save(session: ApiSession): void;
  clear(): void;
  clearIfCurrent(accessToken: string): void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isWireUser(value: unknown): value is WireUser {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    (value.role === "student" || value.role === "officer" || value.role === "admin")
  );
}

export function parseApiSession(value: unknown): ApiSession | null {
  if (!isRecord(value)) return null;
  if (typeof value.access_token !== "string" || value.access_token.length === 0) return null;
  if (typeof value.expires_at !== "string") return null;
  if (!isWireUser(value.user)) return null;
  return {
    access_token: value.access_token,
    token_type: "Bearer",
    expires_at: value.expires_at,
    user: value.user,
    remember: value.remember === true,
  };
}

export function isSessionExpired(expiresAt: string, now: Date = new Date()): boolean {
  const expiry = Date.parse(expiresAt);
  if (Number.isNaN(expiry)) return true;
  return expiry <= now.getTime();
}

function readJson(storage: Storage | null, key: string): unknown {
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeJson(storage: Storage | null, key: string, value: unknown): void {
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // Session remains in memory on the ApiClient.
  }
}

function safeRemove(storage: Storage | null, key: string): void {
  if (!storage) return;
  try {
    storage.removeItem(key);
  } catch {
    // Ignore storage access errors.
  }
}

function browserStorage(kind: "local" | "session"): Storage | null {
  try {
    if (kind === "local") {
      return typeof localStorage === "undefined" ? null : localStorage;
    }
    return typeof sessionStorage === "undefined" ? null : sessionStorage;
  } catch {
    return null;
  }
}

const browserSessionStores = new Map<string, SessionStore>();

function createSessionStore(
  key: string,
  accessors: { local: () => Storage | null; session: () => Storage | null }
): SessionStore {
  let memory: ApiSession | null = null;

  const removeStorageIfToken = (accessToken: string) => {
    const sessionParsed = parseApiSession(readJson(accessors.session(), key));
    if (sessionParsed?.access_token === accessToken) {
      safeRemove(accessors.session(), key);
    }
    const localParsed = parseApiSession(readJson(accessors.local(), key));
    if (localParsed?.access_token === accessToken) {
      safeRemove(accessors.local(), key);
    }
  };

  return {
    load() {
      if (memory) {
        if (!isSessionExpired(memory.expires_at)) return memory;
        const expiredToken = memory.access_token;
        memory = null;
        removeStorageIfToken(expiredToken);
      }
      const sessionParsed = parseApiSession(readJson(accessors.session(), key));
      const localParsed = parseApiSession(readJson(accessors.local(), key));
      const sessionValid = sessionParsed && !isSessionExpired(sessionParsed.expires_at) ? sessionParsed : null;
      const localValid = localParsed && !isSessionExpired(localParsed.expires_at) ? localParsed : null;
      if (sessionParsed && !sessionValid) safeRemove(accessors.session(), key);
      if (localParsed && !localValid) safeRemove(accessors.local(), key);
      const parsed = sessionValid ?? localValid;
      if (!parsed) return null;
      memory = parsed;
      return parsed;
    },
    save(session) {
      const payload: ApiSession = {
        ...session,
        token_type: "Bearer",
      };
      memory = payload;
      if (session.remember) {
        writeJson(accessors.local(), key, payload);
        safeRemove(accessors.session(), key);
      } else {
        writeJson(accessors.session(), key, payload);
        safeRemove(accessors.local(), key);
      }
    },
    clear() {
      memory = null;
      safeRemove(accessors.local(), key);
      safeRemove(accessors.session(), key);
    },
    clearIfCurrent(accessToken) {
      if (memory?.access_token === accessToken) memory = null;
      removeStorageIfToken(accessToken);
    },
  };
}

export function createBrowserSessionStore(
  key: string = API_SESSION_STORAGE_KEY
): SessionStore {
  const existing = browserSessionStores.get(key);
  if (existing) return existing;
  const store = createSessionStore(key, {
    local: () => browserStorage("local"),
    session: () => browserStorage("session"),
  });
  browserSessionStores.set(key, store);
  return store;
}

export function resetBrowserSessionStoresForTests(): void {
  browserSessionStores.clear();
}

export function createMemorySessionStore(initial?: ApiSession | null): SessionStore {
  let current: ApiSession | null = initial ?? null;
  return {
    load() {
      if (!current) return null;
      if (isSessionExpired(current.expires_at)) {
        current = null;
        return null;
      }
      return current;
    },
    save(session) {
      current = session;
    },
    clear() {
      current = null;
    },
    clearIfCurrent(accessToken) {
      if (current?.access_token === accessToken) current = null;
    },
  };
}
