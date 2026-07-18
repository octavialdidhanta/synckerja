import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { parseContactReply } from "./parseContactReply.ts";
import type { ParsedContact } from "./parseContactReply.ts";
import {
  getParticipantProfile,
  syncSubmissionContactFields,
  upsertParticipantContactField,
} from "./participantProfile.ts";
import {
  getMissingContactFields,
  isAnyContactFlowActive,
  isContactGateEnabled,
  isEmailCollectionEnabled,
  resolveFlowBranch,
  type MissingContactField,
} from "./skipMatrix.ts";
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
  if (!campaign || !isAnyContactFlowActive(campaign)) return null;
  return { enrollment: joined as LeadMagnetEnrollmentRow, campaign };
}

function expectedContactKind(args: {
  enrollment: LeadMagnetEnrollmentRow;
  campaign: LeadMagnetCampaignRow;
  profile: { phone_number: string | null; email: string | null };
}): MissingContactField | null {
  const stored = args.enrollment.awaiting_contact_kind;
  if (stored === "email" || stored === "phone") return stored;

  const branch = resolveFlowBranch({
    campaign: args.campaign,
    profile: args.profile,
    isFollower: true,
  });
  if (branch.branch === "needs_contact") return branch.ask;
  return getMissingContactFields(args.profile);
}

function parsedMatchesExpectedKind(
  parsed: ParsedContact,
  expected: MissingContactField | null,
): boolean {
  if (!expected || parsed.kind === "invalid") return false;
  if (expected === "any") return parsed.kind === "phone" || parsed.kind === "email";
  return parsed.kind === expected;
}

function qualifiesForSupplementalMatch(
  status: string,
  parsed: ParsedContact,
  expected: MissingContactField | null,
): boolean {
  if (!parsedMatchesExpectedKind(parsed, expected)) return false;
  if (SUPPLEMENTAL_DELIVERY_STATUSES.includes(
    status as typeof SUPPLEMENTAL_DELIVERY_STATUSES[number],
  )) {
    return true;
  }
  if (status === "comment_replied" && expected && expected !== "any") {
    return true;
  }
  return false;
}

async function deliverAfterEmailCollection(
  admin: SupabaseClient,
  args: {
    enrollment: LeadMagnetEnrollmentRow;
    campaign: LeadMagnetCampaignRow;
    accessToken: string;
    pageId: string;
  },
): Promise<void> {
  const { sendDeliveryMessage } = await import("../followGateRuntime.ts");
  await sendDeliveryMessage(admin, {
    enrollment: args.enrollment,
    campaign: args.campaign,
    accessToken: args.accessToken,
    pageId: args.pageId,
  });
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
  if (!isAnyContactFlowActive(args.campaign)) {
    return false;
  }

  const parsed = parseContactReply(args.messageBody);

  const profile = await getParticipantProfile(admin, {
    organizationId: args.enrollment.organization_id,
    platform: args.enrollment.platform,
    participantScopedId: args.enrollment.participant_scoped_id,
  });
  const profileFields = profile ?? { phone_number: null, email: null };
  const expected = expectedContactKind({
    enrollment: args.enrollment,
    campaign: args.campaign,
    profile: profileFields,
  });

  if (parsed.kind === "invalid") {
    if (mode === "awaiting") {
      await sendContactInvalidReply(admin, args);
      return true;
    }
    return false;
  }

  if (!parsedMatchesExpectedKind(parsed, expected)) {
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
    awaiting_contact_kind: null,
  });

  const enrollmentAfterCollect = {
    ...args.enrollment,
    status: "contact_collected" as const,
    awaiting_contact_kind: null,
  };

  if (parsed.kind === "email" && isEmailCollectionEnabled(args.campaign)) {
    await logLeadMagnetFunnelEvent(admin, {
      enrollmentId: args.enrollment.id,
      campaignId: args.campaign.id,
      organizationId: args.enrollment.organization_id,
      eventType: "contact_collected",
      metadata: {
        kind: "email",
        delivery_channel: "instagram",
        delivery_scheduled: true,
        supplemental: mode === "supplemental",
      },
    });
    await deliverAfterEmailCollection(admin, {
      enrollment: enrollmentAfterCollect,
      campaign: args.campaign,
      accessToken: args.accessToken,
      pageId: args.pageId,
    });
    return true;
  }

  if (parsed.kind === "phone" && isContactGateEnabled(args.campaign)) {
    await logLeadMagnetFunnelEvent(admin, {
      enrollmentId: args.enrollment.id,
      campaignId: args.campaign.id,
      organizationId: args.enrollment.organization_id,
      eventType: "contact_collected",
      metadata: {
        kind: "phone",
        delivery_channel: "whatsapp",
        delivery_scheduled: true,
        supplemental: mode === "supplemental",
      },
    });
    await orchestrateDeliveryAfterContact(admin, {
      enrollment: enrollmentAfterCollect,
      campaign: args.campaign,
      accessToken: args.accessToken,
      pageId: args.pageId,
      collectedKind: "phone",
      phoneDigits: parsed.normalized,
    });
    return true;
  }

  if (mode === "awaiting") {
    await sendContactInvalidReply(admin, args);
    return true;
  }
  return false;
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
    const expected = expectedContactKind({
      enrollment: joined.enrollment,
      campaign: joined.campaign,
      profile: profile ?? { phone_number: null, email: null },
    });
    if (qualifiesForSupplementalMatch(joined.enrollment.status, parsed, expected)) {
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
