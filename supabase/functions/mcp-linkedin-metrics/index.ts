/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  credentialShape,
  describeOrganizationMembership,
  internalSecretMatches,
} from "../_shared/scheduledPosts/scheduledPostsInternalAuth.ts";
import {
  buildLinkedInPostUrl,
  fetchLinkedInFollowerCount,
  fetchLinkedInOrganizationPosts,
} from "../_shared/linkedinContentApi.ts";
import { resolveOrgLinkedInContentForMetrics } from "../_shared/linkedinContentOrgResolver.ts";
import { computeEngagementRate } from "../_shared/linkedinContentPlanMatcher.ts";

/**
 * Read-only LinkedIn Company Page organic metrics door for Synckerja MCP.
 * Personal profiles are excluded (insights scopes not grantable on this app).
 */

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_ROWS = 50;
const MAX_LOOKBACK_DAYS = 365;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function reject(reason: string, error: string, status: number, extra: Record<string, unknown> = {}): Response {
  console.error("mcp-linkedin-metrics: rejected", { reason, ...extra });
  return json({ error }, status);
}

function parseYmd(value: unknown): string | null {
  const text = String(value ?? "").trim();
  const match = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.exec(text);
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.toISOString().slice(0, 10) === text ? text : null;
}

function formatYmd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function defaultLast30Days(): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 29);
  return { start: formatYmd(start), end: formatYmd(end) };
}

