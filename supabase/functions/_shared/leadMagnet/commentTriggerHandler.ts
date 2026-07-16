import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { replyMetaComment } from "../metaContentApi.ts";
import { findMatchingLeadMagnetCampaign } from "./campaignMatcher.ts";
import { createLeadMagnetLead } from "./createLeadMagnetLead.ts";
import { fetchCommentText } from "./fetchParticipantProfile.ts";
import { logLeadMagnetFunnelEvent, updateEnrollmentStatus } from "./funnelAnalytics.ts";
import { runFollowCheckAndDmFlow } from "./followGateRuntime.ts";
import { deferLeadMagnetWork } from "./webhookBridge.ts";
import type { LeadMagnetCommentTriggerInput, LeadMagnetEnrollmentRow } from "./types.ts";

function buildPublicCommentReply(text: string, username: string | null): string {
  const handle = (username ?? "").trim().replace(/^@/, "");
  if (!handle) return text;
  const mention = `@${handle}`;
  if (text.includes(mention)) return text;
  return `${mention} ${text}`;
}

async function sendPublicCommentReply(
  admin: SupabaseClient,
  args: {
    platform: LeadMagnetCommentTriggerInput["platform"];
    commentId: string;
    accessToken: string;
    campaign: { id: string; comment_reply_text: string };
    organizationId: string;
    enrollmentId: string;
    authorUsername: string | null;
    retry?: boolean;
  },
): Promise<boolean> {
  const advancedStatuses = new Set([
    "follow_gate_sent",
    "follow_checked",
    "follow_validated",
    "framework_offered",
    "material_offer_skipped",
    "delivered",
  ]);

  try {
    const replyText = buildPublicCommentReply(args.campaign.comment_reply_text, args.authorUsername);
    const replyResult = await replyMetaComment(args.platform, args.commentId, replyText, args.accessToken);
    deferLeadMagnetWork((async () => {
      const { data: current } = await admin
        .from("lead_magnet_enrollments")
        .select("status")
        .eq("id", args.enrollmentId)
        .maybeSingle();
      const currentStatus = (current?.status as string | undefined) ?? "comment_replied";
      const nextStatus = advancedStatuses.has(currentStatus) ? currentStatus : "comment_replied";

      await updateEnrollmentStatus(admin, args.enrollmentId, nextStatus, {
        comment_reply_id: replyResult.id,
      });
      await logLeadMagnetFunnelEvent(admin, {
        enrollmentId: args.enrollmentId,
        campaignId: args.campaign.id,
        organizationId: args.organizationId,
        eventType: "comment_reply_sent",
        metadata: {
          reply_id: replyResult.id,
          comment_id: args.commentId,
          ...(args.retry ? { retry: true } : {}),
        },
      });
      await logLeadMagnetFunnelEvent(admin, {
        enrollmentId: args.enrollmentId,
        campaignId: args.campaign.id,
        organizationId: args.organizationId,
        eventType: "comment_replied",
        metadata: args.retry ? { retry: true } : undefined,
      });
    })());
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[lead-magnet] comment reply failed:", msg);
    deferLeadMagnetWork(updateEnrollmentStatus(admin, args.enrollmentId, "comment_replied", {
      last_error: `comment_reply: ${msg}`,
    }));
    return false;
  }
}

function scheduleFollowCheckAndDmFlow(
  admin: SupabaseClient,
  args: {
    enrollment: LeadMagnetEnrollmentRow;
    campaign: Parameters<typeof runFollowCheckAndDmFlow>[1]["campaign"];
    accessToken: string;
    pageId: string;
  },
): void {
  deferLeadMagnetWork(
    runFollowCheckAndDmFlow(admin, args).catch((err) => {
      console.error("[lead-magnet] deferred DM flow failed:", err);
    }),
  );
}

function isFacebookSessionExpiredError(lastError: string | null | undefined): boolean {
  const err = (lastError ?? "").toLowerCase();
  return err.includes("outside the allowed window") || err.includes("(#10)");
}

function canRestartFacebookDmFlow(existing: Record<string, unknown>): boolean {
  const status = String(existing.status ?? "");
  if (status === "follow_gate_sent") return true;
  if (!isFacebookSessionExpiredError(existing.last_error as string | null)) return false;
  return ["follow_validated", "framework_offered", "failed"].includes(status);
}

