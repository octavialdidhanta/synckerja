import { describe, expect, it } from "vitest";
import {
  bigThoughtListed,
  bigThoughtReadyForAudit,
  checklistFrames,
  checklistFromFailure,
  completeChecklist,
  evaluateIndividualChecklist,
  individualChecklistPassed,
  uncheckedDuplicateChecklist,
} from "@/thinking-lab/big-thought/checklist";
import { judgeBigThought } from "@/thinking-lab/big-thought/semantic";
import type { BigThoughtFacts } from "@/thinking-lab/big-thought/types";

function facts(overrides: Partial<BigThoughtFacts> = {}): BigThoughtFacts {
  return {
    code: "BT01",
    whatItSays: "A distinct material support",
    relationToParent: "DISTINCT_MATERIAL_SUPPORT",
    supportRole: "REASON",
    explainsWhyParentIsTrue: true,
    introducesUnsupportedPremise: false,
    duplicateOfCode: null,
    resolution: "RESOLVED",
    unresolvedReasons: [],
    ...overrides,
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

  it("sends only a Big Thought that passed Generate into Audit", () => {
    expect(bigThoughtReadyForAudit({ admission: "GENERATE_VALID" })).toBe(true);
    expect(bigThoughtReadyForAudit({ admission: "STALE", passConfirmed: true })).toBe(true);
    expect(
      bigThoughtReadyForAudit({
        admission: "GENERATE_VALID",
        gateFailure: { gate: "sibling", reason: "Same reasoning job.", earlier: "pass" },
      }),
    ).toBe(false);
    expect(bigThoughtReadyForAudit({ admission: "GENERATE_REJECT" })).toBe(false);
    expect(bigThoughtReadyForAudit({ admission: "UNRESOLVED" })).toBe(false);
  });
});

