import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import type { ManageCommentsPostListItem } from "@/6-0-social-media-manage-comments/types/manageCommentsSharedTypes";
import type { ManageCommentsPostFilter } from "@/6-0-social-media-manage-comments/types/manageCommentsSharedTypes";
import { ManageCommentsPostListItemRow } from "@/6-0-social-media-manage-comments/components/shared/ManageCommentsPostListItem";

type ManageCommentsPostListProps = {
  posts: ManageCommentsPostListItem[];
  selectedId: string | null;
  highlightedPostIds?: Set<string>;
  onSelect: (post: ManageCommentsPostListItem) => void;
  isLoading?: boolean;
  isFetching?: boolean;
  totalPosts?: number;
  activeFilter?: ManageCommentsPostFilter;
  hasSearch?: boolean;
  onClearFilters?: () => void;
  platformBadge?: ReactNode;
  /** Prefix React keys when post ids may repeat across accounts/platforms. */
  listItemKeyPrefix?: string;
  /** TikTok/YouTube use "video"; Meta platforms use "post". */
  contentKind?: "video" | "post";
};

export function ManageCommentsPostList({
  posts,
  selectedId,
  highlightedPostIds,
  onSelect,
  isLoading,
  isFetching,
  totalPosts = 0,
  activeFilter = "all",
  hasSearch = false,
  onClearFilters,
  platformBadge,
  listItemKeyPrefix,
  contentKind = "video",
}: ManageCommentsPostListProps) {
  const { t } = useTranslation();
  const isPost = contentKind === "post";

  if (isLoading && posts.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (posts.length === 0) {
    const filteredEmpty =
      totalPosts > 0 && (activeFilter !== "all" || hasSearch);
    return (
      <div className="px-3 py-8 text-center text-sm text-muted-foreground">
        <p>
          {filteredEmpty
            ? isPost
              ? t(
                  "digitalMarketing.manageComments.noPostsFilteredPosts",
                  "No posts match the current filters for this account.",
                )
              : t(
                  "digitalMarketing.manageComments.noPostsFiltered",
                  "No videos match the current filters for this account.",
                )
            : isPost
              ? t(
                  "digitalMarketing.manageComments.noPostsAccountPosts",
                  "No posts found for this account.",
                )
              : t(
                  "digitalMarketing.manageComments.noPostsAccount",
                  "No videos found for this account.",
                )}
        </p>
        {filteredEmpty && onClearFilters ? (
          <Button
            type="button"
            variant="link"
            className="mt-2 h-auto p-0 text-primary"
            onClick={onClearFilters}
          >
            {isPost
              ? t("digitalMarketing.manageComments.showAllPostsPosts", "Show all posts")
              : t("digitalMarketing.manageComments.showAllPosts", "Show all videos")}
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {posts.map((post) => (
        <ManageCommentsPostListItemRow
          key={listItemKeyPrefix ? `${listItemKeyPrefix}:${post.id}` : post.id}
          post={post}
          selected={selectedId != null && String(post.id) === String(selectedId)}
          isNew={highlightedPostIds?.has(post.id)}
          onSelect={() => onSelect(post)}
          platformBadge={platformBadge}
        />
      ))}
    </div>
  );
}

ManageCommentsPostList.displayName = "ManageCommentsPostList";
