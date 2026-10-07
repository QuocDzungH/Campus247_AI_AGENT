import { DataGatewayError } from "../errors";

export const API_PENDING_IDEMPOTENCY_KEY = "campus247_api_pending_idempotency_v1";
export const AMBIGUOUS_PENDING_INTENT_CODE = "AMBIGUOUS_PENDING_INTENT";

export interface PendingIntent {
  method: string;
  path: string;
  body: string;
}

export interface PendingIdempotencyStore {
  // Reuses the only matching pending key. Throws if several match and no explicit key is given.
  peekOrCreate(method: string, path: string, body: string, explicit?: string): string;
  confirm(key: string): void;
  clear(): void;
}

export function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `idem-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function ambiguousPendingIntentError(matchCount: number): DataGatewayError {
  const error = new DataGatewayError(
    "conflict",
    "Ambiguous pending intent: retry must pass the original Idempotency-Key.",
    { matchCount }
  );
  error.code = AMBIGUOUS_PENDING_INTENT_CODE;
  error.retryable = false;
  return error;
}

function isPendingIntent(value: unknown): value is PendingIntent {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as PendingIntent).method === "string" &&
    typeof (value as PendingIntent).path === "string" &&
    typeof (value as PendingIntent).body === "string"
  );
}

function readPersisted(storage: Storage | null, key: string): Record<string, PendingIntent> {
  if (!storage) return {};
  try {
    const raw = storage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
    const result: Record<string, PendingIntent> = {};
    for (const [intentKey, value] of Object.entries(parsed)) {
      if (intentKey.length > 0 && isPendingIntent(value)) result[intentKey] = value;
    }
    return result;
  } catch {
    return {};
  }
}

function writePersisted(
  storage: Storage | null,
  key: string,
  value: Record<string, PendingIntent>
): void {
  if (!storage) return;
  try {
    if (Object.keys(value).length === 0) storage.removeItem(key);
    else storage.setItem(key, JSON.stringify(value));
  } catch {
    // Pending keys remain in memory for this tab.
  }
}

function browserSessionStorage(): Storage | null {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage;
  } catch {
    return null;
  }
}

function sameIntent(left: PendingIntent, method: string, path: string, body: string): boolean {
  return left.method === method && left.path === path && left.body === body;
}

function createStore(storage: Storage | null, storageKey: string): PendingIdempotencyStore {
  const memory = new Map<string, PendingIntent>(Object.entries(readPersisted(storage, storageKey)));

  const persist = () => {
    writePersisted(storage, storageKey, Object.fromEntries(memory));
  };

  return {
    peekOrCreate(method, path, body, explicit) {
      const intent: PendingIntent = { method, path, body };
      if (explicit) {
        memory.set(explicit, intent);
        persist();
        return explicit;
      }
      const matches = [...memory.entries()].filter(([, pending]) =>
        sameIntent(pending, method, path, body)
      );
      if (matches.length > 1) throw ambiguousPendingIntentError(matches.length);
      if (matches.length === 1) return matches[0][0];
      const key = newIdempotencyKey();
      memory.set(key, intent);
      persist();
      return key;
    },
    confirm(key) {
      if (!memory.has(key)) return;
      memory.delete(key);
      persist();
    },
    clear() {
      memory.clear();
      persist();
    },
  };
}

const browserStores = new Map<string, PendingIdempotencyStore>();

export function createBrowserPendingStore(
  storageKey: string = API_PENDING_IDEMPOTENCY_KEY
): PendingIdempotencyStore {
  const existing = browserStores.get(storageKey);
  if (existing) return existing;
  const store = createStore(browserSessionStorage(), storageKey);
  browserStores.set(storageKey, store);
  return store;
}

export function createMemoryPendingStore(
  initial?: Record<string, PendingIntent>
): PendingIdempotencyStore {
  let raw = initial && Object.keys(initial).length > 0 ? JSON.stringify(initial) : null;
  return createStore(
    {
      getItem() {
        return raw;
      },
      setItem(_key: string, value: string) {
        raw = value;
      },
      removeItem() {
        raw = null;
      },
      clear() {
        raw = null;
      },
      key() {
        return null;
      },
      length: 0,
    } as Storage,
    API_PENDING_IDEMPOTENCY_KEY
  );
}

export function resetBrowserPendingStoresForTests(): void {
  browserStores.clear();
}
