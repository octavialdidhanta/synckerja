/// Brick Open Finance / payment API helpers for edge functions.

export type BrickEnv = {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  useMock: boolean;
};

export type BrickLedgerTransaction = {
  externalId: string;
  transactionDate: string;
  amount: number;
  direction: "credit" | "debit";
  description: string | null;
  reference: string | null;
  counterpartyName: string | null;
  accountNumber: string | null;
  bankName: string | null;
  status: string | null;
  raw: Record<string, unknown>;
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

export async function getBrickPublicAccessToken(env: BrickEnv): Promise<string> {
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

export type AccountValidationResult = {
  accountNo: string;
  accountName: string;
  bankShortCode: string;
  activityId: string;
};

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
    query: {
      accountNumber,
      bankShortCode,
    },
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

function normalizeLedgerDirection(
  raw: Record<string, unknown>,
  amount: number,
): "credit" | "debit" {
  const type = String(raw.transactionType ?? raw.type ?? raw.category ?? "").toLowerCase();
  if (type.includes("received") || type.includes("topup") || type.includes("credit")) return "credit";
  if (type.includes("sent") || type.includes("disburse") || type.includes("debit")) return "debit";
  return amount >= 0 ? "credit" : "debit";
}

function mapLedgerRow(raw: Record<string, unknown>, index: number): BrickLedgerTransaction {
  const amountRaw = Number(raw.amount ?? raw.transactionAmount ?? 0);
  const amount = Math.abs(amountRaw);
  const direction = normalizeLedgerDirection(raw, amountRaw);
  const externalId = String(
    raw.id ?? raw.refId ?? raw.referenceId ?? raw.refNumber ?? `brick-${index}-${raw.date ?? Date.now()}`,
  );
  const dateStr = String(raw.date ?? raw.createdAt ?? raw.transactionDate ?? new Date().toISOString());

  return {
    externalId,
    transactionDate: dateStr,
    amount,
    direction,
    description: raw.description ? String(raw.description) : null,
    reference: raw.refId ? String(raw.refId) : raw.refNumber ? String(raw.refNumber) : null,
    counterpartyName: raw.accountHolderName
      ? String(raw.accountHolderName)
      : raw.accountDisplayName
        ? String(raw.accountDisplayName)
        : null,
    accountNumber: raw.accountNumber ? String(raw.accountNumber) : raw.accountNo ? String(raw.accountNo) : null,
    bankName: raw.bankName ? String(raw.bankName) : raw.bank ? String(raw.bank) : null,
    status: raw.status ? String(raw.status) : null,
    raw,
  };
}

export async function fetchBrickLedgerTransactions(
  env: BrickEnv,
  startDate: string,
  endDate: string,
): Promise<BrickLedgerTransaction[]> {
  if (env.useMock) {
    return buildMockTransactions(startDate, endDate);
  }

  const token = await getBrickPublicAccessToken(env);
  const all: BrickLedgerTransaction[] = [];
  let page = 1;
  const size = 500;

  for (;;) {
    const { ok, data } = await brickRequest(env, "/payments/gs/ledger", {
      query: {
        startDate,
        endDate,
        status: "completed",
        page: String(page),
        size: String(size),
      },
      headers: { publicAccessToken: token },
    });

    if (!ok) {
      const msg = (data as { message?: string })?.message ?? "Ledger fetch failed";
      throw new Error(msg);
    }

    const rows =
      (data as { data?: Record<string, unknown>[] })?.data ??
      (data as { data?: { data?: Record<string, unknown>[] } })?.data?.data ??
      (Array.isArray(data) ? data : []);

    const list = Array.isArray(rows) ? rows : [];
    for (let i = 0; i < list.length; i++) {
      all.push(mapLedgerRow(list[i] as Record<string, unknown>, all.length + i));
    }

    if (list.length < size) break;
    page += 1;
    if (page > 20) break;
  }

  return all;
}

function buildMockTransactions(startDate: string, endDate: string): BrickLedgerTransaction[] {
  const now = new Date();
  const creditAmount = 500000;
  return [
    {
      externalId: `mock-credit-${startDate}-${endDate}`,
      transactionDate: now.toISOString(),
      amount: creditAmount,
      direction: "credit",
      description: "Mock incoming transfer (Brick sandbox)",
      reference: "MOCK-REF-001",
      counterpartyName: "Mock Client",
      accountNumber: null,
      bankName: "MANDIRI",
      status: "completed",
      raw: { mock: true },
    },
    {
      externalId: `mock-debit-${startDate}`,
      transactionDate: now.toISOString(),
      amount: 50000,
      direction: "debit",
      description: "Mock outgoing fee",
      reference: "MOCK-REF-002",
      counterpartyName: null,
      accountNumber: null,
      bankName: "MANDIRI",
      status: "completed",
      raw: { mock: true },
    },
  ];
}

export function filterTransactionsForAccount(
  transactions: BrickLedgerTransaction[],
  accountNumber: string | null,
  bankName: string | null,
): BrickLedgerTransaction[] {
  if (!accountNumber) return transactions;
  const normalizedAccount = accountNumber.replace(/\D/g, "");
  const bankCode = resolveBankShortCode(bankName);

  return transactions.filter((tx) => {
    if (!tx.accountNumber) {
      // Ledger rows without account — include credits for linked account sync
      return tx.direction === "credit";
    }
    const txAccount = tx.accountNumber.replace(/\D/g, "");
    const accountMatch =
      txAccount === normalizedAccount ||
      txAccount.endsWith(normalizedAccount) ||
      normalizedAccount.endsWith(txAccount);
    if (!accountMatch) return false;
    if (bankCode && tx.bankName) {
      const txBank = resolveBankShortCode(tx.bankName);
      if (txBank && txBank !== bankCode) return false;
    }
    return true;
  });
}

export function formatYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}
