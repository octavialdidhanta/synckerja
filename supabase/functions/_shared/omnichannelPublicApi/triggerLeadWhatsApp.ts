import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveLeadWhatsAppBodyParams } from "./leadWhatsAppBodyParams.ts";
import {
  buildWhatsAppPrecheckSkipReason,
  buildWhatsAppSkipReasonMeta,
  fetchLeadTemplateBodySlotCount,
} from "./leadWhatsAppTemplateSlots.ts";
import {
  resolveOrganizationWhatsAppCredentials,
  WA_ACCOUNT_NOT_MAPPED_CODE,
  WA_ACCOUNT_NOT_MAPPED_ERROR,
} from "./resolveOrganizationWhatsAppCredentials.ts";

const META_API_BASE = "https://graph.facebook.com/v21.0";

export type LeadWhatsAppDebugInfo = {
  template_name: string;
  template_language: string;
  mapping_source: "parameter_mapping" | "organization_whatsapp_templates" | "fixed_7";
  param_count: number;
  expected_slot_count: number | null;
  web_id: string;
  whatsapp_account_id?: string | null;
  phone_number_id?: string | null;
  account_resolution?: "mapped" | "not_mapped";
};

export type LeadWhatsAppResult = {
  status: "sent" | "failed" | "skipped" | "pending";
  messageId: string | null;
  skipReason?: string | null;
  error?: string;
  metaErrorCode?: number | null;
  mappingSource?: LeadWhatsAppDebugInfo["mapping_source"];
  paramCount?: number;
  bodyParams?: string[];
  rawMetadata?: Record<string, unknown> | null;
  templateLanguage?: string;
  expectedSlotCount?: number | null;
  debug?: LeadWhatsAppDebugInfo;
};

export { parseLeadConsent } from "./leadWhatsAppBodyParams.ts";

function buildDebugBase(args: {
  templateName: string;
  templateLanguage: string;
  mappingSource: LeadWhatsAppDebugInfo["mapping_source"];
  paramCount: number;
  expectedSlotCount: number | null;
  webId: string;
  whatsappAccountId?: string | null;
  phoneNumberId?: string | null;
  accountResolution?: LeadWhatsAppDebugInfo["account_resolution"];
}): LeadWhatsAppDebugInfo {
  return {
    template_name: args.templateName,
    template_language: args.templateLanguage,
    mapping_source: args.mappingSource,
    param_count: args.paramCount,
    expected_slot_count: args.expectedSlotCount,
    web_id: args.webId,
    whatsapp_account_id: args.whatsappAccountId ?? null,
    phone_number_id: args.phoneNumberId ?? null,
    account_resolution: args.accountResolution,
  };
}

