import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { OmnichannelApiTokenContext } from "./auth.ts";
import {
  coalesceUtm,
  mergeIncomingAttribution,
  parsePageUrl,
  type SessionMarketingRow,
} from "./urlParams.ts";

export const SESSION_ATTRIBUTION_SELECT =
  "id, utm_source, utm_medium, utm_campaign, utm_content, utm_term, first_utm_source, first_utm_medium, first_utm_campaign, first_utm_content, first_utm_term, last_utm_source, last_utm_medium, last_utm_campaign, last_utm_content, last_utm_term, gclid, fbclid, fbclid_captured_at, has_gclid, first_has_gclid, last_has_gclid, has_fbclid, first_has_fbclid, last_has_fbclid, has_msclkid, has_gbraid, has_wbraid, landing_url, first_landing_url, last_landing_url, started_at";

export type EnsureAnalyticsSessionParams = {
  sessionId: string;
  visitorId: string;
  pageUrl?: string | null;
  referrer?: string | null;
};

export type EnsureAnalyticsSessionResult =
  | { ok: true; session: SessionMarketingRow }
  | { ok: false; error: string };

const SESSION_NOT_READY_MESSAGE =
  "Sesi analytics belum tersedia. Pastikan POST /traffic-logs sukses untuk session_id ini, lalu coba lagi.";

export function isSessionForeignKeyError(message: string | undefined | null): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  return (
    m.includes("analytics_click_events_session_id_fkey") ||
    m.includes("analytics_wa_clicks_session_id_fkey") ||
    m.includes("analytics_page_views_session_id_fkey") ||
    (m.includes("foreign key") && m.includes("session_id"))
  );
}

export function sessionNotReadyMessage(): string {
  return SESSION_NOT_READY_MESSAGE;
}

async function loadSessionRow(
  admin: SupabaseClient,
  sessionId: string,
  webId: string,
): Promise<SessionMarketingRow | null> {
  const { data } = await admin
    .from("analytics_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("web_id", webId)
    .maybeSingle();
  return (data as SessionMarketingRow | null) ?? null;
}

/** Upsert minimal analytics_sessions row so child FK inserts succeed. */
export async function ensureAnalyticsSessionForIngest(
  admin: SupabaseClient,
  ctx: OmnichannelApiTokenContext,
  params: EnsureAnalyticsSessionParams,
): Promise<EnsureAnalyticsSessionResult> {
  const { sessionId, visitorId, pageUrl, referrer } = params;
  const now = new Date().toISOString();
  const webId = ctx.webId;

  const existing = await loadSessionRow(admin, sessionId, webId);
  if (existing) {
    const { error: updErr } = await admin
      .from("analytics_sessions")
      .update({
        last_seen_at: now,
        visitor_id: visitorId,
        ...(pageUrl ? { last_landing_url: pageUrl } : {}),
        ...(referrer !== undefined ? { last_referrer: referrer } : {}),
      })
      .eq("id", sessionId)
      .eq("web_id", webId);

    if (updErr) {
      console.error("ensureAnalyticsSessionForIngest update:", updErr);
      return { ok: false, error: updErr.message };
    }

    const refreshed = await loadSessionRow(admin, sessionId, webId);
    if (refreshed) return { ok: true, session: refreshed };
    return { ok: false, error: "Session row missing after update." };
  }

  const insertRow: Record<string, unknown> = {
    id: sessionId,
    web_id: webId,
    visitor_id: visitorId,
    started_at: now,
    last_seen_at: now,
  };
  if (pageUrl) {
    insertRow.landing_url = pageUrl;
    insertRow.first_landing_url = pageUrl;
    insertRow.last_landing_url = pageUrl;
  }
  if (referrer !== undefined && referrer !== null) {
    insertRow.referrer = referrer;
    insertRow.first_referrer = referrer;
    insertRow.last_referrer = referrer;
  }

  const { error: insErr } = await admin.from("analytics_sessions").insert(insertRow);

  if (insErr) {
    if (insErr.code === "23505") {
      const raced = await loadSessionRow(admin, sessionId, webId);
      if (raced) return { ok: true, session: raced };
    }
    console.error("ensureAnalyticsSessionForIngest insert:", insErr);
    return { ok: false, error: insErr.message };
  }

  const created = await loadSessionRow(admin, sessionId, webId);
  if (!created) return { ok: false, error: "Session row missing after insert." };
  return { ok: true, session: created };
}

/** Merge UTM / click IDs from landing URL into an existing analytics session (wa-link-clicks race-safe). */
export async function mergeSessionAttributionFromPageContext(
  admin: SupabaseClient,
  webId: string,
  params: {
    sessionId: string;
    visitorId: string;
    pageUrl?: string | null;
    referrer?: string | null;
    body?: Record<string, unknown>;
  },
): Promise<SessionMarketingRow | null> {
  const { sessionId, visitorId, referrer, body = {} } = params;
  const pageUrl = params.pageUrl != null ? String(params.pageUrl).trim() : "";
  const parsed = pageUrl ? parsePageUrl(pageUrl) : null;
  const utm = coalesceUtm(body, parsed);
  const hasAttribution =
    Boolean(utm.fbclid) ||
    Boolean(utm.gclid) ||
    Boolean(utm.utm_source) ||
    Boolean(utm.utm_medium) ||
    Boolean(utm.utm_campaign) ||
    Boolean(pageUrl);

  if (!hasAttribution) {
    return loadSessionRow(admin, sessionId, webId);
  }

  const now = new Date().toISOString();

  const { data: existingSession } = await admin
    .from("analytics_sessions")
    .select(SESSION_ATTRIBUTION_SELECT)
    .eq("id", sessionId)
    .eq("web_id", webId)
    .maybeSingle();

  if (!existingSession?.id) return null;

  const sessionPatch = mergeIncomingAttribution(existingSession, utm, {
    now,
    pageUrl: pageUrl || String(existingSession.last_landing_url ?? existingSession.landing_url ?? ""),
    referrer: referrer ?? null,
    visitorId,
  });

  const { error } = await admin
    .from("analytics_sessions")
    .update(sessionPatch)
    .eq("id", sessionId)
    .eq("web_id", webId);

  if (error) {
    console.warn("mergeSessionAttributionFromPageContext:", error);
    return null;
  }

  return loadSessionRow(admin, sessionId, webId);
}

/** Post-write check before traffic-logs returns 201. */
export async function verifyAnalyticsSessionExists(
  admin: SupabaseClient,
  sessionId: string,
): Promise<boolean> {
  const { data } = await admin
    .from("analytics_sessions")
    .select("id")
    .eq("id", sessionId)
    .maybeSingle();
  return Boolean(data?.id);
}
