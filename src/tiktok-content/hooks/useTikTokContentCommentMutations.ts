import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { parseEdgeFunctionError } from "@/tiktok-ads/lib/parseEdgeFunctionError";
import { supabase } from "@/shared/lib/supabaseClient";
import { manageCommentsInboxStateQueryKey } from "@/6-0-social-media-manage-comments/lib/manageCommentsInboxQueryKeys";
import type { ManageCommentsInboxState } from "@/6-0-social-media-manage-comments/lib/manageCommentsInboxApi";
import {
  hydrateCommentHighlightStoreFromServer,
  hydratePostHighlightStoreFromServer,
} from "@/6-0-social-media-manage-comments/lib/manageCommentsInboundHighlightStore";
import type { TikTokCommentsListResponse } from "@/tiktok-content/types/tiktokCommentApiTypes";

function isInboxStatePayload(payload: unknown): payload is ManageCommentsInboxState {
  if (!payload || typeof payload !== "object") return false;
  const row = payload as ManageCommentsInboxState;
  return Array.isArray(row.posts) && Array.isArray(row.inbound_comments);
}

function applyInboxStateFromPayload(
  queryClient: QueryClient,
  organizationId: string,
  openId: string,
  videoId: string,
  payload: unknown,
) {
  if (!isInboxStatePayload(payload)) return;
  queryClient.setQueryData(manageCommentsInboxStateQueryKey(organizationId, openId), payload);
  hydratePostHighlightStoreFromServer(openId, payload.posts);
  const engagedSet = new Set(payload.engaged_comment_ids);
  const inboundForVideo = payload.inbound_comments
    .filter((row) => row.video_id === videoId)
    .map((row) => row.comment_id);
  hydrateCommentHighlightStoreFromServer(openId, videoId, inboundForVideo, engagedSet);
}

function removeCommentFromThreadCaches(
  queryClient: QueryClient,
  organizationId: string,
  openId: string,
  videoId: string,
  commentId: string,
) {
  const trimmedId = commentId.trim();
  if (!trimmedId) return;

  const stripFromList = (old: TikTokCommentsListResponse | null | undefined) => {
    if (!old?.comments?.length) return old;
    const comments = old.comments.filter((c) => c.id !== trimmedId);
    if (comments.length === old.comments.length) return old;
    return { ...old, comments };
  };

  queryClient.setQueriesData<TikTokCommentsListResponse | null>(
    { queryKey: ["tiktok-content-comments", "v3", organizationId, openId, videoId] },
    stripFromList,
  );

  queryClient.setQueriesData<TikTokCommentsListResponse | null>(
    { queryKey: ["tiktok-content-comment-replies", "v3", organizationId, openId, videoId] },
    stripFromList,
  );
}

async function invokeCommentAction(
  organizationId: string,
  openId: string,
  action: string,
  extra: Record<string, unknown>,
) {
  const { data, error } = await supabase.functions.invoke("tiktok-content-comments", {
    body: {
      action,
      organization_id: organizationId,
      open_id: openId,
      ...extra,
    },
  });
  if (error) throw await parseEdgeFunctionError(error, data);
  const payload = data as ManageCommentsInboxState & {
    error?: string;
    ok?: boolean;
    comment_id?: string;
  };
  if (payload?.error) throw await parseEdgeFunctionError(null, payload);
  return payload;
}

export function useTikTokContentCommentMutations(args: {
  organizationId: string | null | undefined;
  openId: string;
  videoId: string | null;
}) {
  const { organizationId, openId, videoId } = args;
  const queryClient = useQueryClient();

  const invalidateComments = () => {
    if (!organizationId || !openId || !videoId) return;
    void queryClient.invalidateQueries({
      queryKey: ["tiktok-content-comments", "v3", organizationId, openId, videoId],
    });
    void queryClient.invalidateQueries({
      queryKey: ["tiktok-content-comment-replies", "v3", organizationId, openId],
    });
    void queryClient.invalidateQueries({
      queryKey: ["tiktok-content-comment-posts", organizationId, openId],
    });
  };

  const invalidateInboxState = () => {
    if (!organizationId || !openId) return;
    void queryClient.invalidateQueries({
      queryKey: manageCommentsInboxStateQueryKey(organizationId, openId),
    });
  };

  const replyComment = useMutation({
    mutationFn: async (input: { text: string; commentId: string }) => {
      if (!organizationId || !openId || !videoId) throw new Error("Missing context");
      const commentId = input.commentId.trim();
      if (!commentId) throw new Error("Missing comment to reply to");
      return invokeCommentAction(organizationId, openId, "replyComment", {
        video_id: videoId,
        text: input.text,
        comment_id: commentId,
      });
    },
    onSuccess: (_data, variables) => {
      invalidateComments();
      invalidateInboxState();
      if (!organizationId || !openId || !videoId) return;
      void queryClient.invalidateQueries({
        queryKey: [
          "tiktok-content-comment-replies",
          "v3",
          organizationId,
          openId,
          videoId,
          variables.commentId,
        ],
      });
    },
  });

  const hideComment = useMutation({
    mutationFn: async (commentId: string) => {
      if (!organizationId || !openId || !videoId) throw new Error("Missing context");
      return invokeCommentAction(organizationId, openId, "hideComment", {
        comment_id: commentId,
        video_id: videoId,
      });
    },
    onSuccess: (data, commentId) => {
      if (organizationId && openId && videoId) {
        removeCommentFromThreadCaches(queryClient, organizationId, openId, videoId, commentId);
        applyInboxStateFromPayload(queryClient, organizationId, openId, videoId, data);
      }
      invalidateComments();
    },
  });

  const deleteComment = useMutation({
    mutationFn: async (input: { commentId: string; parentCommentId?: string | null }) => {
      if (!organizationId || !openId || !videoId) throw new Error("Missing context");
      const parentCommentId = input.parentCommentId?.trim();
      return invokeCommentAction(organizationId, openId, "deleteComment", {
        comment_id: input.commentId.trim(),
        video_id: videoId,
        ...(parentCommentId ? { parent_comment_id: parentCommentId } : {}),
      });
    },
    onSuccess: (data, input) => {
      if (organizationId && openId && videoId) {
        removeCommentFromThreadCaches(
          queryClient,
          organizationId,
          openId,
          videoId,
          input.commentId,
        );
        applyInboxStateFromPayload(queryClient, organizationId, openId, videoId, data);
      }
      invalidateComments();
    },
  });

  const likeComment = useMutation({
    mutationFn: async (input: { commentId: string; action?: "LIKE" | "UNLIKE" }) => {
      if (!organizationId || !openId || !videoId) throw new Error("Missing context");
      const commentId = input.commentId.trim();
      if (!commentId) throw new Error("Missing comment_id");
      return invokeCommentAction(organizationId, openId, "likeComment", {
        comment_id: commentId,
        video_id: videoId,
        like_action: input.action ?? "LIKE",
      });
    },
    onSuccess: () => {
      invalidateComments();
      invalidateInboxState();
    },
  });

  return { replyComment, hideComment, deleteComment, likeComment };
}
