import { describe, expect, it } from "vitest";
import { insightKeyResultProgress } from "@/6-0-social-media-performance-shared/insightTargetOkrProgress";

describe("insightKeyResultProgress", () => {
  it("computes volume metric progress", () => {
    expect(insightKeyResultProgress("views", 500, 1000)).toBe(50);
  });

  it("computes engagement rate progress", () => {
    expect(insightKeyResultProgress("avg_engagement_rate", 2.5, 5)).toBe(50);
  });

  it("returns 0 when target is zero", () => {
    expect(insightKeyResultProgress("likes", 10, 0)).toBe(0);
  });

  it("returns 0 when actual is null", () => {
    expect(insightKeyResultProgress("views", null, 1000)).toBe(0);
  });
});
