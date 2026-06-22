import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveLeadWhatsAppBodyParams } from "./leadWhatsAppBodyParams.ts";
import { resolveOrganizationWhatsAppCredentials } from "./resolveOrganizationWhatsAppCredentials.ts";

const META_API_BASE = "https://graph.facebook.com/v21.0";

export type LeadWhatsAppResult = {
  status: "sent" | "failed" | "skipped" | "pending";
  messageId: string | null;
  skipReason?: string | null;
  error?: string;
  metaErrorCode?: number | null;
  mappingSource?: "parameter_mapping" | "organization_whatsapp_templates" | "fixed_7";
  paramCount?: number;
  bodyParams?: string[];
  rawMetadata?: Record<string, unknown> | null;
  templateLanguage?: string;
};

export { parseLeadConsent } from "./leadWhatsAppBodyParams.ts";

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
    const creds = await resolveOrganizationWhatsAppCredentials(admin, args.organizationId);
    if (!creds.ok) {
      return {
        status: "skipped",
        messageId: null,
        skipReason: "wa_not_configured",
        error: creds.error,
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
      console.error("triggerLeadWhatsApp:", {
        organizationId: args.organizationId,
        webId: args.webId,
        templateName: args.templateName,
        mappingSource: resolved.mappingSource,
        paramCount: resolved.params.length,
        params: resolved.params,
        metaError: json,
      });
      return {
        status: "failed",
        messageId: null,
        skipReason: `meta:${errMsg}`.slice(0, 500),
        error: errMsg,
        metaErrorCode: metaErr?.code ?? null,
        mappingSource: resolved.mappingSource,
        paramCount: resolved.params.length,
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
