import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { OmnichannelApiTokenContext } from "../../_shared/omnichannelPublicApi/auth.ts";
import { scheduleAnalyticsRollupRefresh } from "../../_shared/omnichannelPublicApi/analyticsRollupDebounce.ts";
import { isUuid } from "../../_shared/omnichannelPublicApi/auth.ts";
import {
  ensureAnalyticsSessionForIngest,
  isSessionForeignKeyError,
  sessionNotReadyMessage,
  verifyAnalyticsSessionExists,
} from "../../_shared/omnichannelPublicApi/ensureAnalyticsSession.ts";
import { apiError, apiSuccess } from "../../_shared/omnichannelPublicApi/response.ts";
import {
  patchFloatingStubAttributionFromSession,
  syncFloatingWaClickToLead,
} from "../../_shared/omnichannelPublicApi/syncFloatingWaClickToLead.ts";
import { resolveClickPathFromPageView } from "../../_shared/omnichannelPublicApi/resolveClickPathFromPageView.ts";
import {
  coalesceUtm,
  mergeIncomingAttribution,
  parsePageUrl,
  resolveSessionMarketingAttribution,
  type SessionMarketingRow,
} from "../../_shared/omnichannelPublicApi/urlParams.ts";

async function insertPageViewWithSessionRetry(
  admin: SupabaseClient,
  ctx: OmnichannelApiTokenContext,
  params: {
    sessionId: string;
    visitorId: string;
    path: string;
    startedAt: string;
  },
): Promise<{ ok: true; pageViewId: string } | { ok: false; error: string; isFk: boolean }> {
  const pageViewId = crypto.randomUUID();
  const row = {
    id: pageViewId,
    session_id: params.sessionId,
    web_id: ctx.webId,
    visitor_id: params.visitorId,
    path: params.path,
    started_at: params.startedAt,
    active_ms: 0,
    scroll_max_pct: 0,
  };

  const { error } = await admin.from("analytics_page_views").insert(row);
  if (!error) return { ok: true, pageViewId };

  if (!isSessionForeignKeyError(error.message)) {
    return { ok: false, error: error.message, isFk: false };
  }

  const ensured = await ensureAnalyticsSessionForIngest(admin, ctx, {
    sessionId: params.sessionId,
    visitorId: params.visitorId,
  });
  if (!ensured.ok) {
    return { ok: false, error: ensured.error, isFk: true };
  }

  const retryId = crypto.randomUUID();
  const { error: retryErr } = await admin.from("analytics_page_views").insert({
    ...row,
    id: retryId,
  });
  if (retryErr) {
    return {
      ok: false,
      error: retryErr.message,
      isFk: isSessionForeignKeyError(retryErr.message),
    };
  }
  return { ok: true, pageViewId: retryId };
}

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
      .select(
        "id, utm_source, utm_medium, utm_campaign, utm_content, utm_term, first_utm_source, first_utm_medium, first_utm_campaign, first_utm_content, first_utm_term, last_utm_source, last_utm_medium, last_utm_campaign, last_utm_content, last_utm_term, gclid, fbclid, fbclid_captured_at, has_gclid, first_has_gclid, last_has_gclid, has_fbclid, first_has_fbclid, last_has_fbclid, has_msclkid, has_gbraid, has_wbraid",
      )
      .eq("id", sessionId)
      .maybeSingle();

    if (existingSession?.id) {
      const sessionPatch = mergeIncomingAttribution(existingSession, utm, {
        now,
        pageUrl,
        referrer,
        visitorId,
      });

      const { error: sessionErr } = await admin
        .from("analytics_sessions")
        .update(sessionPatch)
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
        fbclid_captured_at: utm.fbclid ? now : null,
      };

      const { error: sessionErr } = await admin.from("analytics_sessions").insert(sessionRow);
      if (sessionErr) {
        if (sessionErr.code === "23505") {
          const sessionPatch = mergeIncomingAttribution(
            (await admin
              .from("analytics_sessions")
              .select(
                "id, utm_source, utm_medium, utm_campaign, utm_content, utm_term, first_utm_source, first_utm_medium, first_utm_campaign, first_utm_content, first_utm_term, last_utm_source, last_utm_medium, last_utm_campaign, last_utm_content, last_utm_term, gclid, fbclid, fbclid_captured_at, has_gclid, first_has_gclid, last_has_gclid, has_fbclid, first_has_fbclid, last_has_fbclid, has_msclkid, has_gbraid, has_wbraid",
              )
              .eq("id", sessionId)
              .maybeSingle()).data ?? {},
            utm,
            { now, pageUrl, referrer, visitorId },
          );
          const { error: raceUpdErr } = await admin
            .from("analytics_sessions")
            .update(sessionPatch)
            .eq("id", sessionId);
          if (raceUpdErr) {
            console.error("handleTrafficLogs session race update:", raceUpdErr);
            return apiError("Gagal menyimpan sesi traffic.", "INTERNAL_ERROR", 500, corsHeaders, raceUpdErr.message);
          }
        } else {
          console.error("handleTrafficLogs session insert:", sessionErr);
          return apiError("Gagal menyimpan sesi traffic.", "INTERNAL_ERROR", 500, corsHeaders, sessionErr.message);
        }
      }
    }

    const sessionVerified = await verifyAnalyticsSessionExists(admin, sessionId);
    if (!sessionVerified) {
      console.error("handleTrafficLogs: session missing after write", { sessionId });
      return apiError("Gagal memverifikasi sesi traffic.", "INTERNAL_ERROR", 500, corsHeaders);
    }

    const pvResult = await insertPageViewWithSessionRetry(admin, ctx, {
      sessionId,
      visitorId,
      path,
      startedAt: now,
    });

    if (!pvResult.ok) {
      console.error("handleTrafficLogs page_view:", pvResult.error);
      if (pvResult.isFk) {
        return apiError(sessionNotReadyMessage(), "SESSION_NOT_READY", 422, corsHeaders);
      }
      return apiError("Gagal menyimpan page view.", "INTERNAL_ERROR", 500, corsHeaders, pvResult.error);
    }

    const pageViewId = pvResult.pageViewId;

    const { data: sessionForPatch } = await admin
      .from("analytics_sessions")
      .select("*")
      .eq("id", sessionId)
      .eq("web_id", ctx.webId)
      .maybeSingle();

    if (sessionForPatch) {
      await patchFloatingStubAttributionFromSession(
        admin,
        ctx.organizationId,
        ctx.webId,
        sessionId,
        sessionForPatch as SessionMarketingRow,
      );
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

async function insertClickEventWithSessionRetry(
  admin: SupabaseClient,
  ctx: OmnichannelApiTokenContext,
  body: Record<string, unknown>,
  sessionId: string,
  visitorId: string,
  path: string,
  pathClient: string | null,
  trackKey: string,
  clickAt: string,
): Promise<{ ok: true; clickId: string } | { ok: false; error: string; isFk: boolean }> {
  const buildRow = (clickId: string) => ({
    id: clickId,
    session_id: sessionId,
    web_id: ctx.webId,
    visitor_id: visitorId,
    path: path || "/",
    path_client: pathClient,
    created_at: clickAt,
    track_key: trackKey,
    element_type: body.element_type != null ? String(body.element_type) : null,
    element_label: body.element_label != null ? String(body.element_label) : null,
    target_url: body.target_url != null ? String(body.target_url) : null,
    is_internal: body.is_internal === true,
  });

  const clickId = crypto.randomUUID();
  const { error } = await admin.from("analytics_click_events").insert(buildRow(clickId));
  if (!error) return { ok: true, clickId };

  if (!isSessionForeignKeyError(error.message)) {
    return { ok: false, error: error.message, isFk: false };
  }

  const ensured = await ensureAnalyticsSessionForIngest(admin, ctx, { sessionId, visitorId });
  if (!ensured.ok) return { ok: false, error: ensured.error, isFk: true };

  const retryId = crypto.randomUUID();
  const { error: retryErr } = await admin.from("analytics_click_events").insert(buildRow(retryId));
  if (retryErr) {
    return {
      ok: false,
      error: retryErr.message,
      isFk: isSessionForeignKeyError(retryErr.message),
    };
  }
  return { ok: true, clickId: retryId };
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
    const clientPath = String(body.path ?? "/").trim() || "/";
    const trackKey = String(body.track_key ?? "").trim();
    const clickAt = new Date().toISOString();
    const pageViewId = body.page_view_id != null ? String(body.page_view_id).trim() : null;

    if (!isUuid(sessionId) || !isUuid(visitorId)) {
      return apiError("session_id dan visitor_id harus UUID valid.", "VALIDATION_ERROR", 422, corsHeaders);
    }
    if (!trackKey) {
      return apiError("track_key wajib diisi.", "VALIDATION_ERROR", 422, corsHeaders);
    }

    const ensured = await ensureAnalyticsSessionForIngest(admin, ctx, { sessionId, visitorId });
    if (!ensured.ok) {
      return apiError(sessionNotReadyMessage(), "SESSION_NOT_READY", 422, corsHeaders);
    }

    const resolved = await resolveClickPathFromPageView(admin, {
      sessionId,
      clientPath,
      clickAt,
      pageViewId: pageViewId && isUuid(pageViewId) ? pageViewId : null,
      targetUrl: body.target_url != null ? String(body.target_url) : null,
    });

    const insertResult = await insertClickEventWithSessionRetry(
      admin,
      ctx,
      body,
      sessionId,
      visitorId,
      resolved.path,
      resolved.pathClient,
      trackKey,
      clickAt,
    );

    if (!insertResult.ok) {
      console.error("handleClickEvents insert:", insertResult.error);
      if (insertResult.isFk) {
        return apiError(sessionNotReadyMessage(), "SESSION_NOT_READY", 422, corsHeaders);
      }
      return apiError("Gagal menyimpan click event.", "INTERNAL_ERROR", 500, corsHeaders, insertResult.error);
    }

    scheduleAnalyticsRollupRefresh(admin, ctx.webId);
    return apiSuccess({ click_event_id: insertResult.clickId }, 201, corsHeaders);
  } catch (e) {
    console.error("handleClickEvents:", e);
    return apiError("Kesalahan server saat click event.", "INTERNAL_ERROR", 500, corsHeaders);
  }
}

