import { describe, expect, it, vi } from "vitest";
import { MCP_TOOLS } from "../src/mcp/registry";
import { listAdsAudience, listAdsSegments } from "../src/db/adsPerformance";
import { parseAdsAudienceQuery, presentAdsAudience, whereText, whoText } from "../src/tools/ads/audienceList";
import { parseAdsSegmentsQuery, presentAdsSegments } from "../src/tools/ads/performanceSegments";
// Edge function helpers are plain TypeScript with no Deno globals, so they run here too.
import { summarizeAudience } from "../../../supabase/functions/mcp-ads-performance/metaAudience.ts";
import { scopeGoal, segmentBuckets } from "../../../supabase/functions/mcp-ads-performance/metaSegments.ts";

const chats = (count: number) => [{ action_type: "onsite_conversion.messaging_conversation_started_7d", value: String(count) }];

describe("audience summary from Meta targeting", () => {
  const targeting = {
    geo_locations: {
      custom_locations: [{ latitude: -6.1102, longitude: 106.7405, radius: 3, distance_unit: "kilometer", name: "Komplek Katamaran" }],
      location_types: ["home", "recent"],
    },
    excluded_geo_locations: { cities: [{ key: "1", name: "Tangerang", region: "Banten" }] },
    age_min: 25,
    age_max: 55,
    genders: [1],
    flexible_spec: [{ interests: [{ id: "1", name: "Kuliner" }, { id: "2", name: "Sate" }] }],
    targeting_automation: { advantage_audience: 0 },
    publisher_platforms: ["instagram", "facebook"],
    instagram_positions: ["stream", "reels"],
  };

  it("reads the radius pin, exclusions, age, gender, interests, and placements", () => {
    const summary = summarizeAudience(targeting, [{ content: "Location:", children: ["Komplek Katamaran (+3 km)"] }]);
    expect(summary.locations[0]).toMatchObject({ type: "radius", name: "Komplek Katamaran", radius: 3, unit: "kilometer" });
    expect(summary.excluded_locations[0]).toMatchObject({ type: "city", name: "Tangerang, Banten" });
    expect(summary).toMatchObject({ age_min: 25, age_max: 55, genders: "male", advantage_audience: false });
    expect(summary.interests).toEqual(["Kuliner", "Sate"]);
    expect(summary.placements).toEqual(["instagram: stream, reels", "facebook"]);
    expect(summary.sentence_lines).toEqual(["Location: Komplek Katamaran (+3 km)"]);
    expect(whereText(summary)).toBe("3 km around Komplek Katamaran, excluding Tangerang, Banten");
    expect(whoText(summary)).toBe("age 25-55, male, interests: Kuliner, Sate");
  });

  it("treats missing placements as automatic and empty targeting as all ages", () => {
    const summary = summarizeAudience({}, null);
    expect(summary.placements).toEqual(["automatic (Advantage+ placements)"]);
    expect(whoText(summary)).toBe("all ages, all genders, no interest targeting");
    expect(whereText(summary)).toBeNull();
  });
});

describe("segment buckets", () => {
  const campaigns = [
    { campaign_id: "100", spend: "5000", objective: "OUTCOME_SALES", optimization_goals: ["CONVERSATIONS"] },
    { campaign_id: "200", spend: "0", objective: "OUTCOME_TRAFFIC" },
  ];

  it("counts chats per segment when every spending campaign is a chat campaign", () => {
    const scope = scopeGoal(campaigns, null);
    expect(scope).toMatchObject({ label: "messaging conversations started", mixed: false });
    const buckets = segmentBuckets("placement", [
      { publisher_platform: "instagram", platform_position: "instagram_reels", spend: "3000", impressions: "900", inline_link_clicks: "20", actions: chats(6) },
      { publisher_platform: "facebook", platform_position: "feed", spend: "2000", impressions: "700", inline_link_clicks: "9", actions: chats(2) },
    ], scope.goal);
    expect(buckets).toEqual([
      { key: "instagram / instagram_reels", spend: 3000, impressions: 900, clicks: 20, reach: 0, results: 6, results_label: "messaging conversations started" },
      { key: "facebook / feed", spend: 2000, impressions: 700, clicks: 9, reach: 0, results: 2, results_label: "messaging conversations started" },
    ]);
  });

  it("leaves results empty when campaigns in scope count different results", () => {
    const scope = scopeGoal(campaigns, new Set(["100", "200"]));
    expect(scope).toMatchObject({ goal: null, label: null, mixed: true });
    const [bucket] = segmentBuckets("age", [{ age: "25-34", spend: "10", impressions: "5", actions: chats(1) }], scope.goal);
    expect(bucket.results).toBeNull();
  });

  it("normalizes hour keys", () => {
    const buckets = segmentBuckets("hour", [
      { hourly_stats_aggregated_by_advertiser_time_zone: "19:00:00 - 19:59:59", spend: "10", impressions: "10" },
    ], null);
    expect(buckets[0].key).toBe("19:00");
  });
});

