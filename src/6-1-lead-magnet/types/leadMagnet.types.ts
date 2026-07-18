import type { CommentReplyTextsTuple } from '../lib/commentReplyVariants';

export type LeadMagnetPlatform = 'instagram' | 'facebook';

export type LeadMagnetCampaignStatus = 'draft' | 'active' | 'paused' | 'archived';

export type LeadMagnetCampaignMetrics = {
  new_followers: number;
  new_emails: number;
  new_phones: number;
  non_follower_at_start: number;
  total_enrollments: number;
};

export type LeadMagnetCampaignMetricTotals = {
  new_followers: number;
  new_emails: number;
  new_phones: number;
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
  /** Free-text target market label; required at publish. */
  target_market: string;
  /** @deprecated use lead_magnet_campaign_accounts */
  platform?: LeadMagnetPlatform | null;
  /** @deprecated use lead_magnet_campaign_accounts */
  account_id?: string | null;
  keyword: string;
  status: LeadMagnetCampaignStatus;
  comment_reply_enabled: boolean;
  comment_reply_texts: CommentReplyTextsTuple;
  comment_reply_text: string;
  follow_gate_text: string;
  follow_button_label: string;
  framework_offer_text: string;
  framework_button_label: string;
  delivery_text: string;
  delivery_button_label: string;
  delivery_fallback_text: string;
  delivery_url: string;
  delivery_links: Array<{ label: string; url: string }>;
  delivery_mode: LeadMagnetDeliveryMode;
  delivery_storage_path: string | null;
  delivery_file_name: string | null;
  delivery_file_mime: string | null;
  delivery_file_size_bytes: number | null;
  skip_follow_gate_if_follower: boolean;
  skip_material_offer: boolean;
  contact_gate_enabled: boolean;
  email_collection_enabled: boolean;
  contact_prompt_text: string;
  contact_invalid_text: string;
  contact_ack_text: string;
  whatsapp_account_id: string | null;
  whatsapp_template_name: string | null;
  whatsapp_template_language: string | null;
  whatsapp_template_params: Record<string, unknown>;
  email_subject: string;
  email_html_body: string;
  email_from_name: string | null;
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
  target_market: string;
  accounts: LeadMagnetCampaignAccount[];
  keyword: string;
  comment_reply_enabled: boolean;
  comment_reply_texts: CommentReplyTextsTuple;
  comment_reply_text: string;
  follow_gate_text: string;
  follow_button_label: string;
  framework_offer_text: string;
  framework_button_label: string;
  delivery_text: string;
  delivery_button_label: string;
  delivery_fallback_text: string;
  delivery_url: string;
  delivery_links: Array<{ label: string; url: string }>;
  delivery_mode: LeadMagnetDeliveryMode;
  delivery_storage_path: string | null;
  delivery_file_name: string | null;
  delivery_file_mime: string | null;
  delivery_file_size_bytes: number | null;
  skip_follow_gate_if_follower: boolean;
  skip_material_offer: boolean;
  contact_gate_enabled: boolean;
  email_collection_enabled: boolean;
  contact_prompt_text: string;
  contact_invalid_text: string;
  contact_ack_text: string;
  whatsapp_account_id: string | null;
  whatsapp_template_name: string | null;
  whatsapp_template_language: string | null;
  whatsapp_template_params: Record<string, unknown>;
  email_subject: string;
  email_html_body: string;
  email_from_name: string | null;
  posts: LeadMagnetCampaignPost[];
};

export const DEFAULT_LEAD_MAGNET_FORM: LeadMagnetCampaignForm = {
  name: '',
  target_market: '',
  accounts: [],
  keyword: '',
  comment_reply_enabled: true,
  comment_reply_texts: [
    '✅ Sudah kami balas! Cek DM ya 📩',
    'Hai! Materinya sudah dikirim ke DM kamu 📩',
    'Selesai! Silakan cek pesan masuk ya 👇',
  ],
  comment_reply_text: '✅ Sudah kami balas! Cek DM ya 📩',
  follow_gate_text:
    'Hai {{username}}! Makasih sudah tertarik 💕\n\nMateri ini khusus buat yang udah follow ya — follow dulu, nanti langsung kami kirim!',
  follow_button_label: 'Sudah Follow',
  framework_offer_text:
    'Hai {{username}}! Makasih sudah tertarik 😊\n\nKlik tombol di bawah, link-nya kami kirim sebentar lagi!',
  framework_button_label: 'Kirimkan saya link-nya 😊',
  delivery_text: 'Hai {{username}}! Klik tombol di bawah ya 👇',
  delivery_button_label: 'Kirim link-nya 😊',
  delivery_fallback_text:
    'Hai {{username}}, WhatsApp kami belum bisa mengirim materi. Unduh langsung di sini ya:',
  delivery_url: '',
  delivery_links: [],
  delivery_mode: 'link',
  delivery_storage_path: null,
  delivery_file_name: null,
  delivery_file_mime: null,
  delivery_file_size_bytes: null,
  skip_follow_gate_if_follower: false,
  skip_material_offer: false,
  contact_gate_enabled: false,
  email_collection_enabled: false,
  contact_prompt_text: 'Hai {{username}}! Kirim email kamu ya supaya bisa dapat link-nya 📩',
  contact_invalid_text:
    'Format email belum valid 😅 Kirim email aktif ya (contoh: nama@email.com).',
  contact_ack_text: '',
  whatsapp_account_id: null,
  whatsapp_template_name: null,
  whatsapp_template_language: null,
  whatsapp_template_params: {},
  email_subject: 'Materi {{campaign_name}}',
  email_html_body:
    '<p>Hai {{username}},</p>\n<p>Terima kasih! Berikut link materi {{campaign_name}}:</p>\n<p><a href="{{delivery_url}}">{{delivery_url}}</a></p>',
  email_from_name: null,
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
