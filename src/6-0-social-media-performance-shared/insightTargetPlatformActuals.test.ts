import { describe, expect, it } from "vitest";
import {
  aggregateEngagementTargetsWeighted,
  summarizeAccountsActuals,
  type PlatformPeriodActuals,
} from "./insightTargetPlatformActuals";

const connected = (
  partial: Partial<PlatformPeriodActuals>,
): PlatformPeriodActuals => ({
  audience: null,
  views: 0,
  likes: 0,
  comments: 0,
  shares: 0,
  avgEngagementRate: null,
  hasConnectedAccount: true,
  ...partial,
});

describe("summarizeAccountsActuals", () => {
  it("uses views-weighted average for avg engagement total", () => {
    const summary = summarizeAccountsActuals([
      connected({ views: 12_870, avgEngagementRate: 2.92 }),
      connected({ views: 4_738, avgEngagementRate: null }),
      connected({ views: 1_249, avgEngagementRate: 1.2 }),
    ]);

    const expected = (2.92 * 12_870 + 1.2 * 1_249) / (12_870 + 1_249);
    expect(summary.avgEngagementRate).toBeCloseTo(expected, 5);
    expect(summary.avgEngagementRate).not.toBeCloseTo((2.92 + 1.2) / 2, 5);
  });
});

describe("aggregateEngagementTargetsWeighted", () => {
  it("weights target engagement by account views", () => {
    const accounts = [
      { platform: "tiktok" as const, accountId: "a1", accountLabel: "A1", avatarUrl: null },
      { platform: "tiktok" as const, accountId: "a2", accountLabel: "A2", avatarUrl: null },
      { platform: "youtube" as const, accountId: "a3", accountLabel: "A3", avatarUrl: null },
    ];
    const actualsById: Record<string, PlatformPeriodActuals> = {
      a1: connected({ views: 12_870 }),
      a2: connected({ views: 4_738 }),
      a3: connected({ views: 1_249 }),
    };
    const formMap = {
      "tiktok:a1:avg_engagement_rate": "3",
      "tiktok:a2:avg_engagement_rate": "4",
      "youtube:a3:avg_engagement_rate": "5",
    };

    const total = aggregateEngagementTargetsWeighted(
      accounts,
      (account) => actualsById[account.accountId],
      formMap,
    );

    const expected = (3 * 12_870 + 4 * 4_738 + 5 * 1_249) / (12_870 + 4_738 + 1_249);
    expect(total).toBeCloseTo(expected, 5);
    expect(total).not.toBeCloseTo(4, 5);
  });
});
