import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  mapFlowResponseToLeadSubmission,
  type FlowProfileFields,
} from "./mapFlowResponseToLeadSubmission.ts";

const WA_TICKET_PREFIX = "WA-";

function buildWaTicketId(convId: string): string {
  return WA_TICKET_PREFIX + String(convId).replace(/-/g, "").slice(0, 8).toUpperCase();
}

function mergeFormData(
  existing: Record<string, unknown> | null | undefined,
  incoming: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (!incoming || Object.keys(incoming).length === 0) return existing ?? null;
  const base =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? { ...(existing as Record<string, unknown>) }
      : {};
  return { ...base, ...incoming };
}

function applyProfilePatch(
  patch: Record<string, unknown>,
  profile: FlowProfileFields,
): void {
  if (profile.gender) patch.gender = profile.gender;
  if (profile.age != null) patch.age = profile.age;
  if (profile.occupation) patch.occupation = profile.occupation;
  if (profile.location) patch.location = profile.location;
}

async function mirrorWaConversationClientProfile(
  supabase: SupabaseClient,
  args: {
    orgId: string;
    convId: string;
    profile: FlowProfileFields;
    name: string | null;
    phone: string | null;
    email: string | null;
  },
): Promise<void> {
  const now = new Date().toISOString();
  const { data: existing } = await supabase
    .from("whatsapp_conversation_client_profiles")
    .select("id")
    .eq("conversation_id", args.convId)
    .eq("organization_id", args.orgId)
    .maybeSingle();

  const payload: Record<string, unknown> = {
    updated_at: now,
  };
  if (args.name?.trim()) payload.name = args.name.trim().slice(0, 512);
  if (args.phone?.trim()) payload.phone_number = args.phone.trim().slice(0, 512);
  if (args.email?.trim()) payload.email = args.email.trim().slice(0, 512);
  applyProfilePatch(payload, args.profile);

  if (existing?.id) {
    const { error } = await supabase
      .from("whatsapp_conversation_client_profiles")
      .update(payload)
      .eq("id", existing.id);
    if (error) console.error("mirrorWaConversationClientProfile: update failed", error);
    return;
  }

  if (!payload.name) {
    payload.name = args.name?.trim() || "WhatsApp";
  }

  const { error: insErr } = await supabase.from("whatsapp_conversation_client_profiles").insert({
    ...payload,
    conversation_id: args.convId,
    organization_id: args.orgId,
  });

  if (insErr) console.error("mirrorWaConversationClientProfile: insert failed", insErr);
}

/** Upsert lead_submissions from Meta WhatsApp Form Flow `nfm_reply`. */
export async function persistWaFlowSubmissionToLead(
  supabase: SupabaseClient,
  args: {
    orgId: string;
    convId: string;
    customerWaId: string;
    customerName: string | null;
    flowResponse: Record<string, unknown>;
    flowName: string | null;
  },
): Promise<void> {
  const ticketId = buildWaTicketId(args.convId);
  const { data: lead } = await supabase
    .from("leads")
    .select("id, client")
    .eq("organization_id", args.orgId)
    .eq("ticket_id", ticketId)
    .maybeSingle();

  if (!lead?.id) {
    console.warn("persistWaFlowSubmissionToLead: no lead for ticket", { ticketId, convId: args.convId });
    return;
  }

  const mapped = mapFlowResponseToLeadSubmission(args.flowResponse, args.flowName);
  const now = new Date().toISOString();
  const notesPrefix = args.flowName?.trim()
    ? `WhatsApp Form Flow: ${args.flowName.trim()}`
    : "WhatsApp Form Flow submission";

  const { data: existingSub } = await supabase
    .from("lead_submissions")
    .select("id, name, email, phone_number, form_data, notes, status")
    .eq("lead_id", lead.id)
    .eq("organization_id", args.orgId)
    .eq("is_active", true)
    .order("status", { ascending: true })
    .order("submitted_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  const patch: Record<string, unknown> = {
    updated_at: now,
    whatsapp_conversation_id: args.convId,
    status: "submitted",
    submitted_at: now,
  };

  if (mapped.core.name) patch.name = mapped.core.name;
  else if (args.customerName?.trim()) patch.name = args.customerName.trim().slice(0, 512);
  else if (lead.client) patch.name = String(lead.client).slice(0, 512);

  if (mapped.core.email) patch.email = mapped.core.email;
  if (mapped.core.phone_number) patch.phone_number = mapped.core.phone_number;
  else if (args.customerWaId) patch.phone_number = args.customerWaId;

  applyProfilePatch(patch, mapped.profile);

  if (mapped.formData) {
    patch.form_data = mergeFormData(
      existingSub?.form_data as Record<string, unknown> | null,
      mapped.formData,
    );
  }

  const prevNotes = existingSub?.notes != null ? String(existingSub.notes).trim() : "";
  patch.notes = prevNotes ? `${prevNotes}\n${notesPrefix}` : notesPrefix;

  const resolvedName = (patch.name as string | undefined) ?? args.customerName ?? String(lead.client ?? "");
  const resolvedPhone = (patch.phone_number as string | undefined) ?? args.customerWaId;
  const resolvedEmail = (patch.email as string | undefined) ?? null;

  if (existingSub?.id) {
    const { error } = await supabase.from("lead_submissions").update(patch).eq("id", existingSub.id);
    if (error) console.error("persistWaFlowSubmissionToLead: update failed", error);
  } else {
    const { error: insErr } = await supabase.from("lead_submissions").insert({
      organization_id: args.orgId,
      lead_id: lead.id,
      web_id: null,
      form_id: null,
      name: resolvedName || "WhatsApp",
      phone_number: resolvedPhone ?? null,
      email: resolvedEmail,
      gender: patch.gender ?? null,
      age: patch.age ?? null,
      occupation: patch.occupation ?? null,
      location: patch.location ?? null,
      notes: patch.notes,
      form_data: patch.form_data ?? null,
      whatsapp_conversation_id: args.convId,
      status: "submitted",
      is_active: true,
      submitted_at: now,
      updated_at: now,
    });

    if (insErr) console.error("persistWaFlowSubmissionToLead: insert failed", insErr);
  }

  await mirrorWaConversationClientProfile(supabase, {
    orgId: args.orgId,
    convId: args.convId,
    profile: mapped.profile,
    name: resolvedName || null,
    phone: resolvedPhone || null,
    email: resolvedEmail,
  });
}