describe("segments presenter", () => {
  it("orders hours, names the cheapest bucket, and ignores tiny buckets on cost", () => {
    const view = presentAdsSegments({
      period: { start: "2026-11-01", end: "2026-11-02", clipped: false },
      truncated: false,
      accounts: [{
        platform: "meta",
        label: "Sate Sultan PIK",
        account_id: "1732838271125755",
        currency: "IDR",
        spend: 510_000,
        impressions: 13_000,
        clicks: 240,
        reach: 10_000,
        segment_results_label: "messaging conversations started",
        segments: {
          hour: {
            buckets: [
              { key: "19:00", spend: 200_000, impressions: 5_000, clicks: 100, reach: null, results: 30, results_label: "messaging conversations started" },
              { key: "12:00", spend: 300_000, impressions: 7_500, clicks: 130, reach: null, results: 30, results_label: "messaging conversations started" },
              { key: "03:00", spend: 10_000, impressions: 500, clicks: 10, reach: null, results: 4, results_label: "messaging conversations started" },
            ],
            error: null,
          },
        },
        error: null,
        note: null,
      }],
    }, ["hour"]);
    const hour = view.accounts[0].segments.hour!;
    expect(hour.buckets.map((bucket) => bucket.key)).toEqual(["03:00", "12:00", "19:00"]);
    expect(hour.buckets[2]).toMatchObject({ label: "19:00–20:00", cost_per_result: 6666.67, share_of_results: 46.9 });
    expect(hour.best.lowest_cost_per_result).toBe("19:00");
    expect(view.readings[0]).toContain("by hour, 19:00–20:00 has the lowest cost per messaging conversations started");
  });

  it("rejects more than one scope id", () => {
    expect(parseAdsSegmentsQuery({ campaign_id: "1", adset_id: "2" })).toBeNull();
    expect(parseAdsSegmentsQuery({ dimensions: ["city"] })).toBeNull();
    expect(parseAdsSegmentsQuery({ dimensions: ["hour", "hour"], ad_id: "act_9" })).toMatchObject({ dimensions: ["hour"], adId: "9" });
  });
});

describe("audience and segments doors", () => {
  const config = { supabaseUrl: "https://db.example", supabaseServiceRoleKey: "service-key", scheduledPostsInternalSecret: "super-secret-value" };
  const ctx = { userId: "user-1", organizationId: "org-1" };
  const period = { start: "2026-11-01", end: "2026-11-02", clipped: false };

  it("asks for audience mode and hides the secret", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      period,
      truncated: false,
      accounts: [{
        platform: "meta", label: "Shop", account_id: "222", currency: "IDR", error: null, note: null,
        audiences: [{
          adset_id: "5", adset_name: "PIK 3km super-secret-value", campaign_id: "100", campaign_name: "C", delivery: "Active",
          spend: 100, impressions: 10, clicks: 1, results: 4, results_label: "messaging conversations started",
          audience: summarizeAudience({ age_min: 21 }, []), error: null,
        }],
      }],
    }), { status: 200 }));
    const result = await listAdsAudience(config, ctx, parseAdsAudienceQuery({ date_start: "2026-11-01", date_end: "2026-11-02", adset_id: "5" })!, fetchImpl as typeof fetch);
    const body = JSON.parse(String((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(body).toMatchObject({ mode: "audience", platform: "meta", adset_id: "5", date_start: "2026-11-01" });
    expect(JSON.stringify(result)).not.toContain("super-secret-value");
    expect(result.accounts[0].adsets[0]).toMatchObject({ adset_name: "PIK 3km", cost_per_result: 25, where: null });
    expect(presentAdsAudience({ period, truncated: false, accounts: [] }).notes[0]).toContain("No active Meta ad account");
  });

  it("asks for segments mode with the requested dimensions", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      period, truncated: false,
      accounts: [{ platform: "meta", label: "Shop", account_id: "222", currency: "IDR", spend: 0, impressions: 0, clicks: 0, reach: 0, segments: {}, error: null, note: null }],
    }), { status: 200 }));
    await listAdsSegments(config, ctx, parseAdsSegmentsQuery({ dimensions: ["age", "hour"], campaign_id: "100" })!, fetchImpl as typeof fetch);
    const body = JSON.parse(String((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(body).toMatchObject({ mode: "segments", platform: "meta", dimensions: ["age", "hour"], campaign_id: "100" });
  });
});

describe("audience and segments catalog", () => {
  it("shares the ads gate and is pointed to from the breakdown", () => {
    const breakdown = MCP_TOOLS.find((tool) => tool.name === "ads.performance.breakdown");
    for (const name of ["ads.audience.list", "ads.performance.segments"] as const) {
      const tool = MCP_TOOLS.find((item) => item.name === name);
      expect(breakdown?.description).toContain(name);
      expect(tool?.scopes).toEqual(["ads:read"]);
      expect(tool?.pagePaths).toEqual(breakdown?.pagePaths);
      expect(tool?.mutates).toBeUndefined();
    }
  });
});
