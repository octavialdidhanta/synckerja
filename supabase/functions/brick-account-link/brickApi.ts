/// Brick API helpers — keep in sync with brick-bank-sync/brickApi.ts and _shared/brickApi.ts
export type BrickEnv = {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  useMock: boolean;
};

export type AccountValidationResult = {
  accountNo: string;
  accountName: string;
  bankShortCode: string;
  activityId: string;
};

const BANK_SHORT_CODE_MAP: Record<string, string> = {
  mandiri: "MANDIRI",
  bca: "BCA",
  bri: "BRI",
  bni: "BNI",
  cimb: "CIMB",
  permata: "PERMATA",
  danamon: "DANAMON",
};

export function readBrickEnv(): BrickEnv | null {
  const clientId = Deno.env.get("BRICK_CLIENT_ID")?.trim() ?? "";
  const clientSecret = Deno.env.get("BRICK_CLIENT_SECRET")?.trim() ?? "";
  const useMock = Deno.env.get("BRICK_USE_MOCK") === "true";
  if (!clientId || !clientSecret) {
    if (useMock) {
      return {
        baseUrl: brickBaseUrl(),
        clientId: "mock",
        clientSecret: "mock",
        useMock: true,
      };
    }
    return null;
  }
  return {
    baseUrl: brickBaseUrl(),
    clientId,
    clientSecret,
    useMock: false,
  };
}

export function brickBaseUrl(): string {
  const explicit = Deno.env.get("BRICK_API_BASE_URL")?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const sandbox = Deno.env.get("BRICK_SANDBOX") !== "false";
  return sandbox ? "https://sandbox.onebrick.io/v2" : "https://api.onebrick.io/v2";
}

export function resolveBankShortCode(bankName: string | null | undefined): string | null {
  if (!bankName) return null;
  const key = bankName.trim().toLowerCase();
  for (const [needle, code] of Object.entries(BANK_SHORT_CODE_MAP)) {
    if (key.includes(needle)) return code;
  }
  const upper = bankName.trim().toUpperCase();
  if (upper.length <= 12) return upper;
  return null;
}

export function brickCorsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
  };
}

export function brickJson(body: object, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...brickCorsHeaders(), "Content-Type": "application/json" },
  });
}

async function brickRequest(
  env: BrickEnv,
  path: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    query?: Record<string, string>;
    body?: unknown;
  } = {},
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const url = new URL(`${env.baseUrl}${path.startsWith("/") ? path : `/${path}`}`);
  if (options.query) {
    for (const [k, v] of Object.entries(options.query)) {
      if (v) url.searchParams.set(k, v);
    }
  }

  const headers: Record<string, string> = {
    accept: "application/json",
    ...(options.headers ?? {}),
  };
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(url.toString(), {
    method: options.method ?? "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { ok: res.ok, status: res.status, data };
}

async function getBrickPublicAccessToken(env: BrickEnv): Promise<string> {
  if (env.useMock) return "mock-public-access-token";

  const basic = btoa(`${env.clientId}:${env.clientSecret}`);
  const { ok, data } = await brickRequest(env, "/payments/auth/token", {
    method: "POST",
    headers: { Authorization: `Basic ${basic}` },
    body: {},
  });

  const token =
    (data as { data?: { accessToken?: string; publicAccessToken?: string } })?.data?.accessToken ??
    (data as { data?: { publicAccessToken?: string } })?.data?.publicAccessToken ??
    (data as { publicAccessToken?: string })?.publicAccessToken ??
    (data as { accessToken?: string })?.accessToken;

  if (!ok || !token) {
    const msg = (data as { message?: string })?.message ?? "Failed to obtain Brick access token";
    throw new Error(msg);
  }
  return String(token);
}

export async function validateBrickBankAccount(
  env: BrickEnv,
  accountNumber: string,
  bankShortCode: string,
): Promise<AccountValidationResult> {
  if (env.useMock) {
    return {
      accountNo: accountNumber,
      accountName: "Mock Account Holder",
      bankShortCode,
      activityId: `mock-${accountNumber}-${bankShortCode}`,
    };
  }

  const token = await getBrickPublicAccessToken(env);
  const { ok, data } = await brickRequest(env, "/payments/gs/account-validation", {
    query: { accountNumber, bankShortCode },
    headers: { publicAccessToken: token },
  });

  const payload = (data as { data?: Record<string, unknown> })?.data ?? data;
  if (!ok || !payload) {
    const msg = (data as { message?: string })?.message ?? "Account validation failed";
    throw new Error(msg);
  }

  return {
    accountNo: String(payload.accountNo ?? payload.accountNumber ?? accountNumber),
    accountName: String(payload.accountName ?? payload.accountHolderName ?? ""),
    bankShortCode: String(payload.bankShortCode ?? bankShortCode),
    activityId: String(payload.activityId ?? payload.referenceId ?? `${bankShortCode}-${accountNumber}`),
  };
}
