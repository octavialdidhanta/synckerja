import { describe, expect, it } from "vitest";
import {
  computePosShiftCashVariance,
  formatPosShiftVariance,
} from "./posShiftVariance";

describe("computePosShiftCashVariance", () => {
  it("returns counted minus expected", () => {
    expect(computePosShiftCashVariance(765_000, 770_164)).toBe(-5164);
    expect(computePosShiftCashVariance(770_164, 770_164)).toBe(0);
    expect(computePosShiftCashVariance(780_000, 770_000)).toBe(10_000);
  });
});

describe("formatPosShiftVariance", () => {
  it("uses parentheses for shortage", () => {
    expect(formatPosShiftVariance(-5164)).toBe("(Rp 5.164)");
  });

  it("formats surplus without parentheses", () => {
    expect(formatPosShiftVariance(1000)).toBe("Rp 1.000");
  });
});
