import { describe, expect, it } from "vitest";
import {
  aggregateInsightBaseline,
  computeInsightBaselineGapPercentage,
  insightAccountBaseline,
} from "@/6-0-social-media-performance-shared/insightTargetBaseline";
import { computeInsightTargetProgress } from "@/6-0-social-media-performance-shared/insightTargetProgress";
import type { SocialMediaInsightTargetRow } from "@/6-0-social-media-performance-shared/socialMediaInsightTargetTypes";
import type {
  SocialMediaInsightAccountRow,
  SocialMediaInsightSummary,
} from "@/6-0-social-media-performance-shared/socialMediaInsightTypes";
import type { GoogleAdsDateRangeSelection } from "@/6-0-google-ads/lib/googleAdsDatePresets";
import type { PlatformPeriodActuals } from "@/6-0-social-media-performance-shared/insightTargetPlatformActuals";

describe("computeInsightBaselineGapPercentage", () => {
  it("measures how much of the before-to-target gap is covered", () => {
    expect(computeInsightBaselineGapPercentage(80, 50, 100)).toBe(60);
  });

  it("returns 100 when current already equals the target and the gap is zero", () => {
    expect(computeInsightBaselineGapPercentage(100, 100, 100)).toBe(100);
  });
});

describe("insightAccountBaseline", () => {
  it("prefers a saved override over the previous actual", () => {
    expect(insightAccountBaseline({ saved: 40, previousActual: 80 })).toBe(40);
  });

  it("uses the previous actual when nothing was saved", () => {
    expect(insightAccountBaseline({ saved: null, previousActual: 80 })).toBe(80);
  });
});

function account(): SocialMediaInsightAccountRow {
  return {
    platform: "tiktok",
    accountId: "acc-1",
    accountLabel: "Account",
    avatarUrl: null,
    connected: true,
    loading: false,
    error: null,
    audienceCount: 80,
    audienceHidden: false,
    audienceLabel: "followers",
    contentCount: 1,
    totalViews: 80,
    totalLikes: 1,
    totalComments: 0,
    totalShares: 0,
    avgEngagementRate: 0.25,
    matchedPlans: 0,
    totalContent: 1,
    hasUnmappedContent: false,
    settingsPath: "",
    performancePath: "",
    isPlatformPlaceholder: false,
  };
}

function targetRow(baseline: number | null): SocialMediaInsightTargetRow {
  return {
    id: "row-1",
    organization_id: "org",
    platform: "tiktok",
    account_id: "acc-1",
    metric: "views",
    period_type: "monthly",
    year: 2026,
    month: 9,
    quarter: null,
    target_value: 100,
    baseline_value: baseline,
    individual_objective_id: null,
    created_at: "",
    updated_at: "",
  };
}

const summary: SocialMediaInsightSummary = {
  totalAudience: 80,
  totalViews: 80,
  totalLikes: 1,
  totalComments: 0,
  totalShares: 0,
  avgEngagementRate: 0.25,
};

const selection: GoogleAdsDateRangeSelection = {
  preset: "last_month",
  rollingDays: 30,
  range: { from: new Date(2026, 8, 1), to: new Date(2026, 8, 30) },
};

const previousActuals: Record<string, PlatformPeriodActuals> = {
  "tiktok:acc-1": {
    audience: 70,
    views: 50,
    likes: 1,
    comments: 0,
    shares: 0,
    avgEngagementRate: 0.2,
    hasConnectedAccount: true,
  },
};

describe("aggregateInsightBaseline", () => {
  it("sums previous views for accounts that have a target", () => {
    const rowsByCell = new Map([["tiktok:acc-1:views", targetRow(null)]]);
    const targetMap = new Map([["tiktok:acc-1:views", 100]]);
    expect(
      aggregateInsightBaseline({
        metric: "views",
        accounts: [account()],
        targetMap,
        rowsByCell,
        previousActualsByAccount: previousActuals,
      }),
    ).toBe(50);
  });
});

describe("computeInsightTargetProgress baseline", () => {
  it("shows before → current progress for a completed month", () => {
    const [views] = computeInsightTargetProgress({
      summary,
      accounts: [account()],
      platformFilter: "tiktok",
      dateSelection: selection,
      targetRows: [targetRow(null)],
      previousActualsByAccount: previousActuals,
      now: new Date(2026, 9, 15),
    }).filter((item) => item.metric === "views");

    expect(views.baseline).toBe(50);
    expect(views.actual).toBe(80);
    expect(views.target).toBe(100);
    expect(views.percentage).toBe(60);
  });

  it("uses a saved before value instead of the previous actual", () => {
    const [views] = computeInsightTargetProgress({
      summary,
      accounts: [account()],
      platformFilter: "tiktok",
      dateSelection: selection,
      targetRows: [targetRow(40)],
      previousActualsByAccount: previousActuals,
      now: new Date(2026, 9, 15),
    }).filter((item) => item.metric === "views");

    expect(views.baseline).toBe(40);
    expect(views.percentage).toBe(Math.round(((80 - 40) / (100 - 40)) * 100));
  });
});
