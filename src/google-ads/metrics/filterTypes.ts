export type GoogleAdsCampaignListItem = {
  id: string;
  campaign_id: string;
  customer_id: string;
  name: string;
  status: string;
};

export type GoogleAdsAdGroupListItem = {
  id: string;
  ad_group_id: string;
  campaign_id: string;
  customer_id: string;
  name: string;
  status: string;
};

export const GOOGLE_ADS_FILTER_ALL = "__all__" as const;
