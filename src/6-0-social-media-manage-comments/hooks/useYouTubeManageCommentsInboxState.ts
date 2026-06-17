import { useCallback, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ManageCommentsPostListItem } from "@/6-0-social-media-manage-comments/types/manageCommentsSharedTypes";
import {
  dismissYouTubeManageCommentsPostHighlight,
  fetchYouTubeManageCommentsInboxState,
  markYouTubeManageCommentsCommentRead,
  syncYouTubeManageCommentsInboundComments,
  syncYouTubeManageCommentsPostBaselines,
  type YouTubeManageCommentsInboxState,
} from "@/6-0-social-media-manage-comments/lib/youtubeManageCommentsInboxApi";
import { youtubeManageCommentsInboxStateQueryKey } from "@/6-0-social-media-manage-comments/lib/youtubeManageCommentsInboxQueryKeys";
import {
  hydrateCommentHighlightStoreFromServer,
  hydratePostHighlightStoreFromServer,
} from "@/6-0-social-media-manage-comments/lib/manageCommentsInboundHighlightStore";

function applyInboxStateToLocalStore(
  channelId: string,
  state: YouTubeManageCommentsInboxState,
  activeVideoId?: string | null,
): void {
  hydratePostHighlightStoreFromServer(channelId, state.posts);

  if (activeVideoId) {
    const engagedSet = new Set(state.engaged_comment_ids);
    const inboundForVideo = state.inbound_comments
      .filter((row) => row.video_id === activeVideoId)
      .map((row) => row.comment_id);
    hydrateCommentHighlightStoreFromServer(
      channelId,
      activeVideoId,
      inboundForVideo,
      engagedSet,
    );
  }
}

export function useYouTubeManageCommentsInboxState(args: {
  organizationId: string | null | undefined;
  channelId: string;
  activeVideoId?: string | null;
  enabled?: boolean;
}) {
  const { organizationId, channelId, activeVideoId = null, enabled = true } = args;
  const queryClient = useQueryClient();
  const queryEnabled = Boolean(organizationId && channelId && enabled);

  const inboxQuery = useQuery({
    queryKey: youtubeManageCommentsInboxStateQueryKey(organizationId, channelId),
    queryFn: async () => {
      if (!organizationId || !channelId) return null;
      return fetchYouTubeManageCommentsInboxState(organizationId, channelId);
    },
    enabled: queryEnabled,
    staleTime: 15_000,
  });

  useEffect(() => {
    if (!inboxQuery.data || !channelId) return;
    applyInboxStateToLocalStore(channelId, inboxQuery.data, activeVideoId);
  }, [inboxQuery.data, channelId, activeVideoId]);

  const hydrateFromState = useCallback(
    (state: YouTubeManageCommentsInboxState) => {
      if (!channelId) return;
      queryClient.setQueryData(
        youtubeManageCommentsInboxStateQueryKey(organizationId, channelId),
        state,
      );
      applyInboxStateToLocalStore(channelId, state, activeVideoId);
    },
    [queryClient, organizationId, channelId, activeVideoId],
  );

  const syncPostBaselinesMutation = useMutation({
    mutationFn: async (posts: ManageCommentsPostListItem[]) => {
      if (!organizationId || !channelId) throw new Error("Missing context");
      return syncYouTubeManageCommentsPostBaselines(
        organizationId,
        channelId,
        posts.map((p) => ({ video_id: p.id, comment_count: p.commentCount })),
      );
    },
    onSuccess: hydrateFromState,
  });

  const syncInboundCommentsMutation = useMutation({
    mutationFn: async (input: { videoId: string; commentIds: string[] }) => {
      if (!organizationId || !channelId) throw new Error("Missing context");
      return syncYouTubeManageCommentsInboundComments(
        organizationId,
        channelId,
        input.videoId,
        input.commentIds,
      );
    },
    onSuccess: hydrateFromState,
  });

  const dismissPostHighlightMutation = useMutation({
    mutationFn: async (videoId: string) => {
      if (!organizationId || !channelId) throw new Error("Missing context");
      return dismissYouTubeManageCommentsPostHighlight(organizationId, channelId, videoId);
    },
    onSuccess: hydrateFromState,
  });

  const markCommentReadMutation = useMutation({
    mutationFn: async (input: { videoId: string; commentId: string }) => {
      if (!organizationId || !channelId) throw new Error("Missing context");
      return markYouTubeManageCommentsCommentRead(
        organizationId,
        channelId,
        input.videoId,
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
        queryKey: youtubeManageCommentsInboxStateQueryKey(organizationId, channelId),
      });
    },
  };
}

export function useSyncYouTubeManageCommentsPostBaselines(args: {
  organizationId: string | null | undefined;
  channelId: string;
  posts: ManageCommentsPostListItem[];
  postsReady: boolean;
  enabled?: boolean;
  syncPostBaselines: ReturnType<
    typeof useYouTubeManageCommentsInboxState
  >["syncPostBaselinesMutation"];
}) {
  const { organizationId, channelId, posts, postsReady, enabled = true, syncPostBaselines } = args;
  const lastSignatureRef = useRef("");

  useEffect(() => {
    if (!enabled || !postsReady || !organizationId || !channelId || posts.length === 0) return;

    const signature = posts
      .map((p) => `${p.id}:${p.commentCount}`)
      .sort()
      .join("|");
    if (signature === lastSignatureRef.current) return;
    lastSignatureRef.current = signature;

    void syncPostBaselines.mutateAsync(posts).catch(() => {
      lastSignatureRef.current = "";
    });
  }, [enabled, posts, postsReady, organizationId, channelId, syncPostBaselines]);
}

export function useSyncYouTubeManageCommentsInboundComments(args: {
  organizationId: string | null | undefined;
  channelId: string;
  videoId: string | null;
  commentIds: string[];
  commentsReady: boolean;
  enabled?: boolean;
  syncInboundComments: ReturnType<
    typeof useYouTubeManageCommentsInboxState
  >["syncInboundCommentsMutation"];
}) {
  const {
    organizationId,
    channelId,
    videoId,
    commentIds,
    commentsReady,
    enabled = true,
    syncInboundComments,
  } = args;
  const lastSignatureRef = useRef("");

  useEffect(() => {
    if (!enabled || !commentsReady || !organizationId || !channelId || !videoId) return;

    const signature = `${videoId}:${commentIds.slice().sort().join(",")}`;
    if (signature === lastSignatureRef.current) return;
    lastSignatureRef.current = signature;

    void syncInboundComments.mutateAsync({ videoId, commentIds }).catch(() => {
      lastSignatureRef.current = "";
    });
  }, [
    enabled,
    commentsReady,
    organizationId,
    channelId,
    videoId,
    commentIds,
    syncInboundComments,
  ]);
}
