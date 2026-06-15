import { xenditApiBase } from "./xenditEnv.ts";
import { formatXenditApiError } from "./xenditErrors.ts";
import { xenditBasicAuthHeader } from "./xenditKeyUtils.ts";

export type XenditRequestOptions = {
  method?: "GET" | "POST" | "PATCH";
  path: string;
  body?: Record<string, unknown>;
  forUserId?: string | null;
  withSplitRule?: string | null;
  idempotencyKey?: string;
};

export async function xenditRequest<T>(
  secretKey: string,
  options: XenditRequestOptions,
): Promise<T> {
  const method = options.method ?? "GET";
  const url = `${xenditApiBase()}${options.path.startsWith("/") ? options.path : `/${options.path}`}`;
  const headers: Record<string, string> = {
    Authorization: xenditBasicAuthHeader(secretKey),
    "Content-Type": "application/json",
  };
  if (options.forUserId?.trim()) {
    headers["for-user-id"] = options.forUserId.trim();
  }
  if (options.withSplitRule?.trim()) {
    headers["with-split-rule"] = options.withSplitRule.trim();
  }
  if (options.idempotencyKey?.trim()) {
    headers["Idempotency-key"] = options.idempotencyKey.trim();
  }

  const res = await fetch(url, {
    method,
    headers,
    ...(method !== "GET" && options.body ? { body: JSON.stringify(options.body) } : {}),
  });

  const text = await res.text();
  let json: unknown = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { message: text };
  }

  if (!res.ok) {
    throw new Error(formatXenditApiError(res.status, json));
  }
  return json as T;
}

/** Non-throwing request for credential / xenPlatform diagnostics. */
export async function xenditRequestProbe(
  secretKey: string,
  options: XenditRequestOptions,
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const method = options.method ?? "GET";
  const url = `${xenditApiBase()}${options.path.startsWith("/") ? options.path : `/${options.path}`}`;
  const headers: Record<string, string> = {
    Authorization: xenditBasicAuthHeader(secretKey),
    "Content-Type": "application/json",
  };
  const res = await fetch(url, {
    method,
    headers,
    ...(method !== "GET" && options.body ? { body: JSON.stringify(options.body) } : {}),
  });
  const text = await res.text();
  let body: unknown = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { message: text };
  }
  return { ok: res.ok, status: res.status, body };
}
