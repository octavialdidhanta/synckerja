import { useMemo } from "react";

import { useTranslation } from "react-i18next";

import { Loader2 } from "lucide-react";

import { useYouTubeContentCommentRepliesQuery } from "@/youtube-content/hooks/useYouTubeContentCommentsQuery";

import { YouTubeCommentItem } from "@/6-0-social-media-manage-comments/components/youtube/YouTubeCommentItem";

import { TikTokOptimisticReplyBubble } from "@/6-0-social-media-manage-comments/components/tiktok/TikTokOptimisticReplyBubble";

import type { ManageCommentsReplyControls } from "@/6-0-social-media-manage-comments/types/manageCommentsReplyControls";

import type { OptimisticCommentReply } from "@/6-0-social-media-manage-comments/types/manageCommentsOptimisticTypes";



type YouTubeCommentReplyThreadProps = {

  organizationId: string;

  channelId: string;

  commentId: string;

  videoId: string;

  threadId?: string | null;

  replyControls: ManageCommentsReplyControls;

  optimisticReplies: OptimisticCommentReply[];

  isMutating?: boolean;

  highlightedIds?: Set<string>;

};



export function YouTubeCommentReplyThread({

  organizationId,

  channelId,

  commentId,

  videoId,

  threadId,

  replyControls,

  optimisticReplies,

  isMutating,

  highlightedIds,

}: YouTubeCommentReplyThreadProps) {

  const { t } = useTranslation();



  const repliesQuery = useYouTubeContentCommentRepliesQuery({

    organizationId,

    channelId,

    videoId,

    commentId,

    enabled: Boolean(organizationId && channelId && videoId && commentId),

  });



  const optimisticTexts = useMemo(

    () => new Set(optimisticReplies.map((r) => r.text.trim())),

    [optimisticReplies],

  );



  const serverReplies = useMemo(() => {

    const rows = repliesQuery.data?.comments ?? [];

    return [...rows].sort((a, b) => (b.create_time ?? 0) - (a.create_time ?? 0));

  }, [repliesQuery.data?.comments]);



  if (repliesQuery.isLoading && serverReplies.length === 0 && optimisticReplies.length === 0) {

    return (

      <div className="mt-2 flex items-center gap-2 border-l-2 border-sky-200 pl-3 text-xs text-muted-foreground">

        <Loader2 className="h-3.5 w-3.5 animate-spin" />

        {t("digitalMarketing.manageComments.loadingReplies", "Loading replies…")}

      </div>

    );

  }



  if (serverReplies.length === 0 && optimisticReplies.length === 0) return null;



  return (

    <div className="mt-2 space-y-1 border-l-2 border-sky-300 pl-3">

      {optimisticReplies.map((reply) => (

        <TikTokOptimisticReplyBubble key={reply.tempId} reply={reply} nested />

      ))}

      {serverReplies

        .filter((reply) => !optimisticTexts.has(reply.text.trim()))

        .map((reply) => (

          <YouTubeCommentItem

            key={reply.id}

            comment={reply}

            organizationId={organizationId}

            channelId={channelId}

            videoId={videoId}

            rootThreadId={threadId}

            replyControls={replyControls}

            isMutating={isMutating}

            nested

            isNew={highlightedIds?.has(reply.id)}

            highlightedIds={highlightedIds}

          />

        ))}

    </div>

  );

}



YouTubeCommentReplyThread.displayName = "YouTubeCommentReplyThread";

