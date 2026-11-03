import { describe, expect, it, vi } from "vitest";
import { MCP_TOOLS } from "../src/mcp/registry";
import { listAdsBreakdown } from "../src/db/adsPerformance";
import {
  parseAdsBreakdownQuery,
  presentAdsBreakdown,
  type AdsBreakdownSourceItem,
} from "../src/tools/ads/performanceBreakdown";
// The edge function helper is plain TypeScript with no Deno globals, so it runs here too.
import { breakdownRows } from "../../../supabase/functions/mcp-ads-performance/metaBreakdown.ts";

function item(overrides: Partial<AdsBreakdownSourceItem> & Pick<AdsBreakdownSourceItem, "id" | "name">): AdsBreakdownSourceItem {
  return {
    campaign_id: "100",
    campaign_name: "Campaign Sate Sultan PIK",
    adset_id: "200",
    adset_name: "Ad set PIK",
    delivery: "Active",
    spend: 0,
    impressions: 0,
    clicks: 0,
    reach: 0,
    results: 0,
    results_label: "messaging conversations started",
    result_value: null,
    ...overrides,
  };
}

describe("ads breakdown input", () => {
  it("defaults to the ad level and strips the act_ prefix", () => {
    expect(parseAdsBreakdownQuery({ account_id: "act_1732838271125755" })).toEqual({
      level: "ad",
      month: null,
      dateStart: null,
      dateEnd: null,
      accountId: "1732838271125755",
      campaignId: null,
    });
  });

  it("rejects a month with dates, half a range, and non-numeric ids", () => {
    expect(parseAdsBreakdownQuery({ month: "2026-11", date_start: "2026-11-01", date_end: "2026-11-02" })).toBeNull();
    expect(parseAdsBreakdownQuery({ date_start: "2026-11-01" })).toBeNull();
    expect(parseAdsBreakdownQuery({ campaign_id: "abc" })).toBeNull();
    expect(parseAdsBreakdownQuery({ level: "campaign" })).toBeNull();
  });
});

describe("ads breakdown ranking", () => {
  const source = {
    period: { start: "2026-11-02", end: "2026-11-02", clipped: false },
    truncated: false,
    accounts: [{
      platform: "meta",
      label: "Sate Sultan PIK",
      account_id: "1732838271125755",
      currency: "IDR",
      spend: 261_278,
      impressions: 6_772,
      clicks: 133,
      reach: 5_870,
      rows: [
        item({ id: "a1", name: "Video bakar", spend: 150_000, impressions: 3_800, clicks: 80, results: 15 }),
        item({ id: "a2", name: "Foto menu", spend: 100_000, impressions: 2_700, clicks: 48, results: 18 }),
        item({ id: "a3", name: "Carousel", spend: 11_278, impressions: 272, clicks: 5, results: 0 }),
      ],
      error: null,
      note: null,
    }],
  };

  it("ranks by spend and names the cheapest result, the most results, and idle spend", () => {
    const breakdown = presentAdsBreakdown(source, "ad");
    const account = breakdown.accounts[0];
    expect(account.rows.map((row) => [row.rank, row.id])).toEqual([[1, "a1"], [2, "a2"], [3, "a3"]]);
    expect(account.rows[1]).toMatchObject({ cost_per_result: 5555.56, cpm: 37037.04, ctr: 1.78, share_of_results: 54.5 });
    expect(account.best.lowest_cost_per_result).toBe("a2");
    expect(account.best.most_results).toBe("a2");
    expect(account.best.lowest_cpm).toBe("a2");
    expect(account.best.highest_ctr).toBe("a1");
    expect(account.cpm).toBe(38582.1);
    expect(breakdown.readings.join(" ")).toContain("Foto menu has the lowest cost per messaging conversations started");
    expect(breakdown.readings.join(" ")).toContain("1 ad spent without a result: Carousel.");
  });

  it("does not crown a tiny row on cost per result", () => {
    const breakdown = presentAdsBreakdown({
      ...source,
      accounts: [{
        ...source.accounts[0],
        rows: [
          item({ id: "big", name: "Big", spend: 250_000, impressions: 6_000, clicks: 120, results: 30 }),
          item({ id: "tiny", name: "Tiny", spend: 2_000, impressions: 60, clicks: 1, results: 1 }),
        ],
      }],
    }, "ad");
    expect(breakdown.accounts[0].best.lowest_cost_per_result).toBeNull();
    expect(breakdown.accounts[0].best.most_results).toBe("big");
  });

  it("keeps an unavailable account visible instead of zero", () => {
    const breakdown = presentAdsBreakdown({
      ...source,
      accounts: [{ ...source.accounts[0], rows: [], error: "Meta Ads authorization expired. Reconnect the account." }],
    }, "adset");
    expect(breakdown.accounts[0].status).toBe("unavailable");
    expect(breakdown.accounts[0].spend).toBeNull();
    expect(breakdown.notes).toContain("Meta ad performance could not be loaded.");
  });
});

