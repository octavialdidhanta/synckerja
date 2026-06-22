import { parseEdgeFunctionError } from '@/tiktok-ads/lib/parseEdgeFunctionError';
import { supabase } from '@/shared/lib/supabaseClient';

type ThreadsInboxPostRow = {
  media_id: string;
  last_known_comment_count: number;
  is_highlighted: boolean;
  pinned_at: string | null;
};

type ThreadsInboundCommentRow = {
  media_id: string;
  comment_id: string;
  detected_at: string;
};

type ThreadsInboxStateRaw = {
  posts: ThreadsInboxPostRow[];
  inbound_comments: ThreadsInboundCommentRow[];
  engaged_comment_ids: string[];
};

export type ThreadsManageCommentsInboxPostState = {
  video_id: string;
  last_known_comment_count: number;
  is_highlighted: boolean;
  pinned_at: string | null;
};

export type ThreadsManageCommentsInboundComment = {
  video_id: string;
  comment_id: string;
  detected_at: string;
};

export type ThreadsManageCommentsInboxState = {
  posts: ThreadsManageCommentsInboxPostState[];
  inbound_comments: ThreadsManageCommentsInboundComment[];
  engaged_comment_ids: string[];
};

function normalizeThreadsInboxState(raw: ThreadsInboxStateRaw): ThreadsManageCommentsInboxState {
  return {
    posts: (raw.posts ?? []).map((row) => ({
      video_id: String(row.media_id),
      last_known_comment_count: Number(row.last_known_comment_count ?? 0),
      is_highlighted: Boolean(row.is_highlighted),
      pinned_at: row.pinned_at ?? null,
    })),
    inbound_comments: (raw.inbound_comments ?? []).map((row) => ({
      video_id: String(row.media_id),
      comment_id: String(row.comment_id),
      detected_at: String(row.detected_at),
    })),
    engaged_comment_ids: (raw.engaged_comment_ids ?? []).map((id) => String(id)),
  };
}

async function invokeInboxAction(
  organizationId: string,
  accountId: string,
  action: string,
  extra?: Record<string, unknown>,
): Promise<ThreadsManageCommentsInboxState> {
  if (!accountId.trim()) {
    throw new Error('Missing account_id');
  }
  const { data, error } = await supabase.functions.invoke('threads-content-api', {
    body: {
      action,
      organization_id: organizationId,
      account_id: accountId,
      ...extra,
    },
  });
  if (error) throw await parseEdgeFunctionError(error, data);
  const payload = data as ThreadsInboxStateRaw & { error?: string; ok?: boolean };
  if (payload?.error) throw await parseEdgeFunctionError(null, payload);
  return normalizeThreadsInboxState(payload);
}

export async function fetchThreadsManageCommentsInboxState(
  organizationId: string,
  accountId: string,
): Promise<ThreadsManageCommentsInboxState> {
  return invokeInboxAction(organizationId, accountId, 'getInboxState');
}

export async function syncThreadsManageCommentsPostBaselines(
  organizationId: string,
  accountId: string,
  posts: Array<{ video_id: string; comment_count: number }>,
): Promise<ThreadsManageCommentsInboxState> {
  return invokeInboxAction(organizationId, accountId, 'syncPostBaselines', {
    posts: posts.map((p) => ({
      media_id: p.video_id,
      comment_count: p.comment_count,
    })),
  });
}

export async function syncThreadsManageCommentsInboundComments(
  organizationId: string,
  accountId: string,
  mediaId: string,
  commentIds: string[],
): Promise<ThreadsManageCommentsInboxState> {
  return invokeInboxAction(organizationId, accountId, 'syncInboundComments', {
    media_id: mediaId,
    comment_ids: commentIds,
  });
}

export async function dismissThreadsManageCommentsPostHighlight(
  organizationId: string,
  accountId: string,
  mediaId: string,
): Promise<ThreadsManageCommentsInboxState> {
  return invokeInboxAction(organizationId, accountId, 'dismissPostHighlight', {
    media_id: mediaId,
  });
}

export async function markThreadsManageCommentsCommentRead(
  organizationId: string,
  accountId: string,
  mediaId: string,
  commentId: string,
): Promise<ThreadsManageCommentsInboxState> {
  return invokeInboxAction(organizationId, accountId, 'markCommentEngaged', {
    media_id: mediaId,
    comment_id: commentId,
  });
}
