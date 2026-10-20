import { describe, expect, it } from "vitest";
import { canEditBriefContent } from "@/6-1-dashboard/lib/canEditBriefContent";

describe("canEditBriefContent", () => {
  it("allows the employee who is the PIC of the open row", () => {
    expect(canEditBriefContent("emp-1", "emp-1")).toBe(true);
  });

  it("refuses a different employee, a missing profile, and an empty PIC", () => {
    expect(canEditBriefContent("emp-1", "emp-2")).toBe(false);
    expect(canEditBriefContent(null, "emp-1")).toBe(false);
    expect(canEditBriefContent("emp-1", null)).toBe(false);
    expect(canEditBriefContent(undefined, undefined)).toBe(false);
    expect(canEditBriefContent("", "emp-1")).toBe(false);
  });
});
