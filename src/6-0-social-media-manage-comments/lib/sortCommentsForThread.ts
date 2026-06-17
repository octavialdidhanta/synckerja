import type { ManageCommentsSort } from "@/6-0-social-media-manage-comments/types/manageCommentsSharedTypes";

type CommentWithTime = {
  id: string;
  create_time?: number | null;
};

function commentTime(c: CommentWithTime): number {
  return c.create_time ?? 0;
}

/** Pin new comments at the top (stays after dismiss), then apply the chosen sort for the rest. */
export function sortCommentsForThread<T extends CommentWithTime>(
  comments: T[],
  sort: ManageCommentsSort,
  pinnedIds: Set<string>,
): T[] {
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
