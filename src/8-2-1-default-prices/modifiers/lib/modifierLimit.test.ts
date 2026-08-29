import { describe, expect, it } from "vitest";
import {
  applyModifierMax,
  applyModifierMin,
  isModifierLimitValid,
  normalizeModifierLimit,
} from "./modifierLimit";

describe("normalizeModifierLimit", () => {
  it("resets when limit is off", () => {
    expect(
      normalizeModifierLimit({
        limitEnabled: false,
        isRequired: true,
        minSelected: 3,
        maxSelected: 4,
      }),
    ).toEqual({ min: 0, max: 1 });
  });

  it("keeps max and zeros min when optional", () => {
    expect(
      normalizeModifierLimit({
        limitEnabled: true,
        isRequired: false,
        minSelected: 2,
        maxSelected: 4,
      }),
    ).toEqual({ min: 0, max: 4 });
  });

  it("requires min >= 1 and max >= min when required", () => {
    expect(
      normalizeModifierLimit({
        limitEnabled: true,
        isRequired: true,
        minSelected: 1,
        maxSelected: 4,
      }),
    ).toEqual({ min: 1, max: 4 });
    expect(
      normalizeModifierLimit({
        limitEnabled: true,
        isRequired: true,
        minSelected: 3,
        maxSelected: 2,
      }),
    ).toEqual({ min: 3, max: 3 });
  });
});

describe("applyModifierMin / applyModifierMax", () => {
  it("raises max when min steps past it", () => {
    expect(applyModifierMin({ minSelected: 5, maxSelected: 4 })).toEqual({ min: 5, max: 5 });
  });

  it("lowers min when required max steps below it", () => {
    expect(
      applyModifierMax({ minSelected: 3, maxSelected: 2, isRequired: true }),
    ).toEqual({ min: 2, max: 2 });
  });

  it("does not keep min when optional max changes", () => {
    expect(
      applyModifierMax({ minSelected: 3, maxSelected: 2, isRequired: false }),
    ).toEqual({ min: 0, max: 2 });
  });
});

describe("isModifierLimitValid", () => {
  it("accepts required min/max range", () => {
    expect(
      isModifierLimitValid({
        limitEnabled: true,
        isRequired: true,
        minSelected: 1,
        maxSelected: 4,
      }),
    ).toBe(true);
  });
});
