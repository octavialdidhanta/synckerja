export type LeadMagnetPlatform = 'instagram' | 'facebook';

export type LeadMagnetCampaignStatus = 'draft' | 'active' | 'paused' | 'archived';

export type LeadMagnetCampaignMetrics = {
  new_followers: number;
  non_follower_at_start: number;
  total_enrollments: number;
};

export type LeadMagnetCampaignAccount = {
  id?: string;
  campaign_id?: string;
  platform: LeadMagnetPlatform;
  account_id: string;
};

export type LeadMagnetCampaignPost = {
  id?: string;
  platform: LeadMagnetPlatform;
  media_id: string;
  media_permalink?: string | null;
  media_caption?: string | null;
  media_thumbnail_url?: string | null;
};

export type LeadMagnetDeliveryMode = 'link' | 'upload';

export type LeadMagnetCampaign = {
  id: string;
  organization_id: string;
  name: string;
  /** @deprecated use lead_magnet_campaign_accounts */
  platform?: LeadMagnetPlatform | null;
  /** @deprecated use lead_magnet_campaign_accounts */
  account_id?: string | null;
  keyword: string;
  status: LeadMagnetCampaignStatus;
  comment_reply_text: string;
  follow_gate_text: string;
  follow_button_label: string;
  framework_offer_text: string;
  framework_button_label: string;
  delivery_text: string;
  delivery_button_label: string;
  delivery_url: string;
  delivery_mode: LeadMagnetDeliveryMode;
  delivery_storage_path: string | null;
  delivery_file_name: string | null;
  delivery_file_mime: string | null;
  delivery_file_size_bytes: number | null;
  skip_follow_gate_if_follower: boolean;
  skip_material_offer: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  lead_magnet_campaign_posts?: LeadMagnetCampaignPost[];
  lead_magnet_campaign_accounts?: LeadMagnetCampaignAccount[];
  metrics?: LeadMagnetCampaignMetrics;
};

export type LeadMagnetMediaPost = {
  media_id: string;
  caption: string | null;
  permalink: string | null;
  timestamp: string | null;
  media_type: string | null;
  media_url?: string | null;
  thumbnail_url?: string | null;
};

export type LeadMagnetEnrollment = {
  id: string;
  participant_username: string | null;
  participant_scoped_id: string;
  status: string;
  created_at: string;
  last_error: string | null;
  conversation_id: string | null;
};

export type LeadMagnetCampaignForm = {
  name: string;
  accounts: LeadMagnetCampaignAccount[];
  keyword: string;
  comment_reply_text: string;
  follow_gate_text: string;
  follow_button_label: string;
  framework_offer_text: string;
  framework_button_label: string;
  delivery_text: string;
  delivery_button_label: string;
  delivery_url: string;
  delivery_mode: LeadMagnetDeliveryMode;
  delivery_storage_path: string | null;
  delivery_file_name: string | null;
  delivery_file_mime: string | null;
  delivery_file_size_bytes: number | null;
  skip_follow_gate_if_follower: boolean;
  skip_material_offer: boolean;
  posts: LeadMagnetCampaignPost[];
};

export const DEFAULT_LEAD_MAGNET_FORM: LeadMagnetCampaignForm = {
  name: '',
  accounts: [],
  keyword: '',
  comment_reply_text:
    '✅ Sudah kami balas! Cek DM ya 📩',
  follow_gate_text:
    'Hai {{username}}! Makasih sudah komen 😊\n\nFollow dulu supaya materi masuk inbox, bukan tab Permintaan.\n\nSudah follow? Klik tombol di bawah 👇',
  follow_button_label: 'Sudah Follow',
  framework_offer_text:
    'Hai {{username}}! Klik tombol di bawah untuk download materinya 👇',
  framework_button_label: 'Ambil Materi',
  delivery_text: 'Hai {{username}}, ini materinya. Semoga bermanfaat! 🙏',
  delivery_button_label: 'Unduh',
  delivery_url: '',
  delivery_mode: 'link',
  delivery_storage_path: null,
  delivery_file_name: null,
  delivery_file_mime: null,
  delivery_file_size_bytes: null,
  skip_follow_gate_if_follower: false,
  skip_material_offer: false,
  posts: [],
};

export function getCampaignAccounts(campaign: LeadMagnetCampaign): LeadMagnetCampaignAccount[] {
  if (campaign.lead_magnet_campaign_accounts?.length) {
    return campaign.lead_magnet_campaign_accounts;
  }
  if (campaign.platform && campaign.account_id) {
    return [{ platform: campaign.platform, account_id: campaign.account_id }];
  }
  return [];
}

export function getAccountForPlatform(
  accounts: LeadMagnetCampaignAccount[],
  platform: LeadMagnetPlatform,
): string {
  return accounts.find((a) => a.platform === platform)?.account_id ?? '';
}

export function isPlatformEnabled(
  accounts: LeadMagnetCampaignAccount[],
  platform: LeadMagnetPlatform,
): boolean {
  return accounts.some((a) => a.platform === platform);
}

export function formatCampaignPlatformsLabel(accounts: LeadMagnetCampaignAccount[]): string {
  const hasIg = accounts.some((a) => a.platform === 'instagram');
  const hasFb = accounts.some((a) => a.platform === 'facebook');
  if (hasIg && hasFb) return 'IG + FB';
  if (hasIg) return 'Instagram';
  if (hasFb) return 'Facebook';
  return '—';
}

export function countPostsForPlatform(posts: LeadMagnetCampaignPost[], platform: LeadMagnetPlatform): number {
  return posts.filter((p) => p.platform === platform).length;
}
