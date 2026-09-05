import { describe, expect, it } from "vitest";
import { ratingSummaryFor } from "../hooks/usePublicOrderProductRatingMap";
import type { OrderProductRatingSummary } from "./orderProductRatingTypes";

describe("ratingSummaryFor", () => {
  it("returns null when map missing or empty", () => {
    expect(ratingSummaryFor(undefined, "a")).toBeNull();
    expect(ratingSummaryFor(new Map(), "a")).toBeNull();
  });

  it("returns summary for catalog id", () => {
    const summary: OrderProductRatingSummary = {
      catalogItemId: "a",
      avgRating: 5,
      ratingCount: 2,
    };
    const map = new Map([["a", summary]]);
    expect(ratingSummaryFor(map, "a")).toEqual(summary);
    expect(ratingSummaryFor(map, "b")).toBeNull();
  });
});
