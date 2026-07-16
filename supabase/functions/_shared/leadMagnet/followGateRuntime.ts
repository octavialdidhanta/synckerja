import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { LeadMagnetCampaignRow, LeadMagnetEnrollmentRow } from "./types.ts";
import { interpolateLeadMagnetText } from "./types.ts";
import type { FollowConfirmResult } from "./types.ts";
import { buildFacebookFollowGateButtons, buildLeadMagnetActionButton } from "./leadMagnetActionButtons.ts";
import { fetchParticipantProfile } from "./fetchParticipantProfile.ts";
import { logLeadMagnetFunnelEvent, updateEnrollmentStatus } from "./funnelAnalytics.ts";
import { sendLeadMagnetDm, type LeadMagnetSendResult } from "./sendLeadMagnetMessage.ts";

declare const EdgeRuntime: {
  waitUntil: (promise: Promise<unknown>) => void;
};

function deferFollowGateWork(work: Promise<unknown>): void {
  if (typeof EdgeRuntime !== "undefined" && typeof EdgeRuntime.waitUntil === "function") {
    EdgeRuntime.waitUntil(work);
    return;
  }
  void work;
}

function shouldUseCommentPrivateReply(enrollment: LeadMagnetEnrollmentRow): boolean {
  if (enrollment.private_reply_message_id) return false;
  const commentId = enrollment.comment_id?.trim();
  if (!commentId) return false;
  return enrollment.platform === "instagram" || enrollment.platform === "facebook";
}

function firstContactPrivateReplyCommentId(
  enrollment: LeadMagnetEnrollmentRow,
): string | null {
  if (!shouldUseCommentPrivateReply(enrollment)) return null;
  return enrollment.comment_id!.trim();
}

function needsFirstContactDm(enrollment: LeadMagnetEnrollmentRow): boolean {
  if (shouldUseCommentPrivateReply(enrollment)) return true;
  return !enrollment.conversation_id;
}

function isPrivateReplyFirstContact(enrollment: LeadMagnetEnrollmentRow): boolean {
  return shouldUseCommentPrivateReply(enrollment);
}

function buildPrivateReplyEnrollmentPatch(sendResult: LeadMagnetSendResult): Record<string, unknown> {
  if (!sendResult.ok) return {};
  if (sendResult.firstDmMethod !== "private_reply_button" && sendResult.firstDmMethod !== "private_reply_text") {
    return {};
  }
  return {
    private_reply_sent_at: new Date().toISOString(),
    private_reply_message_id: sendResult.messageId ?? null,
    first_dm_method: sendResult.firstDmMethod,
  };
}

async function recordPrivateReplyOutcome(
  admin: SupabaseClient,
  args: {
    enrollment: LeadMagnetEnrollmentRow;
    campaign: LeadMagnetCampaignRow;
    sendResult: LeadMagnetSendResult;
    step: string;
  },
): Promise<void> {
  const usedPrivateReply = args.sendResult.firstDmMethod === "private_reply_button"
    || args.sendResult.firstDmMethod === "private_reply_text";

  if (usedPrivateReply && args.sendResult.ok) {
    await logLeadMagnetFunnelEvent(admin, {
      enrollmentId: args.enrollment.id,
      campaignId: args.campaign.id,
      organizationId: args.enrollment.organization_id,
      eventType: "private_reply_sent",
      metadata: {
        step: args.step,
        message_id: args.sendResult.messageId,
        endpoint: args.sendResult.privateReplyEndpoint,
        method: args.sendResult.firstDmMethod,
        recipient_id: args.sendResult.recipientId,
      },
    });
    return;
  }

  if (!args.sendResult.ok && isPrivateReplyFirstContact(args.enrollment)) {
    await logLeadMagnetFunnelEvent(admin, {
      enrollmentId: args.enrollment.id,
      campaignId: args.campaign.id,
      organizationId: args.enrollment.organization_id,
      eventType: "private_reply_failed",
      metadata: {
        step: args.step,
        error: args.sendResult.error,
        meta_error_code: args.sendResult.metaErrorCode,
        meta_error_subcode: args.sendResult.metaErrorSubcode,
        session_expired: args.sendResult.isSessionExpired,
      },
    });
  }
}

