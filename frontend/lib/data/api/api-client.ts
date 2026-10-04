import { DataGatewayError, ErrorReason } from "../errors";
import { createBrowserPendingStore, PendingIdempotencyStore } from "./idempotency";
import { ApiHttpResult, ApiRequestOptions, ErrorBody } from "./types";

export const DEFAULT_API_TIMEOUT_MS = 10_000;
export const INTAKE_API_TIMEOUT_MS = 25_000;

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function parseErrorEnvelope(body: unknown): ErrorBody | null {
  if (!isRecord(body) || !isRecord(body.error)) return null;
  const error = body.error;
  return {
    code: typeof error.code === "string" ? error.code : undefined,
    message: typeof error.message === "string" ? error.message : undefined,
    request_id: typeof error.request_id === "string" ? error.request_id : undefined,
    retryable: typeof error.retryable === "boolean" ? error.retryable : undefined,
    details: isRecord(error.details) ? (error.details as ErrorBody["details"]) : undefined,
  };
}

function fallbackMessage(body: unknown, status: number): string {
  if (isRecord(body) && typeof body.message === "string") return body.message;
  return `HTTP ${status}`;
}

export function reasonFromStatusAndCode(status: number, code?: string): ErrorReason {
  switch (code) {
    case "UNAUTHENTICATED":
      return "unauthorized";
    case "FORBIDDEN":
      return "forbidden";
    case "RESOURCE_NOT_FOUND":
      return "not_found";
    case "VALIDATION_ERROR":
    case "CONFIRMATION_REQUIRED":
      return "validation";
    case "STALE_REVISION":
    case "STALE_PREVIEW":
    case "STALE_BRIEF":
    case "PREVIEW_EXPIRED":
    case "PREVIEW_ALREADY_SUBMITTED":
    case "CONVERSATION_LOCKED":
    case "CONVERSATION_BUSY":
    case "TICKET_CLOSED":
    case "INVALID_STATUS_TRANSITION":
    case "IDEMPOTENCY_CONFLICT":
    case "GATE_FAILED":
    case "TEMPLATE_UNAVAILABLE":
      return "conflict";
    case "AI_UNAVAILABLE":
    case "AI_OUTPUT_INVALID":
    case "HANDOVER_FAILED":
    case "PERSISTENCE_UNAVAILABLE":
    case "RATE_LIMITED":
      return "server";
    default:
      break;
  }

  switch (status) {
    case 401:
      return "unauthorized";
    case 403:
      return "forbidden";
    case 404:
      return "not_found";
    case 409:
      return "conflict";
    case 422:
      return "validation";
    case 500:
    case 502:
    case 503:
    case 504:
    case 429:
      return "server";
    default:
      return "unknown";
  }
}

function isFormDataBody(body: unknown): body is FormData {
  return typeof FormData !== "undefined" && body instanceof FormData;
}

function serializeBody(body: unknown): string | FormData | undefined {
  if (body === undefined) return undefined;
  if (isFormDataBody(body)) return body;
  return JSON.stringify(body);
}

function headerMap(headers?: HeadersInit): Record<string, string> {
  const result: Record<string, string> = {};
  if (!headers) return result;
  if (headers instanceof Headers) {
    headers.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }
  if (Array.isArray(headers)) {
    for (const [key, value] of headers) result[key] = value;
    return result;
  }
  return { ...headers };
}

function keepPendingAfterError(error: DataGatewayError): boolean {
  if (error.reason === "network") return true;
  if (error.retryable) return true;
  if (typeof error.status === "number" && error.status >= 500) return true;
  if (error.status === 429) return true;
  return false;
}

export function shouldConfirmPendingOnSuccess(status: number, body: unknown): boolean {
  if (status !== 202) return true;
  // JobAccepted (job_id) is complete for idempotency. Processing (operation_id) must be retried with the same key.
  return isRecord(body) && typeof body.job_id === "string" && body.job_id.length > 0;
}

export class ApiClient {
  private baseUrl: string;
  private accessToken: string | null = null;
  private defaultTimeoutMs: number;
  private pendingStore: PendingIdempotencyStore;
  private inFlight = new Set<AbortController>();

  constructor(
    baseUrl: string,
    options?: { defaultTimeoutMs?: number; pendingStore?: PendingIdempotencyStore }
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.defaultTimeoutMs = options?.defaultTimeoutMs ?? DEFAULT_API_TIMEOUT_MS;
    this.pendingStore = options?.pendingStore ?? createBrowserPendingStore();
  }

  setAccessToken(token: string | null): void {
    if (this.accessToken === token) return;
    const previous = this.accessToken;
    this.accessToken = token;
    // Logout (→ null) or account switch (token A → token B) drop the previous session's keys.
    // Restore onto an empty client (null → token) must keep persisted pending keys.
    if (token === null || previous !== null) {
      this.pendingStore.clear();
    }
  }

