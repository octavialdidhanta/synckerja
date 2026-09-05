import { describe, expect, it } from "vitest";
import {
  formatOrderAvgRating,
  formatOrderRatingCount,
} from "./formatOrderRatingCount";

describe("formatOrderRatingCount", () => {
  it("formats small counts as digits", () => {
    expect(formatOrderRatingCount(1)).toBe("1");
    expect(formatOrderRatingCount(12)).toBe("12");
    expect(formatOrderRatingCount(99)).toBe("99");
  });

  it("caps at 100+", () => {
    expect(formatOrderRatingCount(100)).toBe("100+");
    expect(formatOrderRatingCount(999)).toBe("100+");
  });

  it("guards invalid input", () => {
    expect(formatOrderRatingCount(0)).toBe("0");
    expect(formatOrderRatingCount(-3)).toBe("0");
    expect(formatOrderRatingCount(Number.NaN)).toBe("0");
  });
});

describe("formatOrderAvgRating", () => {
  it("formats one decimal", () => {
    expect(formatOrderAvgRating(5)).toBe("5.0");
    expect(formatOrderAvgRating(4.86)).toBe("4.9");
    expect(formatOrderAvgRating(4.84)).toBe("4.8");
  });
});
