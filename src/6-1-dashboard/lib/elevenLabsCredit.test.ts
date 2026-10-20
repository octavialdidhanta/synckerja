import { describe, expect, it } from "vitest";
import { exactCreditCostFromHeader, recordedCreditTotal } from "../../../supabase/functions/_shared/elevenLabsCredit.ts";

describe("exact ElevenLabs credit", () => {
  it("keeps only the integer from the character-cost header", () => {
    expect(exactCreditCostFromHeader("186")).toBe(186);
    expect(exactCreditCostFromHeader(" 0 ")).toBe(0);
    expect(exactCreditCostFromHeader(null)).toBeNull();
    expect(exactCreditCostFromHeader("")).toBeNull();
    expect(exactCreditCostFromHeader("186.5")).toBeNull();
    expect(exactCreditCostFromHeader("-1")).toBeNull();
    expect(exactCreditCostFromHeader("1e2")).toBeNull();
  });

  it("sums recorded costs and leaves unrecorded generations out", () => {
    expect(recordedCreditTotal([186, null, 40])).toBe(226);
    expect(recordedCreditTotal([null, undefined])).toBeNull();
    expect(recordedCreditTotal([0])).toBe(0);
  });
});
