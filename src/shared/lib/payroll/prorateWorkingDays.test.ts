import { describe, expect, it } from "vitest";
import { calculateProrateRatio } from "./prorateWorkingDays";

describe("calculateProrateRatio", () => {
  it("returns 1 for full month join at start", () => {
    const result = calculateProrateRatio({
      periodStart: "2026-05-01",
      periodEnd: "2026-05-31",
      workingDays: [1, 2, 3, 4, 5],
      employeeJoinDate: "2026-05-01",
    });
    expect(result.ratio).toBe(1);
  });

  it("returns partial ratio for mid-month join (9 Mei)", () => {
    const result = calculateProrateRatio({
      periodStart: "2026-05-01",
      periodEnd: "2026-05-31",
      workingDays: [1, 2, 3, 4, 5],
      employeeJoinDate: "2026-05-09",
    });
    expect(result.ratio).toBeGreaterThan(0.5);
    expect(result.ratio).toBeLessThan(0.85);
  });

  it("excludes national holidays when not counted as working", () => {
    const withoutHoliday = calculateProrateRatio({
      periodStart: "2026-05-04",
      periodEnd: "2026-05-08",
      workingDays: [1, 2, 3, 4, 5],
      employeeJoinDate: "2026-05-04",
    });
    const withHoliday = calculateProrateRatio({
      periodStart: "2026-05-04",
      periodEnd: "2026-05-08",
      workingDays: [1, 2, 3, 4, 5],
      holidayDates: ["2026-05-06"],
      employeeJoinDate: "2026-05-04",
    });
    expect(withHoliday.totalWorkingDays).toBeLessThan(withoutHoliday.totalWorkingDays);
  });

  it("returns 0 ratio when join after period end", () => {
    const result = calculateProrateRatio({
      periodStart: "2026-05-01",
      periodEnd: "2026-05-31",
      workingDays: [1, 2, 3, 4, 5],
      employeeJoinDate: "2026-06-01",
    });
    expect(result.ratio).toBe(0);
  });

  it("counts Sunday when working_days includes 7 (app DOW)", () => {
    const result = calculateProrateRatio({
      periodStart: "2026-05-03",
      periodEnd: "2026-05-09",
      workingDays: [1, 2, 3, 4, 5, 6, 7],
    });
    expect(result.totalWorkingDays).toBe(7);
  });

  it("uses shift-assigned days when provided", () => {
    const result = calculateProrateRatio({
      periodStart: "2026-05-01",
      periodEnd: "2026-05-07",
      workingDays: [1, 2, 3, 4, 5, 6, 7],
      shiftAssignedDays: ["2026-05-01", "2026-05-02", "2026-05-03"],
      employeeJoinDate: "2026-05-02",
    });
    expect(result.mode).toBe("shift_assigned");
    expect(result.totalWorkingDays).toBe(3);
    expect(result.effectiveWorkingDays).toBe(2);
    expect(result.ratio).toBeCloseTo(2 / 3, 5);
  });
});
