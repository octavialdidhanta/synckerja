import { describe, expect, it } from "vitest";
import {
  dashboardStateToSearchParams,
  parseDashboardUrlState,
} from "./dashboardUrlState";

describe("parseDashboardUrlState", () => {
  it("defaults to summary tab and today preset", () => {
    const state = parseDashboardUrlState(new URLSearchParams());
    expect(state.tab).toBe("summary");
    expect(state.outletId).toBeNull();
    expect(state.compareOutletIds).toEqual([]);
    expect(state.dateRange.preset).toBe("today");
    expect(state.dateRange.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(state.dateRange.to).toBe(state.dateRange.from);
  });

  it("parses comparison tab, outlet, and capped compareOutletIds", () => {
    const ids = [
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
      "33333333-3333-4333-8333-333333333333",
      "44444444-4444-4444-8444-444444444444",
      "55555555-5555-4555-8555-555555555555",
      "66666666-6666-4666-8666-666666666666",
    ];
    const params = new URLSearchParams({
      tab: "comparison",
      outletId: ids[0],
      compareOutletIds: [...ids, "not-a-uuid"].join(","),
      preset: "this_month",
      from: "2026-09-01",
      to: "2026-09-30",
    });
    const state = parseDashboardUrlState(params);
    expect(state.tab).toBe("comparison");
    expect(state.outletId).toBe(ids[0]);
    expect(state.compareOutletIds).toEqual(ids.slice(0, 5));
    expect(state.dateRange).toEqual({
      preset: "this_month",
      from: "2026-09-01",
      to: "2026-09-30",
    });
  });
});

describe("dashboardStateToSearchParams", () => {
  it("serializes shareable filter state", () => {
    const params = dashboardStateToSearchParams({
      tab: "comparison",
      outletId: "11111111-1111-4111-8111-111111111111",
      compareOutletIds: [
        "11111111-1111-4111-8111-111111111111",
        "22222222-2222-4222-8222-222222222222",
      ],
      dateRange: { preset: "today", from: "2026-09-05", to: "2026-09-05" },
    });
    expect(params.get("tab")).toBe("comparison");
    expect(params.get("outletId")).toBe("11111111-1111-4111-8111-111111111111");
    expect(params.get("compareOutletIds")).toBe(
      "11111111-1111-4111-8111-111111111111,22222222-2222-4222-8222-222222222222",
    );
    expect(params.get("preset")).toBe("today");
    expect(params.get("from")).toBe("2026-09-05");
    expect(params.get("to")).toBe("2026-09-05");
  });
});