function clampRange(startYmd: string, endYmd: string): { start: string; end: string } {
  const now = new Date();
  const minStart = new Date(now);
  minStart.setDate(minStart.getDate() - MAX_LOOKBACK_DAYS);
  let start = new Date(`${startYmd}T00:00:00.000Z`);
  let end = new Date(`${endYmd}T00:00:00.000Z`);
  if (start.getTime() < minStart.getTime()) start = minStart;
  if (start.getTime() > end.getTime()) start = end;
  return { start: formatYmd(start), end: formatYmd(end) };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "misconfigured" }, 500);

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "invalid_input" }, 400);
  }

  const secret = Deno.env.get("SCHEDULED_POSTS_INTERNAL_SECRET") ?? "";
  const provided = typeof body.internal_secret === "string" ? body.internal_secret : "";
  if (!secret) return reject("secret_missing", "misconfigured", 500);
  if (!internalSecretMatches(provided, secret)) {
    const header = req.headers.get("Authorization") ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
    return reject("secret_rejected", "forbidden: internal credential rejected", 403, {
      bearerShape: credentialShape(token),
    });
  }

  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const userId = String(body.mcp_user_id ?? "").trim();
  const organizationId = String(body.organization_id ?? "").trim();
  if (!uuid.test(userId) || !uuid.test(organizationId)) return json({ error: "invalid_input" }, 400);

  const defaults = defaultLast30Days();
  const rawStart = body.date_start == null || body.date_start === ""
    ? defaults.start
    : parseYmd(body.date_start);
  const rawEnd = body.date_end == null || body.date_end === ""
    ? defaults.end
    : parseYmd(body.date_end);
  if (!rawStart || !rawEnd || rawStart > rawEnd) return json({ error: "invalid_input" }, 400);
  const { start: dateStart, end: dateEnd } = clampRange(rawStart, rawEnd);
  const pageIdParam = body.page_id != null ? String(body.page_id).trim() : "";
  const limitRaw = body.limit == null ? 25 : Number(body.limit);
  if (!Number.isInteger(limitRaw) || limitRaw < 1 || limitRaw > MAX_ROWS) {
    return json({ error: "invalid_input" }, 400);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const membership = await describeOrganizationMembership(admin, userId, organizationId);
  if (membership.state === "policy") return reject("database_policy", "forbidden: database policy denied", 403);
  if (membership.state === "query_failed") return reject("database_query_failed", "linkedin_metrics_unavailable", 500);
  if (membership.state !== "active") {
    return reject("membership", "forbidden: organization mismatch", 403, { organizationId });
  }

  let accountQuery = admin
    .from("organization_linkedin_content_accounts")
    .select("page_id, label, display_name, account_kind, is_default, sort_order")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .limit(20);
  if (pageIdParam) accountQuery = accountQuery.eq("page_id", pageIdParam);

  const { data: accountRows, error: accountErr } = await accountQuery;
  if (accountErr) return reject("account_lookup_failed", "linkedin_metrics_unavailable", 500);

  const orgAccounts = ((accountRows ?? []) as Array<{
    page_id?: string;
    label?: string | null;
    display_name?: string | null;
    account_kind?: string | null;
    is_default?: boolean;
  }>).filter((row) => String(row.account_kind ?? "organization") !== "person");

  if (orgAccounts.length === 0) {
    return json({
      period: { start: dateStart, end: dateEnd, time_zone: "Asia/Jakarta" },
      accounts: [],
      count: 0,
      how_to_read:
        "No LinkedIn Company Page is connected for this organization. Personal profiles are excluded from organic insights.",
    });
  }

  const accounts = [];
  for (const row of orgAccounts) {
    const pageId = String(row.page_id ?? "").trim();
    if (!pageId) continue;
    const label = String(row.display_name ?? row.label ?? pageId);
    try {
      const resolved = await resolveOrgLinkedInContentForMetrics(admin, organizationId, pageId);
      if (!resolved) {
        accounts.push({
          page_id: pageId,
          account_label: label,
          status: "error",
          error: "LinkedIn page token missing — reconnect Company Page in settings",
          summary: null,
          posts: [],
        });
        continue;
      }
      const { accessToken } = resolved;
      const [posts, followers] = await Promise.all([
        fetchLinkedInOrganizationPosts(accessToken, pageId, dateStart, dateEnd),
        fetchLinkedInFollowerCount(accessToken, pageId),
      ]);
      const rows = posts.map((p) => {
        const engagement = computeEngagementRate(p);
        return {
          post_id: String(p.id ?? ""),
          title: String(p.title ?? "").slice(0, 280),
          share_url: p.id ? buildLinkedInPostUrl(String(p.id)) : null,
          posted_at: p.published_at ?? null,
          views: Number(p.view_count ?? 0) || 0,
          likes: Number(p.like_count ?? 0) || 0,
          comments: Number(p.comment_count ?? 0) || 0,
          shares: Number(p.share_count ?? 0) || 0,
          engagement_rate: engagement,
        };
      });
      const summary = {
        followers: followers,
        post_count: rows.length,
        total_views: rows.reduce((s, r) => s + r.views, 0),
        total_likes: rows.reduce((s, r) => s + r.likes, 0),
        total_comments: rows.reduce((s, r) => s + r.comments, 0),
        total_shares: rows.reduce((s, r) => s + r.shares, 0),
        avg_engagement_rate: (() => {
          const withRate = rows.filter((r) => r.engagement_rate != null);
          if (withRate.length === 0) return null;
          return withRate.reduce((s, r) => s + Number(r.engagement_rate), 0) / withRate.length;
        })(),
      };
      accounts.push({
        page_id: pageId,
        account_label: label,
        status: "ok",
        error: null,
        summary,
        posts: rows.slice(0, limitRaw),
        posts_truncated: rows.length > limitRaw,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      accounts.push({
        page_id: pageId,
        account_label: label,
        status: "error",
        error: msg.slice(0, 240),
        summary: null,
        posts: [],
      });
    }
  }

  return json({
    period: { start: dateStart, end: dateEnd, time_zone: "Asia/Jakarta" },
    how_to_read:
      "Organic LinkedIn Company Page metrics for the period (Asia/Jakarta days). followers is page audience; posts are author finder results in range with views/likes/comments/shares. Personal LinkedIn profiles are not included. engagement_rate is (likes+comments+shares)/views*100 when views > 0. Reconnect the Company Page in Synckerja if status is error after connecting a personal profile.",
    count: accounts.length,
    accounts,
  });
});
