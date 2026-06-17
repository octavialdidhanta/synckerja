import type { YouTubeCommentRow } from "@/youtube-content/types/youtubeCommentApiTypes";

/** Top-level threads plus their reply totals (YouTube video statistics omit replies). */
export function sumYouTubeTopLevelCommentActivity(
  comments: ReadonlyArray<Pick<YouTubeCommentRow, "reply_count">>,
): number {
  return comments.reduce(
    (sum, row) => sum + 1 + Math.max(0, Number(row.reply_count) || 0),
    0,
  );
}
