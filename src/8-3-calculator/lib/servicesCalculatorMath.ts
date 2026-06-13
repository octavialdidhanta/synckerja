export type RemarketingAudienceSource = "manual" | "branding" | "traffic";
export type TrafficAdType = "meta" | "google";

export interface EngagementInputs {
  brandingBudget: number;
  brandingCpm: number;
  brandingFrequency: number;
  brandingEngagementRate: number;
  brandingQualificationRate: number;
}

export interface EngagementResults {
  brandingImpressions: number;
  brandingReach: number;
  brandingEngagements: number;
  brandingWarmAudience: number;
  brandingCostPerEngagement: number;
}

export interface TrafficInputs {
  adType: TrafficAdType;
  budget: number;
  cpm: number;
  cpc: number;
  ctrLink: number;
  adsClickToVisit: number;
}

export interface TrafficResults {
  impressions: number;
  adClicks: number;
  websiteVisitors: number;
  costPerClick: number;
}

export interface ConversionInputs {
  remarketingAudienceSource: RemarketingAudienceSource;
  remarketingAudienceManual: number;
  brandingWarmAudience: number;
  trafficWebsiteVisitors: number;
  conversionFrequency: number;
  conversionCpm: number;
  ctrLink: number;
  adsClickToVisit: number;
  whatsappClick: number;
  prospectToClient: number;
  reservation: number;
  crossSelling: number;
}

export interface ConversionResults {
  impressions: number;
  calculatedBudget: number;
  adClicks: number;
  websiteVisitors: number;
  leads: number;
  totalClients: number;
  costPerClient: number;
  activeRemarketingAudience: number;
}

export function calculateEngagementResults(input: EngagementInputs): EngagementResults {
  const {
    brandingBudget,
    brandingCpm,
    brandingFrequency,
    brandingEngagementRate,
    brandingQualificationRate,
  } = input;

  if (brandingFrequency <= 0) {
    return {
      brandingImpressions: 0,
      brandingReach: 0,
      brandingEngagements: 0,
      brandingWarmAudience: 0,
      brandingCostPerEngagement: 0,
    };
  }

  const safeCpm = brandingCpm > 0 ? brandingCpm : 1;
  const brandingImpressions = Math.floor((brandingBudget / safeCpm) * 1000);
  const brandingReach = Math.floor(brandingImpressions / brandingFrequency);
  const brandingEngagements = Math.floor(brandingReach * (brandingEngagementRate / 100));
  const brandingWarmAudience = Math.floor(brandingEngagements * (brandingQualificationRate / 100));
  const brandingCostPerEngagement =
    brandingEngagements > 0 ? brandingBudget / brandingEngagements : 0;

  return {
    brandingImpressions,
    brandingReach,
    brandingEngagements,
    brandingWarmAudience,
    brandingCostPerEngagement,
  };
}

export function calculateTrafficResults(input: TrafficInputs): TrafficResults {
  const { adType, budget, cpm, cpc, ctrLink, adsClickToVisit } = input;

  let impressions = 0;
  let adClicks = 0;
  let costPerClick = 0;

  if (adType === "meta") {
    const safeCpm = cpm > 0 ? cpm : 1;
    impressions = Math.floor((budget / safeCpm) * 1000);
    adClicks = Math.floor(impressions * (ctrLink / 100));
    costPerClick = adClicks > 0 ? budget / adClicks : 0;
  } else if (cpc > 0) {
    costPerClick = cpc;
    adClicks = Math.floor(budget / cpc);
    impressions = ctrLink > 0 ? Math.floor((adClicks / ctrLink) * 100) : 0;
  }

  const websiteVisitors = Math.floor(adClicks * (adsClickToVisit / 100));

  return { impressions, adClicks, websiteVisitors, costPerClick };
}

export function resolveRemarketingAudience(input: {
  remarketingAudienceSource: RemarketingAudienceSource;
  remarketingAudienceManual: number;
  brandingWarmAudience: number;
  trafficWebsiteVisitors: number;
}): number {
  if (input.remarketingAudienceSource === "branding") {
    return input.brandingWarmAudience;
  }
  if (input.remarketingAudienceSource === "traffic") {
    return input.trafficWebsiteVisitors;
  }
  return input.remarketingAudienceManual;
}

/** Upsell/cross-sell adds service units on top of converted clients (e.g. 20% → 1.2× packages). */
export function applyCrossSelling(realClients: number, crossSellingPercent: number): number {
  if (realClients <= 0) return 0;
  if (crossSellingPercent <= 0) return realClients;
  return Math.floor(realClients * (1 + crossSellingPercent / 100));
}

export function calculateConversionResults(input: ConversionInputs): ConversionResults {
  const {
    conversionFrequency,
    conversionCpm,
    ctrLink,
    adsClickToVisit,
    whatsappClick,
    prospectToClient,
    reservation,
    crossSelling,
  } = input;

  const activeRemarketingAudience = resolveRemarketingAudience(input);
  const safeFrequency = conversionFrequency > 0 ? conversionFrequency : 1;
  const safeCpm = conversionCpm > 0 ? conversionCpm : 1;

  const impressions =
    activeRemarketingAudience > 0
      ? Math.floor(activeRemarketingAudience * safeFrequency)
      : 0;
  const calculatedBudget = Math.round((impressions / 1000) * safeCpm);

  const adClicks = Math.floor(impressions * (ctrLink / 100));
  const websiteVisitors = Math.floor(adClicks * (adsClickToVisit / 100));
  const leads = Math.floor(websiteVisitors * (whatsappClick / 100));
  const leadsToClients = Math.floor(leads * (prospectToClient / 100));
  const realClients = Math.floor(leadsToClients * (reservation / 100));
  const totalClients = applyCrossSelling(realClients, crossSelling);
  const costPerClient = totalClients > 0 ? calculatedBudget / totalClients : 0;

  return {
    impressions,
    calculatedBudget,
    adClicks,
    websiteVisitors,
    leads,
    totalClients,
    costPerClient,
    activeRemarketingAudience,
  };
}
