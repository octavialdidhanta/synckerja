import { parseEdgeFunctionError } from '@/tiktok-ads/lib/parseEdgeFunctionError';
import { supabase } from '@/shared/lib/supabaseClient';
import type { MetaContentPlatform } from '@/meta-platform/types/metaContentTypes';

export type MetaManageCommentsInboxPostState = {
  media_id: string;
  last_known_comment_count: number;
  is_highlighted: boolean;
  pinned_at: string | null;
};

export type MetaManageCommentsInboundComment = {
  media_id: string;
  comment_id: string;
  detected_at: string;
};

export type MetaManageCommentsInboxState = {
  posts: MetaManageCommentsInboxPostState[];
  inbound_comments: MetaManageCommentsInboundComment[];
  engaged_comment_ids: string[];
};

async function invokeInboxAction(
  organizationId: string,
  platform: MetaContentPlatform,
  accountId: string,
  action: string,
  extra?: Record<string, unknown>,
): Promise<MetaManageCommentsInboxState> {
  const { data, error } = await supabase.functions.invoke('meta-content-comments', {
    body: {
      action,
      organization_id: organizationId,
      platform,
      account_id: accountId,
      ...extra,
    },
  });
  if (error) throw await parseEdgeFunctionError(error, data);
  const payload = data as MetaManageCommentsInboxState & { error?: string };
  if (payload?.error) throw await parseEdgeFunctionError(null, payload);
  return payload;
}

export async function fetchMetaManageCommentsInboxState(
  organizationId: string,
  platform: MetaContentPlatform,
  accountId: string,
): Promise<MetaManageCommentsInboxState> {
  return invokeInboxAction(organizationId, platform, accountId, 'getInboxState');
}

export async function syncMetaManageCommentsPostBaselines(
  organizationId: string,
  platform: MetaContentPlatform,
  accountId: string,
  posts: Array<{ media_id: string; comment_count: number }>,
): Promise<MetaManageCommentsInboxState> {
  return invokeInboxAction(organizationId, platform, accountId, 'syncPostBaselines', { posts });
}

export async function syncMetaManageCommentsInboundComments(
  organizationId: string,
  platform: MetaContentPlatform,
  accountId: string,
  mediaId: string,
  commentIds: string[],
): Promise<MetaManageCommentsInboxState> {
  return invokeInboxAction(organizationId, platform, accountId, 'syncInboundComments', {
    media_id: mediaId,
    comment_ids: commentIds,
  });
}

export async function markMetaManageCommentsCommentRead(
  organizationId: string,
  platform: MetaContentPlatform,
  accountId: string,
  mediaId: string,
  commentId: string,
): Promise<MetaManageCommentsInboxState> {
  return invokeInboxAction(organizationId, platform, accountId, 'markCommentEngaged', {
    media_id: mediaId,
    comment_id: commentId,
  });
}

export async function dismissMetaManageCommentsPostHighlight(
  organizationId: string,
  platform: MetaContentPlatform,
  accountId: string,
  mediaId: string,
): Promise<MetaManageCommentsInboxState> {
  return invokeInboxAction(organizationId, platform, accountId, 'dismissPostHighlight', {
    media_id: mediaId,
  });
}
