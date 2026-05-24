/**
 * Google Ads offline conversion helpers (bundled in this function folder for deploy).
 */

export type ClickIdBundle = {
  gclid: string | null;
  gbraid: string | null;
  wbraid: string | null;
};

export function parseClickIdsFromAttribution(raw: unknown): ClickIdBundle {
  const empty: ClickIdBundle = { gclid: null, gbraid: null, wbraid: null };
  if (raw == null) return empty;
  let obj: unknown = raw;
  if (typeof obj === "string") {
    const t = obj.trim();
    if (!t) return empty;
    try {
      obj = JSON.parse(t) as unknown;
    } catch {
      return empty;
    }
  }
  if (typeof obj !== "object" || obj === null || Array.isArray(obj)) return empty;
  const rec = obj as Record<string, unknown>;
  const pick = (key: string) => {
    const v = rec[key];
    if (v == null) return null;
    const s = String(v).trim();
    return s === "" ? null : s;
  };
  return {
    gclid: pick("gclid"),
    gbraid: pick("gbraid"),
    wbraid: pick("wbraid"),
  };
}

export function mergeClickIds(columnGclid: string | null, fromAttr: ClickIdBundle): ClickIdBundle {
  const gclid = (columnGclid?.trim() || fromAttr.gclid) ?? null;
  return {
    gclid: gclid || null,
    gbraid: fromAttr.gbraid,
    wbraid: fromAttr.wbraid,
  };
}

export function hasAnyClickId(ids: ClickIdBundle): boolean {
  return Boolean(ids.gclid || ids.gbraid || ids.wbraid);
}

/** Google enhanced conversions: normalize email before SHA-256. */
export function normalizeEmailForHash(email: string): string | null {
  let e = email.trim().toLowerCase();
  if (!e || !e.includes("@")) return null;
  const at = e.lastIndexOf("@");
  if (at <= 0) return null;
  let local = e.slice(0, at);
  const domain = e.slice(at + 1);
  if (!domain) return null;
  if (domain === "gmail.com" || domain === "googlemail.com") {
    local = local.replace(/\./g, "");
    if (local.includes("+")) {
      local = local.split("+")[0] ?? local;
    }
    e = `${local}@${domain}`;
  }
  return e;
}

/** Normalize phone to E.164 digits with leading + (Indonesia default +62). */
export function normalizePhoneForHash(phone: string): string | null {
  let digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("0")) {
    digits = `62${digits.slice(1)}`;
  } else if (!digits.startsWith("62") && digits.length >= 9 && digits.length <= 12) {
    digits = `62${digits}`;
  }
  if (digits.length < 10) return null;
  return `+${digits}`;
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export type HashedUserIdentifiers = {
  hashedEmail: string | null;
  hashedPhone: string | null;
};

export async function hashUserIdentifiers(
  email: string | null | undefined,
  phone: string | null | undefined,
): Promise<HashedUserIdentifiers> {
  let hashedEmail: string | null = null;
  let hashedPhone: string | null = null;
  if (email) {
    const norm = normalizeEmailForHash(email);
    if (norm) hashedEmail = await sha256Hex(norm);
  }
  if (phone) {
    const norm = normalizePhoneForHash(phone);
    if (norm) hashedPhone = await sha256Hex(norm);
  }
  return { hashedEmail, hashedPhone };
}

export function hasHashableContact(h: HashedUserIdentifiers): boolean {
  return Boolean(h.hashedEmail || h.hashedPhone);
}

