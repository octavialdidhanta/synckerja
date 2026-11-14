import { describe, expect, it } from "vitest";
import {
  PASS_GATE_IDS,
  bigThoughtListed,
  checklistFromFailure,
  readBigThoughtCheckId,
  readGateFailure,
} from "@/thinking-lab/big-thought/checklist";

describe("list visibility", () => {
  it("keeps an audit failure visible and hides a generate rejection", () => {
    expect(bigThoughtListed({ admission: "GENERATE_VALID", audit: "AUDIT_PASS" })).toBe(true);
    expect(
      bigThoughtListed({
        admission: "GENERATE_VALID",
        audit: "AUDIT_FAIL",
        auditGateFailure: { gate: "duplicate", reason: "Same reasoning job.", earlier: "pass" },
      }),
    ).toBe(true);
    expect(
      bigThoughtListed({
        admission: "GENERATE_VALID",
        gateFailure: { gate: "relation", reason: "ELABORATION", earlier: "pass" },
      }),
    ).toBe(false);
  });
});

describe("pass checklist", () => {
  it("lists the checks in the order they are judged", () => {
    expect([...PASS_GATE_IDS]).toEqual(["resolved", "relation", "explains", "premise", "showable", "duplicate"]);
  });

  it("reads the earlier set-wide sibling check as duplicate", () => {
    expect(readBigThoughtCheckId("sibling")).toBe("duplicate");
    expect(readBigThoughtCheckId("premise")).toBe("premise");
    expect(readBigThoughtCheckId("other")).toBeNull();
    expect(readGateFailure({ gate: "sibling", reason: "Same reasoning job." })).toMatchObject({ gate: "duplicate" });
  });

  it("rebuilds a stored failure without checking later gates", () => {
    const checklist = checklistFromFailure({ gate: "showable", reason: "Too abstract to show.", earlier: "pass" });
    expect(checklist.items.map((item) => [item.id, item.state])).toEqual([
      ["resolved", "pass"],
      ["relation", "pass"],
      ["explains", "pass"],
      ["premise", "pass"],
      ["showable", "fail"],
      ["duplicate", "unchecked"],
    ]);
  });
});
