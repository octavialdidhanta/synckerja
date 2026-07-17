import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { parseContactReply } from "./parseContactReply.ts";
import type { ParsedContact } from "./parseContactReply.ts";
import {
  getParticipantProfile,
  syncSubmissionContactFields,
  upsertParticipantContactField,
} from "./participantProfile.ts";
import { getMissingContactFields } from "./skipMatrix.ts";
import { sendContactInvalidReply } from "./contactGatePrompt.ts";
import { orchestrateDeliveryAfterContact } from "../delivery/deliveryOrchestrator.ts";
import { logLeadMagnetFunnelEvent, updateEnrollmentStatus } from "../funnelAnalytics.ts";
import type { LeadMagnetCampaignRow, LeadMagnetEnrollmentRow } from "../types.ts";

export type ContactGateMatchMode = "awaiting" | "supplemental";

/** Mid-async recovery only — delivered_* are terminal (no supplemental contact on same enrollment). */
const SUPPLEMENTAL_DELIVERY_STATUSES = [
  "contact_collected",
] as const;

const SUPPLEMENTAL_QUERY_STATUSES = [
  ...SUPPLEMENTAL_DELIVERY_STATUSES,
  "comment_replied",
] as const;

function joinEnrollmentCampaign(row: Record<string, unknown>): {
  enrollment: LeadMagnetEnrollmentRow;
  campaign: LeadMagnetCampaignRow;
} | null {
  const joined = row as LeadMagnetEnrollmentRow & {
    campaign: LeadMagnetCampaignRow | LeadMagnetCampaignRow[] | null;
  };
  const campaignRaw = joined.campaign;
  const campaign = Array.isArray(campaignRaw) ? campaignRaw[0] : campaignRaw;
  if (!campaign?.contact_gate_enabled) return null;
  return { enrollment: joined as LeadMagnetEnrollmentRow, campaign };
}

function parsedMatchesMissingField(
  parsed: ParsedContact,
  missing: ReturnType<typeof getMissingContactFields>,
): boolean {
  if (!missing || parsed.kind === "invalid") return false;
  if (missing === "any") return parsed.kind === "phone" || parsed.kind === "email";
  return parsed.kind === missing;
}

function qualifiesForSupplementalMatch(
  status: string,
  parsed: ParsedContact,
  missing: ReturnType<typeof getMissingContactFields>,
): boolean {
  if (!parsedMatchesMissingField(parsed, missing)) return false;
  if (SUPPLEMENTAL_DELIVERY_STATUSES.includes(
    status as typeof SUPPLEMENTAL_DELIVERY_STATUSES[number],
  )) {
    return true;
  }
  // Stuck after partial delivery (e.g. comment_replied race) — not early "any" gate.
  if (status === "comment_replied" && missing && missing !== "any") {
    return true;
  }
  return false;
}

export async function handleInboundContact(
  admin: SupabaseClient,
  args: {
    enrollment: LeadMagnetEnrollmentRow;
    campaign: LeadMagnetCampaignRow;
    accessToken: string;
    pageId: string;
    messageBody: string;
    mode?: ContactGateMatchMode;
  },
): Promise<boolean> {
  const mode = args.mode ?? "awaiting";

  if (mode === "awaiting" && args.enrollment.status !== "awaiting_contact") {
    return false;
  }
  if (mode === "supplemental" && !SUPPLEMENTAL_QUERY_STATUSES.includes(
    args.enrollment.status as typeof SUPPLEMENTAL_QUERY_STATUSES[number],
  )) {
    return false;
  }
  if (!args.campaign.contact_gate_enabled) {
    return false;
  }

  const parsed = parseContactReply(args.messageBody);
  if (parsed.kind === "invalid") {
    if (mode === "awaiting") {
      await sendContactInvalidReply(admin, args);
      return true;
    }
    return false;
  }

  const profile = await getParticipantProfile(admin, {
    organizationId: args.enrollment.organization_id,
    platform: args.enrollment.platform,
    participantScopedId: args.enrollment.participant_scoped_id,
  });

  const missingBefore = getMissingContactFields(profile ?? { phone_number: null, email: null });
  if (!parsedMatchesMissingField(parsed, missingBefore)) {
    if (mode === "awaiting") {
      await sendContactInvalidReply(admin, args);
      return true;
    }
    return false;
  }

  const now = new Date().toISOString();
  const phonePatch = parsed.kind === "phone" ? parsed.normalized : undefined;
  const emailPatch = parsed.kind === "email" ? parsed.normalized : undefined;

  await upsertParticipantContactField(admin, {
    organizationId: args.enrollment.organization_id,
    platform: args.enrollment.platform,
    participantScopedId: args.enrollment.participant_scoped_id,
    phoneNumber: phonePatch ?? profile?.phone_number ?? null,
    email: emailPatch ?? profile?.email ?? null,
    canonicalLeadId: args.enrollment.lead_id,
    canonicalSubmissionId: args.enrollment.lead_submission_id,
  });

  await syncSubmissionContactFields(admin, args.enrollment.lead_submission_id, {
    phoneNumber: phonePatch ?? profile?.phone_number ?? null,
    email: emailPatch ?? profile?.email ?? null,
    leadMagnetCampaignName: args.campaign.name,
    leadMagnetTargetMarket: args.campaign.target_market,
  });

  await updateEnrollmentStatus(admin, args.enrollment.id, "contact_collected", {
    updated_at: now,
  });

  const deliveryChannel = parsed.kind === "phone" ? "whatsapp" : "email";
  await logLeadMagnetFunnelEvent(admin, {
    enrollmentId: args.enrollment.id,
    campaignId: args.campaign.id,
    organizationId: args.enrollment.organization_id,
    eventType: "contact_collected",
    metadata: {
      kind: parsed.kind,
      delivery_channel: deliveryChannel,
      delivery_scheduled: true,
      supplemental: mode === "supplemental",
    },
  });

  await orchestrateDeliveryAfterContact(admin, {
    enrollment: { ...args.enrollment, status: "contact_collected" },
    campaign: args.campaign,
    accessToken: args.accessToken,
    pageId: args.pageId,
    collectedKind: parsed.kind,
    phoneDigits: parsed.kind === "phone" ? parsed.normalized : undefined,
    email: parsed.kind === "email" ? parsed.normalized : undefined,
  });

  return true;
}

