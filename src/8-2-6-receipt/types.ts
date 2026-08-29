export type PosOutletReceiptSettings = {
  id: string;
  organization_id: string;
  outlet_id: string;
  logo_storage_path: string | null;
  footer_notes: string | null;
  share_via_email: boolean;
  share_via_sms: boolean;
  website_url: string | null;
  twitter_url: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  tiktok_url: string | null;
  whatsapp_url: string | null;
};

export type PosOutletReceiptSettingsSave = {
  footer_notes: string | null;
  share_via_email: boolean;
  share_via_sms: boolean;
  website_url: string | null;
  twitter_url: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  tiktok_url: string | null;
  whatsapp_url: string | null;
  logo_storage_path: string | null;
};

export type ReceiptOutletIdentitySave = {
  name: string;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  phone: string | null;
};

export type ReceiptDraft = {
  outletName: string;
  businessName: string;
  city: string;
  province: string;
  postalCode: string;
  phoneNational: string;
  footerNotes: string;
  shareViaEmail: boolean;
  shareViaSms: boolean;
  websiteUrl: string;
  twitterUrl: string;
  facebookUrl: string;
  instagramUrl: string;
  tiktokUrl: string;
  whatsappUrl: string;
};

export const EMPTY_RECEIPT_SETTINGS: Omit<
  PosOutletReceiptSettings,
  "id" | "organization_id" | "outlet_id"
> = {
  logo_storage_path: null,
  footer_notes: null,
  share_via_email: false,
  share_via_sms: false,
  website_url: null,
  twitter_url: null,
  facebook_url: null,
  instagram_url: null,
  tiktok_url: null,
  whatsapp_url: null,
};

export const RECEIPT_SETTINGS_SELECT =
  "id, organization_id, outlet_id, logo_storage_path, footer_notes, share_via_email, share_via_sms, website_url, twitter_url, facebook_url, instagram_url, tiktok_url, whatsapp_url";
