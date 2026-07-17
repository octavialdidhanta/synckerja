import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { LeadMagnetCampaignRow, LeadMagnetEnrollmentRow } from "./types.ts";
import { interpolateLeadMagnetText, LEAD_MAGNET_DEFAULT_MESSAGES } from "./types.ts";
import type { FollowConfirmResult } from "./types.ts";
import { buildFacebookFollowGateButtons, buildLeadMagnetActionButton, buildLeadMagnetDeliveryButton } from "./leadMagnetActionButtons.ts";
import {
  fetchParticipantFollowCheck,
} from "./fetchParticipantProfile.ts";
import {
  followStatusToLegacyBoolean,
  LEAD_MAGNET_CONSENT_OPENER_TEXT,
  needsMessagingConsentRecheck,
  shouldSkipFollowGate,
  type FollowStatus,
} from "./followCheckStatus.ts";
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

const IG_FOLLOW_RETRY_TEXT =
  "Pastikan kamu sudah follow akun Instagram kami, lalu klik Sudah Follow sekali lagi di DM.";

function postFollowGateStatuses(): LeadMagnetEnrollmentRow["status"][] {
  return [
    "follow_validated",
    "framework_offered",
    "material_offer_skipped",
    "awaiting_contact",
    "contact_collected",
    "delivered",
    "delivered_whatsapp",
    "delivered_email",
    "delivered_instagram",
  ];
}

export function isPostContactGateEnrollmentStatus(status: string): boolean {
  return postFollowGateStatuses().includes(status as LeadMagnetEnrollmentRow["status"]);
}

