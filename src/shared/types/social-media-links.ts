export interface SocialMediaLink {
  id: string;
  social_media_plan_id: string;
  platform: string;
  url: string;
  social_media_name?: string | null;
  platform_account_open_id?: string | null;
  external_post_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface CreateSocialMediaLinkData {
  social_media_plan_id: string;
  platform: string;
  url: string;
  social_media_name?: string | null;
}

export interface UpdateSocialMediaLinkData {
  platform?: string;
  url?: string;
  social_media_name?: string | null;
}
