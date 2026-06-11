import { describe, expect, it } from "vitest";
import {
  buildInsightObjectiveTitle,
  resolveOkrCycleForInsightPeriod,
} from "@/6-0-social-media-performance-shared/insightTargetOkrCycleResolver";
import type { OkrCycle } from "@/shared/hooks/useOkrCycles";

const cycles: OkrCycle[] = [
  {
    id: "cycle-q1",
    organization_id: "org-1",
    name: "Q1 2026",
    year: 2026,
    quarter: "Q1",
    period_type: "quarterly",
    start_date: "2026-01-01",
    end_date: "2026-03-31",
    is_active: true,
    created_at: "",
    updated_at: "",
    created_by: "",
  },
  {
    id: "cycle-q2",
    organization_id: "org-1",
    name: "Q2 2026",
    year: 2026,
    quarter: "Q2",
    period_type: "quarterly",
    start_date: "2026-04-01",
    end_date: "2026-06-30",
    is_active: false,
    created_at: "",
    updated_at: "",
    created_by: "",
  },
];

describe("resolveOkrCycleForInsightPeriod", () => {
  it("matches quarterly period to cycle by year and quarter", () => {
    const result = resolveOkrCycleForInsightPeriod(
      { periodType: "quarterly", year: 2026, quarter: 1 },
      cycles,
    );
    expect(result?.id).toBe("cycle-q1");
  });

  it("matches monthly period by date overlap", () => {
    const result = resolveOkrCycleForInsightPeriod(
      { periodType: "monthly", year: 2026, month: 2 },
      cycles,
    );
    expect(result?.id).toBe("cycle-q1");
  });

  it("returns null when no cycles exist", () => {
    const result = resolveOkrCycleForInsightPeriod(
      { periodType: "quarterly", year: 2026, quarter: 1 },
      [],
    );
    expect(result).toBeNull();
  });
});

describe("buildInsightObjectiveTitle", () => {
  it("formats quarterly title", () => {
    expect(buildInsightObjectiveTitle({ periodType: "quarterly", year: 2026, quarter: 1 })).toBe(
      "Social Media KPI — Q1 2026",
    );
  });

  it("formats monthly title", () => {
    const title = buildInsightObjectiveTitle({ periodType: "monthly", year: 2026, month: 6 });
    expect(title).toContain("2026");
    expect(title).toContain("Social Media KPI");
  });
});
