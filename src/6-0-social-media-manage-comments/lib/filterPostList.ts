import type {
  ManageCommentsPostFilter,
  ManageCommentsPostListItem,
} from "@/6-0-social-media-manage-comments/types/manageCommentsSharedTypes";

export function filterManageCommentsPosts(
  posts: ManageCommentsPostListItem[],
  filter: ManageCommentsPostFilter,
  search: string,
  unreadPostIds?: ReadonlySet<string>,
): ManageCommentsPostListItem[] {
  let list = posts;
  if (filter === "unread") {
    list = unreadPostIds?.size
      ? list.filter((p) => unreadPostIds.has(p.id))
      : [];
  } else if (filter === "with_comments") {
    list = list.filter((p) => p.commentCount > 0);
  } else if (filter === "no_comments") {
    list = list.filter((p) => p.commentCount === 0);
  }
  const q = search.trim().toLowerCase();
  if (!q) return list;
  return list.filter(
    (p) =>
      p.title.toLowerCase().includes(q) ||
      p.snippet.toLowerCase().includes(q),
  );
}
