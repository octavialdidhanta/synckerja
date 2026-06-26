import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { OmnichannelApiTokenContext } from "./auth.ts";
import {
  API_LEAD_SOURCE_WHATSAPP_BUTTON,
  deriveApiLeadCrmFields,
  isFloatingWaLeadSource,
  LEGACY_FLOATING_WA_LEAD_SOURCE,
} from "./apiLeadCrmFields.ts";
import {
  getOrCreateSystemActor,
  resolveLeadStatusId,
} from "./leadStatusMap.ts";
import {
  ensureAnalyticsSessionForIngest,
} from "./ensureAnalyticsSession.ts";
import {
  resolveSessionMarketingAttribution,
  type SessionMarketingRow,
} from "./urlParams.ts";

/** @deprecated import API_LEAD_SOURCE_WHATSAPP_BUTTON from apiLeadCrmFields */
export const FLOATING_WA_LEAD_SOURCE = API_LEAD_SOURCE_WHATSAPP_BUTTON;

const FLOATING_WA_CLIENT = "Website visitor";

export type SyncFloatingWaClickParams = {
  sessionId: string;
  visitorId: string;
  path: string;
  targetUrl: string | null;
  targetPhone: string | null;
  waClickId: string;
};

export type SyncFloatingWaClickResult =
  | { ok: true; leadId: string; leadCreated: boolean }
  | { ok: false; error: string };

export type FloatingStubLeadRef = {
  leadId: string;
  submissionId: string | null;
};

export async function findFloatingStubLead(
  admin: SupabaseClient,
  organizationId: string,
  webId: string,
  sessionId: string,
): Promise<FloatingStubLeadRef | null> {
  const { data: lead, error: leadErr } = await admin
    .from("leads")
    .select("id, source")
    .eq("organization_id", organizationId)
    .eq("web_id", webId)
    .eq("analytics_session_id", sessionId)
    .maybeSingle();

  if (leadErr || !lead?.id) return null;

  const isFloatingSource = isFloatingWaLeadSource(lead.source);

  const { data: drafts } = await admin
    .from("lead_submissions")
    .select("id, form_data, status")
    .eq("lead_id", lead.id)
    .eq("organization_id", organizationId)
    .eq("status", "draft")
    .eq("is_active", true);

  const floatingDraft = (drafts ?? []).find((row) => {
    const fd = row.form_data as Record<string, unknown> | null;
    return fd?.source === "floating_whatsapp";
  });

  if (!isFloatingSource && !floatingDraft) return null;

  return {
    leadId: String(lead.id),
    submissionId: floatingDraft?.id != null ? String(floatingDraft.id) : null,
  };
}

/** Backfill attribution on floating stub when traffic-logs arrives after wa-link-clicks. */
export async function patchFloatingStubAttributionFromSession(
  admin: SupabaseClient,
  organizationId: string,
  webId: string,
  sessionId: string,
  session: SessionMarketingRow,
): Promise<void> {
  const marketing = resolveSessionMarketingAttribution(sessionId, webId, session);
  if (!marketing.attributionLabel && !marketing.attribution.utm_source) return;

  const { error } = await admin
    .from("leads")
    .update({
      attribution: marketing.attribution,
      attribution_label: marketing.attributionLabel,
      gclid: marketing.gclid,
      fbclid: marketing.fbclid,
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", organizationId)
    .eq("web_id", webId)
    .eq("analytics_session_id", sessionId)
    .in("source", [API_LEAD_SOURCE_WHATSAPP_BUTTON, LEGACY_FLOATING_WA_LEAD_SOURCE])
    .is("attribution", null);

  if (error) {
    console.warn("patchFloatingStubAttributionFromSession:", error);
  }
}

export async function syncFloatingWaClickToLead(
  admin: SupabaseClient,
  ctx: OmnichannelApiTokenContext,
  params: SyncFloatingWaClickParams,
): Promise<SyncFloatingWaClickResult> {
  const { sessionId, visitorId, path, targetUrl, targetPhone, waClickId } = params;

  const sessionResult = await ensureAnalyticsSessionForIngest(admin, ctx, {
    sessionId,
    visitorId,
  });
  const session = sessionResult.ok ? sessionResult.session : null;

  const marketing = session
    ? resolveSessionMarketingAttribution(sessionId, ctx.webId, session)
    : {
        attribution: { session_id: sessionId, web_id: ctx.webId },
        attributionLabel: null,
        gclid: null,
        fbclid: null,
      };

  const existing = await findFloatingStubLead(
    admin,
    ctx.organizationId,
    ctx.webId,
    sessionId,
  );

  const now = new Date().toISOString();

  if (existing) {
    const patch: Record<string, unknown> = { updated_at: now };
    if (marketing.attributionLabel || marketing.attribution.utm_source) {
      const { data: current } = await admin
        .from("leads")
        .select("attribution, attribution_label, gclid, fbclid")
        .eq("id", existing.leadId)
        .maybeSingle();

      if (!current?.attribution) patch.attribution = marketing.attribution;
      if (!current?.attribution_label && marketing.attributionLabel) {
        patch.attribution_label = marketing.attributionLabel;
      }
      if (!current?.gclid && marketing.gclid) patch.gclid = marketing.gclid;
      if (!current?.fbclid && marketing.fbclid) patch.fbclid = marketing.fbclid;
    }

    const { error: updErr } = await admin
      .from("leads")
      .update(patch)
      .eq("id", existing.leadId);

    if (updErr) {
      return { ok: false, error: updErr.message };
    }

    return { ok: true, leadId: existing.leadId, leadCreated: false };
  }

  const actor = await getOrCreateSystemActor(admin, ctx.organizationId);
  const statusId = await resolveLeadStatusId(admin, ctx.organizationId, "new");
  const leadId = crypto.randomUUID();

  const crmFields = deriveApiLeadCrmFields({
    webId: ctx.webId,
    channel: "whatsapp_button",
    clickPath: path,
    attribution: marketing.attribution,
  });

  const { error: leadErr } = await admin.from("leads").insert({
    id: leadId,
    client: FLOATING_WA_CLIENT,
    title: crmFields.title,
    category: crmFields.category,
    created_by: actor.userId,
    created_by_name: crmFields.created_by_name,
    assignee: "Unassigned",
    organization_id: ctx.organizationId,
    source: crmFields.source,
    status_id: statusId,
    phone_number: null,
    email: null,
    attribution: marketing.attribution,
    attribution_label: marketing.attributionLabel,
    web_id: ctx.webId,
    analytics_session_id: sessionId,
    gclid: marketing.gclid,
    fbclid: marketing.fbclid,
    created_at: now,
    updated_at: now,
  });

  if (leadErr) {
    return { ok: false, error: leadErr.message };
  }

  const { error: subErr } = await admin.from("lead_submissions").insert({
    organization_id: ctx.organizationId,
    lead_id: leadId,
    web_id: ctx.webId,
    form_id: null,
    name: FLOATING_WA_CLIENT,
    phone_number: null,
    email: null,
    notes: null,
    form_data: {
      source: "floating_whatsapp",
      path,
      target_url: targetUrl,
      target_phone: targetPhone,
      wa_click_id: waClickId,
      visitor_id: visitorId,
    },
    status: "draft",
    is_active: true,
    updated_at: now,
  });

  if (subErr) {
    await admin.from("leads").delete().eq("id", leadId);
    return { ok: false, error: subErr.message };
  }

  return { ok: true, leadId, leadCreated: true };
}
