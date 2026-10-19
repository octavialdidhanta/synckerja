import { describe, expect, it } from "vitest";
import { computeFunnelStats } from "@/6-1-dashboard/lib/contentPillarTracker";
import type { PillarData } from "@/6-1-dashboard/types/social-media";
import type { LabContentPillar } from "@/thinking-lab/execution/pillars";
import { monthFunnelStats, pillarMonthCount, pillarsInFunnel } from "@/thinking-lab/execution/pillarUsage";

function pillar(overrides: Partial<LabContentPillar> & Pick<LabContentPillar, "id" | "name">): LabContentPillar {
  return {
    funnel: "top",
    category: null,
    isDefault: false,
    ...overrides,
  };
}

function usage(overrides: Partial<PillarData> & Pick<PillarData, "pillar_id" | "pillar_name" | "count" | "funnel">): PillarData {
  return { isDefault: false, ...overrides };
}

describe("pillar month usage", () => {
  const pillars = [
    pillar({ id: "used", name: "Behind The Scene", funnel: "top" }),
    pillar({ id: "fresh", name: "Vote / Polling", funnel: "top" }),
    pillar({ id: "mid", name: "Dos and Don'ts", funnel: "middle" }),
  ];
  const rows = [
    usage({ pillar_id: "used", pillar_name: "Behind The Scene", count: 4, funnel: "top" }),
    usage({ pillar_id: "fresh", pillar_name: "Vote / Polling", count: 0, funnel: "top" }),
    usage({ pillar_id: "mid", pillar_name: "Dos and Don'ts", count: 0, funnel: "middle" }),
  ];

  it("keeps funnel totals equal to the social media tracker", () => {
    expect(monthFunnelStats(rows)).toEqual(computeFunnelStats(rows));
    const joined = pillars.map((item) => pillarMonthCount(item, rows));
    expect(joined.reduce((sum, count) => sum + count, 0)).toBe(computeFunnelStats(rows).total);
  });

  it("puts an unused pillar above one that already has plans", () => {
    expect(pillarsInFunnel(pillars, rows, "top").map((item) => item.name)).toEqual(["Vote / Polling", "Behind The Scene"]);
    expect(pillarsInFunnel(pillars, rows, "top")[0]?.count).toBe(0);
  });

  it("counts a pillar with no tracker row as zero and matches a renamed id by name", () => {
    const renamed = pillar({ id: "other-id", name: "Behind The Scene" });
    expect(pillarMonthCount(renamed, rows)).toBe(4);
    expect(pillarMonthCount(pillar({ id: "missing", name: "Unlisted" }), rows)).toBe(0);
    expect(pillarsInFunnel([pillar({ id: "missing", name: "Unlisted" }), ...pillars], [], "top")[0]?.count).toBe(0);
  });
});
