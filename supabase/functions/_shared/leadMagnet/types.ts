export type LeadMagnetPlatform = "instagram" | "facebook";

export type LeadMagnetCampaignStatus = "draft" | "active" | "paused" | "archived";

export type LeadMagnetEnrollmentStatus =
  | "comment_matched"
  | "comment_replied"
  | "follow_checked"
  | "follow_gate_sent"
  | "follow_validated"
  | "framework_offered"
  | "material_offer_skipped"
  | "awaiting_contact"
  | "contact_collected"
  | "delivered"
  | "delivered_whatsapp"
  | "delivered_email"
  | "delivered_instagram"
  | "failed"
  | "paused";

export type LeadMagnetFunnelEventType =
  | "comment_matched"
  | "comment_replied"
  | "comment_reply_sent"
  | "private_reply_sent"
  | "private_reply_failed"
  | "follow_checked"
  | "follow_gate_sent"
  | "follow_retry"
  | "follow_validated"
  | "framework_offered"
  | "material_offer_skipped"
  | "contact_prompt_sent"
  | "contact_collected"
  | "contact_invalid"
  | "contact_window_expired"
  | "delivery_whatsapp_sent"
  | "delivery_whatsapp_failed"
  | "delivery_email_sent"
  | "delivery_email_failed"
  | "delivery_instagram_sent"
  | "delivered"
  | "dm_failed"
  | "follow_check_failed"
  | "follow_rechecked_after_opener"
  | "follow_gate_skipped_follower";

export type LeadMagnetFirstDmMethod = "private_reply_button" | "private_reply_text" | "standard";

export type LeadMagnetCampaignRow = {
  id: string;
  organization_id: string;
  name: string;
  target_market: string;
  platform: LeadMagnetPlatform;
  account_id: string;
  keyword: string;
  status: LeadMagnetCampaignStatus;
  comment_reply_text: string;
  follow_gate_text: string;
  follow_button_label: string;
  framework_offer_text: string;
  framework_button_label: string;
  delivery_text: string;
  delivery_button_label: string;
  delivery_fallback_text: string | null;
  delivery_url: string;
  skip_follow_gate_if_follower: boolean;
  skip_material_offer: boolean;
  contact_gate_enabled: boolean;
  contact_prompt_text: string | null;
  contact_invalid_text: string | null;
  contact_ack_text: string | null;
  whatsapp_account_id: string | null;
  whatsapp_template_name: string | null;
  whatsapp_template_language: string | null;
  whatsapp_template_params: Record<string, unknown>;
  email_subject: string | null;
  email_html_body: string | null;
  email_from_name: string | null;
  delivery_storage_path?: string | null;
};

export type LeadMagnetEnrollmentRow = {
  id: string;
  organization_id: string;
  campaign_id: string;
  platform: LeadMagnetPlatform;
  participant_scoped_id: string;
  participant_username: string | null;
  comment_id: string | null;
  media_id: string | null;
  conversation_id: string | null;
  conversation_table: string | null;
  lead_submission_id: string | null;
  lead_id: string | null;
  status: LeadMagnetEnrollmentStatus;
  paused_reason: string | null;
  is_follower_at_start: boolean | null;
  became_follower_at: string | null;
  last_error: string | null;
  private_reply_sent_at?: string | null;
  private_reply_message_id?: string | null;
  comment_reply_id?: string | null;
  first_dm_method?: LeadMagnetFirstDmMethod | null;
  follow_confirm_attempts?: number;
};

export type FollowConfirmResult =
  | { outcome: "already_processed" }
  | { outcome: "blocked"; reason: "fb_first_confirm" | "ig_first_confirm" | "ig_not_following" }
  | { outcome: "material_sent" }
  | { outcome: "dm_failed" };

export type LeadMagnetPostbackHandleResult = {
  handled: boolean;
  followConfirm?: FollowConfirmResult;
};

export type LeadMagnetCommentTriggerInput = {
  trigger: "comment";
  platform: LeadMagnetPlatform;
  organizationId: string;
  accountId: string;
  mediaId: string;
  commentId: string;
  authorScopedId: string;
  authorUsername: string | null;
  commentText: string;
  accessToken: string;
  pageId: string;
};

