import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { MissingContactField } from "./skipMatrix.ts";
import { sendLeadMagnetDm } from "../sendLeadMagnetMessage.ts";
import { logLeadMagnetFunnelEvent, updateEnrollmentStatus } from "../funnelAnalytics.ts";
import type { LeadMagnetCampaignRow, LeadMagnetEnrollmentRow } from "../types.ts";
import { LEAD_MAGNET_DEFAULT_MESSAGES } from "../types.ts";

export const DEFAULT_CONTACT_PROMPT_BOTH =
  "Hai {{username}},\n\nTerima kasih atas minat Anda pada materi kami.\n\nUntuk mengirimkan file, silakan balas chat ini dengan:\n• Nomor WhatsApp aktif (contoh: 08123456789) — materi dikirim via WhatsApp, atau\n• Alamat email aktif (contoh: nama@perusahaan.com) — materi dikirim ke email Anda.\n\nKami hanya menggunakan kontak ini untuk pengiriman materi yang Anda minta.";

export const DEFAULT_CONTACT_PROMPT_PHONE =
  "Hai {{username}},\n\nAgar kami dapat mengirim materi langsung ke WhatsApp Anda, silakan balas chat ini dengan nomor WhatsApp aktif (contoh: 08123456789).\n\nMateri akan kami kirim melalui WhatsApp setelah nomor kami terima.";

export const DEFAULT_CONTACT_PROMPT_EMAIL =
  "Hai {{username}},\n\nAgar kami dapat mengirim materi ke email Anda, silakan balas chat ini dengan alamat email aktif (contoh: nama@perusahaan.com).\n\nMateri akan kami kirim ke inbox email setelah alamat kami terima.";

export const DEFAULT_CONTACT_INVALID =
  "Mohon maaf, format nomor atau email belum dapat kami baca.\n\nSilakan kirim nomor WhatsApp (contoh: 08123456789) atau email (contoh: nama@perusahaan.com).";

function needsFirstContactDm(enrollment: LeadMagnetEnrollmentRow): boolean {
  const commentId = enrollment.comment_id?.trim();
  if (commentId && !enrollment.private_reply_message_id) {
    return enrollment.platform === "instagram" || enrollment.platform === "facebook";
  }
  return !enrollment.conversation_id;
}

function interpolateCampaignText(template: string, username: string | null): string {
  const handle = (username ?? "").trim().replace(/^@/, "") || "Kak";
  return template.replace(/\{\{username\}\}/gi, handle);
}

const CONTACT_PROMPT_CLAIM_STATUSES = [
  "follow_validated",
  "material_offer_skipped",
  "contact_collected",
  "delivered_whatsapp",
  "delivered_email",
] as const;

const CONTACT_PROMPT_FORCE_CLAIM_STATUSES = [
  "follow_gate_sent",
  "follow_checked",
  "comment_replied",
  "comment_matched",
] as const;

async function lastContactPromptAsk(
  admin: SupabaseClient,
  enrollmentId: string,
): Promise<MissingContactField | null> {
  const { data } = await admin
    .from("lead_magnet_funnel_events")
    .select("metadata")
    .eq("enrollment_id", enrollmentId)
    .eq("event_type", "contact_prompt_sent")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const ask = (data?.metadata as { ask?: string } | null)?.ask;
  if (ask === "any" || ask === "phone" || ask === "email") return ask;
  return null;
}

export function contactPromptForMissing(
  campaign: LeadMagnetCampaignRow,
  ask: MissingContactField,
  username: string | null,
): string {
  if (ask === "phone") {
    return interpolateCampaignText(DEFAULT_CONTACT_PROMPT_PHONE, username);
  }
  if (ask === "email") {
    return interpolateCampaignText(DEFAULT_CONTACT_PROMPT_EMAIL, username);
  }
  const base = campaign.contact_prompt_text?.trim()
    || LEAD_MAGNET_DEFAULT_MESSAGES.contact_prompt_text
    || DEFAULT_CONTACT_PROMPT_BOTH;
  return interpolateCampaignText(base, username);
}

