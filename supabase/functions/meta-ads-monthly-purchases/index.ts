/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const PURCHASE_TYPES = ["omni_purchase", "purchase"] as const;
const META_ADS_MAX_LOOKBACK_MONTHS = 37;
const INSIGHTS_ATTRIBUTION_PARAMS = "use_unified_attribution_setting=true";

type MonthWindow = { year: number; month: number; start: string; end: string };

function json(body: object, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function formatDateYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseYmd(ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfDayLocal(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function clampRange(startYmd: string, endYmd: string, now: Date): { start: string; end: string } {
  const today = startOfDayLocal(now);
  const minStart = new Date(
    today.getFullYear(),
    today.getMonth() - META_ADS_MAX_LOOKBACK_MONTHS,
    today.getDate(),
  );
  let start = parseYmd(startYmd) ?? minStart;
  let end = parseYmd(endYmd) ?? today;
  start = startOfDayLocal(start);
  end = startOfDayLocal(end);
  if (start.getTime() < minStart.getTime()) start = minStart;
  if (start.getTime() > end.getTime()) start = end;
  return { start: formatDateYmd(start), end: formatDateYmd(end) };
}

function buildMonthWindows(startYmd: string, endYmd: string): MonthWindow[] {
  const rangeStart = parseYmd(startYmd);
  const rangeEnd = parseYmd(endYmd);
  if (!rangeStart || !rangeEnd || rangeStart.getTime() > rangeEnd.getTime()) return [];
  const windows: MonthWindow[] = [];
  let cursor = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1);
  while (cursor.getTime() <= rangeEnd.getTime()) {
    const y = cursor.getFullYear();
    const m = cursor.getMonth();
    const monthStart = startOfDayLocal(new Date(y, m, 1));
    const monthEnd = startOfDayLocal(new Date(y, m + 1, 0));
    const winStart = monthStart.getTime() < rangeStart.getTime() ? rangeStart : monthStart;
    const winEnd = monthEnd.getTime() > rangeEnd.getTime() ? rangeEnd : monthEnd;
    windows.push({
      year: y,
      month: m + 1,
      start: formatDateYmd(winStart),
      end: formatDateYmd(winEnd),
    });
    cursor = new Date(y, m + 1, 1);
  }
  return windows;
}

function periodKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function actId(adAccountId: string): string {
  const digits = adAccountId.replace(/\D/g, "");
  return digits.startsWith("act_") ? digits : `act_${digits}`;
}

function purchaseCount(actions: unknown): number {
  if (!Array.isArray(actions)) return 0;
  for (const type of PURCHASE_TYPES) {
    const hit = actions.find(
      (row) => row && typeof row === "object" && String((row as { action_type?: string }).action_type ?? "") === type,
    ) as { value?: unknown } | undefined;
    if (!hit) continue;
    const n = Number(String(hit.value ?? "").replace(/,/g, ""));
    return Number.isFinite(n) ? Math.round(n) : 0;
  }
  return 0;
}

function decodeKey(raw: string): Uint8Array {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("META_ADS_CONFIG_ENCRYPTION_KEY is not set");
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    const bytes = new Uint8Array(32);
    for (let i = 0; i < 32; i++) bytes[i] = parseInt(trimmed.slice(i * 2, i * 2 + 2), 16);
    return bytes;
  }
  const bin = atob(trimmed);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  if (bytes.length !== 32) throw new Error("META_ADS_CONFIG_ENCRYPTION_KEY must be 32 bytes");
  return bytes;
}

async function decryptToken(ciphertextB64: string): Promise<string> {
  const keyBytes = decodeKey(Deno.env.get("META_ADS_CONFIG_ENCRYPTION_KEY") ?? "");
  const bin = atob(ciphertextB64.trim());
  const combined = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) combined[i] = bin.charCodeAt(i);
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["decrypt"]);
  const dec = await crypto.subtle.decrypt({ name: "AES-GCM", iv, tagLength: 128 }, key, data);
  return new TextDecoder().decode(dec);
}

