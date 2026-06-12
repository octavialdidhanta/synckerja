import type { ManageCommentsSort } from "@/6-0-social-media-manage-comments/types/manageCommentsSharedTypes";
import type { TikTokCommentRow } from "@/tiktok-content/types/tiktokCommentApiTypes";

function commentTime(c: TikTokCommentRow): number {
  return c.create_time ?? 0;
}

/** Pin new comments at the top (stays after dismiss), then apply the chosen sort for the rest. */
export function sortCommentsForThread(
  comments: TikTokCommentRow[],
  sort: ManageCommentsSort,
  pinnedIds: Set<string>,
): TikTokCommentRow[] {
  const pinned = comments
    .filter((c) => pinnedIds.has(c.id))
    .sort((a, b) => commentTime(b) - commentTime(a));
  const rest = comments.filter((c) => !pinnedIds.has(c.id));
  const sortedRest =
    sort === "newest"
      ? [...rest].sort((a, b) => commentTime(b) - commentTime(a))
      : [...rest].sort((a, b) => commentTime(a) - commentTime(b));
  return [...pinned, ...sortedRest];
}
