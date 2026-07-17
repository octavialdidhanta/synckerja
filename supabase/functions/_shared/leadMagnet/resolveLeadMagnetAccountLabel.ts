import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { LeadMagnetPlatform } from "./types.ts";

function formatInstagramLabel(username: string | null | undefined, name: string | null | undefined): string {
  const user = (username ?? "").trim().replace(/^@/, "");
  if (user) return `@${user}`;
  const display = (name ?? "").trim();
  if (display) return display;
  return "";
}

async function resolveAccountIdForPlatform(
  admin: SupabaseClient,
  campaignId: string,
  platform: LeadMagnetPlatform,
  legacyAccountId: string | null | undefined,
): Promise<string> {
  const { data: row } = await admin
    .from("lead_magnet_campaign_accounts")
    .select("account_id")
    .eq("campaign_id", campaignId)
    .eq("platform", platform)
    .maybeSingle();

  const fromJoin = (row?.account_id ?? "").trim();
  if (fromJoin) return fromJoin;

  return (legacyAccountId ?? "").trim();
}

/** Connected social account label for leads.created_by_name (multi-tenant). */
export async function resolveLeadMagnetAccountLabel(
  admin: SupabaseClient,
  args: {
    organizationId: string;
    campaignId: string;
    platform: LeadMagnetPlatform;
    legacyAccountId?: string | null;
  },
): Promise<string> {
  const accountId = await resolveAccountIdForPlatform(
    admin,
    args.campaignId,
    args.platform,
    args.legacyAccountId,
  );

  if (!accountId) {
    return args.platform === "instagram" ? "Instagram" : "Facebook Page";
  }

  if (args.platform === "instagram") {
    const { data: ig } = await admin
      .from("organization_instagram_accounts")
      .select("instagram_username, instagram_name")
      .eq("organization_id", args.organizationId)
      .eq("instagram_business_account_id", accountId)
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const label = formatInstagramLabel(ig?.instagram_username, ig?.instagram_name);
    if (label) return label;
    return `IG ${accountId.slice(0, 8)}`;
  }

  const { data: fb } = await admin
    .from("organization_facebook_pages")
    .select("page_name")
    .eq("organization_id", args.organizationId)
    .eq("facebook_page_id", accountId)
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const pageName = (fb?.page_name ?? "").trim();
  if (pageName) return pageName;
  return `Page ${accountId.slice(0, 8)}`;
}
