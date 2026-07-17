import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { persistLeadWhatsAppThread } from "../../omnichannelPublicApi/persistLeadWhatsAppThread.ts";
import { postTemplateMessage, renderTemplateBodyPreview } from "../../waTemplateGraph.ts";
import { buildDeliveryContext } from "./buildDeliveryContext.ts";
import {
  buildLeadMagnetWhatsAppComponents,
  getInterpolatedLeadMagnetTemplateValues,
} from "./buildLeadMagnetWhatsAppComponents.ts";
import type { LeadMagnetCampaignRow, LeadMagnetEnrollmentRow } from "../types.ts";

type WhatsAppCredentials = {
  whatsappAccountId: string;
  phoneNumberId: string;
  accessToken: string;
};

async function resolveWhatsAppCredentials(
  admin: SupabaseClient,
  organizationId: string,
  whatsappAccountId: string,
): Promise<WhatsAppCredentials | null> {
  const { data: waAccount } = await admin
    .from("organization_whatsapp_accounts")
    .select("id, phone_number_id, meta_access_token, is_active")
    .eq("id", whatsappAccountId)
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .maybeSingle();

  if (!waAccount?.phone_number_id) return null;

  let accessToken = String(waAccount.meta_access_token ?? "").trim();
  if (!accessToken) {
    const { data: orgMeta } = await admin
      .from("organization_meta_config")
      .select("meta_access_token")
      .eq("organization_id", organizationId)
      .maybeSingle();
    accessToken = String(orgMeta?.meta_access_token ?? "").trim();
  }
  if (!accessToken) return null;

  return {
    whatsappAccountId: String(waAccount.id),
    phoneNumberId: String(waAccount.phone_number_id),
    accessToken,
  };
}

export type DeliverViaWhatsAppTemplateResult =
  | {
      ok: true;
      waMessageId: string;
      conversationId?: string;
      persistError?: string;
      bodyParams: string[];
      rawMetadata: Record<string, unknown>;
    }
  | { ok: false; error: string };

export async function deliverViaWhatsAppTemplate(
  admin: SupabaseClient,
  args: {
    enrollment: LeadMagnetEnrollmentRow;
    campaign: LeadMagnetCampaignRow;
    phoneDigits: string;
  },
): Promise<DeliverViaWhatsAppTemplateResult> {
  const accountId = args.campaign.whatsapp_account_id?.trim();
  const templateName = args.campaign.whatsapp_template_name?.trim();
  const templateLanguage = args.campaign.whatsapp_template_language?.trim() || "id";

  if (!accountId || !templateName) {
    return { ok: false, error: "WhatsApp template not configured on campaign" };
  }

  const creds = await resolveWhatsAppCredentials(admin, args.enrollment.organization_id, accountId);
  if (!creds) {
    return { ok: false, error: "WhatsApp account credentials not found" };
  }

  const ctx = await buildDeliveryContext(admin, {
    enrollment: args.enrollment,
    campaign: args.campaign,
  });
  const params = (args.campaign.whatsapp_template_params ?? {}) as Record<string, unknown>;
  const built = buildLeadMagnetWhatsAppComponents(params, ctx);
  if (!built.ok) {
    return { ok: false, error: built.error };
  }

  const bodyParams = getInterpolatedLeadMagnetTemplateValues(params, ctx) ?? [];
  const componentsJson = Array.isArray(params.components_json) ? params.components_json : [];
  const bodyPreview = componentsJson.length > 0
    ? renderTemplateBodyPreview(templateName, componentsJson, bodyParams)
    : `[Template: ${templateName}]`;

  const result = await postTemplateMessage(
    creds.phoneNumberId,
    creds.accessToken,
    args.phoneDigits,
    templateName,
    templateLanguage,
    built.components,
  );

  if (!result.ok) {
    return { ok: false, error: result.body ?? `WA send failed (${result.status})` };
  }

  let conversationId: string | undefined;
  let persistError: string | undefined;

  if (args.enrollment.lead_id) {
    const persisted = await persistLeadWhatsAppThread(admin, {
      organizationId: args.enrollment.organization_id,
      leadId: args.enrollment.lead_id,
      webId: "lead_magnet",
      phoneNumber: args.phoneDigits,
      customerName: args.enrollment.participant_username ?? "Lead",
      waMessageId: result.wa_message_id,
      templateName,
      templateLanguage,
      bodyPreview,
      bodyParams,
      rawMetadata: result.metaData,
      whatsappAccountId: creds.whatsappAccountId,
      phoneNumberId: creds.phoneNumberId,
      leadMagnetMeta: {
        enrollmentId: args.enrollment.id,
        campaignId: args.campaign.id,
      },
    });
    if (persisted.ok) {
      conversationId = persisted.conversationId;
    } else {
      persistError = persisted.error;
      console.error("[lead-magnet] persistLeadWhatsAppThread failed:", persisted.error);
    }
  } else {
    persistError = "Enrollment has no lead_id — livechat thread not created";
    console.warn("[lead-magnet] WA sent without lead_id on enrollment", args.enrollment.id);
  }

  return {
    ok: true,
    waMessageId: result.wa_message_id,
    conversationId,
    persistError,
    bodyParams,
    rawMetadata: result.metaData,
  };
}
