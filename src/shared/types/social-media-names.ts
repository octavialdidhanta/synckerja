export interface SocialMediaName {
  id: string;
  organization_id: string;
  platform: string;
  name: string;
  description?: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CreateSocialMediaNameData {
  organization_id: string;
  platform: string;
  name: string;
  description?: string | null;
  is_active?: boolean;
}

export interface UpdateSocialMediaNameData {
  platform?: string;
  name?: string;
  description?: string | null;
  is_active?: boolean;
}
