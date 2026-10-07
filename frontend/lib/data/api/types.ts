export interface WireUser {
  id: string;
  role: "student" | "officer" | "admin";
  name: string;
}

export interface LoginResult {
  access_token: string;
  token_type: "Bearer";
  expires_at: string;
  user: WireUser;
}

export interface ErrorDetails {
  conversation_id?: string | null;
  user_message_id?: string | null;
  ticket_id?: string | null;
  current_revision?: number | null;
  current_version?: number | null;
  ai_response_locked?: boolean | null;
  handover_status?: string | null;
  field_errors?: Array<{ field: string; reason: string }>;
}

export interface ErrorBody {
  code?: string;
  message?: string;
  request_id?: string;
  retryable?: boolean;
  details?: ErrorDetails;
}

export interface ErrorEnvelope {
  error: ErrorBody;
}

export interface ApiSession {
  access_token: string;
  token_type: "Bearer";
  expires_at: string;
  user: WireUser;
  remember: boolean;
}

export interface ApiHttpResult<T = unknown> {
  status: number;
  ok: boolean;
  headers: Headers;
  body: T | null;
  retryAfter: string | null;
  requestId: string | null;
}

export interface ApiRequestOptions {
  method?: string;
  body?: unknown;
  headers?: HeadersInit;
  timeoutMs?: number;
  // Per-intent key. Required to retry when several pending mutations share method+path+body.
  idempotencyKey?: string;
  skipIdempotency?: boolean;
  skipAuth?: boolean;
  signal?: AbortSignal;
}
