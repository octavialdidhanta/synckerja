import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildLeadMagnetDownloadUrl } from "../leadMagnetActionUrl.ts";
import { interpolateLeadMagnetText } from "../types.ts";
import type { LeadMagnetCampaignRow, LeadMagnetEnrollmentRow } from "../types.ts";
import { buildLeadMagnetAssetPublicUrl } from "../deliveryAsset.ts";

export type DeliveryContext = {
  username: string;
  deliveryUrl: string;
  campaignName: string;
};

export async function buildDeliveryContext(
  admin: SupabaseClient,
  args: {
    enrollment: LeadMagnetEnrollmentRow;
    campaign: LeadMagnetCampaignRow;
  },
): Promise<DeliveryContext> {
  const username = (args.enrollment.participant_username ?? "").trim().replace(/^@/, "") || "Kak";
  let deliveryUrl = String(args.campaign.delivery_url ?? "").trim();

  const storagePath = (args.campaign as { delivery_storage_path?: string | null }).delivery_storage_path;
  if (storagePath?.trim()) {
    const supabaseUrl = (Deno.env.get("SUPABASE_URL") ?? "").trim();
    if (supabaseUrl) {
      deliveryUrl = buildLeadMagnetAssetPublicUrl(supabaseUrl, storagePath.trim());
    }
  }

  if (!deliveryUrl) {
    deliveryUrl = await buildLeadMagnetDownloadUrl(args.enrollment.id);
  }

  return {
    username,
    deliveryUrl,
    campaignName: args.campaign.name,
  };
}

export function interpolateDeliveryTemplate(
  template: string,
  ctx: DeliveryContext,
): string {
  return template
    .replace(/\{\{username\}\}/gi, ctx.username)
    .replace(/\{\{delivery_url\}\}/gi, ctx.deliveryUrl)
    .replace(/\{\{campaign_name\}\}/gi, ctx.campaignName);
}

export function interpolateCampaignText(
  template: string,
  username: string | null,
): string {
  return interpolateLeadMagnetText(template, username);
}

export type WhatsAppTemplateParams = {
  body?: string[];
  header?: string[];
  button?: string[];
};

export function buildWhatsAppTemplateComponents(
  params: WhatsAppTemplateParams | null | undefined,
  ctx: DeliveryContext,
): Array<Record<string, unknown>> {
  const components: Array<Record<string, unknown>> = [];
  const mapVars = (vars: string[] | undefined): string[] =>
    (vars ?? []).map((v) => interpolateDeliveryTemplate(v, ctx));

  const bodyVars = mapVars(params?.body);
  if (bodyVars.length > 0) {
    components.push({
      type: "body",
      parameters: bodyVars.map((text) => ({ type: "text", text })),
    });
  }

  const headerVars = mapVars(params?.header);
  if (headerVars.length > 0) {
    components.push({
      type: "header",
      parameters: headerVars.map((text) => ({ type: "text", text })),
    });
  }

  const buttonVars = mapVars(params?.button);
  if (buttonVars.length > 0) {
    components.push({
      type: "button",
      sub_type: "url",
      index: "0",
      parameters: buttonVars.map((text) => ({ type: "text", text })),
    });
  }

  return components;
}
