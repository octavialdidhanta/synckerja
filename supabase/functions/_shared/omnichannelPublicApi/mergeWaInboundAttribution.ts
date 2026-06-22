import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  FLOATING_WA_LEAD_SOURCE,
} from "./syncFloatingWaClickToLead.ts";
import {
  resolveSessionMarketingAttribution,
  type SessionMarketingRow,
} from "./urlParams.ts";

/** Recent floating stub eligible for merge when first inbound WA arrives. */
export const FLOATING_STUB_MERGE_LOOKBACK_MS = 30 * 60 * 1000;

/** Session attribution fallback when wa-link-clicks row missing but traffic-logs ran. */
export const SESSION_ATTRIBUTION_LOOKBACK_MS = 30 * 60 * 1000;

export function resolveWebIdFromDisplayPhoneNumber(
  displayPhoneNumber: string | null | undefined,
): string | null {
  const d = String(displayPhoneNumber ?? "").replace(/\D/g, "");
  if (d === "6281281714855" || d === "6281118891308") return "vialdi-wedding";
  return null;
}

function buildAttributionLabelFromJson(attribution: Record<string, unknown> | null): string | null {
  if (!attribution) return null;
  const parts = [
    attribution.utm_source,
    attribution.utm_medium,
    attribution.utm_campaign,
  ]
    .map((v) => (v == null ? "" : String(v).trim()))
    .filter(Boolean);
  return parts.length > 0 ? parts.join(" / ") : null;
}

export function extractClickIdsFromAttributionJson(attribution: unknown): {
  gclid: string | null;
  fbclid: string | null;
} {
  if (attribution == null) return { gclid: null, fbclid: null };
  let obj: Record<string, unknown>;
  if (typeof attribution === "string") {
    try {
      obj = JSON.parse(attribution) as Record<string, unknown>;
    } catch {
      return { gclid: null, fbclid: null };
    }
  } else if (typeof attribution === "object" && !Array.isArray(attribution)) {
    obj = attribution as Record<string, unknown>;
  } else {
    return { gclid: null, fbclid: null };
  }
  const gclidRaw = obj.gclid ?? obj.GCLID;
  const fbclidRaw = obj.fbclid ?? obj.FBCLID;
  const gclid = gclidRaw != null ? String(gclidRaw).trim() || null : null;
  const fbclid = fbclidRaw != null ? String(fbclidRaw).trim() || null : null;
  return { gclid, fbclid };
}

/** Most recent unattributed floating stub for this org/web (no WA ticket yet). */
export async function findMergeableFloatingStubLeadId(
  supabase: SupabaseClient,
  orgId: string,
  webId: string | null,
): Promise<string | null> {
  const since = new Date(Date.now() - FLOATING_STUB_MERGE_LOOKBACK_MS).toISOString();

  let query = supabase
    .from("leads")
    .select("id, ticket_id, phone_number, web_id, created_at")
    .eq("organization_id", orgId)
    .eq("source", FLOATING_WA_LEAD_SOURCE)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(10);

  if (webId) {
    query = query.eq("web_id", webId);
  }

  const { data: rows } = await query;
  for (const row of rows ?? []) {
    const tid = String(row.ticket_id ?? "").trim().toUpperCase();
    if (tid.startsWith("WA-")) continue;
    const phone = row.phone_number != null ? String(row.phone_number).trim() : "";
    if (phone) continue;
    return String(row.id);
  }
  return null;
}

async function findRecentUnlinkedSession(
  supabase: SupabaseClient,
  webId: string,
  beforeIso: string,
): Promise<{ sessionId: string; marketing: ReturnType<typeof resolveSessionMarketingAttribution> } | null> {
  const since = new Date(
    new Date(beforeIso).getTime() - SESSION_ATTRIBUTION_LOOKBACK_MS,
  ).toISOString();

  const { data: sessions } = await supabase
    .from("analytics_sessions")
    .select("*")
    .eq("web_id", webId)
    .lte("started_at", beforeIso)
    .gte("started_at", since)
    .order("started_at", { ascending: false })
    .limit(5);

  for (const session of sessions ?? []) {
    const sessionId = String(session.id ?? "");
    if (!sessionId) continue;

    const marketing = resolveSessionMarketingAttribution(
      sessionId,
      webId,
      session as SessionMarketingRow,
    );
    if (!marketing.attributionLabel && !marketing.attribution.utm_source) continue;

    const { data: linked } = await supabase
      .from("leads")
      .select("id")
      .eq("analytics_session_id", sessionId)
      .not("attribution_label", "is", null)
      .limit(1)
      .maybeSingle();

    if (linked?.id) continue;

    return { sessionId, marketing };
  }
  return null;
}

export type WaLeadAttributionPatch = {
  web_id: string;
  analytics_session_id: string;
  attribution: Record<string, unknown>;
  attribution_label: string | null;
  gclid: string | null;
  fbclid: string | null;
};

