import { useMutation, useQueryClient } from "@tanstack/react-query";
import { parseEdgeFunctionError } from "@/tiktok-ads/lib/parseEdgeFunctionError";
import { supabase } from "@/shared/lib/supabaseClient";
import { youtubeManageCommentsInboxStateQueryKey } from "@/6-0-social-media-manage-comments/lib/youtubeManageCommentsInboxQueryKeys";
import type { YouTubeManageCommentsInboxState } from "@/6-0-social-media-manage-comments/lib/youtubeManageCommentsInboxApi";
import type { YouTubeCommentRow } from "@/youtube-content/types/youtubeCommentApiTypes";

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

  const invalidateComments = () => {
    if (!organizationId || !channelId || !videoId) return;
    void queryClient.invalidateQueries({
      queryKey: ["youtube-content-comments", organizationId, channelId, videoId],
    });
    void queryClient.invalidateQueries({
      queryKey: ["youtube-content-comment-replies", organizationId, channelId, videoId],
    });
    void queryClient.invalidateQueries({
      queryKey: ["youtube-content-comment-posts", organizationId, channelId],
    });
  };

  const invalidateInboxState = () => {
    if (!organizationId || !channelId) return;
    void queryClient.invalidateQueries({
      queryKey: youtubeManageCommentsInboxStateQueryKey(organizationId, channelId),
    });
  };

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
    onSuccess: (_data, variables) => {
      invalidateComments();
      invalidateInboxState();
      if (!organizationId || !channelId || !videoId) return;
      const listParentId = variables.repliesListParentId.trim() || variables.commentId;
      void queryClient.invalidateQueries({
        queryKey: [
          "youtube-content-comment-replies",
          organizationId,
          channelId,
          videoId,
          listParentId,
        ],
      });
    },
  });

  return { replyComment };
}
