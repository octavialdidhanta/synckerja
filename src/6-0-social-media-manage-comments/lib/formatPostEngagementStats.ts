import type { TFunction } from "i18next";
import type { ManageCommentsPostListItem } from "@/6-0-social-media-manage-comments/types/manageCommentsSharedTypes";

type PostEngagementCounts = Pick<
  ManageCommentsPostListItem,
  "likeCount" | "commentCount" | "viewCount"
>;

/** e.g. "7 suka · 0 komentar · 248 tayangan" */
export function formatPostEngagementStats(
  post: PostEngagementCounts,
  t: TFunction,
  locale?: string,
): string {
  const nf = new Intl.NumberFormat(locale);
  const parts = [
    `${nf.format(post.likeCount)} ${t("digitalMarketing.manageComments.likes", "likes")}`,
    `${nf.format(post.commentCount)} ${t("digitalMarketing.manageComments.comments", "comments")}`,
    `${nf.format(post.viewCount)} ${t("digitalMarketing.manageComments.views", "views")}`,
  ];
  return parts.join(" · ");
}

export function formatPostListSnippet(commentCount: number, t: TFunction, locale?: string): string {
  const nf = new Intl.NumberFormat(locale);
  if (commentCount > 0) {
    return t("digitalMarketing.manageComments.snippetWithComments", {
      count: commentCount,
      formattedCount: nf.format(commentCount),
      defaultValue: "{{formattedCount}} comments",
    });
  }
  return t(
    "digitalMarketing.manageComments.snippetNoComments",
    "No comments yet.",
  );
}
