import { describe, expect, it } from "vitest";
import { requiresCompanyObjectiveForSave } from "@/6-0-social-media-performance-shared/insightTargetSaveValidation";

describe("requiresCompanyObjectiveForSave", () => {
  it("returns false when no targets and no assignments", () => {
    expect(requiresCompanyObjectiveForSave([], [])).toBe(false);
  });

  it("returns true when any target value is positive", () => {
    expect(
      requiresCompanyObjectiveForSave(
        [
          {
            platform: "tiktok",
            accountId: "acc-1",
            metric: "views",
            targetValue: 100,
          },
        ],
        [],
      ),
    ).toBe(true);
  });

  it("returns false when all target values are zero", () => {
    expect(
      requiresCompanyObjectiveForSave(
        [
          {
            platform: "tiktok",
            accountId: "acc-1",
            metric: "views",
            targetValue: 0,
          },
        ],
        [],
      ),
    ).toBe(false);
  });

  it("returns true when any PIC assignment exists", () => {
    expect(
      requiresCompanyObjectiveForSave(
        [],
        [{ platform: "youtube", accountId: "acc-2", employeeId: "emp-1" }],
      ),
    ).toBe(true);
  });
});
