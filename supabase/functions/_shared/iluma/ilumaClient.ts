import type { IlumaEnvConfig } from "./ilumaEnv.ts";

const ILUMA_API_BASE = "https://api.iluma.ai";

export type IlumaBankValidationResult = {
  id: string;
  status: "PENDING" | "SUCCESS" | "FAILED";
  bank_code: string;
  bank_account_number: string;
  name_matching_result?: "MATCH" | "UNCLEAR" | "NOT_MATCH" | null;
  is_normal_account?: boolean | null;
  failure_reason?: string | null;
  result?: Record<string, unknown> | null;
  raw: Record<string, unknown>;
};

export async function ilumaRequest<T>(
  env: IlumaEnvConfig,
  options: {
    method: "GET" | "POST";
    path: string;
    body?: Record<string, unknown>;
  },
): Promise<T> {
  const url = `${ILUMA_API_BASE}${options.path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const init: RequestInit = {
    method: options.method,
    headers,
  };
  if (options.body) {
    init.body = JSON.stringify(options.body);
  }

  const res = await fetch(url, {
    ...init,
    headers: {
      ...headers,
      Authorization: `Basic ${btoa(`${env.apiKey}:`)}`,
    },
  });

  const text = await res.text();
  let data: T;
  try {
    data = text ? (JSON.parse(text) as T) : ({} as T);
  } catch {
    throw new Error(`Iluma API invalid JSON (${res.status}): ${text.slice(0, 200)}`);
  }

  if (!res.ok) {
    const err = data as Record<string, unknown>;
    const msg = String(err.message ?? err.error ?? err.failure_reason ?? text).slice(0, 300);
    throw new Error(`Iluma API ${res.status}: ${msg}`);
  }

  return data;
}
