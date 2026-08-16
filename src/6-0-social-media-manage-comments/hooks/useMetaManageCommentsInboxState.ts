import { useCallback, useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ManageCommentsPostListItem } from '@/6-0-social-media-manage-comments/types/manageCommentsSharedTypes';
import {
  dismissMetaManageCommentsPostHighlight,
  fetchMetaManageCommentsInboxState,
  markMetaManageCommentsCommentRead,
  syncMetaManageCommentsInboundComments,
  syncMetaManageCommentsPostBaselines,
  type MetaManageCommentsInboxState,
} from '@/6-0-social-media-manage-comments/lib/metaManageCommentsInboxApi';
import { metaManageCommentsInboxStateQueryKey } from '@/6-0-social-media-manage-comments/lib/metaManageCommentsInboxQueryKeys';
import {
  hydrateCommentHighlightStoreFromServer,
  hydratePostHighlightStoreFromServer,
} from '@/6-0-social-media-manage-comments/lib/manageCommentsInboundHighlightStore';
import type { MetaContentPlatform } from '@/meta-platform/types/metaContentTypes';

const META_INBOX_POLL_MS = 15_000;

function applyInboxStateToLocalStore(
  accountId: string,
  state: MetaManageCommentsInboxState,
  activeMediaId?: string | null,
): void {
  hydratePostHighlightStoreFromServer(
    accountId,
    state.posts.map((row) => ({
      video_id: row.media_id,
      is_highlighted: row.is_highlighted,
      pinned_at: row.pinned_at,
      last_known_comment_count: row.last_known_comment_count,
    })),
  );

  if (activeMediaId) {
    const engagedSet = new Set(state.engaged_comment_ids);
    const inboundForMedia = state.inbound_comments
      .filter((row) => row.media_id === activeMediaId)
      .map((row) => row.comment_id);
    hydrateCommentHighlightStoreFromServer(
      accountId,
      activeMediaId,
      inboundForMedia,
      engagedSet,
    );
  }
}

export function useMetaManageCommentsInboxState(args: {
  organizationId: string | null | undefined;
  platform: MetaContentPlatform;
  accountId: string;
  activeMediaId?: string | null;
  enabled?: boolean;
}) {
  const { organizationId, platform, accountId, activeMediaId = null, enabled = true } = args;
  const queryClient = useQueryClient();
  const queryEnabled = Boolean(organizationId && accountId && enabled);

  const inboxQuery = useQuery({
    queryKey: metaManageCommentsInboxStateQueryKey(organizationId, platform, accountId),
    queryFn: async () => {
      if (!organizationId || !accountId) return null;
      return fetchMetaManageCommentsInboxState(organizationId, platform, accountId);
    },
    enabled: queryEnabled,
    staleTime: 15_000,
    refetchInterval: queryEnabled ? META_INBOX_POLL_MS : false,
  });

  useEffect(() => {
    if (!inboxQuery.data || !accountId) return;
    applyInboxStateToLocalStore(accountId, inboxQuery.data, activeMediaId);
  }, [inboxQuery.data, accountId, activeMediaId]);

  const hydrateFromState = useCallback(
    (state: MetaManageCommentsInboxState) => {
      if (!accountId) return;
      queryClient.setQueryData(
        metaManageCommentsInboxStateQueryKey(organizationId, platform, accountId),
        state,
      );
      applyInboxStateToLocalStore(accountId, state, activeMediaId);
    },
    [queryClient, organizationId, platform, accountId, activeMediaId],
  );

  const syncPostBaselinesMutation = useMutation({
    mutationFn: async (posts: ManageCommentsPostListItem[]) => {
      if (!organizationId || !accountId) throw new Error('Missing context');
      return syncMetaManageCommentsPostBaselines(
        organizationId,
        platform,
        accountId,
        posts.map((p) => ({ media_id: p.id, comment_count: p.commentCount })),
      );
    },
    onSuccess: hydrateFromState,
  });

  const syncInboundCommentsMutation = useMutation({
    mutationFn: async (input: { mediaId: string; commentIds: string[] }) => {
      if (!organizationId || !accountId) throw new Error('Missing context');
      return syncMetaManageCommentsInboundComments(
        organizationId,
        platform,
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
      return dismissMetaManageCommentsPostHighlight(organizationId, platform, accountId, mediaId);
    },
    onSuccess: hydrateFromState,
  });

  const markCommentReadMutation = useMutation({
    mutationFn: async (input: { mediaId: string; commentId: string }) => {
      if (!organizationId || !accountId) throw new Error('Missing context');
      return markMetaManageCommentsCommentRead(
        organizationId,
        platform,
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
        queryKey: metaManageCommentsInboxStateQueryKey(organizationId, platform, accountId),
      });
    },
  };
}

export function useSyncMetaManageCommentsPostBaselines(args: {
  organizationId: string | null | undefined;
  platform: MetaContentPlatform;
  accountId: string;
  posts: ManageCommentsPostListItem[];
  postsReady: boolean;
  enabled?: boolean;
  syncPostBaselines: ReturnType<
    typeof useMetaManageCommentsInboxState
  >['syncPostBaselinesMutation'];
}) {
  const {
    organizationId,
    platform,
    accountId,
    posts,
    postsReady,
    enabled = true,
    syncPostBaselines,
  } = args;
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
  }, [enabled, posts, postsReady, organizationId, platform, accountId, syncPostBaselines]);
}

export function useSyncMetaManageCommentsInboundComments(args: {
  organizationId: string | null | undefined;
  platform: MetaContentPlatform;
  accountId: string;
  mediaId: string | null;
  commentIds: string[];
  commentsReady: boolean;
  enabled?: boolean;
  syncInboundComments: ReturnType<
    typeof useMetaManageCommentsInboxState
  >['syncInboundCommentsMutation'];
}) {
  const {
    organizationId,
    platform,
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
    platform,
    accountId,
    mediaId,
    commentIds,
    syncInboundComments,
  ]);
}
