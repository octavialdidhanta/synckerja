import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { facebookPostMediaIdCandidates } from "./facebookPostMediaId.ts";
import { normalizeCommentReplyTexts } from "./commentReplyVariants.ts";
import type { LeadMagnetPlatform } from "./types.ts";
import { commentMatchesKeyword } from "./types.ts";

export type LeadMagnetCampaignAccountRow = {
  id?: string;
  campaign_id?: string;
  platform: LeadMagnetPlatform;
  account_id: string;
};

export type MatchedCampaign = {
  id: string;
  organization_id: string;
  name: string;
  keyword: string;
  status: string;
  comment_reply_enabled: boolean;
  comment_reply_texts: string[];
  comment_reply_text: string;
  follow_gate_text: string;
  follow_button_label: string;
  framework_offer_text: string;
  framework_button_label: string;
  delivery_text: string;
  delivery_button_label: string;
  delivery_fallback_text: string | null;
  delivery_url: string;
  delivery_links: Array<{ label: string; url: string }>;
  skip_follow_gate_if_follower: boolean;
  skip_material_offer: boolean;
  contact_gate_enabled: boolean;
  email_collection_enabled: boolean;
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
  platform: LeadMagnetPlatform;
  account_id: string;
  posts: Array<{ media_id: string; platform: LeadMagnetPlatform }>;
};

type CampaignAccountRow = {
  platform: LeadMagnetPlatform;
  account_id: string;
};

type CampaignFromPostJoin = {
  id: string;
  organization_id: string;
  name: string;
  keyword: string;
  status: string;
  comment_reply_enabled: boolean;
  comment_reply_texts: string[];
  comment_reply_text: string;
  follow_gate_text: string;
  follow_button_label: string;
  framework_offer_text: string;
  framework_button_label: string;
  delivery_text: string;
  delivery_button_label: string;
  delivery_fallback_text: string | null;
  delivery_url: string;
  delivery_links: Array<{ label: string; url: string }>;
  skip_follow_gate_if_follower: boolean;
  skip_material_offer: boolean;
  contact_gate_enabled: boolean;
  email_collection_enabled: boolean;
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
  lead_magnet_campaign_accounts: CampaignAccountRow | CampaignAccountRow[] | null;
};

function mapMatchedCampaign(
  campaign: CampaignFromPostJoin,
  args: {
    platform: LeadMagnetPlatform;
    accountId: string;
    mediaId: string;
  },
): MatchedCampaign | null {
  const accountsRaw = campaign.lead_magnet_campaign_accounts;
  const accounts = Array.isArray(accountsRaw)
    ? accountsRaw
    : accountsRaw
    ? [accountsRaw]
    : [];
  const binding = accounts.find(
    (row) => row.platform === args.platform && String(row.account_id) === args.accountId,
  );
  if (!binding) return null;

  return {
    id: String(campaign.id),
    organization_id: String(campaign.organization_id),
    name: String(campaign.name),
    keyword: String(campaign.keyword),
    status: String(campaign.status),
    comment_reply_enabled: campaign.comment_reply_enabled !== false,
    comment_reply_texts: normalizeCommentReplyTexts(
      campaign.comment_reply_texts,
      campaign.comment_reply_text,
    ),
    comment_reply_text: String(campaign.comment_reply_text),
    follow_gate_text: String(campaign.follow_gate_text),
    follow_button_label: String(campaign.follow_button_label),
    framework_offer_text: String(campaign.framework_offer_text),
    framework_button_label: String(campaign.framework_button_label),
    delivery_text: String(campaign.delivery_text),
    delivery_button_label: String(campaign.delivery_button_label),
    delivery_fallback_text: campaign.delivery_fallback_text != null
      ? String(campaign.delivery_fallback_text)
      : null,
    delivery_url: String(campaign.delivery_url),
    delivery_links: Array.isArray(campaign.delivery_links)
      ? (campaign.delivery_links as Array<{ label: string; url: string }>)
      : [],
    skip_follow_gate_if_follower: Boolean(campaign.skip_follow_gate_if_follower),
    skip_material_offer: Boolean(campaign.skip_material_offer),
    contact_gate_enabled: Boolean(campaign.contact_gate_enabled),
    email_collection_enabled: Boolean(campaign.email_collection_enabled),
    contact_prompt_text: campaign.contact_prompt_text ?? null,
    contact_invalid_text: campaign.contact_invalid_text ?? null,
    contact_ack_text: campaign.contact_ack_text ?? null,
    whatsapp_account_id: campaign.whatsapp_account_id ?? null,
    whatsapp_template_name: campaign.whatsapp_template_name ?? null,
    whatsapp_template_language: campaign.whatsapp_template_language ?? null,
    whatsapp_template_params: (campaign.whatsapp_template_params ?? {}) as Record<string, unknown>,
    email_subject: campaign.email_subject ?? null,
    email_html_body: campaign.email_html_body ?? null,
    email_from_name: campaign.email_from_name ?? null,
    platform: args.platform,
    account_id: String(binding.account_id),
    posts: [{ media_id: args.mediaId, platform: args.platform }],
  };
}

