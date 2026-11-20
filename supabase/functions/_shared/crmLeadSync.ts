import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { propertyCreatedByName } from "./propertyCreatedByName.ts";

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function isIsoDateOnly(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s.trim());
}

/** Legacy funnel prefix — avoids duplicate CRM rows during hub cutover. */
export function buildLegacyWeddingFunnelKey(webId: string, identityHash: string): string {
  return `wedding-package-lead:${webId}:package:${identityHash.slice(0, 16)}`.slice(0, 200);
}

function buildFunnelKey(webId: string, formId: string, identityHash: string): string {
  if (webId === "vialdi-wedding" && formId === "contact-main") {
    return buildLegacyWeddingFunnelKey(webId, identityHash);
  }
  return `contact-submit:${webId}:${formId}:${identityHash.slice(0, 16)}`.slice(0, 200);
}

export async function syncCrmLeadStep1(args: {
  admin: SupabaseClient;
  systemUserId: string;
  organizationId: string;
  webId: string;
  formId: string;
  name: string;
  phone_number: string;
  email: string;
  leadTitle: string;
  servicesLabel: string | null;
  analytics_session_id?: string | null;
  attribution: Record<string, unknown> | null;
  attribution_label: string | null;
  gclid?: string | null;
  propertyDisplayName?: string | null;
}): Promise<{ ok: true; leadId: string; identityHash: string } | { ok: false; error: string }> {
  const identityHash = await sha256Hex(`${args.phone_number}|${args.email.toLowerCase()}`);
  const funnel_key = buildFunnelKey(args.webId, args.formId, identityHash);

  const category =
    args.webId === "vialdi-wedding" && args.formId === "contact-main"
      ? "Wedding package card"
      : "Contact Form";

  const { data: lead, error: leadErr } = await args.admin
    .from("leads")
    .upsert(
      {
        client: args.name,
        title: args.leadTitle,
        category,
        created_by: args.systemUserId,
        created_by_name: propertyCreatedByName(args.propertyDisplayName, args.webId),
        assignee: "",
        followup: 0,
        organization_id: args.organizationId,
        phone_number: args.phone_number,
        email: args.email,
        source:
          args.webId === "vialdi-wedding" && args.formId === "contact-main"
            ? "Wedding package card"
            : `Hub ${args.webId}`,
        web_id: args.webId,
        funnel_key,
        ...(args.servicesLabel ? { services: args.servicesLabel } : {}),
        ...(args.analytics_session_id ? { analytics_session_id: args.analytics_session_id } : {}),
        ...(args.attribution ? { attribution: args.attribution } : {}),
        ...(args.attribution_label ? { attribution_label: args.attribution_label } : {}),
        ...(args.gclid ? { gclid: args.gclid } : {}),
      },
      { onConflict: "organization_id,dedupe_key" },
    )
    .select("id")
    .single();

  if (leadErr || !lead?.id) {
    return { ok: false, error: leadErr?.message ?? "Failed to upsert lead" };
  }

  return { ok: true, leadId: String(lead.id), identityHash };
}

/** Patch an existing CRM lead (e.g. from WA floating click) when form step 1 adds PII. */
export async function patchCrmLeadFromStep1(args: {
  admin: SupabaseClient;
  leadId: string;
  systemUserId: string;
  organizationId: string;
  webId: string;
  formId: string;
  name: string;
  phone_number: string;
  email: string;
  leadTitle: string;
  servicesLabel: string | null;
  analytics_session_id?: string | null;
  attribution: Record<string, unknown> | null;
  attribution_label: string | null;
  gclid?: string | null;
}): Promise<{ ok: true; identityHash: string } | { ok: false; error: string }> {
  const identityHash = await sha256Hex(`${args.phone_number}|${args.email.toLowerCase()}`);
  const funnel_key = buildFunnelKey(args.webId, args.formId, identityHash);

  const category =
    args.webId === "vialdi-wedding" && args.formId === "contact-main"
      ? "Wedding package card"
      : "Contact Form";

  const patch: Record<string, unknown> = {
    client: args.name,
    title: args.leadTitle,
    category,
    phone_number: args.phone_number,
    email: args.email,
    funnel_key,
    source:
      args.webId === "vialdi-wedding" && args.formId === "contact-main"
        ? "Wedding package card"
        : `Hub ${args.webId}`,
    web_id: args.webId,
    updated_at: new Date().toISOString(),
    ...(args.servicesLabel ? { services: args.servicesLabel } : {}),
    ...(args.analytics_session_id ? { analytics_session_id: args.analytics_session_id } : {}),
    ...(args.attribution ? { attribution: args.attribution } : {}),
    ...(args.attribution_label ? { attribution_label: args.attribution_label } : {}),
    ...(args.gclid ? { gclid: args.gclid } : {}),
  };

  const { error: leadErr } = await args.admin
    .from("leads")
    .update(patch)
    .eq("id", args.leadId)
    .eq("organization_id", args.organizationId);

  if (leadErr) return { ok: false, error: leadErr.message };

  return { ok: true, identityHash };
}

export async function updateCrmLeadFromSubmission(args: {
  admin: SupabaseClient;
  submissionId: string;
  leadId: string;
  organizationId: string;
  webId: string;
  formId: string;
  mergedFormData: Record<string, unknown>;
  leadTitle: string;
  servicesLabel: string | null;
  attribution: Record<string, unknown> | null;
  attribution_label: string | null;
  analytics_session_id?: string | null;
  gclid?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (args.attribution) patch.attribution = args.attribution;
  if (args.attribution_label) patch.attribution_label = args.attribution_label;
  if (args.analytics_session_id) patch.analytics_session_id = args.analytics_session_id;
  if (args.gclid) patch.gclid = args.gclid;
  if (args.leadTitle.trim()) patch.title = args.leadTitle.trim();

  const isWedding = args.webId === "vialdi-wedding" && args.formId === "contact-main";
  const pkg = (args.servicesLabel ?? "").trim();
  const eventDate =
    typeof args.mergedFormData.event_date === "string" && isIsoDateOnly(args.mergedFormData.event_date)
      ? args.mergedFormData.event_date.trim()
      : "";
  const eventTime = String(args.mergedFormData.event_time ?? "").trim();
  const eventAddress = String(args.mergedFormData.event_address ?? "").trim();

  if (pkg) {
    patch.services = pkg;
  }

  const { error } = await args.admin
    .from("leads")
    .update(patch)
    .eq("id", args.leadId)
    .eq("organization_id", args.organizationId);

  if (error) return { ok: false, error: error.message };

  if (isWedding) {
    const notesBlock =
      `Paket: ${pkg || "—"}\n` +
      `Tanggal acara: ${eventDate}\n` +
      `Jam acara: ${eventTime}\n` +
      `Alamat lengkap:\n${eventAddress}`;
    const submissionPatch: Record<string, unknown> = {
      notes: notesBlock,
      updated_at: new Date().toISOString(),
    };
    if (eventAddress) submissionPatch.location = eventAddress;
    const { error: subErr } = await args.admin
      .from("lead_submissions")
      .update(submissionPatch)
      .eq("id", args.submissionId);
    if (subErr) {
      console.warn("updateCrmLeadFromSubmission: lead_submissions update failed", subErr.message);
    }
  }

  return { ok: true };
}
