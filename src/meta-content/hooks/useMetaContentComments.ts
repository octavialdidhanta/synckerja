import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { parseEdgeFunctionError } from '@/tiktok-ads/lib/parseEdgeFunctionError';
import { supabase } from '@/shared/lib/supabaseClient';
import { MANAGE_COMMENTS_THREAD_POLL_MS } from '@/6-0-social-media-manage-comments/lib/manageCommentsPolling';
import type { MetaContentCommentRow, MetaContentPlatform } from '@/meta-platform/types/metaContentTypes';

async function invokeComments(args: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('meta-content-comments', { body: args });
  if (error) throw await parseEdgeFunctionError(error, data);
  const payload = data as { error?: string };
  if (payload?.error) throw await parseEdgeFunctionError(null, payload);
  return data;
}

export function useMetaContentCommentsQuery(args: {
  organizationId: string;
  platform: MetaContentPlatform;
  accountId: string;
  mediaId: string | null;
  enabled?: boolean;
  refetchIntervalMs?: number;
}) {
  const { organizationId, platform, accountId, mediaId, enabled = true, refetchIntervalMs } = args;
  return useQuery({
    queryKey: ['meta-content-comments', organizationId, platform, accountId, mediaId],
    enabled: Boolean(organizationId && accountId && mediaId && enabled),
    queryFn: async () => {
      const data = await invokeComments({
        action: 'listComments',
        organization_id: organizationId,
        platform,
        account_id: accountId,
        media_id: mediaId,
        sort: 'newest',
      });
      return data as { comments: MetaContentCommentRow[] };
    },
    refetchInterval: refetchIntervalMs ?? false,
  });
}

export function useMetaContentCommentRepliesQuery(args: {
  organizationId: string;
  platform: MetaContentPlatform;
  accountId: string;
  mediaId: string;
  commentId: string;
  enabled?: boolean;
}) {
  const { organizationId, platform, accountId, mediaId, commentId, enabled = true } = args;
  return useQuery({
    queryKey: ['meta-content-comment-replies', organizationId, platform, accountId, mediaId, commentId],
    enabled: Boolean(organizationId && accountId && mediaId && commentId && enabled),
    queryFn: async () => {
      const data = await invokeComments({
        action: 'listReplies',
        organization_id: organizationId,
        platform,
        account_id: accountId,
        media_id: mediaId,
        comment_id: commentId,
        sort: 'newest',
      });
      return data as { comments: MetaContentCommentRow[] };
    },
  });
}

export function useMetaContentCommentMutations(args: {
  organizationId: string;
  platform: MetaContentPlatform;
  accountId: string;
  mediaId: string | null;
}) {
  const queryClient = useQueryClient();
  const { organizationId, platform, accountId, mediaId } = args;

  const replyMutation = useMutation({
    mutationFn: async (input: { commentId: string; text: string }) => {
      if (!mediaId) throw new Error('No media selected');
      return invokeComments({
        action: 'replyComment',
        organization_id: organizationId,
        platform,
        account_id: accountId,
        media_id: mediaId,
        comment_id: input.commentId,
        text: input.text,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['meta-content-comments', organizationId, platform, accountId, mediaId],
      });
      void queryClient.invalidateQueries({
        queryKey: ['meta-content-comment-posts', organizationId, platform, accountId],
      });
    },
  });

  return { replyMutation };
}
