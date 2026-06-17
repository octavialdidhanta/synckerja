import { ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/ui/avatar";
import { formatPostEngagementStats } from "@/6-0-social-media-manage-comments/lib/formatPostEngagementStats";
import type { ManageCommentsPostListItem } from "@/6-0-social-media-manage-comments/types/manageCommentsSharedTypes";

type ManageCommentsThreadHeaderProps = {
  post: ManageCommentsPostListItem;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  openOnPlatform?: "tiktok" | "youtube";
};

export function ManageCommentsThreadHeader({
  post,
  onRefresh,
  isRefreshing,
  openOnPlatform = "tiktok",
}: ManageCommentsThreadHeaderProps) {
  const { t, i18n } = useTranslation();
  const initials = post.accountLabel.slice(0, 2).toUpperCase();
  const engagementStats = formatPostEngagementStats(post, t, i18n.language);
  const postedLabel = (() => {
    if (!post.postedAt) return null;
    const d = new Date(post.postedAt);
    if (Number.isNaN(d.getTime())) return null;
    return format(d, "d MMM yyyy");
  })();
  const statsLine = postedLabel
    ? `${engagementStats} · ${postedLabel}`
    : engagementStats;

  return (
    <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar className="h-10 w-10 shrink-0">
          <AvatarImage src={post.accountAvatarUrl ?? undefined} alt={post.accountLabel} />
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-gray-900">{post.title}</p>
          <p className="text-xs text-muted-foreground">{statsLine}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {post.shareUrl ? (
          <Button variant="outline" size="sm" asChild className="h-8 text-xs">
            <a href={post.shareUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-1 h-3.5 w-3.5" />
              {openOnPlatform === "youtube"
                ? t("digitalMarketing.manageComments.openOnYouTube", "Open on YouTube")
                : t("digitalMarketing.manageComments.openOnTikTok", "Open on TikTok")}
            </a>
          </Button>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label={t("digitalMarketing.manageComments.refresh", "Refresh")}
          disabled={isRefreshing}
          onClick={onRefresh}
        >
          {isRefreshing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}

ManageCommentsThreadHeader.displayName = "ManageCommentsThreadHeader";
