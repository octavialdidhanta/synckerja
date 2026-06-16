import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { OmnichannelApiTokenContext } from "../../_shared/omnichannelPublicApi/auth.ts";
import { scheduleAnalyticsRollupRefresh } from "../../_shared/omnichannelPublicApi/analyticsRollupDebounce.ts";
import { isUuid } from "../../_shared/omnichannelPublicApi/auth.ts";
import { apiError, apiSuccess } from "../../_shared/omnichannelPublicApi/response.ts";
import { buildAttributionLabel, coalesceUtm, parsePageUrl } from "../../_shared/omnichannelPublicApi/urlParams.ts";

export async function handleTrafficLogs(
  admin: SupabaseClient,
  ctx: OmnichannelApiTokenContext,
  body: Record<string, unknown>,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  try {
    const sessionId = String(body.session_id ?? "").trim();
    const visitorId = String(body.visitor_id ?? "").trim();
    const pageUrl = String(body.page_url ?? "").trim();
    const referrer = body.referrer != null ? String(body.referrer).trim() : null;

    if (!isUuid(sessionId)) {
      return apiError("session_id harus UUID valid.", "VALIDATION_ERROR", 422, corsHeaders);
    }
    if (!isUuid(visitorId)) {
      return apiError("visitor_id harus UUID valid.", "VALIDATION_ERROR", 422, corsHeaders);
    }
    if (!pageUrl) {
      return apiError("page_url wajib diisi.", "VALIDATION_ERROR", 422, corsHeaders);
    }

    const parsed = parsePageUrl(pageUrl);
    const utm = coalesceUtm(body, parsed);
    const now = new Date().toISOString();
    const path = parsed?.path ?? "/";

    const { data: existingSession } = await admin
      .from("analytics_sessions")
      .select("id")
      .eq("id", sessionId)
      .maybeSingle();

    if (existingSession?.id) {
      const { error: sessionErr } = await admin
        .from("analytics_sessions")
        .update({
          last_seen_at: now,
          last_landing_url: pageUrl,
          last_referrer: referrer,
          last_utm_source: utm.utm_source,
          last_utm_medium: utm.utm_medium,
          last_utm_campaign: utm.utm_campaign,
          last_utm_content: utm.utm_content,
          last_utm_term: utm.utm_term,
          last_has_gclid: Boolean(utm.gclid),
          has_gclid: Boolean(utm.gclid),
          last_has_fbclid: Boolean(utm.fbclid),
          has_fbclid: Boolean(utm.fbclid),
          has_msclkid: Boolean(utm.msclkid),
          has_gbraid: Boolean(utm.gbraid),
          has_wbraid: Boolean(utm.wbraid),
          gclid: utm.gclid ?? undefined,
          fbclid: utm.fbclid ?? undefined,
          visitor_id: visitorId,
        })
        .eq("id", sessionId);

      if (sessionErr) {
        console.error("handleTrafficLogs session update:", sessionErr);
        return apiError("Gagal memperbarui sesi traffic.", "INTERNAL_ERROR", 500, corsHeaders, sessionErr.message);
      }
    } else {
      const sessionRow = {
        id: sessionId,
        web_id: ctx.webId,
        visitor_id: visitorId,
        started_at: now,
        last_seen_at: now,
        landing_url: pageUrl,
        first_landing_url: pageUrl,
        last_landing_url: pageUrl,
        referrer,
        first_referrer: referrer,
        last_referrer: referrer,
        utm_source: utm.utm_source,
        utm_medium: utm.utm_medium,
        utm_campaign: utm.utm_campaign,
        utm_content: utm.utm_content,
        utm_term: utm.utm_term,
        first_utm_source: utm.utm_source,
        first_utm_medium: utm.utm_medium,
        first_utm_campaign: utm.utm_campaign,
        first_utm_content: utm.utm_content,
        first_utm_term: utm.utm_term,
        last_utm_source: utm.utm_source,
        last_utm_medium: utm.utm_medium,
        last_utm_campaign: utm.utm_campaign,
        last_utm_content: utm.utm_content,
        last_utm_term: utm.utm_term,
        gclid: utm.gclid,
        fbclid: utm.fbclid,
        has_gclid: Boolean(utm.gclid),
        first_has_gclid: Boolean(utm.gclid),
        last_has_gclid: Boolean(utm.gclid),
        has_fbclid: Boolean(utm.fbclid),
        first_has_fbclid: Boolean(utm.fbclid),
        last_has_fbclid: Boolean(utm.fbclid),
        has_msclkid: Boolean(utm.msclkid),
        has_gbraid: Boolean(utm.gbraid),
        has_wbraid: Boolean(utm.wbraid),
      };

      const { error: sessionErr } = await admin.from("analytics_sessions").insert(sessionRow);
      if (sessionErr) {
        console.error("handleTrafficLogs session insert:", sessionErr);
        return apiError("Gagal menyimpan sesi traffic.", "INTERNAL_ERROR", 500, corsHeaders, sessionErr.message);
      }
    }

    const pageViewId = crypto.randomUUID();
    const { error: pvErr } = await admin.from("analytics_page_views").insert({
      id: pageViewId,
      session_id: sessionId,
      web_id: ctx.webId,
      visitor_id: visitorId,
      path,
      started_at: now,
      active_ms: 0,
      scroll_max_pct: 0,
    });

    if (pvErr) {
      console.error("handleTrafficLogs page_view:", pvErr);
      return apiError("Gagal menyimpan page view.", "INTERNAL_ERROR", 500, corsHeaders, pvErr.message);
    }

    scheduleAnalyticsRollupRefresh(admin, ctx.webId);

    return apiSuccess(
      {
        session_id: sessionId,
        page_view_id: pageViewId,
        visitor_id: visitorId,
        web_id: ctx.webId,
      },
      201,
      corsHeaders,
    );
  } catch (e) {
    console.error("handleTrafficLogs:", e);
    return apiError("Kesalahan server saat mencatat traffic.", "INTERNAL_ERROR", 500, corsHeaders);
  }
}

