import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { GoogleAdsFilterPicker } from "@/6-0-google-ads/components/GoogleAdsFilterPicker";
import { useGoogleAdsCampaignList } from "@/google-ads/hooks/useGoogleAdsCampaignList";
import { useGoogleAdsAdGroupList } from "@/google-ads/hooks/useGoogleAdsAdGroupList";
import type { GoogleAdsMetricEntity } from "@/google-ads/metrics/types";

type Props = {
  organizationId: string | null | undefined;
  customerId: string;
  entity: GoogleAdsMetricEntity;
  statusFilter: "all" | "enabled_only";
  reportingEnabled: boolean;
  selectedCampaignId: string | null;
  selectedAdGroupId: string | null;
  onCampaignChange: (campaignId: string | null) => void;
  onAdGroupChange: (adGroupId: string | null) => void;
  disabled?: boolean;
};

export function GoogleAdsCampaignAdGroupFilters({
  organizationId,
  customerId,
  entity,
  statusFilter,
  reportingEnabled,
  selectedCampaignId,
  selectedAdGroupId,
  onCampaignChange,
  onAdGroupChange,
  disabled,
}: Props) {
  const { t } = useTranslation();
  const listEnabled = Boolean(organizationId && customerId && reportingEnabled);

  const campaignsQuery = useGoogleAdsCampaignList(
    organizationId,
    customerId,
    statusFilter,
    listEnabled,
  );

  const campaigns = campaignsQuery.data ?? [];
  const campaignCount = campaigns.length;

  const adGroupsQuery = useGoogleAdsAdGroupList(
    organizationId,
    customerId,
    selectedCampaignId,
    statusFilter,
    listEnabled && Boolean(selectedCampaignId),
  );

  const adGroups = adGroupsQuery.data ?? [];

  const showAdGroupFilter =
    Boolean(selectedCampaignId) && entity !== "campaign";

  const campaignsCountLabel = useMemo(
    () =>
      t("digitalMarketing.googleAds.filterCampaignsCount", {
        defaultValue: "Campaigns ({{count}})",
        count: campaignCount,
      }),
    [t, campaignCount],
  );

  const adGroupsCountLabel = useMemo(
    () =>
      t("digitalMarketing.googleAds.filterAdGroupsCount", {
        defaultValue: "Ad groups ({{count}})",
        count: adGroups.length,
      }),
    [t, adGroups.length],
  );

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <GoogleAdsFilterPicker
        label={t("digitalMarketing.googleAds.filterCampaignLabel", "Campaign")}
        countLabel={campaignsCountLabel}
        placeholder={t("digitalMarketing.googleAds.filterSelectCampaign", "Select a campaign")}
        searchPlaceholder={t("digitalMarketing.googleAds.filterSearchCampaigns", {
          defaultValue: "Search {{count}} campaigns",
          count: campaignCount,
        })}
        allLabel={t("digitalMarketing.googleAds.filterAllCampaigns", "All campaigns")}
        viewAllLabel={t("digitalMarketing.googleAds.filterViewAllCampaigns", {
          defaultValue: "View all {{count}} campaigns",
          count: campaignCount,
        })}
        value={selectedCampaignId}
        options={campaigns}
        isLoading={campaignsQuery.isLoading}
        disabled={disabled}
        onChange={onCampaignChange}
      />

      {showAdGroupFilter ? (
        <GoogleAdsFilterPicker
          label={t("digitalMarketing.googleAds.filterAdGroupLabel", "Ad group")}
          countLabel={adGroupsCountLabel}
          placeholder={t("digitalMarketing.googleAds.filterSelectAdGroup", "Select an ad group")}
          searchPlaceholder={t("digitalMarketing.googleAds.filterSearchAdGroups", {
            defaultValue: "Search {{count}} ad groups",
            count: adGroups.length,
          })}
          allLabel={t("digitalMarketing.googleAds.filterAllAdGroups", "All ad groups")}
          viewAllLabel={t("digitalMarketing.googleAds.filterViewAllAdGroups", {
            defaultValue: "View all {{count}} ad groups in this campaign",
            count: adGroups.length,
          })}
          value={selectedAdGroupId}
          options={adGroups}
          isLoading={adGroupsQuery.isLoading}
          disabled={disabled}
          onChange={onAdGroupChange}
        />
      ) : null}
    </div>
  );
}
