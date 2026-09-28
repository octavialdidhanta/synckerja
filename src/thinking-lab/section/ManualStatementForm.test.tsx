import { describe, expect, it } from "vitest";
import { manualRejection } from "@/thinking-lab/section/ManualStatementForm";

describe("manualRejection", () => {
  it("accepts a valid admission", () => {
    expect(manualRejection({ admission: "GENERATE_VALID", relation: "VALID_TERRITORY" })).toBeNull();
  });

  it("keeps a failed statement out of the set by returning the reason", () => {
    expect(
      manualRejection({
        admission: "GENERATE_REJECT",
        relation: "OUT_OF_PARENT_SCOPE",
        reasons: ["PARENT_FIT"],
      }),
    ).toBe("OUT_OF_PARENT_SCOPE — PARENT_FIT");
  });
});
