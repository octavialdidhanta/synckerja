import { useCallback, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ManageCommentsPostListItem } from "@/6-0-social-media-manage-comments/types/manageCommentsSharedTypes";
import {
  dismissManageCommentsPostHighlight,
  fetchManageCommentsInboxState,
  syncManageCommentsInboundComments,
  syncManageCommentsPostBaselines,
  type ManageCommentsInboxState,
} from "@/6-0-social-media-manage-comments/lib/manageCommentsInboxApi";
import { manageCommentsInboxStateQueryKey } from "@/6-0-social-media-manage-comments/lib/manageCommentsInboxQueryKeys";
import {
  hydrateCommentHighlightStoreFromServer,
  hydratePostHighlightStoreFromServer,
} from "@/6-0-social-media-manage-comments/lib/manageCommentsInboundHighlightStore";

function applyInboxStateToLocalStore(
  openId: string,
  state: ManageCommentsInboxState,
  activeVideoId?: string | null,
): void {
  hydratePostHighlightStoreFromServer(openId, state.posts);

  if (activeVideoId) {
    const engagedSet = new Set(state.engaged_comment_ids);
    const inboundForVideo = state.inbound_comments
      .filter((row) => row.video_id === activeVideoId)
      .map((row) => row.comment_id);
    hydrateCommentHighlightStoreFromServer(
      openId,
      activeVideoId,
      inboundForVideo,
      engagedSet,
    );
  }
}

export function useManageCommentsInboxState(args: {
  organizationId: string | null | undefined;
  openId: string;
  activeVideoId?: string | null;
  enabled?: boolean;
}) {
  const { organizationId, openId, activeVideoId = null, enabled = true } = args;
  const queryClient = useQueryClient();
  const queryEnabled = Boolean(organizationId && openId && enabled);

  const inboxQuery = useQuery({
    queryKey: manageCommentsInboxStateQueryKey(organizationId, openId),
    queryFn: async () => {
      if (!organizationId || !openId) return null;
      return fetchManageCommentsInboxState(organizationId, openId);
    },
    enabled: queryEnabled,
    staleTime: 15_000,
  });

  useEffect(() => {
    if (!inboxQuery.data || !openId) return;
    applyInboxStateToLocalStore(openId, inboxQuery.data, activeVideoId);
  }, [inboxQuery.data, openId, activeVideoId]);

  const hydrateFromState = useCallback(
    (state: ManageCommentsInboxState) => {
      if (!openId) return;
      queryClient.setQueryData(
        manageCommentsInboxStateQueryKey(organizationId, openId),
        state,
      );
      applyInboxStateToLocalStore(openId, state, activeVideoId);
    },
    [queryClient, organizationId, openId, activeVideoId],
  );

  const syncPostBaselinesMutation = useMutation({
    mutationFn: async (posts: ManageCommentsPostListItem[]) => {
      if (!organizationId || !openId) throw new Error("Missing context");
      return syncManageCommentsPostBaselines(
        organizationId,
        openId,
        posts.map((p) => ({ video_id: p.id, comment_count: p.commentCount })),
      );
    },
    onSuccess: hydrateFromState,
  });

  const syncInboundCommentsMutation = useMutation({
    mutationFn: async (input: { videoId: string; commentIds: string[] }) => {
      if (!organizationId || !openId) throw new Error("Missing context");
      return syncManageCommentsInboundComments(
        organizationId,
        openId,
        input.videoId,
        input.commentIds,
      );
    },
    onSuccess: hydrateFromState,
  });

  const dismissPostHighlightMutation = useMutation({
    mutationFn: async (videoId: string) => {
      if (!organizationId || !openId) throw new Error("Missing context");
      return dismissManageCommentsPostHighlight(organizationId, openId, videoId);
    },
    onSuccess: hydrateFromState,
  });

  return {
    inboxQuery,
    syncPostBaselinesMutation,
    syncInboundCommentsMutation,
    dismissPostHighlightMutation,
    invalidateInboxState: () => {
      void queryClient.invalidateQueries({
        queryKey: manageCommentsInboxStateQueryKey(organizationId, openId),
      });
    },
  };
}

/** Sync post baselines after the video list poll settles. */
export function useSyncManageCommentsPostBaselines(args: {
  organizationId: string | null | undefined;
  openId: string;
  posts: ManageCommentsPostListItem[];
  postsReady: boolean;
  enabled?: boolean;
  syncPostBaselines: ReturnType<typeof useManageCommentsInboxState>["syncPostBaselinesMutation"];
}) {
  const { organizationId, openId, posts, postsReady, enabled = true, syncPostBaselines } = args;
  const lastSignatureRef = useRef("");

  useEffect(() => {
    if (!enabled || !postsReady || !organizationId || !openId || posts.length === 0) return;

    const signature = posts
      .map((p) => `${p.id}:${p.commentCount}`)
      .sort()
      .join("|");
    if (signature === lastSignatureRef.current) return;
    lastSignatureRef.current = signature;

    void syncPostBaselines.mutateAsync(posts).catch(() => {
      lastSignatureRef.current = "";
    });
  }, [enabled, posts, postsReady, organizationId, openId, syncPostBaselines]);
}

/** Sync inbound comment ids for the active thread. */
export function useSyncManageCommentsInboundComments(args: {
  organizationId: string | null | undefined;
  openId: string;
  videoId: string | null;
  commentIds: string[];
  commentsReady: boolean;
  enabled?: boolean;
  syncInboundComments: ReturnType<typeof useManageCommentsInboxState>["syncInboundCommentsMutation"];
}) {
  const {
    organizationId,
    openId,
    videoId,
    commentIds,
    commentsReady,
    enabled = true,
    syncInboundComments,
  } = args;
  const lastSignatureRef = useRef("");

  useEffect(() => {
    if (!enabled || !commentsReady || !organizationId || !openId || !videoId) return;

    const signature = `${videoId}:${commentIds.slice().sort().join(",")}`;
    if (signature === lastSignatureRef.current) return;
    lastSignatureRef.current = signature;

    void syncInboundComments
      .mutateAsync({ videoId, commentIds })
      .catch(() => {
        lastSignatureRef.current = "";
      });
  }, [
    enabled,
    commentsReady,
    organizationId,
    openId,
    videoId,
    commentIds,
    syncInboundComments,
  ]);
}
