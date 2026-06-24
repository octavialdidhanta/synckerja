export const SCHEDULED_POST_STATUSES = [
  'pending',
  'publishing',
  'published',
  'failed',
  'cancelled',
] as const;

export type ScheduledPostStatus = (typeof SCHEDULED_POST_STATUSES)[number];

export const DELIVERY_MODES = ['api_auto', 'manual_only'] as const;
export type DeliveryMode = (typeof DELIVERY_MODES)[number];

export const DEFAULT_PRIVACY_LEVEL = 'SELF_ONLY';
export const DEFAULT_TIMEZONE = 'Asia/Jakarta';

export type TikTokProviderConfig = {
  open_id: string;
  account_label?: string;
};

export type ScheduledPost = {
  id: string;
  organization_id: string;
  social_media_plan_id: string;
  platform: string;
  delivery_mode: DeliveryMode;
  status: ScheduledPostStatus;
  scheduled_at: string;
  timezone: string;
  media_source: string;
  media_url_snapshot: string;
  media_resolved_url: string | null;
  caption: string | null;
  title: string | null;
  privacy_level: string | null;
  provider_config: TikTokProviderConfig & Record<string, unknown>;
  external_post_id: string | null;
  published_url: string | null;
  published_at: string | null;
  error_message: string | null;
  retry_count: number;
  next_retry_at: string | null;
  locked_at: string | null;
  last_error_at: string | null;
  scheduled_by: string | null;
  created_at: string;
  updated_at: string;
};
