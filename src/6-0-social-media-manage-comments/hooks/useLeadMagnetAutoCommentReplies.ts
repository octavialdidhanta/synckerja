import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { buildLeadMagnetPublicCommentReply } from '@/6-0-social-media-manage-comments/lib/buildLeadMagnetPublicCommentReply';
import { normalizeCommentReplyTexts } from '@/6-1-lead-magnet/lib/commentReplyVariants';
import { MANAGE_COMMENTS_THREAD_POLL_MS } from '@/6-0-social-media-manage-comments/lib/manageCommentsPolling';
import type { MetaContentPlatform } from '@/meta-platform/types/metaContentTypes';

export type LeadMagnetAutoCommentReply = {
  commentId: string;
  text: string;
  replyId: string | null;
  sentAt: string | null;
};

type EnrollmentRow = {
  comment_id: string | null;
  participant_username: string | null;
  comment_reply_id: string | null;
  comment_reply_sent_text: string | null;
  updated_at: string;
  status: string;
  campaign:
    | { comment_reply_text: string; comment_reply_texts: string[] | null }
    | { comment_reply_text: string; comment_reply_texts: string[] | null }[]
    | null;
};

const REPLY_SENT_STATUSES = new Set([
  'comment_replied',
  'follow_checked',
  'follow_gate_sent',
  'follow_validated',
  'framework_offered',
  'delivered',
]);

export function useLeadMagnetAutoCommentReplies(args: {
  organizationId: string;
  platform: MetaContentPlatform;
  mediaId: string | null;
  enabled?: boolean;
}) {
  const { organizationId, platform, mediaId, enabled = true } = args;

  return useQuery({
    queryKey: ['lead-magnet-auto-comment-replies', organizationId, platform, mediaId],
    enabled: Boolean(organizationId && mediaId && enabled),
    queryFn: async (): Promise<Record<string, LeadMagnetAutoCommentReply>> => {
      const { data, error } = await supabase
        .from('lead_magnet_enrollments')
        .select(
          'comment_id, participant_username, comment_reply_id, comment_reply_sent_text, updated_at, status, campaign:lead_magnet_campaigns!inner(comment_reply_text, comment_reply_texts)',
        )
        .eq('organization_id', organizationId)
        .eq('platform', platform)
        .eq('media_id', mediaId!)
        .not('comment_id', 'is', null);

      if (error) throw error;

      const map: Record<string, LeadMagnetAutoCommentReply> = {};
      for (const row of (data ?? []) as EnrollmentRow[]) {
        const commentId = row.comment_id?.trim();
        if (!commentId) continue;

        const campaign = Array.isArray(row.campaign) ? row.campaign[0] : row.campaign;
        const sentText = row.comment_reply_sent_text?.trim();
        const fallbackTemplate = normalizeCommentReplyTexts(
          campaign?.comment_reply_texts,
          campaign?.comment_reply_text,
        )[0];
        const template = sentText || fallbackTemplate?.trim();
        if (!template) continue;

        const shouldShow =
          Boolean(row.comment_reply_id) || REPLY_SENT_STATUSES.has(row.status);
        if (!shouldShow) continue;

        map[commentId] = {
          commentId,
          text: sentText || buildLeadMagnetPublicCommentReply(template, row.participant_username),
          replyId: row.comment_reply_id,
          sentAt: row.updated_at ?? null,
        };
      }
      return map;
    },
    staleTime: 30_000,
    refetchInterval: MANAGE_COMMENTS_THREAD_POLL_MS,
  });
}
