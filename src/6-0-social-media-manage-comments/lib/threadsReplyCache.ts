import type { QueryClient } from '@tanstack/react-query';
import type { ThreadsContentCommentRow } from '@/threads-content/hooks/useThreadsContentComments';
import {
  MANAGE_COMMENTS_BURST_MAX_ATTEMPTS,
  MANAGE_COMMENTS_BURST_POLL_MS,
} from '@/6-0-social-media-manage-comments/lib/manageCommentsPolling';

export function threadsCommentRepliesQueryKey(
  organizationId: string,
  accountId: string,
  mediaId: string,
  parentCommentId: string,
) {
  return [
    'threads-content-comment-replies',
    organizationId,
    accountId,
    mediaId,
    parentCommentId,
  ] as const;
}

export function appendThreadsReplyToCache(
  queryClient: QueryClient,
  queryKey: readonly unknown[],
  reply: ThreadsContentCommentRow,
) {
  queryClient.setQueryData<{ comments: ThreadsContentCommentRow[] } | null>(queryKey, (old) => {
    if (!old) {
      return { comments: [reply] };
    }
    if (old.comments.some((c) => c.id === reply.id)) return old;
    return {
      ...old,
      comments: [reply, ...old.comments],
    };
  });
}

export function buildThreadsOptimisticReplyRow(args: {
  commentId: string;
  text: string;
  accountLabel: string;
  mediaId: string;
  parentCommentId: string;
}): ThreadsContentCommentRow {
  const rawId = args.commentId.trim();
  const id = /^\d+$/.test(rawId) ? rawId : `local-reply-${rawId}`;
  return {
    id,
    media_id: args.mediaId,
    text: args.text,
    author_display_name: args.accountLabel,
    author_avatar_url: null,
    reply_count: 0,
    parent_comment_id: args.parentCommentId,
    published_at: new Date().toISOString(),
    is_channel_owner: true,
    can_reply: false,
  };
}

export function isThreadsLocalPendingReplyId(id: string): boolean {
  return id.startsWith('local-reply-') || id.startsWith('opt-');
}

export function pruneThreadsLocalRepliesForParent(args: {
  localByParent: Record<string, ThreadsContentCommentRow[]>;
  parentCommentId: string;
  serverComments: ThreadsContentCommentRow[];
}): Record<string, ThreadsContentCommentRow[]> {
  const { localByParent, parentCommentId, serverComments } = args;
  const locals = localByParent[parentCommentId] ?? [];
  if (!locals.length || !serverComments.length) return localByParent;

  const kept = locals.filter((row) => {
    const confirmedOnServer = serverComments.some(
      (serverRow) =>
        !isThreadsLocalPendingReplyId(serverRow.id) &&
        /^\d+$/.test(serverRow.id) &&
        serverRow.text.trim() === row.text.trim(),
    );
    return !confirmedOnServer;
  });
  if (kept.length === locals.length) return localByParent;
  return { ...localByParent, [parentCommentId]: kept };
}

export function bumpThreadsParentReplyCountInCache(args: {
  queryClient: QueryClient;
  organizationId: string;
  accountId: string;
  mediaId: string;
  parentCommentId: string;
}) {
  const { queryClient, organizationId, accountId, mediaId, parentCommentId } = args;
  const bumpRow = (c: ThreadsContentCommentRow) =>
    c.id === parentCommentId ? { ...c, reply_count: (c.reply_count ?? 0) + 1 } : c;

  queryClient.setQueryData<{ comments: ThreadsContentCommentRow[]; comment_count?: number }>(
    ['threads-content-comments', organizationId, accountId, mediaId],
    (old) => {
      if (!old?.comments?.length) return old;
      return {
        ...old,
        comments: old.comments.map(bumpRow),
      };
    },
  );

  queryClient.setQueriesData<{ comments: ThreadsContentCommentRow[]; comment_count?: number }>(
    { queryKey: ['threads-content-comment-replies', organizationId, accountId, mediaId] },
    (old) => {
      if (!old?.comments?.length) return old;
      return {
        ...old,
        comments: old.comments.map(bumpRow),
      };
    },
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function burstRefetchThreadsRepliesUntilFound(args: {
  queryClient: QueryClient;
  organizationId: string;
  accountId: string;
  mediaId: string;
  parentCommentId: string;
  text: string;
  onFound?: (serverComments: ThreadsContentCommentRow[]) => void;
}) {
  const { queryClient, organizationId, accountId, mediaId, parentCommentId, text, onFound } = args;
  const prefix = threadsCommentRepliesQueryKey(organizationId, accountId, mediaId, parentCommentId);

  for (let attempt = 0; attempt < MANAGE_COMMENTS_BURST_MAX_ATTEMPTS; attempt++) {
    await queryClient.refetchQueries({ queryKey: [...prefix] });
    const entries = queryClient.getQueriesData<{ comments: ThreadsContentCommentRow[] } | null>({
      queryKey: [...prefix],
    });
    const serverComments = entries.flatMap(([, data]) => data?.comments ?? []);
    const serverTexts = serverComments.map((c) => c.text);
    if (serverTexts.some((s) => s.trim() === text.trim())) {
      onFound?.(serverComments);
      return true;
    }
    if (attempt < MANAGE_COMMENTS_BURST_MAX_ATTEMPTS - 1) {
      await sleep(MANAGE_COMMENTS_BURST_POLL_MS);
    }
  }
  return false;
}
