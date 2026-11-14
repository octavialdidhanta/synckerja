import { describe, expect, it } from "vitest";
import {
  PASS_GATE_IDS,
  bigThoughtListed,
  checklistFrame,
  checklistFromFailure,
  completeChecklist,
  type PassChecklist,
} from "@/thinking-lab/big-thought/checklist";

/** Every individual gate passed; sibling not checked yet. */
function individualPassed(): PassChecklist {
  return {
    items: PASS_GATE_IDS.map((id) => ({ id, state: id === "sibling" ? "unchecked" : "pass", reason: "" })),
    passed: false,
    lesson: null,
    failure: null,
  };
}

describe("list visibility", () => {
  it("keeps an audit failure visible and hides a generate rejection", () => {
    expect(bigThoughtListed({ admission: "GENERATE_VALID", audit: "AUDIT_PASS" })).toBe(true);
    expect(
      bigThoughtListed({
        admission: "GENERATE_VALID",
        audit: "AUDIT_FAIL",
        auditGateFailure: { gate: "sibling", reason: "Same reasoning job.", earlier: "pass" },
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
    expect([...PASS_GATE_IDS]).toEqual(["resolved", "relation", "explains", "premise", "showable", "duplicate", "sibling"]);
  });

  it("fails sibling only after the individual gates pass", () => {
    const blocked = completeChecklist(checklistFromFailure({ gate: "relation", reason: "METHOD", earlier: "pass" }), {
      passed: false,
      reason: "Same reasoning job",
    });
    expect(blocked.failure?.gate).toBe("relation");

    const distinct = completeChecklist(individualPassed(), { passed: true, reason: "" });
    expect(distinct.passed).toBe(true);
    expect(distinct.items.every((item) => item.state === "pass")).toBe(true);

    const overlap = completeChecklist(individualPassed(), { passed: false, reason: "Same reasoning job" });
    expect(overlap.failure).toMatchObject({ gate: "sibling", earlier: "pass" });
    expect(overlap.items.find((item) => item.id === "duplicate")?.state).toBe("pass");
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
      ["sibling", "unchecked"],
    ]);
  });

  it("keeps later gates pending while one gate is being checked", () => {
    const frame = checklistFrame(individualPassed(), "explains", "checking");
    expect(frame.items.map((item) => item.state)).toEqual([
      "pass",
      "pass",
      "checking",
      "pending",
      "pending",
      "pending",
      "pending",
    ]);
    expect(frame.report).toEqual({ gate: "explains", phase: "checking", outcome: "pass" });
  });
});