const FB_FOLLOW_RETRY_TEXT =
  "Sepertinya Page belum di-follow. Ikuti Page dulu lewat tombol Ikuti Page, lalu klik Sudah Follow lagi di Messenger.";

function postFollowGateStatuses(): LeadMagnetEnrollmentRow["status"][] {
  return ["follow_validated", "framework_offered", "material_offer_skipped", "delivered"];
}

type DmButton = { type: "postback"; title: string; payload: string }
  | { type: "web_url"; title: string; url: string };

async function buildFollowGateButtons(
  enrollment: LeadMagnetEnrollmentRow,
  campaign: LeadMagnetCampaignRow,
  pageId: string,
): Promise<DmButton[]> {
  if (enrollment.platform === "facebook") {
    return buildFacebookFollowGateButtons(enrollment, pageId, campaign.follow_button_label);
  }
  return [await buildLeadMagnetActionButton(
    enrollment,
    campaign.follow_button_label,
    "follow_confirm",
  )];
}

/** Unified first-contact DM: Instagram private reply (tiered) for all follower/non-follower paths. */
export async function sendFirstContactDm(
  admin: SupabaseClient,
  args: {
    enrollment: LeadMagnetEnrollmentRow;
    campaign: LeadMagnetCampaignRow;
    accessToken: string;
    pageId: string;
    text: string;
    buttons?: DmButton[];
    step: "follow_gate" | "framework_offer" | "delivery";
  },
): Promise<LeadMagnetSendResult> {
  const sendResult = await sendLeadMagnetDm(admin, {
    platform: args.enrollment.platform,
    organizationId: args.enrollment.organization_id,
    accountId: args.campaign.account_id,
    pageId: args.pageId,
    accessToken: args.accessToken,
    recipientScopedId: args.enrollment.participant_scoped_id,
    participantUsername: args.enrollment.participant_username,
    text: args.text,
    buttons: args.buttons,
    existingConversationId: args.enrollment.conversation_id,
    commentIdForPrivateReply: firstContactPrivateReplyCommentId(args.enrollment),
    deferPersistence: false,
  });

  if (isPrivateReplyFirstContact(args.enrollment)) {
    await recordPrivateReplyOutcome(admin, {
      enrollment: args.enrollment,
      campaign: args.campaign,
      sendResult,
      step: args.step,
    });
  }

  return sendResult;
}

async function recordFollowGateSent(
  admin: SupabaseClient,
  args: {
    enrollment: LeadMagnetEnrollmentRow;
    campaign: LeadMagnetCampaignRow;
    conversationId: string | null | undefined;
    privateReplyPatch?: Record<string, unknown>;
  },
): Promise<void> {
  if (!args.conversationId) return;
  await updateEnrollmentStatus(admin, args.enrollment.id, "follow_gate_sent", {
    conversation_id: args.conversationId,
    conversation_table: args.enrollment.platform === "instagram"
      ? "instagram_conversations"
      : "facebook_conversations",
    ...(args.privateReplyPatch ?? {}),
  });
  await logLeadMagnetFunnelEvent(admin, {
    enrollmentId: args.enrollment.id,
    campaignId: args.campaign.id,
    organizationId: args.enrollment.organization_id,
    eventType: "follow_gate_sent",
  });
}

export async function runFollowCheckAndDmFlow(
  admin: SupabaseClient,
  args: {
    enrollment: LeadMagnetEnrollmentRow;
    campaign: LeadMagnetCampaignRow;
    accessToken: string;
    pageId: string;
  },
): Promise<void> {
  if (args.enrollment.status === "paused" || args.enrollment.status === "delivered" || args.enrollment.status === "failed") {
    return;
  }

  const username = args.enrollment.participant_username;
  let profile = await fetchParticipantProfile(args.enrollment.participant_scoped_id, args.accessToken);
  if (!profile.username && username) profile = { ...profile, username };

  const isFollower = profile.isFollower;
  await updateEnrollmentStatus(admin, args.enrollment.id, "follow_checked", {
    is_follower_at_start: isFollower,
  });
  await logLeadMagnetFunnelEvent(admin, {
    enrollmentId: args.enrollment.id,
    campaignId: args.campaign.id,
    organizationId: args.enrollment.organization_id,
    eventType: isFollower === null ? "follow_check_failed" : "follow_checked",
    metadata: { is_follower: isFollower },
  });

  if (isFollower === true && args.campaign.skip_follow_gate_if_follower) {
    await sendMaterialOfferOrDelivery(admin, {
      enrollment: args.enrollment,
      campaign: args.campaign,
      accessToken: args.accessToken,
      pageId: args.pageId,
    });
    return;
  }

  await sendFollowGate(admin, {
    enrollment: args.enrollment,
    campaign: args.campaign,
    accessToken: args.accessToken,
    pageId: args.pageId,
  });
}

