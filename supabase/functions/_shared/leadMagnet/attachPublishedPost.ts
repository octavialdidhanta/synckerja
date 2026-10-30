import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export async function attachPublishedPostToLeadMagnet(
  admin: SupabaseClient,
  input: {
    organizationId: string;
    planId: string | null;
    platform: string;
    mediaId: string | null;
    permalink: string | null;
  },
): Promise<void> {
  const planId = String(input.planId ?? "").trim();
  const mediaId = String(input.mediaId ?? "").trim();
  const platform = input.platform === "Instagram"
    ? "instagram"
    : input.platform === "Facebook"
    ? "facebook"
    : "";
  if (!planId || !mediaId || !platform) return;

  const { data: campaign, error } = await admin
    .from("lead_magnet_campaigns")
    .select("id")
    .eq("organization_id", input.organizationId)
    .eq("social_media_plan_id", planId)
    .in("status", ["draft", "active"])
    .maybeSingle();
  if (error || !campaign?.id) {
    if (error) console.error("[lead-magnet] attach lookup", error.message);
    return;
  }

  const { error: insertError } = await admin.from("lead_magnet_campaign_posts").upsert(
    {
      campaign_id: campaign.id,
      platform,
      media_id: mediaId,
      media_permalink: input.permalink,
    },
    { onConflict: "campaign_id,platform,media_id", ignoreDuplicates: true },
  );
  if (insertError) console.error("[lead-magnet] attach post", insertError.message);
}
