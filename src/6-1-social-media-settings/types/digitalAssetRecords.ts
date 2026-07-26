export interface DigitalAssetCharacter {
  id: string;
  organization_id: string;
  name: string | null;
  age: string | null;
  nationality: string | null;
  gender: string | null;
  hair_description: string | null;
  face_description: string | null;
  clothing_description: string | null;
  accessories: string | null;
  body_shape: string | null;
  height: string | null;
  additional_details: string | null;
  reference_image_path: string | null;
  combined_prompt: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface DigitalAssetCharacterImage {
  id: string;
  organization_id: string;
  character_id: string;
  storage_path: string;
  pose_key: string;
  label_custom: string | null;
  sort_order: number;
  is_primary: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface DigitalAssetObject {
  id: string;
  organization_id: string;
  name: string | null;
  description: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface DigitalAssetBrandColor {
  id: string;
  organization_id: string;
  brand_name: string | null;
  primary_color_hex: string | null;
  secondary_color_hex: string | null;
  accent_color_hex: string | null;
  text_color_hex: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface DigitalAssetCompanyLogo {
  id: string;
  organization_id: string;
  brand_name: string | null;
  logo_path: string | null;
  created_at?: string;
  updated_at?: string;
}
