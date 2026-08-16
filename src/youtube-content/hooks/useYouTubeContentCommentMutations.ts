import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { parseEdgeFunctionError } from "@/tiktok-ads/lib/parseEdgeFunctionError";
import { supabase } from "@/shared/lib/supabaseClient";
import { youtubeManageCommentsInboxStateQueryKey } from "@/6-0-social-media-manage-comments/lib/youtubeManageCommentsInboxQueryKeys";
import type { YouTubeManageCommentsInboxState } from "@/6-0-social-media-manage-comments/lib/youtubeManageCommentsInboxApi";
import {
  hydrateCommentHighlightStoreFromServer,
  hydratePostHighlightStoreFromServer,
} from "@/6-0-social-media-manage-comments/lib/manageCommentsInboundHighlightStore";
import type { YouTubeCommentRow } from "@/youtube-content/types/youtubeCommentApiTypes";

function isYouTubeInboxStatePayload(payload: unknown): payload is YouTubeManageCommentsInboxState {
  if (!payload || typeof payload !== "object") return false;
  const row = payload as YouTubeManageCommentsInboxState;
  return Array.isArray(row.posts) && Array.isArray(row.inbound_comments);
}

function applyYouTubeInboxStateFromPayload(
  queryClient: QueryClient,
  organizationId: string,
  channelId: string,
  videoId: string,
  payload: unknown,
) {
  if (!isYouTubeInboxStatePayload(payload)) return;
  queryClient.setQueryData(
    youtubeManageCommentsInboxStateQueryKey(organizationId, channelId),
    payload,
  );
  hydratePostHighlightStoreFromServer(channelId, payload.posts);
  const engagedSet = new Set(payload.engaged_comment_ids);
  const inboundForVideo = payload.inbound_comments
    .filter((row) => row.video_id === videoId)
    .map((row) => row.comment_id);
  hydrateCommentHighlightStoreFromServer(channelId, videoId, inboundForVideo, engagedSet);
}

async function invokeYouTubeCommentAction(
  organizationId: string,
  channelId: string,
  action: string,
  extra: Record<string, unknown>,
) {
  const { data, error } = await supabase.functions.invoke("youtube-content-comments", {
    body: {
      action,
      organization_id: organizationId,
      channel_id: channelId,
      ...extra,
    },
  });
  if (error) throw await parseEdgeFunctionError(error, data);
  const payload = data as YouTubeManageCommentsInboxState & {
    error?: string;
    ok?: boolean;
    comment_id?: string;
    comment?: YouTubeCommentRow;
  };
  if (payload?.error) throw await parseEdgeFunctionError(null, payload);
  return payload;
}

export function useYouTubeContentCommentMutations(args: {
  organizationId: string | null | undefined;
  channelId: string;
  videoId: string | null;
}) {
  const { organizationId, channelId, videoId } = args;
  const queryClient = useQueryClient();

  const replyComment = useMutation({
    mutationFn: async (input: {
      text: string;
      commentId: string;
      repliesListParentId: string;
      threadId?: string | null;
      targetParentCommentId?: string | null;
    }) => {
      if (!organizationId || !channelId || !videoId) throw new Error("Missing context");
      const commentId = input.commentId.trim();
      if (!commentId) throw new Error("Missing comment to reply to");
      return invokeYouTubeCommentAction(organizationId, channelId, "replyComment", {
        video_id: videoId,
        text: input.text,
        comment_id: commentId,
        thread_id: input.threadId ?? null,
        target_parent_comment_id: input.targetParentCommentId ?? null,
      });
    },
    onSuccess: (data) => {
      if (organizationId && channelId && videoId) {
        applyYouTubeInboxStateFromPayload(queryClient, organizationId, channelId, videoId, data);
      }
      // Reply thread cache is updated optimistically in YouTubeCommentThreadPanel.
      // Do not invalidate replies here — an immediate refetch often returns before YouTube
      // lists the new reply and wipes the cached row from the UI.
    },
  });

  const insertComment = useMutation({
    mutationFn: async (input: { text: string }) => {
      if (!organizationId || !channelId || !videoId) throw new Error("Missing context");
      return invokeYouTubeCommentAction(organizationId, channelId, "insertComment", {
        video_id: videoId,
        text: input.text,
      });
    },
    onSuccess: () => {
      if (organizationId && channelId && videoId) {
        void queryClient.invalidateQueries({
          queryKey: ["youtube-content-comments", organizationId, channelId, videoId],
        });
      }
    },
  });

  return { replyComment, insertComment };
}
