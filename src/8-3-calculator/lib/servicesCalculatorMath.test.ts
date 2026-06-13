import { describe, expect, it } from "vitest";
import {
  applyCrossSelling,
  calculateConversionResults,
  calculateEngagementResults,
  calculateTrafficResults,
  resolveRemarketingAudience,
} from "./servicesCalculatorMath";

/** Realistic healthcare-services KPI scenario (Meta ads, IDR). */
const ENGAGEMENT = {
  brandingBudget: 10_000_000,
  brandingCpm: 50_000,
  brandingFrequency: 3,
  brandingEngagementRate: 5,
  brandingQualificationRate: 100,
};

const TRAFFIC_META = {
  adType: "meta" as const,
  budget: 5_000_000,
  cpm: 30_000,
  cpc: 0,
  ctrLink: 1.5,
  adsClickToVisit: 70,
};

const CONVERSION_RATES = {
  conversionFrequency: 7,
  conversionCpm: 25_000,
  ctrLink: 2,
  adsClickToVisit: 80,
  whatsappClick: 15,
  prospectToClient: 40,
  reservation: 60,
  crossSelling: 20,
};

describe("services calculator funnel — engagement → traffic → conversion", () => {
  const engagement = calculateEngagementResults(ENGAGEMENT);
  const traffic = calculateTrafficResults(TRAFFIC_META);

  it("engagement: impressions → reach → engagements → warm audience", () => {
    expect(engagement.brandingImpressions).toBe(200_000);
    expect(engagement.brandingReach).toBe(66_666);
    expect(engagement.brandingEngagements).toBe(3_333);
    expect(engagement.brandingWarmAudience).toBe(3_333);
    expect(engagement.brandingCostPerEngagement).toBeCloseTo(10_000_000 / 3_333, 0);
  });

  it("traffic (Meta): budget → impressions → clicks → website visitors", () => {
    expect(traffic.impressions).toBe(166_666);
    expect(traffic.adClicks).toBe(2_499);
    expect(traffic.websiteVisitors).toBe(1_749);
    expect(traffic.costPerClick).toBeCloseTo(5_000_000 / 2_499, 0);
  });

  it("remarketing audience resolves from branding warm audience", () => {
    expect(
      resolveRemarketingAudience({
        remarketingAudienceSource: "branding",
        remarketingAudienceManual: 0,
        brandingWarmAudience: engagement.brandingWarmAudience,
        trafficWebsiteVisitors: traffic.websiteVisitors,
      }),
    ).toBe(3_333);
  });

  it("remarketing audience resolves from traffic website visitors", () => {
    expect(
      resolveRemarketingAudience({
        remarketingAudienceSource: "traffic",
        remarketingAudienceManual: 0,
        brandingWarmAudience: engagement.brandingWarmAudience,
        trafficWebsiteVisitors: traffic.websiteVisitors,
      }),
    ).toBe(1_749);
  });

  it("conversion from branding audience: budget = audience × freq × CPM", () => {
    const conversion = calculateConversionResults({
      remarketingAudienceSource: "branding",
      remarketingAudienceManual: 0,
      brandingWarmAudience: engagement.brandingWarmAudience,
      trafficWebsiteVisitors: traffic.websiteVisitors,
      ...CONVERSION_RATES,
    });

    expect(conversion.activeRemarketingAudience).toBe(3_333);
    expect(conversion.impressions).toBe(23_331);
    expect(conversion.calculatedBudget).toBe(583_275);
    expect(conversion.adClicks).toBe(466);
    expect(conversion.websiteVisitors).toBe(372);
    expect(conversion.leads).toBe(55);
    expect(conversion.totalClients).toBe(15);
    expect(conversion.costPerClient).toBeCloseTo(583_275 / 15, 0);
  });

  it("conversion from traffic audience uses visitor pool, not engagement", () => {
    const conversion = calculateConversionResults({
      remarketingAudienceSource: "traffic",
      remarketingAudienceManual: 0,
      brandingWarmAudience: engagement.brandingWarmAudience,
      trafficWebsiteVisitors: traffic.websiteVisitors,
      ...CONVERSION_RATES,
    });

    expect(conversion.activeRemarketingAudience).toBe(1_749);
    expect(conversion.impressions).toBe(12_243);
    expect(conversion.calculatedBudget).toBe(306_075);
  });

  it("cross-selling increases total service units, not reduces them", () => {
    expect(applyCrossSelling(13, 20)).toBe(15);
    expect(applyCrossSelling(13, 0)).toBe(13);
  });

  it("engagement frequency ≤ 0 yields zero funnel (no divide-by-zero artifacts)", () => {
    const zero = calculateEngagementResults({ ...ENGAGEMENT, brandingFrequency: 0 });
    expect(zero.brandingWarmAudience).toBe(0);
  });

  it("traffic Google path: CPC-driven clicks then impressions from CTR", () => {
    const google = calculateTrafficResults({
      adType: "google",
      budget: 3_000_000,
      cpm: 0,
      cpc: 2_500,
      ctrLink: 2,
      adsClickToVisit: 65,
    });
    expect(google.adClicks).toBe(1_200);
    expect(google.impressions).toBe(60_000);
    expect(google.websiteVisitors).toBe(780);
  });
});
