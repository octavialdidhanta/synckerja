export type YouTubeChannelAnalyticsOverview = {
  views: number;
  estimated_minutes_watched: number;
  average_view_duration_seconds: number | null;
  subscribers_gained: number;
  subscribers_lost: number;
};

export type YouTubeChannelDemographicsRow = {
  age_group: string;
  gender: string;
  viewer_percentage: number;
};

export type YouTubeChannelTrafficSourceRow = {
  source_type: string;
  source_label: string;
  views: number;
  estimated_minutes_watched: number;
};

export type YouTubeChannelDailyTrendRow = {
  date: string;
  views: number;
  estimated_minutes_watched: number;
};

export type YouTubeChannelAnalyticsResponse = {
  channel_id: string;
  account_id?: string;
  account_label: string | null;
  date_start: string;
  date_end: string;
  overview: YouTubeChannelAnalyticsOverview;
  demographics: YouTubeChannelDemographicsRow[];
  traffic_sources: YouTubeChannelTrafficSourceRow[];
  daily_trend: YouTubeChannelDailyTrendRow[];
  fetched_at?: string;
  cached?: boolean;
};