export async function sendContactPrompt(
  admin: SupabaseClient,
  args: {
    enrollment: LeadMagnetEnrollmentRow;
    campaign: LeadMagnetCampaignRow;
    accessToken: string;
    pageId: string;
    ask: MissingContactField;
  },
): Promise<boolean> {
  if (args.enrollment.status === "awaiting_contact") {
    const lastAsk = await lastContactPromptAsk(admin, args.enrollment.id);
    if (lastAsk === args.ask) return true;
  }

  const now = new Date().toISOString();
  let claimed = false;

  if (args.enrollment.status !== "awaiting_contact") {
    const { data: claimRow } = await admin
      .from("lead_magnet_enrollments")
      .update({ status: "awaiting_contact", updated_at: now })
      .eq("id", args.enrollment.id)
      .in("status", [...CONTACT_PROMPT_CLAIM_STATUSES])
      .select("id")
      .maybeSingle();

    claimed = Boolean(claimRow?.id);

    if (!claimed) {
      const forceClaim = await admin
        .from("lead_magnet_enrollments")
        .update({ status: "awaiting_contact", updated_at: now })
        .eq("id", args.enrollment.id)
        .in("status", [...CONTACT_PROMPT_FORCE_CLAIM_STATUSES])
        .select("id")
        .maybeSingle();
      claimed = Boolean(forceClaim.data?.id);
      if (!claimed) return false;
    }
  }

  const text = contactPromptForMissing(
    args.campaign,
    args.ask,
    args.enrollment.participant_username,
  );

  const sendResult = needsFirstContactDm(args.enrollment)
    ? await sendLeadMagnetDm(admin, {
      platform: args.enrollment.platform,
      organizationId: args.enrollment.organization_id,
      accountId: args.campaign.account_id,
      pageId: args.pageId,
      accessToken: args.accessToken,
      recipientScopedId: args.enrollment.participant_scoped_id,
      participantUsername: args.enrollment.participant_username,
      text,
      existingConversationId: args.enrollment.conversation_id,
      commentIdForPrivateReply: args.enrollment.comment_id?.trim() || null,
      deferPersistence: false,
    })
    : await sendLeadMagnetDm(admin, {
      platform: args.enrollment.platform,
      organizationId: args.enrollment.organization_id,
      accountId: args.campaign.account_id,
      pageId: args.pageId,
      accessToken: args.accessToken,
      recipientScopedId: args.enrollment.participant_scoped_id,
      participantUsername: args.enrollment.participant_username,
      text,
      existingConversationId: args.enrollment.conversation_id,
      deferPersistence: false,
    });

  if (!sendResult.ok) {
    await updateEnrollmentStatus(admin, args.enrollment.id, "failed", {
      last_error: sendResult.error ?? "Contact prompt DM failed",
    });
    return false;
  }

  await updateEnrollmentStatus(admin, args.enrollment.id, "awaiting_contact", {
    conversation_id: sendResult.conversationId ?? args.enrollment.conversation_id,
    conversation_table: args.enrollment.platform === "instagram"
      ? "instagram_conversations"
      : "facebook_conversations",
  });

  await logLeadMagnetFunnelEvent(admin, {
    enrollmentId: args.enrollment.id,
    campaignId: args.campaign.id,
    organizationId: args.enrollment.organization_id,
    eventType: "contact_prompt_sent",
    metadata: { ask: args.ask },
  });

  return true;
}

export async function sendContactInvalidReply(
  admin: SupabaseClient,
  args: {
    enrollment: LeadMagnetEnrollmentRow;
    campaign: LeadMagnetCampaignRow;
    accessToken: string;
    pageId: string;
  },
): Promise<void> {
  const text = interpolateCampaignText(
    args.campaign.contact_invalid_text?.trim()
      || LEAD_MAGNET_DEFAULT_MESSAGES.contact_invalid_text
      || DEFAULT_CONTACT_INVALID,
    args.enrollment.participant_username,
  );

  await sendLeadMagnetDm(admin, {
    platform: args.enrollment.platform,
    organizationId: args.enrollment.organization_id,
    accountId: args.campaign.account_id,
    pageId: args.pageId,
    accessToken: args.accessToken,
    recipientScopedId: args.enrollment.participant_scoped_id,
    participantUsername: args.enrollment.participant_username,
    text,
    existingConversationId: args.enrollment.conversation_id,
    deferPersistence: false,
  });

  await logLeadMagnetFunnelEvent(admin, {
    enrollmentId: args.enrollment.id,
    campaignId: args.campaign.id,
    organizationId: args.enrollment.organization_id,
    eventType: "contact_invalid",
  });
}