export async function sendFollowGate(
  admin: SupabaseClient,
  args: {
    enrollment: LeadMagnetEnrollmentRow;
    campaign: LeadMagnetCampaignRow;
    accessToken: string;
    pageId: string;
    textOverride?: string;
  },
): Promise<void> {
  const text = args.textOverride
    ?? interpolateLeadMagnetText(args.campaign.follow_gate_text, args.enrollment.participant_username);
  const buttons = await buildFollowGateButtons(args.enrollment, args.campaign, args.pageId);

  const sendResult = needsFirstContactDm(args.enrollment)
    ? await sendFirstContactDm(admin, {
      enrollment: args.enrollment,
      campaign: args.campaign,
      accessToken: args.accessToken,
      pageId: args.pageId,
      text,
      buttons,
      step: "follow_gate",
    })
    : await sendLeadMagnetDm(admin, {
      platform: args.enrollment.platform,
      organizationId: args.enrollment.organization_id,
      accountId: args.campaign.account_id,
      pageId: args.pageId,
      accessToken: args.accessToken,
      recipientScopedId: args.enrollment.participant_scoped_id,
      participantUsername: args.enrollment.participant_username,
      text,
      buttons,
      existingConversationId: args.enrollment.conversation_id,
      deferPersistence: false,
    });

  if (!sendResult.ok) {
    await updateEnrollmentStatus(admin, args.enrollment.id, "failed", {
      last_error: sendResult.error ?? "DM send failed",
      conversation_id: sendResult.conversationId,
      conversation_table: args.enrollment.platform === "instagram"
        ? "instagram_conversations"
        : "facebook_conversations",
    });
    deferFollowGateWork(logLeadMagnetFunnelEvent(admin, {
      enrollmentId: args.enrollment.id,
      campaignId: args.campaign.id,
      organizationId: args.enrollment.organization_id,
      eventType: "dm_failed",
      metadata: { step: "follow_gate", error: sendResult.error, session_expired: sendResult.isSessionExpired },
    }));
    return;
  }

  const privateReplyPatch = buildPrivateReplyEnrollmentPatch(sendResult);
  deferFollowGateWork(recordFollowGateSent(admin, {
    enrollment: args.enrollment,
    campaign: args.campaign,
    conversationId: sendResult.conversationId,
    privateReplyPatch,
  }));
}

export async function sendFrameworkOffer(
  admin: SupabaseClient,
  args: {
    enrollment: LeadMagnetEnrollmentRow;
    campaign: LeadMagnetCampaignRow;
    accessToken: string;
    pageId: string;
  },
): Promise<void> {
  if (args.enrollment.status === "framework_offered" || args.enrollment.status === "delivered") {
    return;
  }

  const now = new Date().toISOString();
  const { data: claimed } = await admin
    .from("lead_magnet_enrollments")
    .update({ status: "framework_offered", updated_at: now })
    .eq("id", args.enrollment.id)
    .in("status", ["follow_validated", "material_offer_skipped"])
    .select("id")
    .maybeSingle();

  if (!claimed?.id) return;

  const text = interpolateLeadMagnetText(args.campaign.framework_offer_text, args.enrollment.participant_username);
  const buttons = [await buildLeadMagnetActionButton(
    args.enrollment,
    args.campaign.framework_button_label,
    "get_framework",
  )];

  const sendResult = needsFirstContactDm(args.enrollment)
    ? await sendFirstContactDm(admin, {
      enrollment: args.enrollment,
      campaign: args.campaign,
      accessToken: args.accessToken,
      pageId: args.pageId,
      text,
      buttons,
      step: "framework_offer",
    })
    : await sendLeadMagnetDm(admin, {
      platform: args.enrollment.platform,
      organizationId: args.enrollment.organization_id,
      accountId: args.campaign.account_id,
      pageId: args.pageId,
      accessToken: args.accessToken,
      recipientScopedId: args.enrollment.participant_scoped_id,
      participantUsername: args.enrollment.participant_username,
      text,
      buttons,
      existingConversationId: args.enrollment.conversation_id,
      deferPersistence: false,
    });

  if (!sendResult.ok) {
    await updateEnrollmentStatus(admin, args.enrollment.id, "follow_validated", {
      last_error: sendResult.error ?? "DM send failed",
    });
    deferFollowGateWork(logLeadMagnetFunnelEvent(admin, {
      enrollmentId: args.enrollment.id,
      campaignId: args.campaign.id,
      organizationId: args.enrollment.organization_id,
      eventType: "dm_failed",
      metadata: { step: "framework_offer", error: sendResult.error, session_expired: sendResult.isSessionExpired },
    }));
    return;
  }

  const privateReplyPatch = buildPrivateReplyEnrollmentPatch(sendResult);
  deferFollowGateWork((async () => {
    await updateEnrollmentStatus(admin, args.enrollment.id, "framework_offered", {
      conversation_id: sendResult.conversationId ?? args.enrollment.conversation_id,
      conversation_table: args.enrollment.platform === "instagram"
        ? "instagram_conversations"
        : "facebook_conversations",
      ...privateReplyPatch,
    });
    await logLeadMagnetFunnelEvent(admin, {
      enrollmentId: args.enrollment.id,
      campaignId: args.campaign.id,
      organizationId: args.enrollment.organization_id,
      eventType: "framework_offered",
    });
  })());
}