async function fetchMonthlyPurchases(
  act: string,
  accessToken: string,
  windows: MonthWindow[],
): Promise<Array<{ year: number; month: number; platform_results: number }>> {
  const totals = new Map<string, number>();
  for (const w of windows) totals.set(periodKey(w.year, w.month), 0);
  if (windows.length === 0) return [];

  const since = windows[0]!.start;
  const until = windows[windows.length - 1]!.end;
  const graphVersion = Deno.env.get("META_GRAPH_API_VERSION")?.trim() || "v22.0";
  const fields = "date_start,catalog_segment_actions";
  const filtering = encodeURIComponent(JSON.stringify([
    { field: "ad.effective_status", operator: "NOT_IN", value: ["DELETED", "ARCHIVED"] },
  ]));
  const timeRange = encodeURIComponent(JSON.stringify({ since, until }));
  let path =
    `${act}/insights?fields=${fields}&level=ad&${INSIGHTS_ATTRIBUTION_PARAMS}&filtering=${filtering}&time_increment=monthly&time_range=${timeRange}&limit=500`;

  for (let page = 0; page < 50; page++) {
    const url =
      `https://graph.facebook.com/${graphVersion}/${path}&access_token=${encodeURIComponent(accessToken)}`;
    const res = await fetch(url);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = (body as { error?: { message?: string } })?.error?.message ?? `HTTP ${res.status}`;
      throw new Error(msg);
    }
    for (const row of (body as { data?: unknown[] }).data ?? []) {
      const r = row as { date_start?: string; catalog_segment_actions?: unknown };
      const match = /^(\d{4})-(\d{2})/.exec(String(r.date_start ?? ""));
      if (!match) continue;
      const key = periodKey(Number(match[1]), Number(match[2]));
      if (!totals.has(key)) continue;
      totals.set(key, (totals.get(key) ?? 0) + purchaseCount(r.catalog_segment_actions));
    }
    const after = (body as { paging?: { cursors?: { after?: string } } }).paging?.cursors?.after;
    if (!after) break;
    path =
      `${act}/insights?fields=${fields}&level=ad&${INSIGHTS_ATTRIBUTION_PARAMS}&filtering=${filtering}&time_increment=monthly&time_range=${timeRange}&limit=500&after=${encodeURIComponent(after)}`;
  }

  return windows.map((w) => ({
    year: w.year,
    month: w.month,
    platform_results: totals.get(periodKey(w.year, w.month)) ?? 0,
  }));
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "Server misconfigured" }, 500);

  const appId = Deno.env.get("META_ADS_APP_ID")?.trim() || Deno.env.get("META_APP_ID")?.trim() || "";
  const appSecret = Deno.env.get("META_ADS_APP_SECRET")?.trim() || Deno.env.get("META_APP_SECRET")?.trim() || "";
  if (!appId || !appSecret) return json({ error: "Meta Ads is not configured on the server" }, 503);

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : "";
  if (!token) return json({ error: "Unauthorized" }, 401);
  const { data: userRes, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userRes?.user?.id) return json({ error: "Invalid token" }, 401);

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const organizationId = String(body.organization_id ?? "").trim();
  if (!organizationId) return json({ error: "Missing organization_id" }, 400);

  const { data: profile } = await admin
    .from("profiles")
    .select("active_organization_id")
    .eq("user_id", userRes.user.id)
    .maybeSingle();
  const activeOrg = profile?.active_organization_id != null ? String(profile.active_organization_id) : "";
  if (!activeOrg || activeOrg !== organizationId) return json({ error: "Forbidden" }, 403);

  const { data: tokenRow } = await admin
    .from("organization_meta_ads_connection_tokens")
    .select("access_token_enc")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!tokenRow?.access_token_enc) return json({ error: "Meta Ads not connected or no account configured" }, 400);

  let accessToken: string;
  try {
    accessToken = await decryptToken(String(tokenRow.access_token_enc));
  } catch (e) {
    console.error("meta-ads-monthly-purchases decrypt:", e);
    return json({ error: "Meta Ads not connected or no account configured" }, 400);
  }

  const { data: connection } = await admin
    .from("organization_meta_ads_connections")
    .select("oauth_connected_at")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!connection?.oauth_connected_at) return json({ error: "Meta Ads not connected or no account configured" }, 400);

  const requestedAccount = body.ad_account_id != null ? String(body.ad_account_id).replace(/\D/g, "") : "";
  let accountQuery = admin
    .from("organization_meta_ads_accounts")
    .select("ad_account_id")
    .eq("organization_id", organizationId)
    .eq("is_active", true);
  if (requestedAccount) accountQuery = accountQuery.eq("ad_account_id", requestedAccount);
  else accountQuery = accountQuery.eq("is_default", true);
  const { data: account } = await accountQuery.maybeSingle();
  const adAccountId = String(account?.ad_account_id ?? "");
  if (!adAccountId) return json({ error: "Meta Ads not connected or no account configured" }, 400);

  const now = new Date();
  const yearRaw = Number(body.year);
  const year = Number.isFinite(yearRaw) ? Math.floor(yearRaw) : now.getFullYear();
  const start = String(body.date_start ?? `${year}-01-01`).trim();
  const end = String(
    body.date_end ?? (year === now.getFullYear() ? formatDateYmd(now) : `${year}-12-31`),
  ).trim();
  const { start: dateStart, end: dateEnd } = clampRange(start, end, now);

  try {
    const months = await fetchMonthlyPurchases(actId(adAccountId), accessToken, buildMonthWindows(dateStart, dateEnd));
    return json({ months, ad_account_id: adAccountId, date_start: dateStart, date_end: dateEnd }, 200);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load monthly purchases";
    return json({ error: msg }, 400);
  }
});