export async function findMatchingLeadMagnetCampaign(
  admin: SupabaseClient,
  args: {
    organizationId: string;
    platform: LeadMagnetPlatform;
    accountId: string;
    mediaId: string;
    commentText: string;
  },
): Promise<MatchedCampaign | null> {
  const mediaIdCandidates = args.platform === "facebook"
    ? facebookPostMediaIdCandidates(args.mediaId, args.accountId)
    : [args.mediaId.trim()].filter(Boolean);

  const { data: rows, error } = await admin
    .from("lead_magnet_campaign_posts")
    .select(`
      media_id,
      platform,
      lead_magnet_campaigns!inner (
        id,
        organization_id,
        name,
        keyword,
        status,
        comment_reply_enabled,
        comment_reply_texts,
        comment_reply_text,
        follow_gate_text,
        follow_button_label,
        framework_offer_text,
        framework_button_label,
        delivery_text,
        delivery_button_label,
        delivery_fallback_text,
        delivery_url,
        delivery_links,
        skip_follow_gate_if_follower,
        skip_material_offer,
        contact_gate_enabled,
        email_collection_enabled,
        contact_prompt_text,
        contact_invalid_text,
        contact_ack_text,
        whatsapp_account_id,
        whatsapp_template_name,
        whatsapp_template_language,
        whatsapp_template_params,
        email_subject,
        email_html_body,
        email_from_name,
        lead_magnet_campaign_accounts (platform, account_id)
      )
    `)
    .eq("platform", args.platform)
    .in("media_id", mediaIdCandidates.length ? mediaIdCandidates : [args.mediaId]);

  if (error) {
    console.error("[lead-magnet] campaign match query failed:", error.message);
    return null;
  }
  if (!rows?.length) return null;

  for (const row of rows as Array<{
    media_id: string;
    platform: LeadMagnetPlatform;
    lead_magnet_campaigns: CampaignFromPostJoin | CampaignFromPostJoin[] | null;
  }>) {
    const campaignRaw = row.lead_magnet_campaigns;
    const campaign = Array.isArray(campaignRaw) ? campaignRaw[0] : campaignRaw;
    if (!campaign) continue;
    if (String(campaign.organization_id) !== args.organizationId) continue;
    if (String(campaign.status) !== "active") continue;
    if (!commentMatchesKeyword(args.commentText, String(campaign.keyword ?? ""))) continue;

    const matched = mapMatchedCampaign(campaign, {
      platform: args.platform,
      accountId: args.accountId,
      mediaId: String(row.media_id),
    });
    if (matched) return matched;
  }

  return null;
}

export async function enrollmentExists(
  admin: SupabaseClient,
  campaignId: string,
  participantScopedId: string,
): Promise<boolean> {
  const { data } = await admin
    .from("lead_magnet_enrollments")
    .select("id")
    .eq("campaign_id", campaignId)
    .eq("participant_scoped_id", participantScopedId)
    .maybeSingle();
  return Boolean(data?.id);
}
