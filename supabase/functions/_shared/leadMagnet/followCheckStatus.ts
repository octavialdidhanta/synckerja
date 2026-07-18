import type { LeadMagnetCampaignRow, LeadMagnetEnrollmentRow } from "./types.ts";

export type FollowStatus = "follower" | "non_follower" | "unknown";

export type FollowCheckResult = {
  username: string | null;
  name: string | null;
  status: FollowStatus;
  /** Legacy tri-state for logs: true / false / null (= unknown). */
  isFollower: boolean | null;
};

export const LEAD_MAGNET_CONSENT_OPENER_TEXT = "Hai {{username}}! Sebentar ya…";

type MetaProfileError = {
  message?: string;
  code?: number;
  error_subcode?: number;
};

export function isConsentRequiredMetaError(error: MetaProfileError | undefined): boolean {
  if (!error) return false;
  const msg = (error.message ?? "").toLowerCase();
  if (msg.includes("consent") || msg.includes("permission")) return true;
  if (error.code === 230) return true;
  if (error.error_subcode === 2018218) return true;
  return false;
}

/** Pre-DM `false` from Meta is unreliable; after messaging window opens, treat `false` as non_follower. */
export function resolveFollowStatus(
  raw: boolean | null | undefined,
  opts?: { messagingWindowOpen?: boolean },
): FollowStatus {
  if (raw === true) return "follower";
  if (raw === null || raw === undefined) return "unknown";
  if (opts?.messagingWindowOpen) return "non_follower";
  return "unknown";
}

export function followStatusToLegacyBoolean(status: FollowStatus): boolean | null {
  if (status === "follower") return true;
  if (status === "non_follower") return false;
  return null;
}

/** Strict follow confirm: advance only when Meta reports follower (unknown stays blocked). */
export function shouldAdvanceFollowConfirm(status: FollowStatus): boolean {
  return status === "follower";
}

export function isFirstContactCommentPrivateReply(enrollment: {
  platform: string;
  comment_id?: string | null;
  private_reply_message_id?: string | null;
}): boolean {
  if ((enrollment.private_reply_message_id ?? "").trim()) return false;
  const commentId = (enrollment.comment_id ?? "").trim();
  if (!commentId) return false;
  return enrollment.platform === "instagram" || enrollment.platform === "facebook";
}

/**
 * Follow Gate skip rules (wizard "Aktifkan Follow Gate"):
 * - skip_follow_gate_if_follower=true (toggle OFF) → never send Follow Gate
 * - skip_follow_gate_if_follower=false (toggle ON) → skip only when Meta status is follower
 */
export function shouldSkipFollowGate(
  campaign: Pick<LeadMagnetCampaignRow, "skip_follow_gate_if_follower">,
  followStatus: FollowStatus,
): boolean {
  if (campaign.skip_follow_gate_if_follower === true) return true;
  return followStatus === "follower";
}

/**
 * Legacy/v1 first-contact: when Follow Gate is ON, open messaging window then recheck
 * so confirmed followers can skip the gate accurately.
 */
export function needsMessagingConsentRecheck(
  enrollment: Pick<LeadMagnetEnrollmentRow, "platform" | "comment_id" | "private_reply_message_id">,
  campaign: Pick<LeadMagnetCampaignRow, "skip_follow_gate_if_follower">,
  followStatus: FollowStatus,
): boolean {
  return campaign.skip_follow_gate_if_follower === false
    && enrollment.platform === "instagram"
    && isFirstContactCommentPrivateReply(enrollment)
    && followStatus !== "follower";
}
