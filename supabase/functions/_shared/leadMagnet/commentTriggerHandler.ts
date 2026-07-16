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

      const canRetryFailedFirstContact = existing?.status === "failed"
        && !existing.private_reply_message_id
        && input.platform === "instagram";

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

        await runFollowCheckAndDmFlow(admin, {
          enrollment: enrollmentRow,
          campaign,
          accessToken: input.accessToken,
          pageId: input.pageId,
        });

        try {
          const replyText = buildPublicCommentReply(campaign.comment_reply_text, authorUsername);
          const replyResult = await replyMetaComment(input.platform, input.commentId, replyText, input.accessToken);
          deferLeadMagnetWork((async () => {
            await updateEnrollmentStatus(admin, existing.id as string, "comment_replied", {
              comment_reply_id: replyResult.id,
            });
            await logLeadMagnetFunnelEvent(admin, {
              enrollmentId: existing.id as string,
              campaignId: campaign.id,
              organizationId: input.organizationId,
              eventType: "comment_reply_sent",
              metadata: { reply_id: replyResult.id, comment_id: input.commentId, retry: true },
            });
            await logLeadMagnetFunnelEvent(admin, {
              enrollmentId: existing.id as string,
              campaignId: campaign.id,
              organizationId: input.organizationId,
              eventType: "comment_replied",
              metadata: { retry: true },
            });
          })());
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error("[lead-magnet] retry comment reply failed:", msg);
        }
        return true;
      }

      console.log("[lead-magnet] dedup enrollment, reply comment only", campaign.id, input.authorScopedId);
      try {
        const replyText = buildPublicCommentReply(campaign.comment_reply_text, authorUsername);
        await replyMetaComment(input.platform, input.commentId, replyText, input.accessToken);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[lead-magnet] dedup comment reply failed:", msg);
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

  // 1) Private reply DM first (sync) — strongest IG notification channel.
  await runFollowCheckAndDmFlow(admin, {
    enrollment: enrollmentRow,
    campaign,
    accessToken: input.accessToken,
    pageId: input.pageId,
  });

  // 2) Public comment reply second (sync).
  try {
    const replyText = buildPublicCommentReply(campaign.comment_reply_text, authorUsername);
    const replyResult = await replyMetaComment(input.platform, input.commentId, replyText, input.accessToken);
    deferLeadMagnetWork((async () => {
      await updateEnrollmentStatus(admin, enrollmentId, "comment_replied", {
        comment_reply_id: replyResult.id,
      });
      await logLeadMagnetFunnelEvent(admin, {
        enrollmentId,
        campaignId: campaign.id,
        organizationId: input.organizationId,
        eventType: "comment_reply_sent",
        metadata: { reply_id: replyResult.id, comment_id: input.commentId },
      });
      await logLeadMagnetFunnelEvent(admin, {
        enrollmentId,
        campaignId: campaign.id,
        organizationId: input.organizationId,
        eventType: "comment_replied",
      });
    })());
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[lead-magnet] comment reply failed (DM already attempted):", msg);
    deferLeadMagnetWork(updateEnrollmentStatus(admin, enrollmentId, "comment_replied", {
      last_error: `comment_reply: ${msg}`,
    }));
  }

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
