export interface SocialMediaLink {
  id: string;
  social_media_plan_id: string;
  platform: string;
  url: string;
  social_media_name?: string | null;
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
