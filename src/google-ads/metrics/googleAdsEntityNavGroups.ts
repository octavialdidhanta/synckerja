import {
  ImageIcon,
  KeyRound,
  LayoutGrid,
  Megaphone,
  type LucideIcon,
} from "lucide-react";
import type { GoogleAdsMetricEntity } from "@/google-ads/metrics/types";

export type GoogleAdsEntityNavItemDef = {
  id: GoogleAdsMetricEntity;
  labelKey: string;
  defaultLabel: string;
  icon: LucideIcon;
};

export type GoogleAdsEntityNavGroupDef = {
  id: string;
  sectionKey: string;
  sectionDefault: string;
  items: GoogleAdsEntityNavItemDef[];
};

/**
 * Shared report-level nav (Campaigns / Ad groups / Ads / Keywords).
 * Desktop sidebar and mobile entity picker both use this.
 */
export const GOOGLE_ADS_ENTITY_NAV_GROUPS: GoogleAdsEntityNavGroupDef[] = [
  {
    id: "report",
    sectionKey: "digitalMarketing.googleAds.navSectionCampaigns",
    sectionDefault: "Campaigns",
    items: [
      {
        id: "campaign",
        labelKey: "digitalMarketing.googleAds.navCampaigns",
        defaultLabel: "Campaigns",
        icon: Megaphone,
      },
      {
        id: "ad_group",
        labelKey: "digitalMarketing.googleAds.navAdGroups",
        defaultLabel: "Ad groups",
        icon: LayoutGrid,
      },
      {
        id: "ad",
        labelKey: "digitalMarketing.googleAds.navAds",
        defaultLabel: "Ads",
        icon: ImageIcon,
      },
    ],
  },
  {
    id: "targeting",
    sectionKey: "digitalMarketing.googleAds.navSectionTargeting",
    sectionDefault: "Targeting",
    items: [
      {
        id: "keyword",
        labelKey: "digitalMarketing.googleAds.navKeywords",
        defaultLabel: "Keywords",
        icon: KeyRound,
      },
    ],
  },
];

export function findGoogleAdsEntityNavItem(
  entity: GoogleAdsMetricEntity,
): GoogleAdsEntityNavItemDef | undefined {
  for (const group of GOOGLE_ADS_ENTITY_NAV_GROUPS) {
    const item = group.items.find((i) => i.id === entity);
    if (item) return item;
  }
  return undefined;
}
