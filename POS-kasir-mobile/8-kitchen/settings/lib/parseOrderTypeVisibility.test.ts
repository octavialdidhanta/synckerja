import { describe, expect, it } from "vitest";
import { parseOrderTypeVisibility } from "./parseOrderTypeVisibility";

describe("parseOrderTypeVisibility", () => {
  it("defaults all true", () => {
    expect(parseOrderTypeVisibility(null)).toEqual({
      dine_in: true,
      takeaway: true,
      delivery: true,
      pickup: true,
    });
  });

  it("merges partial jsonb", () => {
    expect(parseOrderTypeVisibility({ takeaway: false })).toEqual({
      dine_in: true,
      takeaway: false,
      delivery: true,
      pickup: true,
    });
  });
});
