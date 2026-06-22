import { useCallback, useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ManageCommentsPostListItem } from '@/6-0-social-media-manage-comments/types/manageCommentsSharedTypes';
import {
  dismissThreadsManageCommentsPostHighlight,
  fetchThreadsManageCommentsInboxState,
  markThreadsManageCommentsCommentRead,
  syncThreadsManageCommentsInboundComments,
  syncThreadsManageCommentsPostBaselines,
  type ThreadsManageCommentsInboxState,
} from '@/6-0-social-media-manage-comments/lib/threadsManageCommentsInboxApi';
import { threadsManageCommentsInboxStateQueryKey } from '@/6-0-social-media-manage-comments/lib/threadsManageCommentsInboxQueryKeys';
import {
  hydrateCommentHighlightStoreFromServer,
  hydratePostHighlightStoreFromServer,
} from '@/6-0-social-media-manage-comments/lib/manageCommentsInboundHighlightStore';

function applyInboxStateToLocalStore(
  accountId: string,
  state: ThreadsManageCommentsInboxState,
  activeMediaId?: string | null,
): void {
  hydratePostHighlightStoreFromServer(accountId, state.posts);

  if (activeMediaId) {
    const engagedSet = new Set(state.engaged_comment_ids);
    const inboundForMedia = state.inbound_comments
      .filter((row) => row.video_id === activeMediaId)
      .map((row) => row.comment_id);
    hydrateCommentHighlightStoreFromServer(
      accountId,
      activeMediaId,
      inboundForMedia,
      engagedSet,
    );
  }
}

export function useThreadsManageCommentsInboxState(args: {
  organizationId: string | null | undefined;
  accountId: string;
  activeMediaId?: string | null;
  enabled?: boolean;
}) {
  const { organizationId, accountId, activeMediaId = null, enabled = true } = args;
  const queryClient = useQueryClient();
  const queryEnabled = Boolean(organizationId && accountId && enabled);

  const inboxQuery = useQuery({
    queryKey: threadsManageCommentsInboxStateQueryKey(organizationId, accountId),
    queryFn: async () => {
      if (!organizationId || !accountId) return null;
      return fetchThreadsManageCommentsInboxState(organizationId, accountId);
    },
    enabled: queryEnabled,
    staleTime: 15_000,
  });

  useEffect(() => {
    if (!inboxQuery.data || !accountId) return;
    applyInboxStateToLocalStore(accountId, inboxQuery.data, activeMediaId);
  }, [inboxQuery.data, accountId, activeMediaId]);

  const hydrateFromState = useCallback(
    (state: ThreadsManageCommentsInboxState) => {
      if (!accountId) return;
      queryClient.setQueryData(
        threadsManageCommentsInboxStateQueryKey(organizationId, accountId),
        state,
      );
      applyInboxStateToLocalStore(accountId, state, activeMediaId);
    },
    [queryClient, organizationId, accountId, activeMediaId],
  );

  const syncPostBaselinesMutation = useMutation({
    mutationFn: async (posts: ManageCommentsPostListItem[]) => {
      if (!organizationId || !accountId) throw new Error('Missing context');
      return syncThreadsManageCommentsPostBaselines(
        organizationId,
        accountId,
        posts.map((p) => ({ video_id: p.id, comment_count: p.commentCount })),
      );
    },
    onSuccess: hydrateFromState,
  });

  const syncInboundCommentsMutation = useMutation({
    mutationFn: async (input: { mediaId: string; commentIds: string[] }) => {
      if (!organizationId || !accountId) throw new Error('Missing context');
      return syncThreadsManageCommentsInboundComments(
        organizationId,
        accountId,
        input.mediaId,
        input.commentIds,
      );
    },
    onSuccess: hydrateFromState,
  });

  const dismissPostHighlightMutation = useMutation({
    mutationFn: async (mediaId: string) => {
      if (!organizationId || !accountId) throw new Error('Missing context');
      return dismissThreadsManageCommentsPostHighlight(organizationId, accountId, mediaId);
    },
    onSuccess: hydrateFromState,
  });

  const markCommentReadMutation = useMutation({
    mutationFn: async (input: { mediaId: string; commentId: string }) => {
      if (!organizationId || !accountId) throw new Error('Missing context');
      return markThreadsManageCommentsCommentRead(
        organizationId,
        accountId,
        input.mediaId,
        input.commentId,
      );
    },
    onSuccess: hydrateFromState,
  });

  return {
    inboxQuery,
    syncPostBaselinesMutation,
    syncInboundCommentsMutation,
    dismissPostHighlightMutation,
    markCommentReadMutation,
    invalidateInboxState: () => {
      void queryClient.invalidateQueries({
        queryKey: threadsManageCommentsInboxStateQueryKey(organizationId, accountId),
      });
    },
  };
}

export function useSyncThreadsManageCommentsPostBaselines(args: {
  organizationId: string | null | undefined;
  accountId: string;
  posts: ManageCommentsPostListItem[];
  postsReady: boolean;
  enabled?: boolean;
  syncPostBaselines: ReturnType<
    typeof useThreadsManageCommentsInboxState
  >['syncPostBaselinesMutation'];
}) {
  const { organizationId, accountId, posts, postsReady, enabled = true, syncPostBaselines } = args;
  const lastSignatureRef = useRef('');

  useEffect(() => {
    if (!enabled || !postsReady || !organizationId || !accountId || posts.length === 0) return;

    const signature = posts
      .map((p) => `${p.id}:${p.commentCount}`)
      .sort()
      .join('|');
    if (signature === lastSignatureRef.current) return;
    lastSignatureRef.current = signature;

    void syncPostBaselines.mutateAsync(posts).catch(() => {
      lastSignatureRef.current = '';
    });
  }, [enabled, posts, postsReady, organizationId, accountId, syncPostBaselines]);
}

export function useSyncThreadsManageCommentsInboundComments(args: {
  organizationId: string | null | undefined;
  accountId: string;
  mediaId: string | null;
  commentIds: string[];
  commentsReady: boolean;
  enabled?: boolean;
  syncInboundComments: ReturnType<
    typeof useThreadsManageCommentsInboxState
  >['syncInboundCommentsMutation'];
}) {
  const {
    organizationId,
    accountId,
    mediaId,
    commentIds,
    commentsReady,
    enabled = true,
    syncInboundComments,
  } = args;
  const lastSignatureRef = useRef('');

  useEffect(() => {
    if (!enabled || !commentsReady || !organizationId || !accountId || !mediaId) return;

    const signature = `${mediaId}:${commentIds.slice().sort().join(',')}`;
    if (signature === lastSignatureRef.current) return;
    lastSignatureRef.current = signature;

    void syncInboundComments.mutateAsync({ mediaId, commentIds }).catch(() => {
      lastSignatureRef.current = '';
    });
  }, [
    enabled,
    commentsReady,
    organizationId,
    accountId,
    mediaId,
    commentIds,
    syncInboundComments,
  ]);
}