/** Kirim template WhatsApp konfirmasi lead (body params dari organization_whatsapp_templates atau fixed 7). */
export async function triggerLeadWhatsApp(
  admin: SupabaseClient,
  args: {
    organizationId: string;
    webId: string;
    templateName: string;
    orgTemplateLanguage?: string | null;
    phoneNumber: string;
    name: string;
    email: string | null;
    formData: Record<string, unknown> | null;
  },
): Promise<LeadWhatsAppResult> {
  try {
    const creds = await resolveOrganizationWhatsAppCredentials(admin, args.organizationId, {
      webId: args.webId,
    });
    if (!creds.ok) {
      const isNotMapped =
        creds.code === WA_ACCOUNT_NOT_MAPPED_CODE ||
        creds.error === WA_ACCOUNT_NOT_MAPPED_ERROR;
      return {
        status: "skipped",
        messageId: null,
        skipReason: isNotMapped ? WA_ACCOUNT_NOT_MAPPED_ERROR : "wa_not_configured",
        error: creds.error,
        debug: buildDebugBase({
          templateName: args.templateName,
          templateLanguage: String(args.orgTemplateLanguage ?? "id").trim() || "id",
          mappingSource: "fixed_7",
          paramCount: 0,
          expectedSlotCount: null,
          webId: args.webId,
          accountResolution: "not_mapped",
        }),
      };
    }

    const toDigits = args.phoneNumber.replace(/\D/g, "");
    if (!toDigits) {
      return {
        status: "skipped",
        messageId: null,
        skipReason: "no_phone",
        error: "Nomor telepon tidak valid.",
      };
    }

    const resolved = await resolveLeadWhatsAppBodyParams(admin, args);

    const debugBase = buildDebugBase({
      templateName: args.templateName,
      templateLanguage: resolved.language,
      mappingSource: resolved.mappingSource,
      paramCount: resolved.params.length,
      expectedSlotCount: null,
      webId: args.webId,
      whatsappAccountId: creds.credentials.whatsappAccountId,
      phoneNumberId: creds.credentials.phoneNumberId,
      accountResolution: "mapped",
    });

    const slotCheck = await fetchLeadTemplateBodySlotCount(
      admin,
      args.organizationId,
      args.templateName,
      resolved.language,
      args.webId,
    );

    if (slotCheck.ok) {
      debugBase.expected_slot_count = slotCheck.slotCount;
      if (resolved.params.length !== slotCheck.slotCount) {
        const skipReason = buildWhatsAppPrecheckSkipReason({
          templateName: args.templateName,
          templateLanguage: resolved.language,
          mappingSource: resolved.mappingSource,
          paramCount: resolved.params.length,
          expectedSlotCount: slotCheck.slotCount,
          webId: args.webId,
        });
        console.error("triggerLeadWhatsApp precheck:", {
          organizationId: args.organizationId,
          webId: args.webId,
          templateName: args.templateName,
          mappingSource: resolved.mappingSource,
          paramCount: resolved.params.length,
          expectedSlotCount: slotCheck.slotCount,
        });
        return {
          status: "failed",
          messageId: null,
          skipReason,
          error: `Jumlah variabel body (${resolved.params.length}) tidak cocok dengan template Meta (${slotCheck.slotCount}).`,
          mappingSource: resolved.mappingSource,
          paramCount: resolved.params.length,
          expectedSlotCount: slotCheck.slotCount,
          templateLanguage: resolved.language,
          debug: debugBase,
        };
      }
    }

    const payload = {
      messaging_product: "whatsapp",
      to: toDigits,
      type: "template",
      template: {
        name: args.templateName,
        language: { code: resolved.language },
        components: [
          {
            type: "body",
            parameters: resolved.params.map((text) => ({ type: "text", text })),
          },
        ],
      },
    };

    const url = `${META_API_BASE}/${creds.credentials.phoneNumberId}/messages`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${creds.credentials.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const metaErr = json.error as { message?: string; code?: number } | undefined;

    if (!res.ok) {
      const errMsg = metaErr?.message ?? `Graph API error ${res.status}`;
      const metaMessage =
        errMsg.startsWith("(#") || metaErr?.code == null
          ? errMsg
          : `(#${metaErr.code}) ${errMsg}`;
      const skipReason = buildWhatsAppSkipReasonMeta({
        metaMessage,
        templateName: args.templateName,
        templateLanguage: resolved.language,
        mappingSource: resolved.mappingSource,
        paramCount: resolved.params.length,
        webId: args.webId,
        expectedSlotCount: debugBase.expected_slot_count,
      });
      console.error("triggerLeadWhatsApp:", {
        organizationId: args.organizationId,
        webId: args.webId,
        templateName: args.templateName,
        mappingSource: resolved.mappingSource,
        paramCount: resolved.params.length,
        expectedSlotCount: debugBase.expected_slot_count,
        params: resolved.params,
        metaError: json,
      });
      return {
        status: "failed",
        messageId: null,
        skipReason,
        error: errMsg,
        metaErrorCode: metaErr?.code ?? null,
        mappingSource: resolved.mappingSource,
        paramCount: resolved.params.length,
        expectedSlotCount: debugBase.expected_slot_count,
        templateLanguage: resolved.language,
        debug: debugBase,
      };
    }

    const messages = json.messages as Array<{ id?: string }> | undefined;
    const messageId = messages?.[0]?.id ?? null;
    return {
      status: "sent",
      messageId: messageId ? String(messageId) : null,
      mappingSource: resolved.mappingSource,
      paramCount: resolved.params.length,
      bodyParams: resolved.params,
      rawMetadata: json,
      templateLanguage: resolved.language,
      expectedSlotCount: debugBase.expected_slot_count,
    };
  } catch (e) {
    console.error("triggerLeadWhatsApp:", e);
    return {
      status: "failed",
      messageId: null,
      skipReason: `meta:${e instanceof Error ? e.message : "Unknown error"}`.slice(0, 500),
      error: e instanceof Error ? e.message : "Unknown error",
    };
  }
}
