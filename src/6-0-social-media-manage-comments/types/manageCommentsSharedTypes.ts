export type ManageCommentsPostFilter =
  | "all"
  | "unread"
  | "with_comments"
  | "no_comments";

export type ManageCommentsSort = "newest" | "oldest";

export type ManageCommentsPostListItem = {
  id: string;
  title: string;
  snippet: string;
  coverImageUrl: string | null;
  postedAt: string | null;
  commentCount: number;
  likeCount: number;
  viewCount: number;
  shareUrl: string | null;
  duration: number | null;
  accountAvatarUrl: string | null;
  accountLabel: string;
};