/** Resolve attribution from wa_click row, floating stub, or recent analytics session. */
export async function resolveWaInboundAttributionPatch(
  supabase: SupabaseClient,
  args: {
    orgId: string;
    webId: string;
    inboundTimestampIso: string;
  },
): Promise<WaLeadAttributionPatch | null> {
  const { orgId, webId, inboundTimestampIso } = args;

  const { data: waClick } = await supabase
    .from("analytics_wa_clicks")
    .select("id, session_id, attribution")
    .eq("web_id", webId)
    .is("phone_number", null)
    .lte("created_at", inboundTimestampIso)
    .order("created_at", { ascending: false })
    .limit(3);

  for (const click of waClick ?? []) {
    const sessionId = click.session_id != null ? String(click.session_id) : "";
    if (!sessionId) continue;
    const rawAttr = click.attribution as Record<string, unknown> | null;
    const clickIds = extractClickIdsFromAttributionJson(rawAttr);
    const attributionLabel = buildAttributionLabelFromJson(rawAttr);
    if (!attributionLabel && !rawAttr?.utm_source) continue;

    return {
      web_id: webId,
      analytics_session_id: sessionId,
      attribution: rawAttr ?? { session_id: sessionId, web_id: webId },
      attribution_label: attributionLabel,
      gclid: clickIds.gclid,
      fbclid: clickIds.fbclid,
    };
  }

  const stubId = await findMergeableFloatingStubLeadId(supabase, orgId, webId);
  if (stubId) {
    const { data: stub } = await supabase
      .from("leads")
      .select("analytics_session_id, attribution, attribution_label, gclid, fbclid")
      .eq("id", stubId)
      .maybeSingle();
    if (stub?.attribution || stub?.attribution_label) {
      const attr = (stub.attribution ?? {}) as Record<string, unknown>;
      const clickIds = extractClickIdsFromAttributionJson(attr);
      return {
        web_id: webId,
        analytics_session_id: String(stub.analytics_session_id ?? attr.session_id ?? ""),
        attribution: attr,
        attribution_label: stub.attribution_label != null
          ? String(stub.attribution_label)
          : buildAttributionLabelFromJson(attr),
        gclid: stub.gclid ?? clickIds.gclid,
        fbclid: stub.fbclid ?? clickIds.fbclid,
      };
    }
  }

  const sessionMatch = await findRecentUnlinkedSession(supabase, webId, inboundTimestampIso);
  if (!sessionMatch) return null;

  return {
    web_id: webId,
    analytics_session_id: sessionMatch.sessionId,
    attribution: sessionMatch.marketing.attribution,
    attribution_label: sessionMatch.marketing.attributionLabel,
    gclid: sessionMatch.marketing.gclid,
    fbclid: sessionMatch.marketing.fbclid,
  };
}

export async function applyAttributionToWaLead(
  supabase: SupabaseClient,
  args: {
    orgId: string;
    leadId: string;
    ticketId: string;
    patch: WaLeadAttributionPatch;
    customerWaId?: string | null;
  },
): Promise<void> {
  const { orgId, leadId, ticketId, patch, customerWaId } = args;

  const { data: current } = await supabase
    .from("leads")
    .select("attribution, attribution_label")
    .eq("id", leadId)
    .maybeSingle();

  if (current?.attribution_label?.trim()) return;
  const existingAttr = current?.attribution as Record<string, unknown> | null;
  if (existingAttr?.utm_source) return;

  const update: Record<string, unknown> = {
    web_id: patch.web_id,
    analytics_session_id: patch.analytics_session_id || null,
    attribution: patch.attribution,
    attribution_label: patch.attribution_label,
    gclid: patch.gclid,
    fbclid: patch.fbclid,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("leads")
    .update(update)
    .eq("organization_id", orgId)
    .eq("id", leadId);

  if (error) {
    console.warn("applyAttributionToWaLead:", error);
    return;
  }

  if (customerWaId && patch.analytics_session_id) {
    await supabase
      .from("analytics_wa_clicks")
      .update({ phone_number: customerWaId })
      .eq("web_id", patch.web_id)
      .eq("session_id", patch.analytics_session_id)
      .is("phone_number", null);
  }

  console.log("applyAttributionToWaLead: patched", {
    lead_id: leadId,
    ticket_id: ticketId,
    session_id: patch.analytics_session_id,
    attribution_label: patch.attribution_label,
  });
}

export async function ensureWaLeadWebsiteAttribution(args: {
  supabase: SupabaseClient;
  orgId: string;
  leadId: string;
  ticketId: string;
  customerWaId: string;
  displayPhoneNumber: string | null | undefined;
  inboundTimestampIso: string;
}): Promise<void> {
  const { supabase, orgId, leadId, ticketId, customerWaId, displayPhoneNumber, inboundTimestampIso } =
    args;

  const webId = resolveWebIdFromDisplayPhoneNumber(displayPhoneNumber);
  if (!webId) return;

  try {
    const patch = await resolveWaInboundAttributionPatch(supabase, {
      orgId,
      webId,
      inboundTimestampIso,
    });
    if (!patch) return;

    await applyAttributionToWaLead(supabase, {
      orgId,
      leadId,
      ticketId,
      patch,
      customerWaId,
    });
  } catch (e) {
    console.warn("ensureWaLeadWebsiteAttribution:", e);
  }
}
