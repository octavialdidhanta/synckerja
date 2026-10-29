import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import {
  emptyCampaignNameTemplate,
  parseCampaignNameTemplate,
  type CampaignNameTemplate,
} from "@/6-0-meta-ads/components/interest-research/campaignNameTemplate";

export type OrgNameTemplates = {
  campaignTemplate: CampaignNameTemplate;
  adsetTemplate: CampaignNameTemplate;
  useCampaignTemplate: boolean;
  useAdsetTemplate: boolean;
};

const EMPTY: OrgNameTemplates = {
  campaignTemplate: emptyCampaignNameTemplate(),
  adsetTemplate: emptyCampaignNameTemplate(),
  useCampaignTemplate: false,
  useAdsetTemplate: false,
};

export function metaAdsNameTemplatesQueryKey(organizationId: string | null | undefined) {
  return ["meta-ads-name-templates", organizationId] as const;
}

export function useMetaAdsNameTemplates(organizationId: string | null | undefined, enabled = true) {
  const queryClient = useQueryClient();
  const queryKey = metaAdsNameTemplatesQueryKey(organizationId);

  const query = useQuery({
    queryKey,
    enabled: Boolean(organizationId) && enabled,
    queryFn: async (): Promise<OrgNameTemplates> => {
      if (!organizationId) return EMPTY;
      const { data, error } = await supabase
        .from("organization_meta_ads_name_templates")
        .select("campaign_template, adset_template, use_campaign_template, use_adset_template")
        .eq("organization_id", organizationId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return EMPTY;
      const campaignTemplate = parseCampaignNameTemplate(data.campaign_template);
      const adsetTemplate = parseCampaignNameTemplate(data.adset_template);
      return {
        campaignTemplate,
        adsetTemplate,
        useCampaignTemplate: Boolean(data.use_campaign_template) && campaignTemplate.tokens.length > 0,
        useAdsetTemplate: Boolean(data.use_adset_template) && adsetTemplate.tokens.length > 0,
      };
    },
  });

  const save = useMutation({
    mutationFn: async (next: OrgNameTemplates) => {
      if (!organizationId) throw new Error("No organization");
      const { error } = await supabase.from("organization_meta_ads_name_templates").upsert(
        {
          organization_id: organizationId,
          campaign_template: next.campaignTemplate,
          adset_template: next.adsetTemplate,
          use_campaign_template: next.useCampaignTemplate && next.campaignTemplate.tokens.length > 0,
          use_adset_template: next.useAdsetTemplate && next.adsetTemplate.tokens.length > 0,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "organization_id" },
      );
      if (error) throw error;
      return next;
    },
    onSuccess: (next) => {
      queryClient.setQueryData(queryKey, next);
    },
  });

  return { ...query, save };
}
