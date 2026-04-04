export interface WhatsAppConfig {
  id: string;
  organization_id: string;
  meta_access_token: string;
  meta_business_manager_id: string | null;
  whatsapp_business_account_id: string;
  verify_token: string;
  phone_number_id: string | null;
  display_phone_number: string | null;
  whatsapp_business_name: string | null;
  name_status: string | null; // Meta display name verification: APPROVED | DECLINED
  instagram_business_account_id: string | null;
  instagram_verify_token: string | null;
  instagram_username: string | null;
  instagram_name: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Instagram Business Account from Meta Graph API (linked to a Facebook Page). */
export interface InstagramBusinessAccount {
  id: string;
  username: string | null;
  name: string | null;
  /** Facebook Page ID linked to this Instagram account; used for Send API (avoids "me" with User token). */
  page_id?: string | null;
}

export interface WhatsAppConfigUpsert {
  organization_id: string;
  whatsapp_business_account_id: string;
  meta_access_token: string;
  meta_business_manager_id?: string | null;
  verify_token: string;
  phone_number_id?: string | null;
  display_phone_number?: string | null;
  whatsapp_business_name?: string | null;
}

/** Single WhatsApp Business API account (multi-account: max 5 per org). DB: organization_whatsapp_accounts.phone_number_id is NOT NULL. */
export interface WhatsAppAccount {
  id: string;
  organization_id: string;
  whatsapp_business_account_id: string;
  /** Required; column is NOT NULL in organization_whatsapp_accounts. */
  phone_number_id: string;
  meta_access_token: string | null;
  display_phone_number: string | null;
  whatsapp_business_name: string | null;
  name_status: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WhatsAppAccountUpsert {
  whatsapp_business_account_id: string;
  phone_number_id: string;
  /** Optional: use shared org token when empty. */
  meta_access_token?: string | null;
  display_phone_number?: string | null;
  whatsapp_business_name?: string | null;
}

export interface WhatsAppConversation {
  id: string;
  organization_id: string;
  customer_wa_id: string;
  customer_name: string | null;
  last_message_at: string | null;
  last_message_body: string | null;
  /** Arah pesan terakhir: inbound / outbound (untuk tampilkan checklist di list). */
  last_message_direction?: string | null;
  /** Status pesan terakhir: sent / delivered / read (untuk checklist di list). */
  last_message_status?: string | null;
  /** Lead status (Open/Unread, On going, Resolve) untuk blokir outbound saat Resolve. */
  lead_status_id?: string | null;
  lead_status_name?: string | null;
  /** Channel sumber: 'whatsapp' | 'instagram'. Untuk live chat unified inbox. */
  channel?: string | null;
  /** WhatsApp Phone Number ID for channel=whatsapp; for multi-account indicator. */
  phone_number_id?: string | null;
  /** Display name of the WhatsApp account (for inbox indicator). */
  whatsapp_account_display_name?: string | null;
  created_at: string;
  updated_at: string;
}

export type WhatsAppMessageStatus = 'sent' | 'delivered' | 'read';

export interface WhatsAppMessage {
  id: string;
  conversation_id: string;
  direction: 'inbound' | 'outbound';
  wa_message_id: string | null;
  body: string | null;
  message_type: string;
  raw_metadata: unknown;
  created_at: string;
  status: WhatsAppMessageStatus | null;
  status_updated_at: string | null;
  read_at: string | null;
  /** Public URL for image/video/document preview (outbound: our storage; inbound: our storage after download from Meta). */
  media_url?: string | null;
  /** Pesan yang dibalas: wa_message_id dan body untuk ditampilkan di bubble. */
  reply_to_wa_message_id?: string | null;
  reply_to_body?: string | null;
  /** Tipe pesan yang dibalas (text, image, video, document, audio) untuk tampilan ikon + caption. */
  reply_to_message_type?: string | null;
  /** Nama pengirim pesan yang dibalas (untuk tampilan reply seperti WhatsApp). */
  reply_to_sender?: string | null;
}

// --- Email Connect (organization_email_connections, email_conversations, email_messages) ---

export interface EmailConnection {
  id: string;
  organization_id: string;
  email_address: string;
  inbound_address: string;
  provider: string | null;
  status: 'pending_verification' | 'verified';
  confirmation_code: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmailConnectionInsert {
  organization_id: string;
  email_address: string;
  inbound_address: string;
  provider?: string | null;
  status?: 'pending_verification' | 'verified';
}

export interface EmailConversation {
  id: string;
  organization_id: string;
  email_connection_id: string;
  from_email: string | null;
  /** Sender display name from From header (e.g. "Octa Vialdi"). Shown in list/thread instead of email when set. */
  from_display_name?: string | null;
  /** Thread subject (email subject). Shown in list when body preview is empty. */
  thread_subject?: string | null;
  last_message_at: string | null;
  last_message_body: string | null;
  last_message_direction: string | null;
  email_connection_display: string | null;
  created_at: string;
  updated_at: string;
  /** From DB after migration; used by Quick Action and Leads Management */
  lead_status_id?: string | null;
  followup?: number;
  fu_priority?: string | null;
}

export interface EmailMessage {
  id: string;
  conversation_id: string;
  direction: 'inbound' | 'outbound';
  from_email: string | null;
  /** Sender display name from From header. Shown in thread instead of email when set. */
  from_display_name?: string | null;
  to_email: string | null;
  subject: string | null;
  body: string | null;
  confirmation_code: string | null;
  /** CC recipients (outbound; comma-separated if multiple). */
  cc?: string | null;
  /** BCC recipients (outbound; comma-separated if multiple). */
  bcc?: string | null;
  created_at: string;
}

// --- Instagram DM (instagram_conversations, instagram_messages) ---

export interface InstagramConversation {
  id: string;
  organization_id: string;
  customer_ig_id: string;
  customer_name: string | null;
  last_message_at: string | null;
  last_message_body: string | null;
  last_message_direction: string | null;
  last_message_status: string | null;
  lead_status_id: string | null;
  lead_status_name: string | null;
  instagram_business_account_id: string;
  instagram_account_display_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface InstagramMessage {
  id: string;
  conversation_id: string;
  direction: 'inbound' | 'outbound';
  platform_message_id: string | null;
  body: string | null;
  message_type: string;
  media_url: string | null;
  raw_metadata: unknown;
  status: string | null;
  status_updated_at: string | null;
  reply_to_platform_message_id: string | null;
  reply_to_body: string | null;
  reply_to_message_type: string | null;
  created_at: string;
}

/** Unified conversation for Live Chat list (WhatsApp/Instagram or Email). */
export type LiveChatConversation =
  | (WhatsAppConversation & { source: 'whatsapp' })
  | (InstagramConversation & { source: 'instagram' })
  | (EmailConversation & { source: 'email' });