describe("ads breakdown door", () => {
  const config = {
    supabaseUrl: "https://db.example",
    supabaseServiceRoleKey: "service-key",
    scheduledPostsInternalSecret: "super-secret-value",
  };
  const ctx = { userId: "user-1", organizationId: "org-1" };

  it("asks the same function for Meta rows at the requested level and hides the secret", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      period: { start: "2026-11-01", end: "2026-11-02", clipped: false },
      level: "adset",
      truncated: false,
      accounts: [{
        platform: "meta",
        label: "Shop",
        account_id: "222",
        currency: "IDR",
        spend: 10,
        impressions: 100,
        clicks: 1,
        reach: 90,
        rows: [item({ id: "s1", name: "Set super-secret-value", spend: 10, impressions: 100, clicks: 1, results: 1 })],
        error: null,
        note: null,
      }],
    }), { status: 200 }));

    const breakdown = await listAdsBreakdown(config, ctx, {
      level: "adset",
      month: null,
      dateStart: "2026-11-01",
      dateEnd: "2026-11-02",
      accountId: "222",
      campaignId: "100",
    }, fetchImpl as typeof fetch);

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://db.example/functions/v1/mcp-ads-performance");
    expect(JSON.parse(String(init.body))).toMatchObject({
      organization_id: "org-1",
      mcp_user_id: "user-1",
      date_start: "2026-11-01",
      date_end: "2026-11-02",
      platform: "meta",
      level: "adset",
      account_id: "222",
      campaign_id: "100",
    });
    expect(JSON.stringify(breakdown)).not.toContain("super-secret-value");
    expect(breakdown.level).toBe("adset");
    expect(breakdown.accounts[0].rows[0].name).toBe("Set");
  });
});

describe("edge function breakdown rows", () => {
  it("borrows the campaign objective so a sales campaign set up for chats counts chats", () => {
    const campaignRows = [{ campaign_id: "100", objective: "OUTCOME_SALES", optimization_goals: ["CONVERSATIONS"] }];
    const adRows = [
      {
        campaign_id: "100",
        campaign_name: "Campaign",
        adset_id: "200",
        adset_name: "Set",
        ad_id: "300",
        ad_name: "Video",
        spend: "5000",
        impressions: "1000",
        clicks: "10",
        reach: "900",
        delivery: "Active",
        purchases: 0,
        actions: [{ action_type: "onsite_conversion.messaging_conversation_started_7d", value: "4" }],
      },
      { campaign_id: "999", ad_id: "301", ad_name: "Other", spend: "9000", actions: [] },
    ];
    const all = breakdownRows("ad", adRows, campaignRows, null);
    expect(all.rows.map((row) => row.id)).toEqual(["301", "300"]);
    expect(all.rows[1]).toMatchObject({
      name: "Video",
      adset_name: "Set",
      results: 4,
      results_label: "messaging conversations started",
      spend: 5000,
    });

    const one = breakdownRows("ad", adRows, campaignRows, "100");
    expect(one.rows.map((row) => row.id)).toEqual(["300"]);
  });
});

describe("ads breakdown catalog", () => {
  it("shares the summary's scope and pages and is pointed to from the summary", () => {
    const summary = MCP_TOOLS.find((tool) => tool.name === "ads.performance.summary");
    const breakdown = MCP_TOOLS.find((tool) => tool.name === "ads.performance.breakdown");
    expect(summary?.description).toContain("ads.performance.breakdown");
    expect(breakdown?.scopes).toEqual(["ads:read"]);
    expect(breakdown?.pagePaths).toEqual(summary?.pagePaths);
    expect(breakdown?.mutates).toBeUndefined();
  });
});
