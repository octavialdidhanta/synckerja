import type { ManageCommentsPostListItem } from "@/6-0-social-media-manage-comments/types/manageCommentsSharedTypes";

function postTimeMs(postedAt: string | null): number {
  if (!postedAt) return 0;
  const ms = new Date(postedAt).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

/** Pinned (recent activity) posts first by bump time, then newest video date. */
export function sortPostsForInbox(
  posts: ManageCommentsPostListItem[],
  pinnedPostIds: Set<string>,
  pinnedAtMs: Map<string, number>,
): ManageCommentsPostListItem[] {
  return [...posts].sort((a, b) => {
    const aPinned = pinnedPostIds.has(a.id);
    const bPinned = pinnedPostIds.has(b.id);
    if (aPinned !== bPinned) return aPinned ? -1 : 1;
    if (aPinned && bPinned) {
      const aBump = pinnedAtMs.get(a.id) ?? 0;
      const bBump = pinnedAtMs.get(b.id) ?? 0;
      if (aBump !== bBump) return bBump - aBump;
    }
    return postTimeMs(b.postedAt) - postTimeMs(a.postedAt);
  });
}
