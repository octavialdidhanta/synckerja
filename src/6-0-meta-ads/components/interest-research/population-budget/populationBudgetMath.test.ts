import { describe, expect, it } from "vitest";
import {
  computePopulationBudget,
  populationDailyBudget,
  populationImpressions,
  populationTotalBudget,
} from "./populationBudgetMath";

describe("populationBudgetMath", () => {
  it("impressions = population × frequency, not × days", () => {
    expect(populationImpressions(45_600, 3)).toBe(136_800);
    const result = computePopulationBudget({
      population: 45_600,
      cpm: 50_000,
      frequency: 3,
      days: 7,
    });
    expect(result.impressions).toBe(136_800);
  });

  it("totalBudget = (impressions / 1000) × CPM", () => {
    expect(populationTotalBudget(136_800, 50_000)).toBe(6_840_000);
    const result = computePopulationBudget({
      population: 45_600,
      cpm: 50_000,
      frequency: 3,
      days: 7,
    });
    expect(result.totalBudget).toBe(6_840_000);
  });

  it("dailyBudget = total / days and days do not change impressions", () => {
    expect(populationDailyBudget(6_840_000, 7)).toBe(6_840_000 / 7);
    const seven = computePopulationBudget({
      population: 10_000,
      cpm: 20_000,
      frequency: 3,
      days: 7,
    });
    const fourteen = computePopulationBudget({
      population: 10_000,
      cpm: 20_000,
      frequency: 3,
      days: 14,
    });
    expect(fourteen.impressions).toBe(seven.impressions);
    expect(fourteen.totalBudget).toBe(seven.totalBudget);
    expect(fourteen.dailyBudget).toBe(seven.dailyBudget / 2);
  });

  it("empty CPM or invalid inputs yield zero budget", () => {
    expect(computePopulationBudget({ population: 10_000, cpm: 0, frequency: 3, days: 7 })).toEqual({
      impressions: 30_000,
      totalBudget: 0,
      dailyBudget: 0,
    });
    expect(computePopulationBudget({ population: 0, cpm: 50_000, frequency: 3, days: 7 }).impressions).toBe(0);
    expect(populationDailyBudget(1_000, 0)).toBe(0);
  });
});
