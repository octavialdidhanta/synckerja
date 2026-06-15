import {
  brickBaseUrl,
  getBrickPublicAccessToken,
  readBrickEnv,
  resolveBankShortCode,
  type BrickEnv,
} from "./brickApi.ts";

export type BrickAggregatedAccount = {
  accountId: string;
  accountNumber: string | null;
  accountName: string | null;
  institutionId: string | null;
  institutionName: string | null;
  accountType: "BANK" | "CREDIT_CARD" | string;
  balance: number | null;
  last4: string | null;
  raw: Record<string, unknown>;
};

export type BrickAggregationTransaction = {
  externalId: string;
  transactionDate: string;
  amount: number;
  direction: "credit" | "debit";
  description: string | null;
  merchantName: string | null;
  reference: string | null;
  raw: Record<string, unknown>;
};

const SANDBOX_MOCK_USER_ACCESS_TOKEN = "sandbox-mock-user-access-token";

function isSandboxMockUserToken(userAccessToken: string | undefined): boolean {
  const token = String(userAccessToken ?? "").trim();
  if (!token) return false;
  const bare = token.startsWith("Bearer ") ? token.slice(7).trim() : token;
  return bare === SANDBOX_MOCK_USER_ACCESS_TOKEN;
}

function aggregationUseMock(userAccessToken?: string): boolean {
  if (Deno.env.get("BRICK_AGGREGATION_USE_MOCK") === "true" ||
    Deno.env.get("BRICK_USE_MOCK") === "true") {
    return true;
  }
  if (isSandboxMockUserToken(userAccessToken)) return true;
  const env = readBrickEnv();
  return env?.useMock === true;
}

function normalizeDigits(value: string | null | undefined): string {
  return String(value ?? "").replace(/\D/g, "");
}

function parseAmount(raw: unknown): number {
  if (typeof raw === "number" && Number.isFinite(raw)) return Math.abs(raw);
  if (typeof raw === "string") {
    const n = Number(raw.replace(/,/g, ""));
    if (Number.isFinite(n)) return Math.abs(n);
  }
  return 0;
}

function parseDirection(raw: unknown, amount?: number): "credit" | "debit" {
  const text = String(raw ?? "").toLowerCase();
  if (text.includes("credit") || text.includes("in") || text.includes("receive")) return "credit";
  if (text.includes("debit") || text.includes("out") || text.includes("spend")) return "debit";
  if (typeof amount === "number" && amount < 0) return "debit";
  return "debit";
}

