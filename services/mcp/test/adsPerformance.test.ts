import { describe, expect, it, vi } from "vitest";
import { MCP_TOOLS } from "../src/mcp/registry";
import { listAdsPerformance } from "../src/db/adsPerformance";
import {
  parseAdsPerformanceQuery,
  presentAdsPerformance,
  resolveAdsPerformancePeriod,
  type AdsPerformanceSourceRow,
} from "../src/tools/ads/performanceSummary";

const now = new Date("2026-11-02T02:00:00.000Z");

function row(overrides: Partial<AdsPerformanceSourceRow> & Pick<AdsPerformanceSourceRow, "platform" | "account_id">): AdsPerformanceSourceRow {
  return {
    label: null,
    currency: "IDR",
    spend: 0,
    impressions: 0,
    clicks: 0,
    reach: null,
    results: 0,
    results_label: "conversions",
    result_value: null,
    error: null,
    note: null,
    ...overrides,
  };
}

describe("ads performance period", () => {
  it("uses the ads page default of the last 30 Jakarta days when no range is passed", () => {
    expect(resolveAdsPerformancePeriod({
      month: null,
      dateStart: null,
      dateEnd: null,
      platform: null,
    }, now)).toEqual({ start: "2026-10-04", end: "2026-11-02", clipped: false });
  });

  it("keeps a past month and rejects a future month", () => {
    expect(resolveAdsPerformancePeriod({
      month: "2026-10",
      dateStart: null,
      dateEnd: null,
      platform: null,
    }, now)).toEqual({ start: "2026-10-01", end: "2026-10-31", clipped: false });
    expect(() => resolveAdsPerformancePeriod({
      month: "2026-12",
      dateStart: null,
      dateEnd: null,
      platform: null,
    }, now)).toThrow("invalid_input");
  });

  it("cuts a range longer than 366 days back from the end", () => {
    expect(resolveAdsPerformancePeriod({
      month: null,
      dateStart: "2025-01-01",
      dateEnd: "2026-11-02",
      platform: null,
    }, now)).toEqual({ start: "2025-11-02", end: "2026-11-02", clipped: true });
  });

  it("rejects a month combined with dates", () => {
    expect(parseAdsPerformanceQuery({
      month: "2026-10",
      date_start: "2026-10-01",
      date_end: "2026-10-31",
    })).toBeNull();
  });
});

describe("ads performance comparison", () => {
  it("names the account and metric leaders", () => {
    const summary = presentAdsPerformance({
      period: { start: "2026-11-01", end: "2026-11-02", clipped: false },
      truncated: false,
      accounts: [
        row({
          platform: "google",
          label: "Brand",
          account_id: "111",
          spend: 1_000_000,
          impressions: 100_000,
          clicks: 2_000,
          results: 40,
          results_label: "conversions",
          result_value: 3_000_000,
        }),
        row({
          platform: "meta",
          label: "Shop",
          account_id: "222",
          spend: 500_000,
          impressions: 200_000,
          clicks: 1_000,
          results: 10,
          results_label: "purchases",
          result_value: 400_000,
        }),
      ],
    });

    expect(summary.performance_leader).toMatchObject({
      platform: "google",
      account_id: "111",
      leading_metrics: ["roas", "cost_per_result", "ctr"],
    });
    expect(summary.accounts.find((account) => account.account_id === "222")?.leading_metrics).toEqual(["cpm"]);
    expect(summary.leaders.map((leader) => leader.metric)).not.toContain("cpc");
    expect(summary.comparisons).toEqual([
      "google Brand is the performance leader because it leads roas, cost_per_result, ctr.",
      "google Brand has the highest ROAS at 3.",
      "google Brand has the lowest cost per conversion at 25000 IDR.",
      "google Brand has the highest CTR at 2%.",
      "meta Shop has the lowest CPM at 2500 IDR.",
    ]);
    expect(summary.readings).toEqual([
      "google Brand ROAS 3 covers spend.",
      "meta Shop ROAS 0.8 is below spend.",
    ]);
  });

  it("does not compare money metrics across currencies", () => {
    const summary = presentAdsPerformance({
      period: { start: "2026-11-01", end: "2026-11-02", clipped: false },
      truncated: false,
      accounts: [
        row({
          platform: "google",
          label: "Brand",
          account_id: "111",
          currency: "IDR",
          spend: 100,
          impressions: 1_000,
          clicks: 10,
          results: 1,
          result_value: 300,
        }),
        row({
          platform: "meta",
          label: "Shop",
          account_id: "222",
          currency: "USD",
          spend: 100,
          impressions: 1_000,
          clicks: 30,
          results: 1,
          results_label: "purchases",
          result_value: 500,
        }),
      ],
    });

    expect(summary.leaders.map((leader) => leader.metric)).toEqual(["ctr"]);
    expect(summary.notes).toContain("Money metrics are compared only inside the same currency.");
  });

  it("does not treat a failed account as zero", () => {
    const summary = presentAdsPerformance({
      period: { start: "2026-11-01", end: "2026-11-02", clipped: false },
      truncated: false,
      accounts: [
        row({
          platform: "google",
          label: "Brand",
          account_id: "111",
          spend: 100,
          impressions: 1_000,
          clicks: 10,
          results: 2,
          result_value: 250,
        }),
        row({
          platform: "meta",
          label: "Shop",
          account_id: "222",
          spend: null,
          impressions: null,
          clicks: null,
          results: null,
          results_label: "purchases",
          result_value: null,
          error: "Meta Ads is not connected for this account.",
        }),
      ],
    });

    expect(summary.leaders).toEqual([]);
    expect(summary.accounts.find((account) => account.account_id === "222")?.status).toBe("unavailable");
    expect(summary.notes).toContain("Some accounts could not be loaded. Do not treat them as zero.");
    expect(summary.readings).toEqual(["google Brand ROAS 2.5 covers spend."]);
    expect(summary.how_to_read).toContain("not the campaign tab");
  });

  it("keeps the highest-spend campaign rows when the payload matches the dashboard", () => {
    const summary = presentAdsPerformance({
      period: { start: "2026-10-04", end: "2026-11-02", clipped: false },
      matches_dashboard: true,
      truncated: false,
      accounts: [
        row({
          platform: "google",
          label: "Brand",
          account_id: "111",
          spend: 100,
          impressions: 1_000,
          clicks: 10,
          results: 2,
          result_value: 250,
          campaigns_truncated: true,
          campaigns: [{
            id: "c1",
            name: "Search Brand",
            spend: 80,
            impressions: 800,
            clicks: 8,
            reach: null,
            results: 2,
            results_label: "conversions",
            result_value: 250,
          }],
        }),
      ],
    });

    expect(summary.how_to_read).toContain("campaign tab");
    expect(summary.accounts[0]?.campaigns_truncated).toBe(true);
    expect(summary.accounts[0]?.campaigns[0]).toMatchObject({
      id: "c1",
      name: "Search Brand",
      spend: 80,
      ctr: 1,
      roas: 3.13,
    });
  });
});

