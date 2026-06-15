/// Canonical Brick API client for edge functions.

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

export type BrickCloseVaResult = {
  id: string;
  accountNo: string;
  bankShortCode: string;
  amount: number;
  status: string;
  referenceId: string;
  expiredAt: string | null;
  raw: Record<string, unknown>;
};

export type BrickCloseVaStatus = {
  id: string;
  status: string;
  amount: number;
  accountNo: string | null;
  bankShortCode: string | null;
  paymentId: string | null;
  referenceId: string | null;
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

export function bankShortCodeMatchesBankName(bankShortCode: string, bankName: string | null): boolean {
  const code = bankShortCode.trim().toUpperCase();
  const resolved = resolveBankShortCode(bankName);
  if (!resolved) return false;
  return resolved === code;
}

export function brickCorsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-signature, x-timestamp",
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

function formatBrickApiError(data: unknown, fallback: string): string {
  if (!data || typeof data !== "object") return fallback;
  const root = data as Record<string, unknown>;
  const errors = root.errors as Record<string, unknown> | undefined;
  const nested = root.error as Record<string, unknown> | string | undefined;
  const dataPayload = root.data as Record<string, unknown> | undefined;

  const candidates = [
    root.message,
    typeof errors?.message === "string" ? errors.message : null,
    typeof nested === "string" ? nested : null,
    typeof nested === "object" && nested ? nested.message : null,
    dataPayload?.message,
    root.code != null ? `Brick error: ${String(root.code)}` : null,
  ].filter((v): v is string => typeof v === "string" && v.trim().length > 0);

  return candidates[0] ?? fallback;
}

function brickBasicAuthHeader(clientId: string, clientSecret: string): string {
  const credentials = `${clientId}:${clientSecret}`;
  const bytes = new TextEncoder().encode(credentials);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return `Basic ${btoa(binary)}`;
}

export async function getBrickPublicAccessToken(env: BrickEnv): Promise<string> {
  if (env.useMock) return "mock-public-access-token";

  const basic = brickBasicAuthHeader(env.clientId, env.clientSecret);
  const { ok, data } = await brickRequest(env, "/payments/auth/token", {
    method: "GET",
    headers: { Authorization: basic },
  });

  const dataNode = (data as { data?: Record<string, unknown> })?.data;
  const token =
    (typeof dataNode?.publicAccessToken === "string" ? dataNode.publicAccessToken : null) ??
    (typeof dataNode?.accessToken === "string" ? dataNode.accessToken : null) ??
    (typeof (data as { publicAccessToken?: string })?.publicAccessToken === "string"
      ? (data as { publicAccessToken: string }).publicAccessToken
      : null) ??
    (typeof (data as { accessToken?: string })?.accessToken === "string"
      ? (data as { accessToken: string }).accessToken
      : null);

  if (!ok || !token) {
    const msg = formatBrickApiError(data, "Failed to obtain Brick access token");
    throw new Error(msg);
  }
  return String(token);
}

function brickPublicAccessTokenHeader(token: string): Record<string, string> {
  const value = token.startsWith("Bearer ") ? token : `Bearer ${token}`;
  return { publicAccessToken: value };
}

export type AccountValidationResult = {
  accountNo: string;
  accountName: string;
  bankShortCode: string;
  activityId: string;
};

/** Brick disbursement Quick Start sandbox beneficiary (MANDIRI only). */
export const BRICK_SANDBOX_DISBURSE_ACCOUNT = {
  bankShortCode: "MANDIRI",
  accountNo: "12345678",
  accountHolderName: "PROD ONLY",
} as const;

export function isBrickSandboxDisburseTestAccount(
  bankShortCode: string,
  accountNumber: string,
  accountHolderName?: string,
): boolean {
  const no = accountNumber.replace(/\D/g, "");
  const holder = (accountHolderName ?? "").trim().toUpperCase();
  return no === BRICK_SANDBOX_DISBURSE_ACCOUNT.accountNo && holder.includes("PROD");
}

export async function resolveBrickDisburseBeneficiary(
  env: BrickEnv,
  accountNumber: string,
  bankShortCode: string,
  accountHolderName: string,
): Promise<AccountValidationResult> {
  const sandbox = Deno.env.get("BRICK_SANDBOX") !== "false";
  const holder = accountHolderName.trim();

  if (env.useMock) {
    return {
      accountNo: accountNumber,
      accountName: holder || "Mock Account Holder",
      bankShortCode,
      activityId: `mock-${accountNumber}-${bankShortCode}`,
    };
  }

  if (sandbox && isBrickSandboxDisburseTestAccount(bankShortCode, accountNumber, holder)) {
    return {
      accountNo: BRICK_SANDBOX_DISBURSE_ACCOUNT.accountNo,
      accountName: BRICK_SANDBOX_DISBURSE_ACCOUNT.accountHolderName,
      bankShortCode: BRICK_SANDBOX_DISBURSE_ACCOUNT.bankShortCode,
      activityId: `sandbox-mandiri-${BRICK_SANDBOX_DISBURSE_ACCOUNT.accountNo}`,
    };
  }

  try {
    const validated = await validateBrickBankAccount(env, accountNumber, bankShortCode);
    return validated;
  } catch (e) {
    if (sandbox && holder.length >= 3) {
      return {
        accountNo: accountNumber,
        accountName: holder,
        bankShortCode: bankShortCode.trim().toUpperCase(),
        activityId: `sandbox-fallback-${bankShortCode}-${accountNumber}`,
      };
    }
    throw e;
  }
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
  let result = await brickRequest(env, "/payments/gs/account-validation", {
    method: "POST",
    headers: brickPublicAccessTokenHeader(token),
    body: { accountNumber, bankShortCode },
  });

  if (!result.ok) {
    result = await brickRequest(env, "/payments/gs/account-validation", {
      query: { accountNumber, bankShortCode },
      headers: brickPublicAccessTokenHeader(token),
    });
  }

  const { ok, data } = result;
  const payload = (data as { data?: Record<string, unknown> })?.data ?? data;
  if (!ok || !payload) {
    const msg = formatBrickApiError(data, "Account validation failed");
    throw new Error(msg);
  }

  const record = payload as Record<string, unknown>;
  const accountName = String(record.accountName ?? record.accountHolderName ?? "").trim();
  if (!accountName) {
    throw new Error(
      "Account validation returned no holder name. Use a valid sandbox test account (see Brick disbursement docs).",
    );
  }

  return {
    accountNo: String(record.accountNo ?? record.accountNumber ?? accountNumber),
    accountName,
    bankShortCode: String(record.bankShortCode ?? bankShortCode),
    activityId: String(record.activityId ?? record.referenceId ?? `${bankShortCode}-${accountNumber}`),
  };
}

export async function createBrickCloseVa(
  env: BrickEnv,
  input: {
    amount: number;
    bankShortCode: string;
    referenceId: string;
    displayName: string;
    description: string;
    /** Brick API: expiration in minutes from request time (min 60, max 30 days). */
    expiryMinutes: number;
  },
): Promise<BrickCloseVaResult> {
  const expiryMinutes = Math.min(
    30 * 24 * 60,
    Math.max(60, Math.floor(input.expiryMinutes)),
  );

  if (env.useMock) {
    const mockExpires = new Date(Date.now() + expiryMinutes * 60 * 1000).toISOString();
    return {
      id: `CL_mock_${Date.now()}`,
      accountNo: "1608190249364670",
      bankShortCode: input.bankShortCode,
      amount: input.amount,
      status: "pending",
      referenceId: input.referenceId,
      expiredAt: mockExpires,
      raw: { mock: true },
    };
  }

  const token = await getBrickPublicAccessToken(env);
  const { ok, data } = await brickRequest(env, "/payments/gs/va/close", {
    method: "POST",
    headers: brickPublicAccessTokenHeader(token),
    body: {
      paymentMethodType: "virtual_bank_account",
      amount: input.amount,
      description: input.description.slice(0, 255),
      expiredAt: String(expiryMinutes),
      bankShortCode: input.bankShortCode,
      referenceId: input.referenceId,
      displayName: input.displayName.slice(0, 24),
    },
  });

  const payload = (data as { data?: Record<string, unknown> })?.data ?? data;
  if (!ok || !payload) {
    const msg = (data as { message?: string })?.message ??
      (data as { errors?: { message?: string } })?.errors?.message ??
      "Failed to create Brick Close VA";
    throw new Error(msg);
  }

  return {
    id: String(payload.id ?? ""),
    accountNo: String(payload.accountNo ?? payload.accountNumber ?? ""),
    bankShortCode: String(payload.bankShortCode ?? input.bankShortCode),
    amount: Number(payload.amount ?? input.amount),
    status: String(payload.status ?? "pending"),
    referenceId: String(payload.referenceId ?? input.referenceId),
    expiredAt: payload.expiredAt ? String(payload.expiredAt) : formatBrickExpiredAt(
      new Date(Date.now() + expiryMinutes * 60 * 1000),
    ),
    raw: payload as Record<string, unknown>,
  };
}

export async function getBrickCloseVaStatus(env: BrickEnv, vaId: string): Promise<BrickCloseVaStatus> {
  if (env.useMock) {
    return {
      id: vaId,
      status: "pending",
      amount: 5000000,
      accountNo: "1608190249364670",
      bankShortCode: "MANDIRI",
      paymentId: `PAY_mock_${vaId}`,
      referenceId: "mock-ref",
      raw: { mock: true },
    };
  }

  const token = await getBrickPublicAccessToken(env);
  const { ok, data } = await brickRequest(env, "/payments/gs/va/close", {
    query: { vaId },
    headers: brickPublicAccessTokenHeader(token),
  });

  const payload = (data as { data?: Record<string, unknown> })?.data ?? data;
  if (!ok || !payload) {
    const msg = (data as { message?: string })?.message ??
      (data as { errors?: { message?: string } })?.errors?.message ??
      "Failed to get Brick VA status";
    throw new Error(msg);
  }

  return {
    id: String(payload.id ?? vaId),
    status: String(payload.status ?? "").toLowerCase(),
    amount: Number(payload.amount ?? 0),
    accountNo: payload.accountNo ? String(payload.accountNo) : null,
    bankShortCode: payload.bankShortCode ? String(payload.bankShortCode) : null,
    paymentId: payload.paymentId ? String(payload.paymentId) : null,
    referenceId: payload.referenceId ? String(payload.referenceId) : null,
    raw: payload as Record<string, unknown>,
  };
}

function normalizeLedgerDirection(
  raw: Record<string, unknown>,
  amount: number,
): "credit" | "debit" {
  const type = String(raw.transactionType ?? raw.type ?? raw.category ?? "").toLowerCase();
  if (
    type.includes("received") || type.includes("topup") || type.includes("credit") ||
    type.includes("va") || type.includes("paid") || type.includes("acceptance")
  ) {
    return "credit";
  }
  if (type.includes("sent") || type.includes("disburse") || type.includes("debit")) return "debit";
  return amount >= 0 ? "credit" : "debit";
}

function extractBrickRows(data: unknown): Record<string, unknown>[] {
  const rows =
    (data as { data?: Record<string, unknown>[] })?.data ??
    (data as { data?: { data?: Record<string, unknown>[] } })?.data?.data ??
    (Array.isArray(data) ? data : []);
  return Array.isArray(rows) ? rows : [];
}

function dedupeBrickTransactions(list: BrickLedgerTransaction[]): BrickLedgerTransaction[] {
  const seen = new Set<string>();
  const out: BrickLedgerTransaction[] = [];
  for (const tx of list) {
    if (seen.has(tx.externalId)) continue;
    seen.add(tx.externalId);
    out.push(tx);
  }
  return out;
}

async function fetchLedgerPages(
  env: BrickEnv,
  token: string,
  startDate: string,
  endDate: string,
  status?: string,
): Promise<BrickLedgerTransaction[]> {
  const all: BrickLedgerTransaction[] = [];
  let page = 1;
  const size = 500;

  for (;;) {
    const query: Record<string, string> = {
      startDate,
      endDate,
      page: String(page),
      size: String(size),
    };
    if (status) query.status = status;

    const { ok, data } = await brickRequest(env, "/payments/gs/ledger", {
      query,
      headers: brickPublicAccessTokenHeader(token),
    });

    if (!ok) {
      if (status === undefined) {
        const msg = (data as { message?: string })?.message ?? "Ledger fetch failed";
        throw new Error(msg);
      }
      break;
    }

    const list = extractBrickRows(data);
    for (let i = 0; i < list.length; i++) {
      all.push(mapLedgerRow(list[i], all.length + i));
    }

    if (list.length < size) break;
    page += 1;
    if (page > 20) break;
  }

  return all;
}

async function fetchBrickTopupRows(
  env: BrickEnv,
  token: string,
  startDate: string,
  endDate: string,
): Promise<{ rows: BrickLedgerTransaction[]; errors: string[] }> {
  const paths = ["/payments/gs/topup", "/payments/gs/top-up-history"];
  const merged: BrickLedgerTransaction[] = [];
  const errors: string[] = [];

  for (const path of paths) {
    const { ok, data } = await brickRequest(env, path, {
      query: { startDate, endDate },
      headers: brickPublicAccessTokenHeader(token),
    });
    if (!ok) {
      const msg = (data as { message?: string })?.message ?? `Topup fetch failed: ${path}`;
      errors.push(msg);
      continue;
    }
    const list = extractBrickRows(data);
    merged.push(...list.map((row, i) => mapLedgerRow(row, i)));
  }

  return { rows: merged, errors };
}

function mapLedgerRow(raw: Record<string, unknown>, index: number): BrickLedgerTransaction {
  const amountRaw = Number(raw.amount ?? raw.transactionAmount ?? 0);
  const amount = Math.abs(amountRaw);
  const direction = normalizeLedgerDirection(raw, amountRaw);
  const externalId = String(
    raw.id ??
      raw.paymentId ??
      raw.refId ??
      raw.referenceId ??
      raw.refNumber ??
      `brick-${index}-${raw.date ?? Date.now()}`,
  );
  const dateStr = String(raw.date ?? raw.createdAt ?? raw.transactionDate ?? new Date().toISOString());

  return {
    externalId,
    transactionDate: dateStr,
    amount,
    direction,
    description: raw.description
      ? String(raw.description)
      : raw.transactionType
        ? String(raw.transactionType)
        : null,
    reference: raw.refId
      ? String(raw.refId)
      : raw.refNumber
        ? String(raw.refNumber)
        : raw.referenceId
          ? String(raw.referenceId)
          : null,
    counterpartyName: raw.accountHolderName
      ? String(raw.accountHolderName)
      : raw.accountDisplayName
        ? String(raw.accountDisplayName)
        : null,
    accountNumber: raw.accountNumber ? String(raw.accountNumber) : raw.accountNo ? String(raw.accountNo) : null,
    bankName: raw.bankName ? String(raw.bankName) : raw.bank ? String(raw.bank) : raw.bankShortCode ? String(raw.bankShortCode) : null,
    status: raw.status ? String(raw.status) : null,
    raw,
  };
}

export async function fetchBrickLedgerTransactions(
  env: BrickEnv,
  startDate: string,
  endDate: string,
): Promise<{ transactions: BrickLedgerTransaction[]; topupErrors: string[] }> {
  if (env.useMock) {
    return { transactions: buildMockTransactions(startDate, endDate), topupErrors: [] };
  }

  const token = await getBrickPublicAccessToken(env);
  const merged: BrickLedgerTransaction[] = [];

  merged.push(...await fetchLedgerPages(env, token, startDate, endDate));
  for (const status of ["completed", "processing", "pending"] as const) {
    merged.push(...await fetchLedgerPages(env, token, startDate, endDate, status));
  }

  let topupErrors: string[] = [];
  // Topup ledger endpoints are often unavailable in Brick sandbox — skip to avoid noisy sync errors.
  if (Deno.env.get("BRICK_SANDBOX") === "false") {
    const topup = await fetchBrickTopupRows(env, token, startDate, endDate);
    merged.push(...topup.rows);
    topupErrors = topup.errors;
  }

  return { transactions: dedupeBrickTransactions(merged), topupErrors };
}

function buildMockTransactions(startDate: string, endDate: string): BrickLedgerTransaction[] {
  const now = new Date();
  return [
    {
      externalId: `mock-credit-${startDate}-${endDate}`,
      transactionDate: now.toISOString(),
      amount: 500000,
      direction: "credit",
      description: "Mock incoming transfer (Brick sandbox)",
      reference: "MOCK-REF-001",
      counterpartyName: "Mock Client",
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
  options?: { isPrimaryVaTarget?: boolean },
): BrickLedgerTransaction[] {
  if (!accountNumber) return transactions;
  const normalizedAccount = accountNumber.replace(/\D/g, "");
  const bankCode = resolveBankShortCode(bankName);

  return transactions.filter((tx) => {
    const txBank = resolveBankShortCode(tx.bankName);
    const bankMatches = !bankCode || !txBank || txBank === bankCode;

    if (!tx.accountNumber) {
      if (tx.direction !== "credit" || !bankMatches) return false;
      return options?.isPrimaryVaTarget ?? true;
    }

    const txAccount = tx.accountNumber.replace(/\D/g, "");
    const accountMatch =
      txAccount === normalizedAccount ||
      txAccount.endsWith(normalizedAccount) ||
      normalizedAccount.endsWith(txAccount);

    if (accountMatch) return bankMatches;

    if (tx.direction === "credit" && bankMatches) {
      return options?.isPrimaryVaTarget ?? false;
    }

    return false;
  });
}

export function formatYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Brick VA timestamps expect Asia/Jakarta offset, e.g. 2024-07-17T12:38:11.000+07:00 */
export function formatBrickExpiredAt(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const pick = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${pick("year")}-${pick("month")}-${pick("day")}T${pick("hour")}:${pick("minute")}:${pick("second")}.000+07:00`;
}

export type BrickDisbursementResult = {
  id: string;
  referenceId: string;
  amount: number;
  status: string;
  bankShortCode: string;
  accountNo: string;
  accountHolderName: string;
  raw: Record<string, unknown>;
};

export type BrickDisbursementStatus = {
  id: string;
  referenceId: string | null;
  amount: number;
  status: string;
  feeAmount: number | null;
  bankShortCode: string | null;
  accountNo: string | null;
  accountHolderName: string | null;
  failureCode: string | null;
  failureMessage: string | null;
  createdAt: string | null;
  raw: Record<string, unknown>;
};

function parseBrickDisbursementPayload(
  payload: Record<string, unknown>,
  fallbackReferenceId?: string,
): BrickDisbursementStatus {
  const attrs = (payload.attributes as Record<string, unknown>) ?? payload;
  const method = (attrs.disbursementMethod as Record<string, unknown>) ?? {};
  const feeRaw = attrs.feeAmount ?? attrs.fee ?? attrs.disbursementFee ?? null;

  return {
    id: String(payload.id ?? attrs.id ?? ""),
    referenceId: attrs.referenceId
      ? String(attrs.referenceId)
      : payload.referenceId
        ? String(payload.referenceId)
        : fallbackReferenceId ?? null,
    amount: Number(attrs.amount ?? payload.amount ?? 0),
    status: String(attrs.status ?? payload.status ?? "").toLowerCase(),
    feeAmount: feeRaw != null ? Number(feeRaw) : null,
    bankShortCode: method.bankShortCode
      ? String(method.bankShortCode)
      : attrs.bankShortCode
        ? String(attrs.bankShortCode)
        : null,
    accountNo: method.bankAccountNo
      ? String(method.bankAccountNo)
      : attrs.bankAccountNo
        ? String(attrs.bankAccountNo)
        : null,
    accountHolderName: method.bankAccountHolderName
      ? String(method.bankAccountHolderName)
      : attrs.bankAccountHolderName
        ? String(attrs.bankAccountHolderName)
        : null,
    failureCode: attrs.errorCode != null
      ? String(attrs.errorCode)
      : attrs.failureCode != null
        ? String(attrs.failureCode)
        : null,
    failureMessage: attrs.errorMessage != null
      ? String(attrs.errorMessage)
      : attrs.failureMessage != null
        ? String(attrs.failureMessage)
        : null,
    createdAt: attrs.createdAt ? String(attrs.createdAt) : null,
    raw: payload as Record<string, unknown>,
  };
}

export async function createBrickDisbursement(
  env: BrickEnv,
  input: {
    referenceId: string;
    description: string;
    amount: number;
    bankShortCode: string;
    bankAccountNo: string;
    bankAccountHolderName: string;
  },
): Promise<BrickDisbursementResult> {
  if (env.useMock) {
    return {
      id: `DIS_mock_${Date.now()}`,
      referenceId: input.referenceId,
      amount: input.amount,
      status: "processing",
      bankShortCode: input.bankShortCode,
      accountNo: input.bankAccountNo,
      accountHolderName: input.bankAccountHolderName,
      raw: { mock: true },
    };
  }

  const token = await getBrickPublicAccessToken(env);
  const { ok, data } = await brickRequest(env, "/payments/gs/disbursements", {
    method: "POST",
    headers: brickPublicAccessTokenHeader(token),
    body: {
      referenceId: input.referenceId,
      description: input.description.slice(0, 255),
      amount: Math.floor(input.amount),
      disbursementMethod: {
        type: "bank_transfer",
        bankShortCode: input.bankShortCode,
        bankAccountNo: input.bankAccountNo,
        bankAccountHolderName: input.bankAccountHolderName,
      },
    },
  });

  const payload = (data as { data?: Record<string, unknown> })?.data ?? data;
  if (!ok || !payload) {
    const msg = formatBrickApiError(data, "Failed to create Brick disbursement");
    throw new Error(msg);
  }

  const parsed = parseBrickDisbursementPayload(payload as Record<string, unknown>, input.referenceId);
  return {
    id: parsed.id,
    referenceId: parsed.referenceId ?? input.referenceId,
    amount: parsed.amount > 0 ? parsed.amount : input.amount,
    status: parsed.status || "processing",
    bankShortCode: parsed.bankShortCode ?? input.bankShortCode,
    accountNo: parsed.accountNo ?? input.bankAccountNo,
    accountHolderName: parsed.accountHolderName ?? input.bankAccountHolderName,
    raw: parsed.raw,
  };
}

export async function getBrickDisbursementStatus(
  env: BrickEnv,
  options: { referenceId?: string; disbursementId?: string },
): Promise<BrickDisbursementStatus> {
  const referenceId = options.referenceId?.trim() ?? "";
  const disbursementId = options.disbursementId?.trim() ?? "";

  if (env.useMock) {
    return {
      id: disbursementId || `DIS_mock_${referenceId}`,
      referenceId: referenceId || null,
      amount: 10000,
      status: "processing",
      feeAmount: null,
      bankShortCode: "MANDIRI",
      accountNo: "12345678",
      accountHolderName: "Mock Holder",
      failureCode: null,
      failureMessage: null,
      createdAt: new Date().toISOString(),
      raw: { mock: true },
    };
  }

  const token = await getBrickPublicAccessToken(env);
  let ok = false;
  let data: unknown = null;

  if (referenceId) {
    const res = await brickRequest(env, `/payments/gs/${encodeURIComponent(referenceId)}`, {
      headers: brickPublicAccessTokenHeader(token),
    });
    ok = res.ok;
    data = res.data;
  } else if (disbursementId) {
    const res = await brickRequest(env, "/payments/gs/disbursements", {
      query: { disbursementId },
      headers: brickPublicAccessTokenHeader(token),
    });
    ok = res.ok;
    data = res.data;
    if (!ok) {
      const alt = await brickRequest(env, `/payments/gs/${encodeURIComponent(disbursementId)}`, {
        headers: brickPublicAccessTokenHeader(token),
      });
      ok = alt.ok;
      data = alt.data;
    }
  } else {
    throw new Error("referenceId or disbursementId required");
  }

  const payload = (data as { data?: Record<string, unknown> })?.data ?? data;
  if (!ok || !payload) {
    const msg = (data as { message?: string })?.message ??
      (data as { errors?: { message?: string } })?.errors?.message ??
      "Failed to get Brick disbursement status";
    throw new Error(msg);
  }

  return parseBrickDisbursementPayload(payload as Record<string, unknown>, referenceId || undefined);
}

export async function simulateBrickCloseVaPayment(
  env: BrickEnv,
  vaId: string,
  action: "PAID" | "COMPLETED",
): Promise<unknown> {
  if (env.useMock) {
    return { ok: true, mock: true, vaId, action };
  }

  const token = await getBrickPublicAccessToken(env);
  const paths = [
    "/payments/gs/simulate-payment-of-close-va-paid",
    "/payments/gs/simulate-payment-of-close-va",
    "/payments/gs/simulate-close-va",
    "/payments/gs/simulate-close-va-paid",
  ];

  let lastError = "Simulate VA failed";
  for (const path of paths) {
    const { ok, status, data } = await brickRequest(env, path, {
      method: "POST",
      headers: brickPublicAccessTokenHeader(token),
      body: { vaId, action },
    });
    if (ok) return data;
    lastError = (data as { message?: string })?.message ??
      (data as { errors?: { message?: string } })?.errors?.message ??
      JSON.stringify(data);
    if (status !== 404) break;
  }

  throw new Error(lastError);
}

export type BrickWalletBalance = {
  usableBalance: number;
  pendingBalance: number;
  totalBalance: number;
  raw: Record<string, unknown>;
};

function parseBrickWalletBalancePayload(payload: Record<string, unknown>): BrickWalletBalance {
  const balance = (payload.balance as Record<string, unknown> | undefined) ?? payload;
  const usable = Number(balance.usableBalance ?? balance.usable_balance ?? balance.brickPayBalance ?? 0);
  const pending = Number(balance.pendingBalance ?? balance.pending_balance ?? 0);
  const total = Number(balance.totalBalance ?? balance.total_balance ?? usable + pending);
  return {
    usableBalance: usable,
    pendingBalance: pending,
    totalBalance: total,
    raw: payload,
  };
}

function isRetryableBrickBalanceError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("upstream") ||
    lower.includes("service is not available") ||
    lower.includes("service_unavailable") ||
    lower.includes("server_unavailabl") ||
    lower.includes("timeout") ||
    lower.includes("502") ||
    lower.includes("503") ||
    lower.includes("504")
  );
}

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function tryParseBrickWalletBalance(data: unknown): BrickWalletBalance | null {
  if (!data || typeof data !== "object") return null;
  const root = data as Record<string, unknown>;
  const dataNode = root.data;
  const candidates: Record<string, unknown>[] = [];

  if (dataNode && typeof dataNode === "object") {
    const dn = dataNode as Record<string, unknown>;
    if (dn.balance && typeof dn.balance === "object") {
      candidates.push(dn.balance as Record<string, unknown>);
    }
    candidates.push(dn);
  }
  if (root.balance && typeof root.balance === "object") {
    candidates.push(root.balance as Record<string, unknown>);
  }
  candidates.push(root);

  for (const candidate of candidates) {
    const usableRaw = candidate.usableBalance ?? candidate.usable_balance ?? candidate.brickPayBalance;
    if (usableRaw == null || Number.isNaN(Number(usableRaw))) continue;
    return parseBrickWalletBalancePayload(candidate);
  }
  return null;
}

export async function getBrickWalletBalance(env: BrickEnv): Promise<BrickWalletBalance> {
  if (env.useMock) {
    return {
      usableBalance: 1_000_000,
      pendingBalance: 0,
      totalBalance: 1_000_000,
      raw: { mock: true },
    };
  }

  const paths = ["/payments/gs", "/payments/gs/balance"];
  const maxAttempts = 3;
  let lastError = "Failed to get Brick wallet balance";

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    for (const path of paths) {
      const token = await getBrickPublicAccessToken(env);
      const { ok, status, data } = await brickRequest(env, path, {
        method: "GET",
        headers: brickPublicAccessTokenHeader(token),
      });

      const parsed = tryParseBrickWalletBalance(data);
      if (ok && parsed) return parsed;

      lastError = formatBrickApiError(data, `Failed to get Brick wallet balance (HTTP ${status})`);
      if (!isRetryableBrickBalanceError(lastError) && status < 500) {
        break;
      }
    }

    if (attempt < maxAttempts && isRetryableBrickBalanceError(lastError)) {
      await sleepMs(500 * attempt);
      continue;
    }
    break;
  }

  throw new Error(lastError);
}
