import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { countTemplateBodySlotsFromComponents } from "./leadTemplateMapping.ts";
import { fetchMetaTemplateComponents } from "./leadWhatsAppTemplatePreview.ts";
import { resolveOrganizationWhatsAppCredentials } from "./resolveOrganizationWhatsAppCredentials.ts";

const META_API_BASE = "https://graph.facebook.com/v21.0";

export async function resolveWabaIdForOrg(
  admin: SupabaseClient,
  organizationId: string,
  credentials: { whatsappAccountId: string; phoneNumberId: string; accessToken: string },
): Promise<string | null> {
  const { data: acc } = await admin
    .from("organization_whatsapp_accounts")
    .select("whatsapp_business_account_id")
    .eq("id", credentials.whatsappAccountId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  let wabaId = String(acc?.whatsapp_business_account_id ?? "").trim();
  if (!wabaId) {
    const { data: meta } = await admin
      .from("organization_meta_config")
      .select("whatsapp_business_account_id")
      .eq("organization_id", organizationId)
      .maybeSingle();
    wabaId = String(meta?.whatsapp_business_account_id ?? "").trim();
  }

  if (!wabaId && credentials.phoneNumberId) {
    const fields = encodeURIComponent("whatsapp_business_account{id}");
    const url =
      `${META_API_BASE}/${encodeURIComponent(credentials.phoneNumberId)}?fields=${fields}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${credentials.accessToken}` },
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const wabaObj = json.whatsapp_business_account as { id?: string } | undefined;
    wabaId = wabaObj?.id != null ? String(wabaObj.id).trim() : "";
  }

  return wabaId || null;
}

export async function fetchLeadTemplateBodySlotCount(
  admin: SupabaseClient,
  organizationId: string,
  templateName: string,
  templateLanguage: string,
  webId?: string | null,
): Promise<{ ok: true; slotCount: number } | { ok: false; error: string }> {
  const creds = await resolveOrganizationWhatsAppCredentials(admin, organizationId, { webId });
  if (!creds.ok) return { ok: false, error: creds.error };

  const wabaId = await resolveWabaIdForOrg(admin, organizationId, creds.credentials);
  if (!wabaId) {
    return { ok: false, error: "WhatsApp Business Account ID tidak ditemukan." };
  }

  const components = await fetchMetaTemplateComponents(
    wabaId,
    creds.credentials.accessToken,
    templateName,
    templateLanguage,
  );

  if (!components) {
    return { ok: false, error: "Template Meta tidak ditemukan atau belum APPROVED." };
  }

  const slotCount = countTemplateBodySlotsFromComponents(components);
  return { ok: true, slotCount };
}

export function buildWhatsAppSkipReasonMeta(args: {
  metaMessage: string;
  templateName: string;
  templateLanguage: string;
  mappingSource: string;
  paramCount: number;
  webId: string;
  expectedSlotCount?: number | null;
}): string {
  const parts = [
    `meta:${args.metaMessage}`,
    `template=${args.templateName}`,
    `lang=${args.templateLanguage}`,
    `mapping=${args.mappingSource}`,
    `slots=${args.paramCount}`,
    `web_id=${args.webId}`,
  ];
  if (args.expectedSlotCount != null && args.expectedSlotCount !== args.paramCount) {
    parts.push(`expected=${args.expectedSlotCount}`);
  }
  return parts.join(";").slice(0, 500);
}

export function buildWhatsAppPrecheckSkipReason(args: {
  templateName: string;
  templateLanguage: string;
  mappingSource: string;
  paramCount: number;
  expectedSlotCount: number;
  webId: string;
}): string {
  return [
    `meta_precheck:expected_${args.expectedSlotCount}_got_${args.paramCount}`,
    `template=${args.templateName}`,
    `lang=${args.templateLanguage}`,
    `mapping=${args.mappingSource}`,
    `web_id=${args.webId}`,
  ].join(";").slice(0, 500);
}