async function sendMaterialOfferOrDelivery(
  admin: SupabaseClient,
  args: {
    enrollment: LeadMagnetEnrollmentRow;
    campaign: LeadMagnetCampaignRow;
    accessToken: string;
    pageId: string;
  },
): Promise<void> {
  if (args.campaign.skip_material_offer) {
    deferFollowGateWork(logLeadMagnetFunnelEvent(admin, {
      enrollmentId: args.enrollment.id,
      campaignId: args.campaign.id,
      organizationId: args.enrollment.organization_id,
      eventType: "material_offer_skipped",
      metadata: { reason: "campaign_setting" },
    }));
    await sendDeliveryMessage(admin, args);
    return;
  }
  await sendFrameworkOffer(admin, args);
}

export async function sendDeliveryMessage(
  admin: SupabaseClient,
  args: {
    enrollment: LeadMagnetEnrollmentRow;
    campaign: LeadMagnetCampaignRow;
    accessToken: string;
    pageId: string;
  },
): Promise<void> {
  if (args.enrollment.status === "delivered") {
    return;
  }

  const now = new Date().toISOString();
  const { data: claimed } = await admin
    .from("lead_magnet_enrollments")
    .update({ status: "delivered", updated_at: now })
    .eq("id", args.enrollment.id)
    .in("status", ["framework_offered", "follow_validated", "material_offer_skipped"])
    .select("id")
    .maybeSingle();

  if (!claimed?.id) return;

  const text = interpolateLeadMagnetText(args.campaign.delivery_text, args.enrollment.participant_username);
  const buttons = [{
    type: "web_url" as const,
    title: args.campaign.delivery_button_label,
    url: args.campaign.delivery_url,
  }];

  const sendResult = needsFirstContactDm(args.enrollment)
    ? await sendFirstContactDm(admin, {
      enrollment: args.enrollment,
      campaign: args.campaign,
      accessToken: args.accessToken,
      pageId: args.pageId,
      text,
      buttons,
      step: "delivery",
    })
    : await sendLeadMagnetDm(admin, {
      platform: args.enrollment.platform,
      organizationId: args.enrollment.organization_id,
      accountId: args.campaign.account_id,
      pageId: args.pageId,
      accessToken: args.accessToken,
      recipientScopedId: args.enrollment.participant_scoped_id,
      participantUsername: args.enrollment.participant_username,
      text,
      buttons,
      existingConversationId: args.enrollment.conversation_id,
      deferPersistence: false,
    });

  if (!sendResult.ok) {
    await updateEnrollmentStatus(admin, args.enrollment.id, "framework_offered", {
      last_error: sendResult.error ?? "Delivery DM failed",
    });
    deferFollowGateWork(logLeadMagnetFunnelEvent(admin, {
      enrollmentId: args.enrollment.id,
      campaignId: args.campaign.id,
      organizationId: args.enrollment.organization_id,
      eventType: "dm_failed",
      metadata: { step: "delivery", error: sendResult.error, session_expired: sendResult.isSessionExpired },
    }));
    return;
  }

  const privateReplyPatch = buildPrivateReplyEnrollmentPatch(sendResult);
  deferFollowGateWork((async () => {
    await updateEnrollmentStatus(admin, args.enrollment.id, "delivered", {
      conversation_id: sendResult.conversationId ?? args.enrollment.conversation_id,
      conversation_table: args.enrollment.platform === "instagram"
        ? "instagram_conversations"
        : "facebook_conversations",
      ...privateReplyPatch,
    });
    await logLeadMagnetFunnelEvent(admin, {
      enrollmentId: args.enrollment.id,
      campaignId: args.campaign.id,
      organizationId: args.enrollment.organization_id,
      eventType: "delivered",
    });
  })());
}