export type LeadMagnetPostbackTriggerInput = {
  trigger: "postback";
  platform: LeadMagnetPlatform;
  organizationId: string;
  accountId: string;
  participantScopedId: string;
  participantUsername: string | null;
  payload: string;
  conversationId?: string | null;
  accessToken: string;
  pageId: string;
};

export type LeadMagnetInboundMessageTriggerInput = {
  trigger: "inbound_message";
  platform: LeadMagnetPlatform;
  organizationId: string;
  accountId: string;
  participantScopedId: string;
  participantUsername: string | null;
  messageBody: string;
  conversationId?: string | null;
  accessToken: string;
  pageId: string;
};

export type LeadMagnetRuntimeInput =
  | LeadMagnetCommentTriggerInput
  | LeadMagnetPostbackTriggerInput
  | LeadMagnetInboundMessageTriggerInput;

export const LEAD_MAGNET_PAYLOAD_PREFIX = "lm:";

export function buildLeadMagnetPostbackPayload(enrollmentId: string, action: "follow_confirm" | "get_framework"): string {
  return `${LEAD_MAGNET_PAYLOAD_PREFIX}${enrollmentId}:${action}`;
}

export function parseLeadMagnetPostbackPayload(payload: string): { enrollmentId: string; action: "follow_confirm" | "get_framework" } | null {
  const trimmed = payload.trim();
  if (!trimmed.startsWith(LEAD_MAGNET_PAYLOAD_PREFIX)) return null;
  const rest = trimmed.slice(LEAD_MAGNET_PAYLOAD_PREFIX.length);
  const colon = rest.indexOf(":");
  if (colon <= 0) return null;
  const enrollmentId = rest.slice(0, colon).trim();
  const action = rest.slice(colon + 1).trim();
  if (!enrollmentId) return null;
  if (action !== "follow_confirm" && action !== "get_framework") return null;
  return { enrollmentId, action };
}

export function interpolateLeadMagnetText(template: string, username: string | null): string {
  const handle = (username ?? "").trim().replace(/^@/, "") || "Kak";
  return template.replace(/\{\{username\}\}/gi, handle);
}

export function commentMatchesKeyword(commentText: string, keyword: string): boolean {
  const text = commentText.trim().toLowerCase();
  const kw = keyword.trim().toLowerCase();
  if (!text || !kw) return false;
  return text.includes(kw);
}

export const LEAD_MAGNET_DEFAULT_MESSAGES = {
  comment_reply_text: "✅ Sudah kami balas! Cek DM ya 📩",
  follow_gate_text:
    "Hai {{username}}! Makasih sudah komen 😊\n\nFollow dulu supaya materi masuk inbox, bukan tab Permintaan.\n\nSudah follow? Klik tombol di bawah 👇",
  follow_button_label: "Sudah Follow",
  framework_offer_text:
    "Hai {{username}}! Klik tombol di bawah untuk download materinya 👇",
  framework_button_label: "Ambil Materi",
  delivery_text: "Hai {{username}}, ini materinya. Semoga bermanfaat! 🙏",
  delivery_button_label: "Unduh",
  delivery_fallback_text:
    "Hai {{username}}, WhatsApp kami belum bisa mengirim materi. Unduh langsung di sini ya:",
  contact_prompt_text:
    "Hai {{username}},\n\nTerima kasih atas minat Anda pada materi kami.\n\nUntuk mengirimkan file, silakan balas chat ini dengan:\n• Nomor WhatsApp aktif (contoh: 08123456789) — materi dikirim via WhatsApp, atau\n• Alamat email aktif (contoh: nama@perusahaan.com) — materi dikirim ke email Anda.\n\nKami hanya menggunakan kontak ini untuk pengiriman materi yang Anda minta.",
  contact_invalid_text:
    "Mohon maaf, format nomor atau email belum dapat kami baca.\n\nSilakan kirim nomor WhatsApp (contoh: 08123456789) atau email (contoh: nama@perusahaan.com).",
  contact_ack_text: "Terima kasih {{username}}! Materi sedang kami kirim ke kontak kamu ✅",
} as const;
