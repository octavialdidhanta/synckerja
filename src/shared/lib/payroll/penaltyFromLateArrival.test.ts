import { describe, expect, it } from "vitest";
import {
  calculateLateArrivalPenalties,
  calculatePenalizableMinutes,
} from "./penaltyFromLateArrival";

const baseSettings = {
  enableAutomaticPenalties: true,
  defaultHourlyRate: 50000,
};

const fixedRule = {
  id: "rule-fixed",
  name: "Telat >5 menit",
  thresholdMinutes: 5,
  calculationType: "fixed" as const,
  penaltyAmount: 50000,
};

describe("calculatePenalizableMinutes", () => {
  it("OCTA 08:20 with 15 min tolerance → 5 penalizable minutes", () => {
    expect(calculatePenalizableMinutes(20, 15)).toBe(5);
  });

  it("Aidah 12:50 vs shift 13:00 — not late in attendance flow", () => {
    expect(calculatePenalizableMinutes(0, 10)).toBe(0);
  });
});

describe("calculateLateArrivalPenalties", () => {
  it("applies fixed rule when penalizable minutes meet threshold", () => {
    const result = calculateLateArrivalPenalties({
      isLate: true,
      lateMinutes: 20,
      lateToleranceMinutes: 15,
      rules: [fixedRule],
      settings: baseSettings,
    });

    expect(result.penalizableMinutes).toBe(5);
    expect(result.totalAmount).toBe(50000);
    expect(result.applied).toHaveLength(1);
  });

  it("returns zero when within shift tolerance", () => {
    const result = calculateLateArrivalPenalties({
      isLate: true,
      lateMinutes: 10,
      lateToleranceMinutes: 15,
      rules: [fixedRule],
      settings: baseSettings,
    });

    expect(result.totalAmount).toBe(0);
    expect(result.skippedReason).toBe("within_tolerance");
  });

  it("skips when automatic penalties disabled", () => {
    const result = calculateLateArrivalPenalties({
      isLate: true,
      lateMinutes: 20,
      lateToleranceMinutes: 15,
      rules: [fixedRule],
      settings: { ...baseSettings, enableAutomaticPenalties: false },
    });

    expect(result.totalAmount).toBe(0);
    expect(result.skippedReason).toBe("automatic_penalties_disabled");
  });

  it("calculates hourly penalty from penalizable minutes", () => {
    const result = calculateLateArrivalPenalties({
      isLate: true,
      lateMinutes: 80,
      lateToleranceMinutes: 15,
      rules: [
        {
          id: "rule-hourly",
          name: "Hourly late",
          thresholdMinutes: 5,
          calculationType: "hourly",
          hourlyRate: 60000,
        },
      ],
      settings: baseSettings,
    });

    expect(result.penalizableMinutes).toBe(65);
    expect(result.totalAmount).toBe(Math.round((65 / 60) * 60000));
  });
});
