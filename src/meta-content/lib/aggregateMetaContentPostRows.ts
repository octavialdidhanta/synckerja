import type { MetaContentMetricsPayload } from '@/meta-platform/types/metaContentTypes';

export type MetaContentPostTotals = {
  reach: number;
  views: number;
  likes: number;
  comments: number;
  engagement: number;
  postCount: number;
};

/** Summary cards must match the visible post table (single source of truth). */
export function aggregateMetaContentPostRows(
  posts: MetaContentMetricsPayload['posts'],
): MetaContentPostTotals {
  let reach = 0;
  let views = 0;
  let likes = 0;
  let comments = 0;
  let engagement = 0;

  for (const row of posts) {
    reach += Number(row.reach) || 0;
    views += Number(row.view_count) || 0;
    likes += Number(row.like_count) || 0;
    comments += Number(row.comment_count) || 0;
    engagement += Number(row.total_interactions) || 0;
  }

  if (engagement === 0) {
    engagement = likes + comments;
  }

  return {
    reach,
    views,
    likes,
    comments,
    engagement,
    postCount: posts.length,
  };
}
