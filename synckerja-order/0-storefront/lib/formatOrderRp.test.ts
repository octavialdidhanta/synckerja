import { describe, expect, it } from "vitest";
import { formatOrderRp } from "./formatOrderRp";

describe("formatOrderRp", () => {
  it("formats without a space after Rp", () => {
    expect(formatOrderRp(15000)).toBe("Rp15.000");
    expect(formatOrderRp(34545)).toBe("Rp34.545");
  });
});