export async function handlePageViewHeartbeat(
  admin: SupabaseClient,
  ctx: OmnichannelApiTokenContext,
  body: Record<string, unknown>,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  try {
    const pageViewId = String(body.page_view_id ?? "").trim();
    if (!isUuid(pageViewId)) {
      return apiError("page_view_id harus UUID valid.", "VALIDATION_ERROR", 422, corsHeaders);
    }

    const activeMs = Math.max(0, Number(body.active_ms ?? 0));
    const scrollMax = Math.min(100, Math.max(0, Number(body.scroll_max_pct ?? 0)));
    const endedAt = body.ended_at != null ? String(body.ended_at) : null;

    const patch: Record<string, unknown> = {
      active_ms: activeMs,
      scroll_max_pct: scrollMax,
    };
    if (endedAt) patch.ended_at = endedAt;

    const { error } = await admin
      .from("analytics_page_views")
      .update(patch)
      .eq("id", pageViewId)
      .eq("web_id", ctx.webId);

    if (error) {
      return apiError("Gagal memperbarui heartbeat.", "INTERNAL_ERROR", 500, corsHeaders, error.message);
    }

    scheduleAnalyticsRollupRefresh(admin, ctx.webId);
    return apiSuccess({ page_view_id: pageViewId }, 200, corsHeaders);
  } catch (e) {
    console.error("handlePageViewHeartbeat:", e);
    return apiError("Kesalahan server saat heartbeat.", "INTERNAL_ERROR", 500, corsHeaders);
  }
}

export async function handleClickEvents(
  admin: SupabaseClient,
  ctx: OmnichannelApiTokenContext,
  body: Record<string, unknown>,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  try {
    const sessionId = String(body.session_id ?? "").trim();
    const visitorId = String(body.visitor_id ?? "").trim();
    const path = String(body.path ?? "/").trim();
    const trackKey = String(body.track_key ?? "").trim();

    if (!isUuid(sessionId) || !isUuid(visitorId)) {
      return apiError("session_id dan visitor_id harus UUID valid.", "VALIDATION_ERROR", 422, corsHeaders);
    }
    if (!trackKey) {
      return apiError("track_key wajib diisi.", "VALIDATION_ERROR", 422, corsHeaders);
    }

    const clickId = crypto.randomUUID();
    const { error } = await admin.from("analytics_click_events").insert({
      id: clickId,
      session_id: sessionId,
      web_id: ctx.webId,
      visitor_id: visitorId,
      path: path || "/",
      created_at: new Date().toISOString(),
      track_key: trackKey,
      element_type: body.element_type != null ? String(body.element_type) : null,
      element_label: body.element_label != null ? String(body.element_label) : null,
      target_url: body.target_url != null ? String(body.target_url) : null,
      is_internal: body.is_internal === true,
    });

    if (error) {
      return apiError("Gagal menyimpan click event.", "INTERNAL_ERROR", 500, corsHeaders, error.message);
    }

    scheduleAnalyticsRollupRefresh(admin, ctx.webId);
    return apiSuccess({ click_event_id: clickId }, 201, corsHeaders);
  } catch (e) {
    console.error("handleClickEvents:", e);
    return apiError("Kesalahan server saat click event.", "INTERNAL_ERROR", 500, corsHeaders);
  }
}

export async function handleWaLinkClicks(
  admin: SupabaseClient,
  ctx: OmnichannelApiTokenContext,
  body: Record<string, unknown>,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  try {
    const sessionId = String(body.session_id ?? "").trim();
    const visitorId = String(body.visitor_id ?? "").trim();
    if (!isUuid(sessionId) || !isUuid(visitorId)) {
      return apiError("session_id dan visitor_id harus UUID valid.", "VALIDATION_ERROR", 422, corsHeaders);
    }

    const path = body.path != null ? String(body.path).trim() || "/" : "/";
    const targetUrl = body.target_url != null ? String(body.target_url).trim() : null;

    let attribution: Record<string, unknown> = {
      path,
      target_url: targetUrl,
      visitor_id: visitorId,
    };

    const { data: session } = await admin
      .from("analytics_sessions")
      .select("utm_source, utm_medium, utm_campaign, gclid, fbclid, landing_url")
      .eq("id", sessionId)
      .eq("web_id", ctx.webId)
      .maybeSingle();

    if (session) {
      attribution = { ...attribution, ...session };
    }

    const waClickId = crypto.randomUUID();
    const { error } = await admin.from("analytics_wa_clicks").insert({
      id: waClickId,
      web_id: ctx.webId,
      session_id: sessionId,
      path,
      target_url: targetUrl,
      phone_number: body.target_phone != null ? String(body.target_phone) : null,
      gclid: session?.gclid ?? null,
      attribution,
      created_at: new Date().toISOString(),
    });

    if (error) {
      return apiError("Gagal menyimpan WA link click.", "INTERNAL_ERROR", 500, corsHeaders, error.message);
    }

    scheduleAnalyticsRollupRefresh(admin, ctx.webId);
    return apiSuccess({ wa_click_id: waClickId }, 201, corsHeaders);
  } catch (e) {
    console.error("handleWaLinkClicks:", e);
    return apiError("Kesalahan server saat WA link click.", "INTERNAL_ERROR", 500, corsHeaders);
  }
}

export { buildAttributionLabel, coalesceUtm, parsePageUrl };
