import { describe, expect, it } from "vitest";
import { spineDowGross, spineHourlyGross } from "../../summary/hooks/useDashboardTimeSeries";

describe("spineDowGross", () => {
  it("fills Sun–Sat with zeros for missing days", () => {
    const points = spineDowGross([
      { dow: 1, label: "Mon", grossSales: 10 },
      { dow: 5, label: "Fri", grossSales: 20 },
    ]);
    expect(points).toHaveLength(7);
    expect(points.map((p) => p.label)).toEqual([
      "Sun",
      "Mon",
      "Tue",
      "Wed",
      "Thu",
      "Fri",
      "Sat",
    ]);
    expect(points[1].grossSales).toBe(10);
    expect(points[5].grossSales).toBe(20);
    expect(points[0].grossSales).toBe(0);
  });
});

describe("spineHourlyGross", () => {
  it("fills hours 0–23", () => {
    const points = spineHourlyGross([
      { hour: 9, grossSales: 100 },
      { hour: 21, grossSales: 50 },
    ]);
    expect(points).toHaveLength(24);
    expect(points[0]).toEqual({ hour: 0, grossSales: 0 });
    expect(points[9]).toEqual({ hour: 9, grossSales: 100 });
    expect(points[21]).toEqual({ hour: 21, grossSales: 50 });
    expect(points[23]).toEqual({ hour: 23, grossSales: 0 });
  });
});