async function aggregationRequest(
  env: BrickEnv,
  path: string,
  userAccessToken: string,
  init?: RequestInit,
): Promise<{ ok: boolean; data: unknown }> {
  const url = `${env.baseUrl.replace(/\/v2$/, "/v2")}${path.startsWith("/") ? path : `/${path}`}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: userAccessToken.startsWith("Bearer ") ? userAccessToken : `Bearer ${userAccessToken}`,
    userAccessToken: userAccessToken.startsWith("Bearer ") ? userAccessToken : `Bearer ${userAccessToken}`,
  };
  const res = await fetch(url, { ...init, headers: { ...headers, ...(init?.headers as Record<string, string> ?? {}) } });
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { ok: res.ok, data };
}

function extractAccountNodes(data: unknown): Record<string, unknown>[] {
  if (!data || typeof data !== "object") return [];
  const root = data as Record<string, unknown>;
  const dataNode = root.data;
  if (Array.isArray(dataNode)) return dataNode as Record<string, unknown>[];
  if (dataNode && typeof dataNode === "object") {
    const inner = dataNode as Record<string, unknown>;
    for (const key of ["accounts", "accountList", "items", "results"]) {
      if (Array.isArray(inner[key])) return inner[key] as Record<string, unknown>[];
    }
  }
  if (Array.isArray(root.accounts)) return root.accounts as Record<string, unknown>[];
  return [];
}

function mapAggregatedAccount(node: Record<string, unknown>): BrickAggregatedAccount {
  const accountId = String(
    node.accountId ?? node.account_id ?? node.id ?? node.accountID ?? "",
  ).trim();
  const accountNumber = node.accountNumber != null
    ? String(node.accountNumber)
    : node.account_number != null
    ? String(node.account_number)
    : node.accountNo != null
    ? String(node.accountNo)
    : null;
  const accountName = node.accountName != null
    ? String(node.accountName)
    : node.account_name != null
    ? String(node.account_name)
    : node.holderName != null
    ? String(node.holderName)
    : null;
  const institutionId = node.institutionId != null
    ? String(node.institutionId)
    : node.institution_id != null
    ? String(node.institution_id)
    : null;
  const institutionName = node.institutionName != null
    ? String(node.institutionName)
    : node.institution_name != null
    ? String(node.institution_name)
    : node.bankName != null
    ? String(node.bankName)
    : null;
  const typeRaw = String(node.accountType ?? node.account_type ?? node.type ?? "BANK").toUpperCase();
  const accountType = typeRaw.includes("CREDIT") || typeRaw.includes("CARD")
    ? "CREDIT_CARD"
    : "BANK";
  const balanceRaw = node.balance ?? node.availableBalance ?? node.currentBalance;
  const balance = balanceRaw != null ? parseAmount(balanceRaw) : null;
  const digits = normalizeDigits(accountNumber);
  const last4 = digits.length >= 4 ? digits.slice(-4) : null;
  return {
    accountId,
    accountNumber,
    accountName,
    institutionId,
    institutionName,
    accountType,
    balance,
    last4,
    raw: node,
  };
}

function extractTransactionNodes(data: unknown): Record<string, unknown>[] {
  if (!data || typeof data !== "object") return [];
  const root = data as Record<string, unknown>;
  const dataNode = root.data;
  if (Array.isArray(dataNode)) return dataNode as Record<string, unknown>[];
  if (dataNode && typeof dataNode === "object") {
    const inner = dataNode as Record<string, unknown>;
    for (const key of ["transactions", "transactionList", "items", "results", "history"]) {
      if (Array.isArray(inner[key])) return inner[key] as Record<string, unknown>[];
    }
  }
  if (Array.isArray(root.transactions)) return root.transactions as Record<string, unknown>[];
  return [];
}

function mapAggregationTransaction(node: Record<string, unknown>, accountId: string): BrickAggregationTransaction | null {
  const externalId = String(
    node.id ?? node.transactionId ?? node.transaction_id ?? node.referenceId ?? "",
  ).trim();
  if (!externalId) return null;

  const amountRaw = node.amount ?? node.transactionAmount ?? node.value;
  const signed = typeof amountRaw === "number" ? amountRaw : parseAmount(amountRaw);
  const amount = Math.abs(signed);
  if (amount <= 0) return null;

  const direction = parseDirection(node.direction ?? node.type ?? node.transactionType, signed);
  const dateRaw = node.transactionDate ?? node.transaction_date ?? node.date ?? node.postingDate;
  const transactionDate = dateRaw ? new Date(String(dateRaw)).toISOString() : new Date().toISOString();

  return {
    externalId: `agg-${accountId}-${externalId}`,
    transactionDate,
    amount,
    direction,
    description: node.description != null ? String(node.description) : node.narrative != null ? String(node.narrative) : null,
    merchantName: node.merchantName != null
      ? String(node.merchantName)
      : node.merchant_name != null
      ? String(node.merchant_name)
      : null,
    reference: node.reference != null ? String(node.reference) : null,
    raw: node,
  };
}

export function mockBrickAggregatedAccounts(
  targetType: "bank_account" | "debt",
  accountNumber?: string | null,
  bankName?: string | null,
): BrickAggregatedAccount[] {
  if (targetType === "debt") {
    const last4 = normalizeDigits(accountNumber).slice(-4) || "4242";
    return [{
      accountId: `mock-cc-${last4}`,
      accountNumber: `****${last4}`,
      accountName: "Mock Credit Card",
      institutionId: "mock-cc",
      institutionName: bankName ?? "MockBank CC",
      accountType: "CREDIT_CARD",
      balance: 5_000_000,
      last4,
      raw: { mock: true },
    }];
  }
  const digits = normalizeDigits(accountNumber) || "1234567890";
  return [{
    accountId: `mock-bank-${digits}`,
    accountNumber: digits,
    accountName: "Mock Bank Account",
    institutionId: "mock-bank",
    institutionName: bankName ?? "MockBank",
    accountType: "BANK",
    balance: 10_500_000,
    last4: digits.slice(-4),
    raw: { mock: true },
  }];
}

export function mockBrickAggregationTransactions(
  accountId: string,
  accountType: string,
): BrickAggregationTransaction[] {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  if (accountType === "CREDIT_CARD") {
    return [{
      externalId: `agg-${accountId}-mock-cc-1`,
      transactionDate: yesterday.toISOString(),
      amount: 250_000,
      direction: "debit",
      description: "Mock Merchant Purchase",
      merchantName: "Toko Mock Brick",
      reference: "MOCK-CC-1",
      raw: { mock: true },
    }];
  }
  return [{
    externalId: `agg-${accountId}-mock-bank-1`,
    transactionDate: yesterday.toISOString(),
    amount: 1_500_000,
    direction: "credit",
    description: "Mock Incoming Transfer",
    merchantName: "PT Mock Client",
    reference: "MOCK-IN-1",
    raw: { mock: true },
  }, {
    externalId: `agg-${accountId}-mock-bank-2`,
    transactionDate: now.toISOString(),
    amount: 500_000,
    direction: "debit",
    description: "Mock Outgoing Payment",
    merchantName: null,
    reference: "MOCK-OUT-1",
    raw: { mock: true },
  }];
}

export async function listBrickAggregatedAccounts(
  userAccessToken: string,
  options?: { targetType?: "bank_account" | "debt"; accountNumber?: string | null; bankName?: string | null },
): Promise<BrickAggregatedAccount[]> {
  const env = readBrickEnv();
  if (!env) throw new Error("Brick is not configured");

  if (aggregationUseMock(userAccessToken)) {
    return mockBrickAggregatedAccounts(
      options?.targetType ?? "bank_account",
      options?.accountNumber,
      options?.bankName,
    );
  }

  const paths = [
    "/open-banking/account/list",
    "/account/list",
    "/financial/account/list",
  ];

  for (const path of paths) {
    const { ok, data } = await aggregationRequest(env, path, userAccessToken, { method: "GET" });
    if (!ok) continue;
    const nodes = extractAccountNodes(data);
    if (nodes.length > 0) {
      return nodes.map(mapAggregatedAccount).filter((a) => a.accountId);
    }
  }

  if (Deno.env.get("BRICK_SANDBOX") !== "false") {
    console.warn("Brick aggregation list unavailable in sandbox; using mock accounts");
    return mockBrickAggregatedAccounts(
      options?.targetType ?? "bank_account",
      options?.accountNumber,
      options?.bankName,
    );
  }

  throw new Error("Failed to list Brick aggregated accounts");
}

export async function fetchBrickAccountBalance(
  userAccessToken: string,
  accountId: string,
): Promise<number | null> {
  const env = readBrickEnv();
  if (!env) throw new Error("Brick is not configured");

  if (aggregationUseMock(userAccessToken)) {
    return accountId.includes("cc") ? 5_000_000 : 10_500_000;
  }

  const paths = [
    `/open-banking/account/${accountId}/balance`,
    `/account/${accountId}/balance`,
  ];

  for (const path of paths) {
    const { ok, data } = await aggregationRequest(env, path, userAccessToken, { method: "GET" });
    if (!ok || !data || typeof data !== "object") continue;
    const root = data as Record<string, unknown>;
    const dataNode = (root.data ?? root) as Record<string, unknown>;
    const balance = dataNode.balance ?? dataNode.availableBalance ?? dataNode.currentBalance;
    if (balance != null) return parseAmount(balance);
  }

  return null;
}

export async function fetchBrickAccountTransactions(
  userAccessToken: string,
  accountId: string,
  accountType: string,
  startDate?: string,
  endDate?: string,
): Promise<BrickAggregationTransaction[]> {
  const env = readBrickEnv();
  if (!env) throw new Error("Brick is not configured");

  if (aggregationUseMock(userAccessToken)) {
    return mockBrickAggregationTransactions(accountId, accountType);
  }

  const query = new URLSearchParams();
  if (startDate) query.set("startDate", startDate);
  if (endDate) query.set("endDate", endDate);

  const paths = [
    `/open-banking/account/${accountId}/transactions?${query.toString()}`,
    `/account/${accountId}/transactions?${query.toString()}`,
    `/open-banking/account/${accountId}/transaction-history?${query.toString()}`,
  ];

  for (const path of paths) {
    const { ok, data } = await aggregationRequest(env, path, userAccessToken, { method: "GET" });
    if (!ok) continue;
    const nodes = extractTransactionNodes(data);
    if (nodes.length > 0) {
      return nodes
        .map((n) => mapAggregationTransaction(n, accountId))
        .filter((t): t is BrickAggregationTransaction => t != null);
    }
  }

  if (Deno.env.get("BRICK_SANDBOX") !== "false") {
    return mockBrickAggregationTransactions(accountId, accountType);
  }

  return [];
}

export function pickBestAggregatedAccount(
  accounts: BrickAggregatedAccount[],
  targetType: "bank_account" | "debt",
  opts: {
    accountNumber?: string | null;
    bankName?: string | null;
    debtName?: string | null;
  },
): BrickAggregatedAccount | null {
  const filtered = accounts.filter((a) =>
    targetType === "debt" ? a.accountType === "CREDIT_CARD" : a.accountType === "BANK",
  );
  if (filtered.length === 0) return null;
  if (filtered.length === 1) return filtered[0];

  const targetDigits = normalizeDigits(opts.accountNumber);
  const bankCode = resolveBankShortCode(opts.bankName);

  for (const account of filtered) {
    const digits = normalizeDigits(account.accountNumber);
    if (targetDigits && digits) {
      if (digits === targetDigits || digits.endsWith(targetDigits) || targetDigits.endsWith(digits)) {
        return account;
      }
      if (account.last4 && targetDigits.endsWith(account.last4)) return account;
    }
    if (bankCode && account.institutionName) {
      const inst = account.institutionName.toUpperCase();
      if (inst.includes(bankCode) || inst.includes((opts.bankName ?? "").toUpperCase())) {
        return account;
      }
    }
    if (opts.debtName && account.accountName) {
      const name = opts.debtName.toLowerCase();
      if (account.accountName.toLowerCase().includes(name) || name.includes(account.accountName.toLowerCase())) {
        return account;
      }
    }
  }

  return filtered[0];
}

export function formatYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function brickAggregationEnvReady(): boolean {
  return readBrickEnv() != null;
}
