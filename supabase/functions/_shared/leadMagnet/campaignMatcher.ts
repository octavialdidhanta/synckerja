import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { facebookPostMediaIdCandidates } from "./facebookPostMediaId.ts";
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
  comment_reply_text: string;
  follow_gate_text: string;
  follow_button_label: string;
  framework_offer_text: string;
  framework_button_label: string;
  delivery_text: string;
  delivery_button_label: string;
  delivery_url: string;
  skip_follow_gate_if_follower: boolean;
  skip_material_offer: boolean;
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
  comment_reply_text: string;
  follow_gate_text: string;
  follow_button_label: string;
  framework_offer_text: string;
  framework_button_label: string;
  delivery_text: string;
  delivery_button_label: string;
  delivery_url: string;
  skip_follow_gate_if_follower: boolean;
  skip_material_offer: boolean;
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
    comment_reply_text: String(campaign.comment_reply_text),
    follow_gate_text: String(campaign.follow_gate_text),
    follow_button_label: String(campaign.follow_button_label),
    framework_offer_text: String(campaign.framework_offer_text),
    framework_button_label: String(campaign.framework_button_label),
    delivery_text: String(campaign.delivery_text),
    delivery_button_label: String(campaign.delivery_button_label),
    delivery_url: String(campaign.delivery_url),
    skip_follow_gate_if_follower: Boolean(campaign.skip_follow_gate_if_follower),
    skip_material_offer: Boolean(campaign.skip_material_offer),
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
        comment_reply_text,
        follow_gate_text,
        follow_button_label,
        framework_offer_text,
        framework_button_label,
        delivery_text,
        delivery_button_label,
        delivery_url,
        skip_follow_gate_if_follower,
        skip_material_offer,
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