describe("individual pass checklist", () => {
  it("passes every individual gate and leaves sibling unchecked", () => {
    const checklist = evaluateIndividualChecklist(facts());
    expect(checklist.failure).toBeNull();
    expect(checklist.items.map((item) => item.state)).toEqual([
      "pass",
      "pass",
      "pass",
      "pass",
      "pass",
      "pass",
      "unchecked",
    ]);
    expect(individualChecklistPassed(facts())).toBe(true);
  });

  it("stops at the first failed gate", () => {
    const unresolved = evaluateIndividualChecklist(facts({ resolution: "UNRESOLVED", unresolvedReasons: ["RESULT_NOT_SHOWN"] }));
    expect(unresolved.failure).toMatchObject({ gate: "resolved", earlier: "pass" });
    expect(unresolved.items.map((item) => item.state)).toEqual([
      "fail",
      "unchecked",
      "unchecked",
      "unchecked",
      "unchecked",
      "unchecked",
      "unchecked",
    ]);

    const relation = evaluateIndividualChecklist(
      facts({ relationToParent: "ELABORATION", supportRole: "UNRESOLVED", explainsWhyParentIsTrue: false }),
    );
    expect(relation.failure?.gate).toBe("relation");
    expect(relation.items.find((item) => item.id === "role")?.state).toBe("unchecked");

    const role = evaluateIndividualChecklist(facts({ supportRole: "UNRESOLVED" }));
    expect(role.failure?.gate).toBe("role");
    expect(role.items.find((item) => item.id === "explains")?.state).toBe("unchecked");

    const explains = evaluateIndividualChecklist(facts({ explainsWhyParentIsTrue: false }));
    expect(explains.failure?.gate).toBe("explains");
    expect(explains.items.find((item) => item.id === "premise")?.state).toBe("unchecked");

    const premise = evaluateIndividualChecklist(facts({ introducesUnsupportedPremise: true }));
    expect(premise.failure?.gate).toBe("premise");
    expect(premise.items.find((item) => item.id === "duplicate")?.state).toBe("unchecked");

    const duplicate = evaluateIndividualChecklist(facts({ duplicateOfCode: "BT02" }));
    expect(duplicate.failure).toMatchObject({ gate: "duplicate", earlier: "pass" });
    expect(duplicate.items.find((item) => item.id === "sibling")?.state).toBe("unchecked");
  });

  it("keeps a repeated label unchecked before the duplicate gate", () => {
    const checklist = uncheckedDuplicateChecklist("Same Big Thought as BT01.");
    expect(checklist.failure).toMatchObject({ gate: "duplicate", earlier: "unchecked" });
    expect(checklist.items.find((item) => item.id === "resolved")?.state).toBe("unchecked");
    expect(checklist.items.find((item) => item.id === "duplicate")?.state).toBe("fail");
  });

  it("fails sibling only after the individual gates pass", () => {
    const blocked = completeChecklist(evaluateIndividualChecklist(facts({ relationToParent: "METHOD" })), {
      passed: false,
      reason: "Same reasoning job",
    });
    expect(blocked.failure?.gate).toBe("relation");

    const distinct = completeChecklist(evaluateIndividualChecklist(facts()), { passed: true, reason: "" });
    expect(distinct.passed).toBe(true);
    expect(distinct.items.every((item) => item.state === "pass")).toBe(true);

    const overlap = completeChecklist(evaluateIndividualChecklist(facts()), {
      passed: false,
      reason: "Same reasoning job",
    });
    expect(overlap.failure).toMatchObject({ gate: "sibling", earlier: "pass" });
    expect(overlap.items.find((item) => item.id === "duplicate")?.state).toBe("pass");
  });

  it("rebuilds a stored failure without checking later gates", () => {
    const checklist = checklistFromFailure({ gate: "explains", reason: "Does not explain the parent.", earlier: "pass" });
    expect(checklist.items.map((item) => [item.id, item.state])).toEqual([
      ["resolved", "pass"],
      ["relation", "pass"],
      ["role", "pass"],
      ["explains", "fail"],
      ["premise", "unchecked"],
      ["duplicate", "unchecked"],
      ["sibling", "unchecked"],
    ]);
  });

  it("confirms one gate at a time and stops at the first failure", () => {
    const failed = evaluateIndividualChecklist(
      facts({ relationToParent: "ELABORATION", supportRole: "UNRESOLVED", explainsWhyParentIsTrue: false }),
    );
    const frames = checklistFrames(failed);
    expect(frames.map((frame) => `${frame.report?.phase}:${frame.report?.gate}:${frame.report?.outcome}`)).toEqual([
      "checking:resolved:pass",
      "checked:resolved:pass",
      "checking:relation:fail",
      "checked:relation:fail",
    ]);
    expect(frames[0]?.items.map((item) => item.state)).toEqual([
      "checking",
      "pending",
      "pending",
      "pending",
      "pending",
      "pending",
      "pending",
    ]);
    expect(frames.at(-1)?.items.map((item) => item.state)).toEqual([
      "pass",
      "fail",
      "unchecked",
      "unchecked",
      "unchecked",
      "unchecked",
      "unchecked",
    ]);
  });

  it("reports a passed checklist only after each gate is confirmed", () => {
    const done = completeChecklist(evaluateIndividualChecklist(facts()), { passed: true, reason: "" });
    const frames = checklistFrames(done);
    expect(frames).toHaveLength(14);
    expect(frames[2]?.items.map((item) => item.state)).toEqual([
      "pass",
      "checking",
      "pending",
      "pending",
      "pending",
      "pending",
      "pending",
    ]);
    expect(frames.at(-1)?.items.every((item) => item.state === "pass")).toBe(true);
    expect(frames.at(-1)?.report).toEqual({ gate: "sibling", phase: "checked", outcome: "pass" });
  });

  it("does not report gates that were not checked on a lexical duplicate", () => {
    const frames = checklistFrames(uncheckedDuplicateChecklist("Same Big Thought as BT01."));
    expect(frames.map((frame) => frame.report?.gate)).toEqual(["duplicate", "duplicate"]);
    expect(frames[0]?.items.slice(0, 5).every((item) => item.state === "unchecked")).toBe(true);
  });
});

describe("adversarial skip", () => {
  it("does not call the verifier when an individual gate already failed", async () => {
    let calls = 0;
    const facts = await judgeBigThought(
      { parentStatement: "A general belief", candidate: { code: "NEW", statement: "A clause" }, siblings: [] },
      async () => {
        calls += 1;
        return JSON.stringify({
          code: "NEW",
          whatItSays: "",
          relationToParent: "DISTINCT_MATERIAL_SUPPORT",
          supportRole: "REASON",
          explainsWhyParentIsTrue: true,
          introducesUnsupportedPremise: false,
          duplicateOfCode: null,
          resolution: "RESOLVED",
          unresolvedReasons: [],
        });
      },
    );
    expect(calls).toBe(1);
    expect(individualChecklistPassed(facts)).toBe(false);
  });
});