describe("ads performance fetch", () => {
  const config = {
    supabaseUrl: "https://db.example",
    supabaseServiceRoleKey: "service-key",
    scheduledPostsInternalSecret: "super-secret-value",
  };
  const ctx = { userId: "user-1", organizationId: "org-1" };

  it("asks the metrics function for the resolved period and hides the internal secret", async () => {
    const period = resolveAdsPerformancePeriod({
      month: null,
      dateStart: null,
      dateEnd: null,
      platform: "meta",
    });
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      period,
      truncated: false,
      accounts: [
        row({
          platform: "meta",
          label: "Shop",
          account_id: "222",
          spend: 100,
          impressions: 1_000,
          clicks: 10,
          results: 1,
          results_label: "purchases",
          result_value: 50,
          error: "super-secret-value leaked",
        }),
      ],
    }), { status: 200 }));

    const summary = await listAdsPerformance(config, ctx, {
      month: null,
      dateStart: null,
      dateEnd: null,
      platform: "meta",
    }, fetchImpl as typeof fetch);

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://db.example/functions/v1/mcp-ads-performance");
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer service-key");
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(body).toMatchObject({
      organization_id: "org-1",
      mcp_user_id: "user-1",
      internal_secret: "super-secret-value",
      date_start: period.start,
      date_end: period.end,
      platform: "meta",
    });
    expect(JSON.stringify(summary)).not.toContain("super-secret-value");
    expect(summary.accounts[0]?.error).toBe("leaked");
    expect(summary.accounts[0]?.status).toBe("unavailable");
  });

  it("remembers that a long range was shortened", async () => {
    const query = {
      month: null,
      dateStart: "2020-01-01",
      dateEnd: "2024-01-01",
      platform: null as const,
    };
    const period = resolveAdsPerformancePeriod(query);
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      period: { ...period, clipped: false },
      truncated: false,
      accounts: [],
    }), { status: 200 }));

    const summary = await listAdsPerformance(config, ctx, query, fetchImpl as typeof fetch);
    const body = JSON.parse(String((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].body)) as {
      date_start: string;
    };
    expect(body.date_start).toBe(period.start);
    expect(summary.period.clipped).toBe(true);
    expect(summary.notes).toContain("The requested range was longer than 366 days, so it was cut to the latest 366 days.");
  });

  it("turns a forbidden response into forbidden", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ error: "forbidden" }), { status: 403 }));
    await expect(listAdsPerformance(config, ctx, {
      month: "2020-01",
      dateStart: null,
      dateEnd: null,
      platform: null,
    }, fetchImpl as typeof fetch)).rejects.toThrow("forbidden");
  });
});

describe("ads tool catalog", () => {
  it("points account listing at the performance summary", () => {
    const accounts = MCP_TOOLS.find((tool) => tool.name === "ads.accounts.list");
    const performance = MCP_TOOLS.find((tool) => tool.name === "ads.performance.summary");
    expect(accounts?.description).toContain("ads.performance.summary");
    expect(performance?.scopes).toEqual(["ads:read"]);
    expect(performance?.pagePaths).toEqual(accounts?.pagePaths);
  });
});