  clearAccessTokenIfCurrent(expectedToken: string): boolean {
    if (this.accessToken !== expectedToken) return false;
    this.setAccessToken(null);
    return true;
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  abortInFlight(): void {
    for (const controller of this.inFlight) {
      controller.abort("account-switch");
    }
    this.inFlight.clear();
  }

  clearIdempotencyKeys(): void {
    this.pendingStore.clear();
  }

  async request<T = unknown>(path: string, options: ApiRequestOptions = {}): Promise<ApiHttpResult<T>> {
    const method = (options.method ?? "GET").toUpperCase();
    const url = `${this.baseUrl}${path}`;
    const serializedBody = serializeBody(options.body);
    const headers = headerMap(options.headers);
    if (
      !isFormDataBody(options.body) &&
      !Object.keys(headers).some((key) => key.toLowerCase() === "content-type")
    ) {
      headers["Content-Type"] = "application/json";
    }

    if (!options.skipAuth && this.accessToken && !Object.keys(headers).some((key) => key.toLowerCase() === "authorization")) {
      headers.Authorization = `Bearer ${this.accessToken}`;
    }

    const isMutation = MUTATION_METHODS.has(method);
    const sendIdempotency =
      isMutation &&
      !options.skipIdempotency &&
      !Object.keys(headers).some((key) => key.toLowerCase() === "idempotency-key");
    const pendingBody =
      typeof serializedBody === "string"
        ? serializedBody
        : isFormDataBody(options.body)
          ? `[form:${options.body.get("field") || "file"}]`
          : "";
    const usedIdempotencyKey = sendIdempotency
      ? this.pendingStore.peekOrCreate(method, path, pendingBody, options.idempotencyKey)
      : undefined;
    if (usedIdempotencyKey) {
      headers["Idempotency-Key"] = usedIdempotencyKey;
    }

    const controller = new AbortController();
    this.inFlight.add(controller);
    const timeoutMs = options.timeoutMs ?? this.defaultTimeoutMs;
    let timedOut = false;
    const timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort("timeout");
    }, timeoutMs);

    const externalSignal = options.signal;
    const onExternalAbort = () => controller.abort(externalSignal?.reason ?? "aborted");
    if (externalSignal) {
      if (externalSignal.aborted) onExternalAbort();
      else externalSignal.addEventListener("abort", onExternalAbort, { once: true });
    }

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: serializedBody,
        signal: controller.signal,
      });

      const retryAfter = response.headers.get("Retry-After");
      const requestId = response.headers.get("X-Request-Id");
      let body: T | null = null;
      if (response.status !== 204) {
        const raw = await response.text();
        if (raw) {
          try {
            body = JSON.parse(raw) as T;
          } catch {
            throw new DataGatewayError("server", `Invalid JSON from API (HTTP ${response.status})`, raw);
          }
        }
      }

      if (!response.ok) {
        const envelope = parseErrorEnvelope(body);
        const message = envelope?.message ?? fallbackMessage(body, response.status);
        const reason = reasonFromStatusAndCode(response.status, envelope?.code);
        const error = new DataGatewayError(reason, message, envelope ?? body);
        error.code = envelope?.code;
        error.requestId = envelope?.request_id ?? requestId ?? undefined;
        error.retryable = envelope?.retryable;
        error.status = response.status;
        error.retryAfter = retryAfter;
        if (usedIdempotencyKey && !keepPendingAfterError(error)) {
          this.pendingStore.confirm(usedIdempotencyKey);
        }
        throw error;
      }

      if (usedIdempotencyKey && shouldConfirmPendingOnSuccess(response.status, body)) {
        this.pendingStore.confirm(usedIdempotencyKey);
      }

      return {
        status: response.status,
        ok: true,
        headers: response.headers,
        body,
        retryAfter,
        requestId,
      };
    } catch (error: unknown) {
      if (error instanceof DataGatewayError) throw error;
      const aborted = error instanceof Error && error.name === "AbortError";
      if (aborted) {
        const message = timedOut
          ? "Request timeout"
          : "Request aborted; the server may still have committed the operation.";
        const gatewayError = new DataGatewayError("network", message, error);
        gatewayError.retryable = true;
        throw gatewayError;
      }
      throw new DataGatewayError(
        "network",
        "Network error: " + (error instanceof Error ? error.message : String(error)),
        error
      );
    } finally {
      clearTimeout(timeoutId);
      this.inFlight.delete(controller);
      if (externalSignal) externalSignal.removeEventListener("abort", onExternalAbort);
    }
  }

  async get<T = unknown>(path: string, options: Omit<ApiRequestOptions, "method" | "body"> = {}): Promise<T | null> {
    const result = await this.request<T>(path, { ...options, method: "GET" });
    return result.body;
  }

  async post<T = unknown, B = unknown>(
    path: string,
    body?: B,
    options: Omit<ApiRequestOptions, "method" | "body"> = {}
  ): Promise<T | null> {
    const result = await this.request<T>(path, { ...options, method: "POST", body });
    return result.body;
  }

  async patch<T = unknown, B = unknown>(
    path: string,
    body?: B,
    options: Omit<ApiRequestOptions, "method" | "body"> = {}
  ): Promise<T | null> {
    const result = await this.request<T>(path, { ...options, method: "PATCH", body });
    return result.body;
  }

  async requestBinary(path: string): Promise<{ blob: Blob; filename: string; contentType: string }> {
    const headers: Record<string, string> = {};
    if (this.accessToken) headers.Authorization = `Bearer ${this.accessToken}`;
    const response = await fetch(`${this.baseUrl}${path}`, { headers });
    if (!response.ok) {
      let body: unknown = null;
      try {
        body = JSON.parse(await response.text());
      } catch {
        body = null;
      }
      const envelope = parseErrorEnvelope(body);
      const message = envelope?.message ?? fallbackMessage(body, response.status);
      const error = new DataGatewayError(reasonFromStatusAndCode(response.status, envelope?.code), message, envelope ?? body);
      error.code = envelope?.code;
      error.status = response.status;
      throw error;
    }
    const disposition = response.headers.get("content-disposition") || "";
    const match = /filename\*=UTF-8''([^;]+)|filename="?([^"]+)"?/i.exec(disposition);
    const encoded = match?.[1] ? decodeURIComponent(match[1]) : undefined;
    const filename = encoded || match?.[2] || "document.pdf";
    return {
      blob: await response.blob(),
      filename,
      contentType: response.headers.get("content-type") || "application/pdf",
    };
  }
}
