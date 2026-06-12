import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/ui/avatar";
import { cn } from "@/shared/lib/utils";
import type { OptimisticCommentReply } from "@/6-0-social-media-manage-comments/types/manageCommentsOptimisticTypes";

type TikTokOptimisticReplyBubbleProps = {
  reply: OptimisticCommentReply;
  nested?: boolean;
};

export function TikTokOptimisticReplyBubble({
  reply,
  nested,
}: TikTokOptimisticReplyBubbleProps) {
  const { t } = useTranslation();
  const initials = reply.accountLabel.slice(0, 2).toUpperCase();

  return (
    <div className={cn("py-1", nested && "pl-0")}>
      <div className="flex gap-2">
        <Avatar className="mt-0.5 h-7 w-7 shrink-0">
          <AvatarImage src={reply.accountAvatarUrl ?? undefined} alt={reply.accountLabel} />
          <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div
            className={cn(
              "rounded-2xl px-3 py-2",
              reply.status === "failed" ? "bg-red-50 ring-1 ring-red-200" : "bg-gray-100",
            )}
          >
            <p className="text-sm text-gray-800">
              <span className="font-semibold">{reply.accountLabel}</span>{" "}
              <span className="font-semibold text-primary underline">
                @{reply.mentionLabel}
              </span>{" "}
              {reply.text}
            </p>
          </div>
          <p
            className={cn(
              "mt-1 text-xs",
              reply.status === "failed" ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {reply.status === "failed"
              ? t("digitalMarketing.manageComments.postFailed", "Couldn't post. Try again.")
              : t("digitalMarketing.manageComments.posting", "Posting…")}
          </p>
        </div>
      </div>
    </div>
  );
}

TikTokOptimisticReplyBubble.displayName = "TikTokOptimisticReplyBubble";