/** Re-comment can downgrade status to comment_replied — restore before handling stale postbacks. */
async function restoreFollowGateStatusIfStale(
  admin: SupabaseClient,
  enrollment: LeadMagnetEnrollmentRow,
): Promise<LeadMagnetEnrollmentRow> {
  const restorable = new Set(["comment_replied", "comment_matched", "follow_checked"]);
  if (!restorable.has(enrollment.status)) return enrollment;
  if (!enrollment.private_reply_message_id?.trim()) return enrollment;

  const now = new Date().toISOString();
  const { data } = await admin
    .from("lead_magnet_enrollments")
    .update({ status: "follow_gate_sent", updated_at: now })
    .eq("id", enrollment.id)
    .in("status", [...restorable])
    .select("id")
    .maybeSingle();

  if (!data?.id) return enrollment;
  return { ...enrollment, status: "follow_gate_sent" };
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
    step: "follow_gate" | "framework_offer" | "delivery" | "consent_opener";
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

async function reloadEnrollmentRow(
  admin: SupabaseClient,
  enrollmentId: string,
): Promise<LeadMagnetEnrollmentRow | null> {
  const { data } = await admin
    .from("lead_magnet_enrollments")
    .select("*")
    .eq("id", enrollmentId)
    .maybeSingle();
  return (data as LeadMagnetEnrollmentRow | null) ?? null;
}

async function logInitialFollowCheck(
  admin: SupabaseClient,
  args: {
    enrollment: LeadMagnetEnrollmentRow;
    campaign: LeadMagnetCampaignRow;
    followStatus: FollowStatus;
  },
): Promise<void> {
  const legacyFollower = followStatusToLegacyBoolean(args.followStatus);
  await updateEnrollmentStatus(admin, args.enrollment.id, "follow_checked", {
    is_follower_at_start: legacyFollower,
  });
  await logLeadMagnetFunnelEvent(admin, {
    enrollmentId: args.enrollment.id,
    campaignId: args.campaign.id,
    organizationId: args.enrollment.organization_id,
    eventType: args.followStatus === "unknown" ? "follow_check_failed" : "follow_checked",
    metadata: {
      is_follower: legacyFollower,
      follow_status: args.followStatus,
    },
  });
}

async function advanceAfterFollowValidated(
  admin: SupabaseClient,
  args: {
    enrollment: LeadMagnetEnrollmentRow;
    campaign: LeadMagnetCampaignRow;
    accessToken: string;
    pageId: string;
    isFollower?: boolean;
  },
): Promise<boolean> {
  const { advanceAfterFollowValidated: route } = await import("./contactGate/advanceContactGate.ts");
  return route(admin, args);
}

async function skipFollowGateAndSendMaterial(
  admin: SupabaseClient,
  args: {
    enrollment: LeadMagnetEnrollmentRow;
    campaign: LeadMagnetCampaignRow;
    accessToken: string;
    pageId: string;
  },
  metadata: Record<string, unknown>,
): Promise<void> {
  await updateEnrollmentStatus(admin, args.enrollment.id, "follow_validated");
  await logLeadMagnetFunnelEvent(admin, {
    enrollmentId: args.enrollment.id,
    campaignId: args.campaign.id,
    organizationId: args.enrollment.organization_id,
    eventType: "follow_gate_skipped_follower",
    metadata,
  });
  await advanceAfterFollowValidated(admin, {
    ...args,
    enrollment: { ...args.enrollment, status: "follow_validated" },
    isFollower: true,
  });
}

async function runSkipFollowGateOpenerRecheckFlow(
  admin: SupabaseClient,
  args: {
    enrollment: LeadMagnetEnrollmentRow;
    campaign: LeadMagnetCampaignRow;
    accessToken: string;
    pageId: string;
  },
  initialStatus: FollowStatus,
): Promise<void> {
  const openerText = interpolateLeadMagnetText(
    LEAD_MAGNET_CONSENT_OPENER_TEXT,
    args.enrollment.participant_username,
  );
  const openerResult = await sendFirstContactDm(admin, {
    enrollment: args.enrollment,
    campaign: args.campaign,
    accessToken: args.accessToken,
    pageId: args.pageId,
    text: openerText,
    step: "consent_opener",
  });

  if (!openerResult.ok) {
    await sendFollowGate(admin, args);
    return;
  }

  const privateReplyPatch = buildPrivateReplyEnrollmentPatch(openerResult);
  await updateEnrollmentStatus(admin, args.enrollment.id, "follow_checked", {
    ...privateReplyPatch,
    conversation_id: openerResult.conversationId ?? args.enrollment.conversation_id,
    conversation_table: "instagram_conversations",
  });

  const enrollmentAfterOpener = await reloadEnrollmentRow(admin, args.enrollment.id);
  const flowEnrollment = enrollmentAfterOpener ?? {
    ...args.enrollment,
    ...privateReplyPatch,
    private_reply_message_id: openerResult.messageId ?? args.enrollment.private_reply_message_id ?? null,
    conversation_id: openerResult.conversationId ?? args.enrollment.conversation_id,
  };

  const recheck = await fetchParticipantFollowCheck(
    args.enrollment.participant_scoped_id,
    args.accessToken,
    { messagingWindowOpen: true },
  );
  const afterLegacy = followStatusToLegacyBoolean(recheck.status);

  await updateEnrollmentStatus(admin, args.enrollment.id, "follow_checked", {
    is_follower_at_start: followStatusToLegacyBoolean(initialStatus),
  });

  await logLeadMagnetFunnelEvent(admin, {
    enrollmentId: args.enrollment.id,
    campaignId: args.campaign.id,
    organizationId: args.enrollment.organization_id,
    eventType: "follow_rechecked_after_opener",
    metadata: {
      follow_status_before: initialStatus,
      follow_status_after: recheck.status,
      is_follower_before: followStatusToLegacyBoolean(initialStatus),
      is_follower_after: afterLegacy,
      username: recheck.username,
    },
  });

  if (recheck.status === "follower") {
    await skipFollowGateAndSendMaterial(admin, {
      ...args,
      enrollment: flowEnrollment,
    }, {
      reason: "recheck_after_opener",
      follow_status_after: recheck.status,
    });
    return;
  }

  await sendFollowGate(admin, {
    ...args,
    enrollment: flowEnrollment,
  });
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
  const reloaded = await reloadEnrollmentRow(admin, args.enrollment.id);
  const enrollment = reloaded ?? args.enrollment;

  if (enrollment.status === "paused" || enrollment.status === "failed") {
    return;
  }
  if (isPostContactGateEnrollmentStatus(enrollment.status)) {
    return;
  }
  if (enrollment.status === "delivered") {
    return;
  }

  const username = enrollment.participant_username;
  let profile = await fetchParticipantFollowCheck(
    enrollment.participant_scoped_id,
    args.accessToken,
  );
  if (!profile.username && username) profile = { ...profile, username };

  const followStatus = profile.status;
  await logInitialFollowCheck(admin, {
    enrollment,
    campaign: args.campaign,
    followStatus,
  });

  if (shouldSkipFollowGate(args.campaign, followStatus)) {
    await skipFollowGateAndSendMaterial(admin, { ...args, enrollment }, {
      reason: "follower_at_comment_check",
      follow_status: followStatus,
    });
    return;
  }

  if (needsMessagingConsentRecheck(enrollment, args.campaign, followStatus)) {
    await runSkipFollowGateOpenerRecheckFlow(admin, { ...args, enrollment }, followStatus);
    return;
  }

  await sendFollowGate(admin, {
    enrollment,
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
): Promise<boolean> {
  if (args.enrollment.status === "framework_offered" || args.enrollment.status === "delivered") {
    return true;
  }

  const now = new Date().toISOString();
  const { data: claimed } = await admin
    .from("lead_magnet_enrollments")
    .update({ status: "framework_offered", updated_at: now })
    .eq("id", args.enrollment.id)
    .in("status", ["follow_validated", "material_offer_skipped"])
    .select("id")
    .maybeSingle();

  if (!claimed?.id) return false;

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
    return false;
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
  return true;
}

export async function resendFrameworkOfferDm(
  admin: SupabaseClient,
  args: {
    enrollment: LeadMagnetEnrollmentRow;
    campaign: LeadMagnetCampaignRow;
    accessToken: string;
    pageId: string;
  },
): Promise<{ ok: boolean; messageId?: string | null; error?: string }> {
  const text = interpolateLeadMagnetText(args.campaign.framework_offer_text, args.enrollment.participant_username);
  const buttons = [await buildLeadMagnetActionButton(
    args.enrollment,
    args.campaign.framework_button_label,
    "get_framework",
  )];

  const sendResult = await sendLeadMagnetDm(admin, {
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

  return {
    ok: sendResult.ok,
    messageId: sendResult.messageId,
    error: sendResult.error,
  };
}

export async function sendMaterialOfferOrDelivery(
  admin: SupabaseClient,
  args: {
    enrollment: LeadMagnetEnrollmentRow;
    campaign: LeadMagnetCampaignRow;
    accessToken: string;
    pageId: string;
  },
): Promise<boolean> {
  if (args.campaign.skip_material_offer) {
    deferFollowGateWork(logLeadMagnetFunnelEvent(admin, {
      enrollmentId: args.enrollment.id,
      campaignId: args.campaign.id,
      organizationId: args.enrollment.organization_id,
      eventType: "material_offer_skipped",
      metadata: { reason: "campaign_setting" },
    }));
    return sendDeliveryMessage(admin, args);
  }
  return sendFrameworkOffer(admin, args);
}

export async function sendDeliveryMessage(
  admin: SupabaseClient,
  args: {
    enrollment: LeadMagnetEnrollmentRow;
    campaign: LeadMagnetCampaignRow;
    accessToken: string;
    pageId: string;
    deliveryChannel?: "instagram";
    isFallback?: boolean;
  },
): Promise<boolean> {
  const deliveredStatuses = new Set([
    "delivered",
    "delivered_instagram",
    "delivered_whatsapp",
    "delivered_email",
  ]);
  if (deliveredStatuses.has(args.enrollment.status)) {
    return true;
  }

  const targetStatus = args.deliveryChannel === "instagram" ? "delivered_instagram" : "delivered";
  const claimFrom = [
    "framework_offered",
    "follow_validated",
    "material_offer_skipped",
    "contact_collected",
    "awaiting_contact",
  ];

  const now = new Date().toISOString();
  const { data: claimed } = await admin
    .from("lead_magnet_enrollments")
    .update({ status: targetStatus, updated_at: now })
    .eq("id", args.enrollment.id)
    .in("status", claimFrom)
    .select("id")
    .maybeSingle();

  if (!claimed?.id) return false;

  const deliveryTemplate = args.isFallback
    ? String(
      args.campaign.delivery_fallback_text
        ?? LEAD_MAGNET_DEFAULT_MESSAGES.delivery_fallback_text
        ?? args.campaign.delivery_text,
    )
    : args.campaign.delivery_text;
  const text = interpolateLeadMagnetText(deliveryTemplate, args.enrollment.participant_username);
  const buttons = [await buildLeadMagnetDeliveryButton(
    args.enrollment,
    args.campaign.delivery_button_label,
  )];

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
    return false;
  }

  const privateReplyPatch = buildPrivateReplyEnrollmentPatch(sendResult);
  deferFollowGateWork((async () => {
    await updateEnrollmentStatus(admin, args.enrollment.id, targetStatus, {
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
      eventType: targetStatus === "delivered_instagram" ? "delivery_instagram_sent" : "delivered",
      metadata: args.deliveryChannel === "instagram"
        ? { channel: "instagram", fallback: args.isFallback === true }
        : undefined,
    });
  })());
  return true;
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

  const enrollment = await restoreFollowGateStatusIfStale(admin, args.enrollment);
  const flowArgs = { ...args, enrollment };

  if (postFollowGateStatuses().includes(flowArgs.enrollment.status)) {
    return { outcome: "already_processed" };
  }

  if (flowArgs.enrollment.status !== "follow_gate_sent") {
    return { outcome: "already_processed" };
  }

  const attempts = flowArgs.enrollment.follow_confirm_attempts ?? 0;

  // IG + FB: 2-step honor flow. Meta is_user_follow_business is often false even when user follows.
  if (attempts < 1) {
    const now = new Date().toISOString();
    await admin
      .from("lead_magnet_enrollments")
      .update({ follow_confirm_attempts: attempts + 1, updated_at: now })
      .eq("id", flowArgs.enrollment.id)
      .eq("status", "follow_gate_sent");

    const retryText = flowArgs.enrollment.platform === "facebook"
      ? FB_FOLLOW_RETRY_TEXT
      : IG_FOLLOW_RETRY_TEXT;

    if (flowArgs.enrollment.platform === "instagram") {
      const profile = await fetchParticipantFollowCheck(
        flowArgs.enrollment.participant_scoped_id,
        flowArgs.accessToken,
        { messagingWindowOpen: true },
      );
      if (profile.status === "follower") {
        // API confirms follow on first click — skip friction, proceed below.
      } else {
        await logLeadMagnetFunnelEvent(admin, {
          enrollmentId: flowArgs.enrollment.id,
          campaignId: flowArgs.campaign.id,
          organizationId: flowArgs.enrollment.organization_id,
          eventType: "follow_retry",
          metadata: {
            platform: "instagram",
            attempt: attempts + 1,
            is_follower: profile.isFollower,
            follow_status: profile.status,
            username: profile.username,
          },
        });
        await sendFollowGate(admin, { ...flowArgs, textOverride: retryText });
        return { outcome: "blocked", reason: "ig_first_confirm" };
      }
    } else {
      await logLeadMagnetFunnelEvent(admin, {
        enrollmentId: flowArgs.enrollment.id,
        campaignId: flowArgs.campaign.id,
        organizationId: flowArgs.enrollment.organization_id,
        eventType: "follow_retry",
        metadata: { platform: "facebook", attempt: attempts + 1 },
      });
      await sendFollowGate(admin, { ...flowArgs, textOverride: retryText });
      return { outcome: "blocked", reason: "fb_first_confirm" };
    }
  }

  if (flowArgs.enrollment.platform === "instagram") {
    const profile = await fetchParticipantFollowCheck(
      flowArgs.enrollment.participant_scoped_id,
      flowArgs.accessToken,
      { messagingWindowOpen: true },
    );
    await logLeadMagnetFunnelEvent(admin, {
      enrollmentId: flowArgs.enrollment.id,
      campaignId: flowArgs.campaign.id,
      organizationId: flowArgs.enrollment.organization_id,
      eventType: "follow_validated",
      metadata: {
        platform: "instagram",
        attempt: attempts + 1,
        is_follower: profile.isFollower,
        follow_status: profile.status,
        username: profile.username,
        honor_bypass: profile.status !== "follower",
      },
    });
  }

  const now = new Date().toISOString();
  const becameFollowerPatch: Record<string, unknown> = {};
  if (
    flowArgs.enrollment.is_follower_at_start === false &&
    !flowArgs.enrollment.became_follower_at
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
    .eq("id", flowArgs.enrollment.id)
    .eq("status", "follow_gate_sent")
    .select("id")
    .maybeSingle();

  if (!claimed?.id) {
    return { outcome: "already_processed" };
  }

  await logLeadMagnetFunnelEvent(admin, {
    enrollmentId: flowArgs.enrollment.id,
    campaignId: flowArgs.campaign.id,
    organizationId: flowArgs.enrollment.organization_id,
    eventType: "follow_validated",
    metadata: { platform: flowArgs.enrollment.platform, attempt: attempts + 1 },
  });

  const validatedEnrollment: LeadMagnetEnrollmentRow = {
    ...flowArgs.enrollment,
    status: "follow_validated",
    follow_confirm_attempts: attempts + 1,
  };

  const materialSent = await advanceAfterFollowValidated(admin, {
    ...flowArgs,
    enrollment: validatedEnrollment,
    isFollower: true,
  });

  return materialSent ? { outcome: "material_sent" } : { outcome: "dm_failed" };
}

/** Admin/helper resend — uses campaign delivery_url with signed download button. */
export async function resendLeadMagnetDeliveryDm(
  admin: SupabaseClient,
  args: {
    enrollment: LeadMagnetEnrollmentRow;
    campaign: LeadMagnetCampaignRow;
    accessToken: string;
    pageId: string;
  },
): Promise<{ ok: boolean; messageId?: string | null; error?: string }> {
  const text = interpolateLeadMagnetText(args.campaign.delivery_text, args.enrollment.participant_username);
  const buttons = [await buildLeadMagnetDeliveryButton(
    args.enrollment,
    args.campaign.delivery_button_label,
  )];

  const sendResult = await sendLeadMagnetDm(admin, {
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

  return {
    ok: sendResult.ok,
    messageId: sendResult.messageId,
    error: sendResult.error,
  };
}