export async function handleLeadMagnetCommentTrigger(
  admin: SupabaseClient,
  input: LeadMagnetCommentTriggerInput,
): Promise<boolean> {
  let commentText = input.commentText.trim();
  let authorUsername = input.authorUsername;

  if (!commentText) {
    const fetched = await fetchCommentText(input.commentId, input.accessToken);
    commentText = (fetched.text ?? "").trim();
    if (!authorUsername && fetched.username) authorUsername = fetched.username;
  }

  if (!commentText) {
    console.log("[lead-magnet] skip comment without text", input.commentId);
    return false;
  }

  const campaign = await findMatchingLeadMagnetCampaign(admin, {
    organizationId: input.organizationId,
    platform: input.platform,
    accountId: input.accountId,
    mediaId: input.mediaId,
    commentText,
  });

  if (!campaign) return false;

  const enrollmentId = crypto.randomUUID();
  const now = new Date().toISOString();

  const { error: enrollErr } = await admin.from("lead_magnet_enrollments").insert({
    id: enrollmentId,
    organization_id: input.organizationId,
    campaign_id: campaign.id,
    platform: input.platform,
    participant_scoped_id: input.authorScopedId,
    participant_username: authorUsername,
    comment_id: input.commentId,
    media_id: input.mediaId,
    status: "comment_matched",
    created_at: now,
    updated_at: now,
  });

  if (enrollErr) {
    if (enrollErr.code === "23505") {
      const { data: existing } = await admin
        .from("lead_magnet_enrollments")
        .select("*")
        .eq("campaign_id", campaign.id)
        .eq("participant_scoped_id", input.authorScopedId)
        .maybeSingle();

      const canRetryFailedFirstContact = existing
        && !existing.private_reply_message_id
        && (existing.status === "failed" || existing.status === "comment_replied")
        && (input.platform === "instagram" || input.platform === "facebook");

      const canResendFacebookFollowGate = existing
        && input.platform === "facebook"
        && canRestartFacebookDmFlow(existing);

      if (canResendFacebookFollowGate && existing) {
        console.log("[lead-magnet] restart FB DM flow after new comment", existing.id, input.commentId, existing.status);
        await admin.from("lead_magnet_enrollments").update({
          comment_id: input.commentId,
          media_id: input.mediaId,
          participant_username: authorUsername ?? existing.participant_username,
          status: "comment_matched",
          private_reply_message_id: null,
          private_reply_sent_at: null,
          first_dm_method: null,
          follow_confirm_attempts: 0,
          last_error: null,
          updated_at: new Date().toISOString(),
        }).eq("id", existing.id);

        const enrollmentRow: LeadMagnetEnrollmentRow = {
          id: existing.id as string,
          organization_id: existing.organization_id as string,
          campaign_id: existing.campaign_id as string,
          platform: existing.platform as LeadMagnetEnrollmentRow["platform"],
          participant_scoped_id: existing.participant_scoped_id as string,
          participant_username: (authorUsername ?? existing.participant_username) as string | null,
          comment_id: input.commentId,
          media_id: input.mediaId,
          conversation_id: (existing.conversation_id as string | null) ?? null,
          conversation_table: (existing.conversation_table as string | null) ?? null,
          lead_submission_id: (existing.lead_submission_id as string | null) ?? null,
          lead_id: (existing.lead_id as string | null) ?? null,
          status: "comment_matched",
          paused_reason: (existing.paused_reason as string | null) ?? null,
          is_follower_at_start: null,
          last_error: null,
        };

        await sendPublicCommentReply(admin, {
          platform: input.platform,
          commentId: input.commentId,
          accessToken: input.accessToken,
          campaign,
          organizationId: input.organizationId,
          enrollmentId: existing.id as string,
          authorUsername,
          retry: true,
        });

        scheduleFollowCheckAndDmFlow(admin, {
          enrollment: enrollmentRow,
          campaign,
          accessToken: input.accessToken,
          pageId: input.pageId,
        });
        return true;
      }

      if (canRetryFailedFirstContact && existing) {
        console.log("[lead-magnet] retry failed enrollment with new comment", existing.id, input.commentId);
        await admin.from("lead_magnet_enrollments").update({
          comment_id: input.commentId,
          media_id: input.mediaId,
          participant_username: authorUsername ?? existing.participant_username,
          status: "comment_matched",
          last_error: null,
          updated_at: new Date().toISOString(),
        }).eq("id", existing.id);

        const enrollmentRow: LeadMagnetEnrollmentRow = {
          id: existing.id as string,
          organization_id: existing.organization_id as string,
          campaign_id: existing.campaign_id as string,
          platform: existing.platform as LeadMagnetEnrollmentRow["platform"],
          participant_scoped_id: existing.participant_scoped_id as string,
          participant_username: (authorUsername ?? existing.participant_username) as string | null,
          comment_id: input.commentId,
          media_id: input.mediaId,
          conversation_id: null,
          conversation_table: null,
          lead_submission_id: (existing.lead_submission_id as string | null) ?? null,
          lead_id: (existing.lead_id as string | null) ?? null,
          status: "comment_matched",
          paused_reason: (existing.paused_reason as string | null) ?? null,
          is_follower_at_start: null,
          last_error: null,
        };

        await sendPublicCommentReply(admin, {
          platform: input.platform,
          commentId: input.commentId,
          accessToken: input.accessToken,
          campaign,
          organizationId: input.organizationId,
          enrollmentId: existing.id as string,
          authorUsername,
          retry: true,
        });

        scheduleFollowCheckAndDmFlow(admin, {
          enrollment: enrollmentRow,
          campaign,
          accessToken: input.accessToken,
          pageId: input.pageId,
        });
        return true;
      }

      console.log("[lead-magnet] dedup enrollment", campaign.id, input.authorScopedId);
      await sendPublicCommentReply(admin, {
        platform: input.platform,
        commentId: input.commentId,
        accessToken: input.accessToken,
        campaign,
        organizationId: input.organizationId,
        enrollmentId: existing!.id as string,
        authorUsername,
      });

      if (existing && !existing.private_reply_message_id) {
        await admin.from("lead_magnet_enrollments").update({
          comment_id: input.commentId,
          media_id: input.mediaId,
          participant_username: authorUsername ?? existing.participant_username,
          last_error: null,
          updated_at: new Date().toISOString(),
        }).eq("id", existing.id);

        const enrollmentRow: LeadMagnetEnrollmentRow = {
          id: existing.id as string,
          organization_id: existing.organization_id as string,
          campaign_id: existing.campaign_id as string,
          platform: existing.platform as LeadMagnetEnrollmentRow["platform"],
          participant_scoped_id: existing.participant_scoped_id as string,
          participant_username: (authorUsername ?? existing.participant_username) as string | null,
          comment_id: input.commentId,
          media_id: input.mediaId,
          conversation_id: (existing.conversation_id as string | null) ?? null,
          conversation_table: (existing.conversation_table as string | null) ?? null,
          lead_submission_id: (existing.lead_submission_id as string | null) ?? null,
          lead_id: (existing.lead_id as string | null) ?? null,
          status: existing.status as string,
          paused_reason: (existing.paused_reason as string | null) ?? null,
          is_follower_at_start: (existing.is_follower_at_start as boolean | null) ?? null,
          last_error: null,
          private_reply_message_id: null,
        };

        scheduleFollowCheckAndDmFlow(admin, {
          enrollment: enrollmentRow,
          campaign,
          accessToken: input.accessToken,
          pageId: input.pageId,
        });
      }
      return true;
    }
    console.error("[lead-magnet] enrollment insert failed:", enrollErr.message);
    return false;
  }

  deferLeadMagnetWork(
    logLeadMagnetFunnelEvent(admin, {
      enrollmentId,
      campaignId: campaign.id,
      organizationId: input.organizationId,
      eventType: "comment_matched",
      metadata: { comment_id: input.commentId, media_id: input.mediaId },
    }),
  );

  const enrollmentRow: LeadMagnetEnrollmentRow = {
    id: enrollmentId,
    organization_id: input.organizationId,
    campaign_id: campaign.id,
    platform: input.platform,
    participant_scoped_id: input.authorScopedId,
    participant_username: authorUsername,
    comment_id: input.commentId,
    media_id: input.mediaId,
    conversation_id: null,
    conversation_table: null,
    lead_submission_id: null,
    lead_id: null,
    status: "comment_matched",
    paused_reason: null,
    is_follower_at_start: null,
    last_error: null,
  };

  // 1) Public comment reply first (sync) — user-visible; target <3s from webhook.
  await sendPublicCommentReply(admin, {
    platform: input.platform,
    commentId: input.commentId,
    accessToken: input.accessToken,
    campaign,
    organizationId: input.organizationId,
    enrollmentId,
    authorUsername,
  });

  // 2) Follow check + DM in background (profile fetch + Messenger API).
  scheduleFollowCheckAndDmFlow(admin, {
    enrollment: enrollmentRow,
    campaign,
    accessToken: input.accessToken,
    pageId: input.pageId,
  });

  deferLeadMagnetWork(createLeadMagnetLead(admin, {
    organizationId: input.organizationId,
    campaign,
    enrollmentId,
    participantUsername: authorUsername,
    participantScopedId: input.authorScopedId,
    platform: input.platform,
    mediaId: input.mediaId,
  }));

  return true;
}