/** Google Ads conversionDateTime: yyyy-mm-dd HH:mm:ss+|-HH:MM */
export function formatConversionDateTimeWib(iso: string | null | undefined): string {
  const d = iso ? new Date(iso) : new Date();
  const valid = Number.isFinite(d.getTime()) ? d : new Date();
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(valid);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "00";
  const yyyy = get("year");
  const mm = get("month");
  const dd = get("day");
  const hh = get("hour");
  const mi = get("minute");
  const ss = get("second");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}+07:00`;
}

export type GoogleAdsConfig = {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  developerToken: string;
  customerId: string;
  conversionActionId: string;
  loginCustomerId: string | null;
};

/** Supported REST versions — v18 is sunset (404 HTML). Default v24. */
export function googleAdsApiVersion(): string {
  const raw = (Deno.env.get("GOOGLE_ADS_API_VERSION") ?? "v24").trim();
  return raw.startsWith("v") ? raw : `v${raw}`;
}

export function readGoogleAdsConfig(): GoogleAdsConfig | null {
  const clientId = Deno.env.get("GOOGLE_ADS_CLIENT_ID")?.trim() ?? "";
  const clientSecret = Deno.env.get("GOOGLE_ADS_CLIENT_SECRET")?.trim() ?? "";
  const refreshToken = Deno.env.get("GOOGLE_ADS_REFRESH_TOKEN")?.trim() ?? "";
  const developerToken = Deno.env.get("GOOGLE_ADS_DEVELOPER_TOKEN")?.trim() ?? "";
  const customerId = (Deno.env.get("GOOGLE_ADS_CUSTOMER_ID")?.trim() ?? "").replace(/\D/g, "");
  const conversionActionId = (Deno.env.get("GOOGLE_ADS_CONVERSION_ACTION_ID")?.trim() ?? "").replace(
    /\D/g,
    "",
  );
  const loginCustomerIdRaw = Deno.env.get("GOOGLE_ADS_LOGIN_CUSTOMER_ID")?.trim() ?? "";
  const loginCustomerId = loginCustomerIdRaw ? loginCustomerIdRaw.replace(/\D/g, "") : null;
  if (!clientId || !clientSecret || !refreshToken || !developerToken || !customerId || !conversionActionId) {
    return null;
  }
  return {
    clientId,
    clientSecret,
    refreshToken,
    developerToken,
    customerId,
    conversionActionId,
    loginCustomerId,
  };
}

function googleAdsRequestHeaders(
  config: GoogleAdsConfig,
  accessToken: string,
): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "developer-token": config.developerToken,
    "Content-Type": "application/json",
  };
  if (config.loginCustomerId) {
    headers["login-customer-id"] = config.loginCustomerId;
  }
  return headers;
}

/** Prefer nested GoogleAdsFailure messages over generic OAuth wrapper text. */
export function parseGoogleAdsErrorMessage(json: Record<string, unknown>): string {
  const err = json.error as Record<string, unknown> | undefined;
  const details = err?.details as Array<Record<string, unknown>> | undefined;
  const failure = details?.find((d) =>
    String(d["@type"] ?? "").includes("GoogleAdsFailure")
  );
  const errors = failure?.errors as Array<Record<string, unknown>> | undefined;
  const messages: string[] = [];
  for (const e of errors ?? []) {
    const msg = e.message != null ? String(e.message).trim() : "";
    if (msg) messages.push(msg);
    const code = e.errorCode as Record<string, unknown> | undefined;
    if (code) {
      for (const [k, v] of Object.entries(code)) {
        if (v) messages.push(`${k}: ${String(v)}`);
      }
    }
  }
  if (messages.length > 0) return [...new Set(messages)].join("; ");
  const top = err?.message != null ? String(err.message).trim() : "";
  return top || "Google Ads API error";
}

export async function listAccessibleCustomerIds(
  config: GoogleAdsConfig,
  accessToken: string,
): Promise<string[]> {
  const apiVersion = googleAdsApiVersion();
  const res = await fetch(
    `https://googleads.googleapis.com/${apiVersion}/customers:listAccessibleCustomers`,
    { method: "GET", headers: googleAdsRequestHeaders(config, accessToken) },
  );
  const text = await res.text();
  if (!res.ok) return [];
  try {
    const json = JSON.parse(text) as { resourceNames?: string[] };
    return (json.resourceNames ?? [])
      .map((r) => r.replace(/^customers\//, "").trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

export async function fetchGoogleAdsAccessToken(config: GoogleAdsConfig): Promise<string> {
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: config.refreshToken,
    grant_type: "refresh_token",
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const json = (await res.json()) as { access_token?: string; error?: string; error_description?: string };
  if (!res.ok || !json.access_token) {
    throw new Error(json.error_description ?? json.error ?? `token HTTP ${res.status}`);
  }
  return json.access_token;
}

export type UploadConversionInput = {
  clickIds: ClickIdBundle;
  conversionDateTime: string;
  conversionValue: number;
  currencyCode: string;
  hashed: HashedUserIdentifiers;
};

export type UploadConversionResult = {
  ok: boolean;
  partialFailure?: unknown;
  errorMessage?: string;
};

export async function uploadClickConversion(
  config: GoogleAdsConfig,
  accessToken: string,
  input: UploadConversionInput,
): Promise<UploadConversionResult> {
  const conversionAction = `customers/${config.customerId}/conversionActions/${config.conversionActionId}`;

  const userIdentifiers: Array<Record<string, string>> = [];
  if (input.hashed.hashedEmail) {
    userIdentifiers.push({
      userIdentifierSource: "FIRST_PARTY",
      hashedEmail: input.hashed.hashedEmail,
    });
  }
  if (input.hashed.hashedPhone) {
    userIdentifiers.push({
      userIdentifierSource: "FIRST_PARTY",
      hashedPhoneNumber: input.hashed.hashedPhone,
    });
  }

  const conversion: Record<string, unknown> = {
    conversionAction,
    conversionDateTime: input.conversionDateTime,
    conversionValue: input.conversionValue,
    currencyCode: input.currencyCode,
  };
  if (input.clickIds.gclid) conversion.gclid = input.clickIds.gclid;
  if (input.clickIds.gbraid) conversion.gbraid = input.clickIds.gbraid;
  if (input.clickIds.wbraid) conversion.wbraid = input.clickIds.wbraid;
  if (userIdentifiers.length > 0) conversion.userIdentifiers = userIdentifiers;

  const apiVersion = googleAdsApiVersion();
  const url =
    `https://googleads.googleapis.com/${apiVersion}/customers/${config.customerId}:uploadClickConversions`;

  const headers = googleAdsRequestHeaders(config, accessToken);

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      conversions: [conversion],
      partialFailure: true,
    }),
  });

  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    json = { raw: text };
  }

  if (!res.ok) {
    let errorMessage = parseGoogleAdsErrorMessage(json);
    if (text.includes("<!DOCTYPE html>") || text.includes("Error 404")) {
      errorMessage =
        `Google Ads API ${apiVersion} returned 404 — check GOOGLE_ADS_API_VERSION (use v24+) and customer ID.`;
    }
    const isCustomerNotFound =
      /CUSTOMER_NOT_FOUND/i.test(errorMessage) ||
      /No customer found/i.test(errorMessage);
    if (isCustomerNotFound) {
      const accessible = await listAccessibleCustomerIds(config, accessToken);
      const hint = accessible.length > 0
        ? ` Accessible customer IDs for this OAuth account: ${accessible.join(", ")}.`
        : " Check GOOGLE_ADS_CUSTOMER_ID and that OAuth login has access to this Ads account.";
      errorMessage = `${errorMessage}.${hint} Configured: ${config.customerId}.`;
    }
    return {
      ok: false,
      errorMessage: errorMessage.slice(0, 1000),
      partialFailure: json,
    };
  }

  const partial = json.partialFailureError as { errors?: unknown[] } | undefined;
  if (partial?.errors && partial.errors.length > 0) {
    return {
      ok: false,
      partialFailure: partial,
      errorMessage: JSON.stringify(partial.errors).slice(0, 1000),
    };
  }

  return { ok: true, partialFailure: json.partialFailureError ?? null };
}