export async function handleFollowConfirmPostback(
  admin: SupabaseClient,
  args: {
    enrollment: LeadMagnetEnrollmentRow;
    campaign: LeadMagnetCampaignRow;
    accessToken: string;
    pageId: string;
  },
): Promise<FollowConfirmResult> {
  if (args.enrollment.status === "paused") {
    return { outcome: "already_processed" };
  }

  if (postFollowGateStatuses().includes(args.enrollment.status)) {
    return { outcome: "already_processed" };
  }

  if (args.enrollment.status !== "follow_gate_sent") {
    return { outcome: "already_processed" };
  }

  const attempts = args.enrollment.follow_confirm_attempts ?? 0;

  if (args.enrollment.platform === "facebook" && attempts < 1) {
    const now = new Date().toISOString();
    await admin
      .from("lead_magnet_enrollments")
      .update({ follow_confirm_attempts: attempts + 1, updated_at: now })
      .eq("id", args.enrollment.id)
      .eq("status", "follow_gate_sent");

    await logLeadMagnetFunnelEvent(admin, {
      enrollmentId: args.enrollment.id,
      campaignId: args.campaign.id,
      organizationId: args.enrollment.organization_id,
      eventType: "follow_retry",
      metadata: { platform: "facebook", attempt: attempts + 1 },
    });

    await sendFollowGate(admin, {
      ...args,
      textOverride: FB_FOLLOW_RETRY_TEXT,
    });

    return { outcome: "blocked", reason: "fb_first_confirm" };
  }

  if (args.enrollment.platform === "instagram") {
    const profile = await fetchParticipantProfile(args.enrollment.participant_scoped_id, args.accessToken);
    if (profile.isFollower !== true) {
      await logLeadMagnetFunnelEvent(admin, {
        enrollmentId: args.enrollment.id,
        campaignId: args.campaign.id,
        organizationId: args.enrollment.organization_id,
        eventType: "follow_retry",
      });
      await sendFollowGate(admin, args);
      return { outcome: "blocked", reason: "ig_not_following" };
    }
  }

  const now = new Date().toISOString();
  const becameFollowerPatch: Record<string, unknown> = {};
  if (
    args.enrollment.is_follower_at_start === false &&
    !args.enrollment.became_follower_at
  ) {
    becameFollowerPatch.became_follower_at = now;
  }

  const { data: claimed } = await admin
    .from("lead_magnet_enrollments")
    .update({
      status: "follow_validated",
      follow_confirm_attempts: attempts + 1,
      updated_at: now,
      ...becameFollowerPatch,
    })
    .eq("id", args.enrollment.id)
    .eq("status", "follow_gate_sent")
    .select("id")
    .maybeSingle();

  if (!claimed?.id) {
    return { outcome: "already_processed" };
  }

  await logLeadMagnetFunnelEvent(admin, {
    enrollmentId: args.enrollment.id,
    campaignId: args.campaign.id,
    organizationId: args.enrollment.organization_id,
    eventType: "follow_validated",
    metadata: { platform: args.enrollment.platform, attempt: attempts + 1 },
  });

  const validatedEnrollment: LeadMagnetEnrollmentRow = {
    ...args.enrollment,
    status: "follow_validated",
    follow_confirm_attempts: attempts + 1,
  };

  await sendMaterialOfferOrDelivery(admin, {
    ...args,
    enrollment: validatedEnrollment,
  });

  return { outcome: "material_sent" };
}
