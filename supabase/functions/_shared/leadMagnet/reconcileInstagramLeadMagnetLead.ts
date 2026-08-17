/**
 * Merge Instagram/Facebook inbox leads into the Lead Magnet CRM row (same idea as
 * WhatsApp reconcileFormLeadWithWaTicket). Canonical UUID is the campaign lead so
 * New leads / Offline visit keep counting.
 *
 * Optional 1:1 backfill for an existing duplicate (do not run across all orgs):
 *
 * -- keep Lead Magnet UUID, reticket to IG-{conv}, delete the IG-only row
 * -- WHERE org = '<org>' AND enrollments.participant_scoped_id = conversations.customer_ig_id
 * -- AND leads.ticket_id LIKE 'LEAD-%' AND duplicate.ticket_id LIKE 'IG-%'
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { extractInstagramHandle } from "../instagramAccountDedupe.ts";
import { isPlaceholderLeadClientName } from "../omnichannelLeadClientName.ts";
import { upsertParticipantContactField } from "./contactGate/participantProfile.ts";
import {
  channelLeadTicketId,
  isLeadMagnetCrmLead,
  resolveCanonicalLeadMagnetLeadId,
  uniqueNonEmpty,
  type LeadMagnetChannelKind,
} from "./leadMagnetChannelLeadMatch.ts";
import type { LeadMagnetPlatform } from "./types.ts";

export type ReconcileChannelLeadResult = {
  leadId: string | null;
  merged: boolean;
};

type TicketLeadRow = {
  id: string;
  ticket_id: string | null;
  client: string | null;
  source: string | null;
  category: string | null;
};

async function loadTicketLead(
  admin: SupabaseClient,
  organizationId: string,
  ticketId: string,
): Promise<TicketLeadRow | null> {
  const { data } = await admin
    .from("leads")
    .select("id, ticket_id, client, source, category")
    .eq("organization_id", organizationId)
    .eq("ticket_id", ticketId)
    .maybeSingle();
  return (data as TicketLeadRow | null) ?? null;
}

async function loadCanonicalFromDirectory(
  admin: SupabaseClient,
  args: {
    organizationId: string;
    platform: LeadMagnetPlatform;
    scopedIds: string[];
    handle: string | null;
  },
): Promise<string | null> {
  const scopedIds = uniqueNonEmpty(args.scopedIds);
  const [enrollRes, profileRes] = await Promise.all([
    scopedIds.length === 0
      ? Promise.resolve({ data: [] as Array<{ lead_id: string | null; participant_scoped_id: string | null }> })
      : admin
        .from("lead_magnet_enrollments")
        .select("lead_id, participant_scoped_id")
        .eq("organization_id", args.organizationId)
        .eq("platform", args.platform)
        .in("participant_scoped_id", scopedIds)
        .not("lead_id", "is", null),
    scopedIds.length === 0
      ? Promise.resolve({ data: [] as Array<{ canonical_lead_id: string | null; participant_scoped_id: string | null }> })
      : admin
        .from("lead_magnet_participant_profiles")
        .select("canonical_lead_id, participant_scoped_id")
        .eq("organization_id", args.organizationId)
        .eq("platform", args.platform)
        .in("participant_scoped_id", scopedIds),
  ]);

  const fromScoped = resolveCanonicalLeadMagnetLeadId({
    scopedIds,
    enrollments: enrollRes.data ?? [],
    profiles: profileRes.data ?? [],
  });
  if (fromScoped) return fromScoped;

  const handle = extractInstagramHandle(args.handle);
  if (!handle) return null;

  const { data: lmLeads } = await admin
    .from("leads")
    .select("id, client, source, category")
    .eq("organization_id", args.organizationId)
    .or("source.eq.Lead Magnet,category.eq.Lead Magnet");

  return resolveCanonicalLeadMagnetLeadId({
    scopedIds,
    enrollments: [],
    profiles: [],
    handle: args.handle,
    leadMagnetLeads: lmLeads ?? [],
  });
}

async function reassignCustomerVisits(
  admin: SupabaseClient,
  organizationId: string,
  fromLeadId: string,
  toLeadId: string,
): Promise<void> {
  if (fromLeadId === toLeadId) return;
  const { error } = await admin
    .from("customer_visits")
    .update({ lead_id: toLeadId, match_status: "matched" })
    .eq("organization_id", organizationId)
    .eq("lead_id", fromLeadId);
  if (error) {
    console.error("[lead-magnet] reassign customer_visits failed:", error.message);
  }
}

async function linkEnrollmentsToConversation(
  admin: SupabaseClient,
  args: {
    organizationId: string;
    platform: LeadMagnetPlatform;
    scopedIds: string[];
    conversationId: string;
    conversationTable: "instagram_conversations" | "facebook_conversations";
  },
): Promise<void> {
  const scopedIds = uniqueNonEmpty(args.scopedIds);
  if (scopedIds.length === 0) return;
  const now = new Date().toISOString();
  await admin
    .from("lead_magnet_enrollments")
    .update({
      conversation_id: args.conversationId,
      conversation_table: args.conversationTable,
      updated_at: now,
    })
    .eq("organization_id", args.organizationId)
    .eq("platform", args.platform)
    .in("participant_scoped_id", scopedIds)
    .is("conversation_id", null);
}

/**
 * When a DM thread exists, reuse the Lead Magnet lead UUID and set ticket_id to IG-/FB-…
 * so Live Chat Open Chat + assignee sync keep working.
 */
