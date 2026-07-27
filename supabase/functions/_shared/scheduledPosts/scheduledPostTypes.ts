export const SCHEDULED_POST_STATUSES = [
  "pending",
  "publishing",
  "published",
  "failed",
  "cancelled",
] as const;

export type ScheduledPostStatus = (typeof SCHEDULED_POST_STATUSES)[number];

export const DELIVERY_MODES = ["api_auto", "manual_only"] as const;
export type DeliveryMode = (typeof DELIVERY_MODES)[number];

export const DEFAULT_PRIVACY_LEVEL = "PUBLIC_TO_EVERYONE";
export const DEFAULT_TIMEZONE = "Asia/Jakarta";
export const MEDIA_SOURCE_GOOGLE_DRIVE = "google_drive_link";

export type TikTokProviderConfig = {
  open_id: string;
  account_label?: string;
  employee_id?: string;
  tiktok_publish_id?: string;
  tiktok_upload_completed?: boolean;
};

export type YouTubeProviderConfig = {
  channel_id: string;
  account_label?: string;
  employee_id?: string;
  published_channel_id?: string;
  published_channel_title?: string;
  published_privacy_status?: string;
  youtube_upload_url?: string;
  youtube_upload_bytes_sent?: number;
  youtube_upload_completed?: boolean;
  youtube_video_id?: string;
};

export type InstagramProviderConfig = {
  instagram_business_account_id: string;
  facebook_page_id: string;
  account_label?: string;
  employee_id?: string;
  ig_container_id?: string;
  ig_upload_phase?: string;
  ig_upload_session_id?: string;
};

export type FacebookProviderConfig = {
  facebook_page_id: string;
  account_label?: string;
  employee_id?: string;
  fb_video_id?: string;
  fb_upload_url?: string;
  fb_upload_phase?: string;
};

export type LinkedInProviderConfig = {
  page_id: string;
  organization_urn?: string;
  account_label?: string;
  employee_id?: string;
  linkedin_upload_urn?: string;
  linkedin_upload_instructions?: Record<string, unknown>;
  linkedin_post_urn?: string;
};

export type ScheduledPostRow = {
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
  provider_config: Record<string, unknown>;
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
