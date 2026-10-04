import { DataGatewayError } from "../errors";
import { ApiClient, INTAKE_API_TIMEOUT_MS } from "./api-client";
import { ApiHttpResult, ApiRequestOptions } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function parseRetryAfterMs(retryAfter: string | null, fallback = 2000): number {
  if (!retryAfter) return fallback;
  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(Math.max(seconds * 1000, 250), 30_000);
  const date = Date.parse(retryAfter);
  if (Number.isFinite(date)) return Math.min(Math.max(date - Date.now(), 250), 30_000);
  return fallback;
}

export function isProcessingBody(body: unknown): boolean {
  return isRecord(body) && body.status === "processing" && typeof body.operation_id === "string";
}

export function isJobAcceptedBody(body: unknown): boolean {
  return isRecord(body) && typeof body.job_id === "string" && body.job_id.length > 0;
}

export async function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    if (signal) signal.addEventListener("abort", onAbort, { once: true });
  });
}

export async function requestUntilComplete<T>(
  client: ApiClient,
  path: string,
  options: ApiRequestOptions,
  limits?: { maxAttempts?: number; timeoutMs?: number }
): Promise<ApiHttpResult<T>> {
  const maxAttempts = limits?.maxAttempts ?? 8;
  const requestOptions: ApiRequestOptions = {
    ...options,
    timeoutMs: options.timeoutMs ?? limits?.timeoutMs ?? INTAKE_API_TIMEOUT_MS,
  };
  let last: ApiHttpResult<T> | undefined;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    last = await client.request<T>(path, requestOptions);
    if (last.status !== 202) return last;
    if (isJobAcceptedBody(last.body)) return last;
    if (!isProcessingBody(last.body)) return last;
    await sleep(parseRetryAfterMs(last.retryAfter), options.signal);
  }
  const error = new DataGatewayError(
    "server",
    "Hệ thống vẫn đang xử lý. Hãy thử lại cùng thao tác; không tạo yêu cầu mới.",
    last?.body
  );
  error.status = 202;
  error.retryable = true;
  error.requestId = last?.requestId ?? undefined;
  error.retryAfter = last?.retryAfter ?? null;
  throw error;
}

export async function pollUntil<T>(
  read: () => Promise<T>,
  isDone: (value: T) => boolean,
  options?: { maxAttempts?: number; intervalMs?: number; signal?: AbortSignal; retryAfter?: () => string | null }
): Promise<T> {
  const maxAttempts = options?.maxAttempts ?? 20;
  let last: T | undefined;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    last = await read();
    if (isDone(last)) return last;
    await sleep(parseRetryAfterMs(options?.retryAfter?.() ?? null, options?.intervalMs ?? 2000), options?.signal);
  }
  const error = new DataGatewayError(
    "server",
    "Chưa nhận được brief từ worker. Hồ sơ vẫn đang xử lý; không báo sẵn sàng giả.",
    last
  );
  error.retryable = true;
  throw error;
}