async function insertWaClickWithSessionRetry(
  admin: SupabaseClient,
  ctx: OmnichannelApiTokenContext,
  params: {
    sessionId: string;
    visitorId: string;
    path: string;
    targetUrl: string | null;
    targetPhone: string | null;
    attribution: Record<string, unknown>;
    gclid: string | null;
  },
): Promise<{ ok: true; waClickId: string } | { ok: false; error: string; isFk: boolean }> {
  const buildRow = (waClickId: string) => ({
    id: waClickId,
    web_id: ctx.webId,
    session_id: params.sessionId,
    path: params.path,
    target_url: params.targetUrl,
    phone_number: params.targetPhone || null,
    gclid: params.gclid,
    attribution: params.attribution,
    created_at: new Date().toISOString(),
  });

  const waClickId = crypto.randomUUID();
  const { error } = await admin.from("analytics_wa_clicks").insert(buildRow(waClickId));
  if (!error) return { ok: true, waClickId };

  if (!isSessionForeignKeyError(error.message)) {
    return { ok: false, error: error.message, isFk: false };
  }

  const ensured = await ensureAnalyticsSessionForIngest(admin, ctx, {
    sessionId: params.sessionId,
    visitorId: params.visitorId,
  });
  if (!ensured.ok) return { ok: false, error: ensured.error, isFk: true };

  const retryId = crypto.randomUUID();
  const { error: retryErr } = await admin.from("analytics_wa_clicks").insert(buildRow(retryId));
  if (retryErr) {
    return {
      ok: false,
      error: retryErr.message,
      isFk: isSessionForeignKeyError(retryErr.message),
    };
  }
  return { ok: true, waClickId: retryId };
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

    const clientPath = body.path != null ? String(body.path).trim() || "/" : "/";
    const targetUrl = body.target_url != null ? String(body.target_url).trim() : null;
    const targetPhone = body.target_phone != null ? String(body.target_phone).trim() : null;
    const clickAt = new Date().toISOString();
    const pageViewId = body.page_view_id != null ? String(body.page_view_id).trim() : null;

    const ensured = await ensureAnalyticsSessionForIngest(admin, ctx, { sessionId, visitorId });
    if (!ensured.ok) {
      return apiError(sessionNotReadyMessage(), "SESSION_NOT_READY", 422, corsHeaders);
    }

    const resolved = await resolveClickPathFromPageView(admin, {
      sessionId,
      clientPath,
      clickAt,
      pageViewId: pageViewId && isUuid(pageViewId) ? pageViewId : null,
      targetUrl: body.target_url != null ? String(body.target_url) : null,
    });
    const path = resolved.path;

    const marketing = resolveSessionMarketingAttribution(sessionId, ctx.webId, ensured.session);

    const attribution: Record<string, unknown> = {
      ...marketing.attribution,
      path,
      ...(resolved.pathClient ? { path_client: resolved.pathClient } : {}),
      target_url: targetUrl,
      visitor_id: visitorId,
    };

    const insertResult = await insertWaClickWithSessionRetry(admin, ctx, {
      sessionId,
      visitorId,
      path,
      targetUrl,
      targetPhone,
      attribution,
      gclid: marketing.gclid,
    });

    if (!insertResult.ok) {
      console.error("handleWaLinkClicks insert:", insertResult.error);
      if (insertResult.isFk) {
        return apiError(sessionNotReadyMessage(), "SESSION_NOT_READY", 422, corsHeaders);
      }
      return apiError("Gagal menyimpan WA link click.", "INTERNAL_ERROR", 500, corsHeaders, insertResult.error);
    }

    const waClickId = insertResult.waClickId;

    const syncResult = await syncFloatingWaClickToLead(admin, ctx, {
      sessionId,
      visitorId,
      path,
      targetUrl,
      targetPhone,
      waClickId,
    });

    scheduleAnalyticsRollupRefresh(admin, ctx.webId);

    const responseBody: Record<string, unknown> = {
      wa_click_id: waClickId,
      lead_sync_status: syncResult.ok ? "synced" : "failed",
    };
    if (syncResult.ok) {
      responseBody.lead_id = syncResult.leadId;
      responseBody.lead_created = syncResult.leadCreated;
    } else {
      responseBody.lead_sync_error = syncResult.error;
      console.error("handleWaLinkClicks lead sync failed:", syncResult.error);
    }

    return apiSuccess(responseBody, 201, corsHeaders);
  } catch (e) {
    console.error("handleWaLinkClicks:", e);
    return apiError("Kesalahan server saat WA link click.", "INTERNAL_ERROR", 500, corsHeaders);
  }
}

export { coalesceUtm, mergeIncomingAttribution, parsePageUrl };
