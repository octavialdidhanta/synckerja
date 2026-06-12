import { format } from "date-fns";
import { useTranslation } from "react-i18next";
import { formatPostListSnippet } from "@/6-0-social-media-manage-comments/lib/formatPostEngagementStats";
import { User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/ui/avatar";
import { cn } from "@/shared/lib/utils";
import { TikTokTabIcon } from "@/6-0-traffic/container/TikTokTabIcon";
import type { ManageCommentsPostListItem } from "@/6-0-social-media-manage-comments/types/manageCommentsSharedTypes";

type ManageCommentsPostListItemRowProps = {
  post: ManageCommentsPostListItem;
  selected: boolean;
  isNew?: boolean;
  onSelect: () => void;
};

function formatPostDate(postedAt: string | null): string {
  if (!postedAt) return "";
  const d = new Date(postedAt);
  if (Number.isNaN(d.getTime())) return "";
  return format(d, "dd/MM/yyyy");
}

export function ManageCommentsPostListItemRow({
  post,
  selected,
  isNew,
  onSelect,
}: ManageCommentsPostListItemRowProps) {
  const { t, i18n } = useTranslation();
  const snippetLabel = formatPostListSnippet(post.commentCount, t, i18n.language);
  const initials = post.accountLabel
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full gap-3 border-b border-gray-100 px-3 py-3 text-left transition-colors hover:bg-gray-50",
        selected && !isNew && "bg-sky-50/60",
        isNew && "border-l-4 border-l-amber-400 bg-amber-50/90 animate-in fade-in",
        selected && isNew && "ring-1 ring-inset ring-amber-200/70",
      )}
    >
      <div className="relative shrink-0">
        <Avatar className="h-11 w-11 rounded-full bg-gray-200">
          <AvatarImage
            src={post.accountAvatarUrl ?? post.coverImageUrl ?? undefined}
            alt={post.accountLabel}
            className="object-cover"
          />
          <AvatarFallback className="rounded-full bg-gray-300 text-sm text-gray-600">
            {initials || <User className="h-5 w-5" />}
          </AvatarFallback>
        </Avatar>
        <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-black ring-2 ring-white">
          <TikTokTabIcon className="h-2.5 w-2.5 text-white" />
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex items-start justify-between gap-2">
          <p className="line-clamp-2 text-sm font-semibold text-gray-900">{post.title}</p>
          {post.postedAt ? (
            <span className="shrink-0 text-xs text-muted-foreground">
              {formatPostDate(post.postedAt)}
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isNew ? (
            <span className="shrink-0 rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
              {t("digitalMarketing.manageComments.newComments", "New comment")}
            </span>
          ) : null}
          <p className="line-clamp-2 text-xs text-muted-foreground">{snippetLabel}</p>
        </div>
      </div>
    </button>
  );
}

ManageCommentsPostListItemRow.displayName = "ManageCommentsPostListItemRow";