async function findAwaitingContactRows(
  admin: SupabaseClient,
  args: {
    organizationId: string;
    participantScopedId: string;
  },
): Promise<Array<{ enrollment: LeadMagnetEnrollmentRow; campaign: LeadMagnetCampaignRow }>> {
  const { data: rows } = await admin
    .from("lead_magnet_enrollments")
    .select("*, campaign:lead_magnet_campaigns(*)")
    .eq("organization_id", args.organizationId)
    .eq("participant_scoped_id", args.participantScopedId)
    .eq("status", "awaiting_contact")
    .order("updated_at", { ascending: false })
    .limit(5);

  const matches: Array<{ enrollment: LeadMagnetEnrollmentRow; campaign: LeadMagnetCampaignRow }> = [];
  for (const row of rows ?? []) {
    const joined = joinEnrollmentCampaign(row as Record<string, unknown>);
    if (joined) matches.push(joined);
  }
  return matches;
}

export async function findActiveContactGateEnrollment(
  admin: SupabaseClient,
  args: {
    organizationId: string;
    participantScopedId: string;
    messageBody: string;
  },
): Promise<{
  enrollment: LeadMagnetEnrollmentRow;
  campaign: LeadMagnetCampaignRow;
  mode: ContactGateMatchMode;
} | null> {
  const parsed = parseContactReply(args.messageBody);

  const awaitingMatches = await findAwaitingContactRows(admin, args);
  if (awaitingMatches.length > 0) {
    const first = awaitingMatches[0];
    return { ...first, mode: "awaiting" };
  }

  if (parsed.kind === "invalid") return null;

  const { data: rows } = await admin
    .from("lead_magnet_enrollments")
    .select("*, campaign:lead_magnet_campaigns(*)")
    .eq("organization_id", args.organizationId)
    .eq("participant_scoped_id", args.participantScopedId)
    .in("status", [...SUPPLEMENTAL_QUERY_STATUSES])
    .order("updated_at", { ascending: false })
    .limit(5);

  for (const row of rows ?? []) {
    const joined = joinEnrollmentCampaign(row as Record<string, unknown>);
    if (!joined) continue;

    const profile = await getParticipantProfile(admin, {
      organizationId: args.organizationId,
      platform: joined.enrollment.platform,
      participantScopedId: args.participantScopedId,
    });
    const missing = getMissingContactFields(profile ?? { phone_number: null, email: null });
    if (qualifiesForSupplementalMatch(joined.enrollment.status, parsed, missing)) {
      return { ...joined, mode: "supplemental" };
    }
  }

  return null;
}

/** @deprecated Use findActiveContactGateEnrollment */
export async function findAwaitingContactEnrollment(
  admin: SupabaseClient,
  args: {
    organizationId: string;
    participantScopedId: string;
  },
): Promise<{ enrollment: LeadMagnetEnrollmentRow; campaign: LeadMagnetCampaignRow } | null> {
  const matches = await findAwaitingContactRows(admin, args);
  return matches[0] ?? null;
}
