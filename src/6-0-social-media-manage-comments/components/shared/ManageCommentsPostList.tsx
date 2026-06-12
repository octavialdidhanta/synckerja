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
}: ManageCommentsPostListProps) {
  const { t } = useTranslation();

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
            ? t(
                "digitalMarketing.manageComments.noPostsFiltered",
                "No videos match the current filters for this account.",
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
            {t("digitalMarketing.manageComments.showAllPosts", "Show all videos")}
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {posts.map((post) => (
        <ManageCommentsPostListItemRow
          key={post.id}
          post={post}
          selected={selectedId === post.id}
          isNew={highlightedPostIds?.has(post.id)}
          onSelect={() => onSelect(post)}
        />
      ))}
    </div>
  );
}

ManageCommentsPostList.displayName = "ManageCommentsPostList";
