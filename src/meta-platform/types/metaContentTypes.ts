export type MetaContentPlatform = 'instagram' | 'facebook';

export type MetaContentAccount = {
  platform: MetaContentPlatform;
  account_id: string;
  account_label: string;
  page_id: string;
  granted_scopes: string[];
  avatar_url: string | null;
  feature_status?: Record<
    string,
    { ok: boolean; missing: string[] }
  >;
};

export type MetaContentPostRow = {
  id: string;
  media_id: string;
  caption: string | null;
  media_type: string | null;
  media_url: string | null;
  thumbnail_url: string | null;
  permalink: string | null;
  timestamp: string | null;
  comment_count: number;
  like_count: number;
};

export type MetaContentCommentRow = {
  id: string;
  media_id: string;
  text: string;
  author_display_name: string;
  author_avatar_url: string | null;
  like_count: number;
  reply_count: number;
  parent_comment_id: string | null;
  published_at: string | null;
  is_channel_owner: boolean;
  can_reply: boolean;
};

export type MetaContentMetricsPayload = {
  date_start?: string;
  date_end?: string;
  account: {
    platform: MetaContentPlatform;
    account_id: string;
    account_label: string;
    audience_count?: number | null;
    audience_hidden?: boolean;
    audience_label?: 'followers' | 'subscribers' | null;
    content_count: number;
    total_views: number;
    total_likes: number;
    total_comments: number;
    total_shares: number;
    avg_engagement_rate: number | null;
    reach: number;
    impressions: number;
    engagement: number;
  };
  posts: Array<{
    platform: MetaContentPlatform;
    account_id: string;
    content_id: string;
    posted_at: string | null;
    view_count: number;
    like_count: number;
    comment_count: number;
    share_count: number;
    reach: number;
    total_interactions: number;
    engagement_rate: number | null;
    caption: string | null;
    media_url: string | null;
    thumbnail_url?: string | null;
    permalink: string | null;
    plan_id: string | null;
    service_name: string | null;
    content_pillar: string | null;
    match_type?: 'share_url' | 'media_id' | null;
  }>;
};
