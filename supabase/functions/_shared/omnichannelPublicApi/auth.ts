import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { apiError } from "./response.ts";
import { buildCorsHeaders } from "./response.ts";

export type OmnichannelApiTokenType = "sdk" | "server" | "legacy_full";

export type OmnichannelApiTokenContext = {
  tokenId: string;
  organizationId: string;
  webId: string;
  allowedOrigins: string[];
  whatsappInvoiceTemplateName: string | null;
  whatsappLeadTemplateName: string | null;
  tokenType: OmnichannelApiTokenType;
};

const SDK_PATHS = new Set([
  "/api/v1/traffic-logs",
  "/api/v1/page-views/heartbeat",
  "/api/v1/click-events",
  "/api/v1/wa-link-clicks",
  "/api/v1/leads",
]);

const SERVER_PATHS = new Set(["/api/v1/orders/invoice-trigger"]);

const BROWSER_SEC_FETCH_SITES = new Set(["same-origin", "same-site", "cross-site"]);

/** Opsi A — invoice-trigger tidak boleh dipanggil dari browser (Origin / Sec-Fetch-Site). */
export function assertInvoiceNotFromBrowser(
  req: Request,
  corsHeaders: Record<string, string>,
): Response | null {
  const origin = req.headers.get("Origin")?.trim();
  if (origin) {
    return apiError(
      "invoice-trigger tidak boleh dipanggil dari browser. Gunakan token Server di backend (Edge Function / server).",
      "BROWSER_REQUEST_REJECTED",
      403,
      corsHeaders,
    );
  }

  const secFetchSite = req.headers.get("Sec-Fetch-Site")?.trim().toLowerCase();
  if (secFetchSite && BROWSER_SEC_FETCH_SITES.has(secFetchSite)) {
    return apiError(
      "invoice-trigger tidak boleh dipanggil dari browser. Gunakan token Server di backend (Edge Function / server).",
      "BROWSER_REQUEST_REJECTED",
      403,
      corsHeaders,
    );
  }

  return null;
}

export function assertPathAllowedForTokenType(
  path: string,
  tokenType: OmnichannelApiTokenType,
  corsHeaders: Record<string, string>,
): Response | null {
  if (tokenType === "legacy_full") return null;

  if (tokenType === "sdk") {
    if (SDK_PATHS.has(path)) return null;
    if (path === "/api/v1/orders/invoice-trigger") {
      return apiError(
        "Token tipe SDK tidak boleh memanggil invoice-trigger. Gunakan token Server di backend.",
        "FORBIDDEN",
        403,
        corsHeaders,
      );
    }
    return apiError(
      "Token tipe SDK tidak diizinkan untuk endpoint ini.",
      "FORBIDDEN",
      403,
      corsHeaders,
    );
  }

  if (tokenType === "server") {
    if (SERVER_PATHS.has(path)) return null;
    return apiError(
      "Token tipe Server hanya untuk invoice-trigger.",
      "FORBIDDEN",
      403,
      corsHeaders,
    );
  }

  return null;
}

function normalizeTokenType(value: unknown): OmnichannelApiTokenType {
  const t = String(value ?? "legacy_full").trim();
  if (t === "sdk" || t === "server" || t === "legacy_full") return t;
  return "legacy_full";
}

const RATE_LIMIT_PER_MINUTE = 100;
const MS_PER_DAY = 86_400_000;

/** True when expires_at is in the past (UTC). Null/empty = never expires. */
export function isOmnichannelApiTokenExpired(expiresAt: string | null | undefined): boolean {
  if (!expiresAt) return false;
  const ts = new Date(expiresAt).getTime();
  return Number.isFinite(ts) && ts < Date.now();
}

export function computeTokenExpiresAt(expiresInDays: number): string | null {
  if (!Number.isFinite(expiresInDays) || expiresInDays <= 0) return null;
  return new Date(Date.now() + expiresInDays * MS_PER_DAY).toISOString();
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hashApiToken(plaintext: string): Promise<string> {
  return sha256Hex(plaintext);
}

export function generateApiTokenPlaintext(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const random = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `sk_omni_${random}`;
}

export function extractBearerToken(authHeader: string | null): string {
  if (!authHeader?.startsWith("Bearer ")) return "";
  return authHeader.slice("Bearer ".length).trim();
}

export async function authenticateOmnichannelApiToken(
  admin: SupabaseClient,
  req: Request,
): Promise<{ ctx: OmnichannelApiTokenContext; corsHeaders: Record<string, string> } | { error: Response }> {
  const origin = req.headers.get("Origin");
  const bearer = extractBearerToken(req.headers.get("Authorization"));

  if (!bearer || !bearer.startsWith("sk_omni_")) {
    const cors = buildCorsHeaders(origin, []);
    return {
      error: apiError("Token API tidak valid atau tidak ada.", "UNAUTHORIZED", 401, cors),
    };
  }

  const tokenHash = await hashApiToken(bearer);

  const { data: row, error } = await admin
    .from("organization_omnichannel_api_tokens")
    .select(
      "id, organization_id, web_id, allowed_origins, whatsapp_invoice_template_name, whatsapp_lead_template_name, is_active, expires_at, token_type",
    )
    .eq("token_hash", tokenHash)
    .maybeSingle();

  const allowedOrigins = Array.isArray(row?.allowed_origins)
    ? (row!.allowed_origins as string[])
    : [];
  const corsHeaders = buildCorsHeaders(origin, allowedOrigins);

  if (error || !row) {
    return {
      error: apiError("Token API tidak dikenali.", "UNAUTHORIZED", 401, corsHeaders),
    };
  }

  if (!row.is_active) {
    return {
      error: apiError("Token API telah dicabut.", "FORBIDDEN", 403, corsHeaders),
    };
  }

  if (isOmnichannelApiTokenExpired(row.expires_at)) {
    return {
      error: apiError("Token API sudah kedaluwarsa.", "FORBIDDEN", 403, corsHeaders),
    };
  }

  const rateErr = await checkRateLimit(admin, row.id, corsHeaders);
  if (rateErr) return { error: rateErr };

  void admin
    .from("organization_omnichannel_api_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", row.id);

  return {
    ctx: {
      tokenId: row.id,
      organizationId: row.organization_id,
      webId: row.web_id,
      allowedOrigins,
      whatsappInvoiceTemplateName: row.whatsapp_invoice_template_name ?? null,
      whatsappLeadTemplateName: row.whatsapp_lead_template_name ?? null,
      tokenType: normalizeTokenType(row.token_type),
    },
    corsHeaders,
  };
}

async function checkRateLimit(
  admin: SupabaseClient,
  tokenId: string,
  corsHeaders: Record<string, string>,
): Promise<Response | null> {
  const now = new Date();
  const windowStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours(), now.getUTCMinutes()),
  ).toISOString();

  const { data: existing } = await admin
    .from("organization_omnichannel_api_rate_limits")
    .select("request_count")
    .eq("token_id", tokenId)
    .eq("window_start", windowStart)
    .maybeSingle();

  const count = (existing?.request_count as number | undefined) ?? 0;
  if (count >= RATE_LIMIT_PER_MINUTE) {
    return apiError(
      "Batas permintaan terlampaui (100/menit). Coba lagi nanti.",
      "RATE_LIMITED",
      429,
      corsHeaders,
    );
  }

  await admin.from("organization_omnichannel_api_rate_limits").upsert(
    {
      token_id: tokenId,
      window_start: windowStart,
      request_count: count + 1,
    },
    { onConflict: "token_id,window_start" },
  );

  return null;
}

export function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}