export async function reconcileLeadMagnetChannelLead(
  admin: SupabaseClient,
  args: {
    organizationId: string;
    platform: LeadMagnetPlatform;
    conversationId: string;
    scopedIds: string[];
    customerHandle?: string | null;
    clientName?: string | null;
  },
): Promise<ReconcileChannelLeadResult> {
  const kind: LeadMagnetChannelKind = args.platform;
  const ticketId = channelLeadTicketId(kind, args.conversationId);
  const scopedIds = uniqueNonEmpty(args.scopedIds);
  const handle = args.customerHandle ?? args.clientName ?? null;

  const ticketLead = await loadTicketLead(admin, args.organizationId, ticketId);
  const canonicalId = await loadCanonicalFromDirectory(admin, {
    organizationId: args.organizationId,
    platform: args.platform,
    scopedIds,
    handle,
  });

  if (!canonicalId) {
    return { leadId: ticketLead?.id ?? null, merged: false };
  }

  if (ticketLead?.id === canonicalId) {
    await linkEnrollmentsToConversation(admin, {
      organizationId: args.organizationId,
      platform: args.platform,
      scopedIds,
      conversationId: args.conversationId,
      conversationTable: kind === "instagram" ? "instagram_conversations" : "facebook_conversations",
    });
    if (scopedIds[0]) {
      await upsertParticipantContactField(admin, {
        organizationId: args.organizationId,
        platform: args.platform,
        participantScopedId: scopedIds[0],
        canonicalLeadId: canonicalId,
      });
    }
    return { leadId: canonicalId, merged: false };
  }

  if (ticketLead && ticketLead.id !== canonicalId) {
    await reassignCustomerVisits(admin, args.organizationId, ticketLead.id, canonicalId);
    const { error: delErr } = await admin.from("leads").delete().eq("id", ticketLead.id);
    if (delErr) {
      console.error("[lead-magnet] delete duplicate channel lead failed:", delErr.message);
      return { leadId: canonicalId, merged: false };
    }
  }

  const now = new Date().toISOString();
  const incoming = String(args.clientName ?? "").trim();
  const patch: Record<string, unknown> = {
    ticket_id: ticketId,
    source: "Lead Magnet",
    category: "Lead Magnet",
    updated_at: now,
  };
  if (incoming && !isPlaceholderLeadClientName(incoming)) {
    const { data: canonicalRow } = await admin
      .from("leads")
      .select("client")
      .eq("id", canonicalId)
      .maybeSingle();
    if (isPlaceholderLeadClientName(canonicalRow?.client as string | null)) {
      patch.client = incoming;
    }
  }

  const { error: upErr } = await admin.from("leads").update(patch).eq("id", canonicalId);
  if (upErr) {
    console.error("[lead-magnet] reticket canonical lead failed:", upErr.message);
    return { leadId: canonicalId, merged: false };
  }

  await linkEnrollmentsToConversation(admin, {
    organizationId: args.organizationId,
    platform: args.platform,
    scopedIds,
    conversationId: args.conversationId,
    conversationTable: kind === "instagram" ? "instagram_conversations" : "facebook_conversations",
  });

  if (scopedIds[0]) {
    await upsertParticipantContactField(admin, {
      organizationId: args.organizationId,
      platform: args.platform,
      participantScopedId: scopedIds[0],
      canonicalLeadId: canonicalId,
    });
  }

  console.log("[lead-magnet] merged channel ticket into campaign lead", {
    lead_id: canonicalId,
    ticket_id: ticketId,
    platform: args.platform,
  });
  return { leadId: canonicalId, merged: true };
}

/** DM-first: reuse the IG-/FB- inbox lead instead of inserting LEAD-. */
export async function findExistingChannelLeadForParticipant(
  admin: SupabaseClient,
  args: {
    organizationId: string;
    platform: LeadMagnetPlatform;
    participantScopedId: string;
    participantUsername?: string | null;
  },
): Promise<{ leadId: string } | null> {
  const scopedId = args.participantScopedId.trim();
  if (!scopedId) return null;

  if (args.platform === "instagram") {
    const { data: byIg } = await admin
      .from("instagram_conversations")
      .select("id, ticket_id, updated_at")
      .eq("organization_id", args.organizationId)
      .eq("customer_ig_id", scopedId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const conv = byIg ??
      (await admin
        .from("instagram_conversations")
        .select("id, ticket_id, updated_at")
        .eq("organization_id", args.organizationId)
        .eq("customer_external_id", scopedId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle()).data;
    if (conv?.id) {
      const ticketId =
        String(conv.ticket_id ?? "").trim() || channelLeadTicketId("instagram", String(conv.id));
      const lead = await loadTicketLead(admin, args.organizationId, ticketId);
      if (lead?.id) return { leadId: String(lead.id) };
    }
  } else {
    const { data: conv } = await admin
      .from("facebook_conversations")
      .select("id, ticket_id, updated_at")
      .eq("organization_id", args.organizationId)
      .eq("customer_psid", scopedId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (conv?.id) {
      const ticketId =
        String(conv.ticket_id ?? "").trim() || channelLeadTicketId("facebook", String(conv.id));
      const lead = await loadTicketLead(admin, args.organizationId, ticketId);
      if (lead?.id) return { leadId: String(lead.id) };
    }
  }

  const handle = extractInstagramHandle(args.participantUsername);
  if (!handle) return null;
  const { data: lmLeads } = await admin
    .from("leads")
    .select("id, client, source, category")
    .eq("organization_id", args.organizationId)
    .or("source.eq.Lead Magnet,category.eq.Lead Magnet");
  const uniqueHandle = resolveCanonicalLeadMagnetLeadId({
    scopedIds: [],
    enrollments: [],
    profiles: [],
    handle: args.participantUsername,
    leadMagnetLeads: lmLeads ?? [],
  });
  return uniqueHandle ? { leadId: uniqueHandle } : null;
}

export { isLeadMagnetCrmLead, channelLeadTicketId };
