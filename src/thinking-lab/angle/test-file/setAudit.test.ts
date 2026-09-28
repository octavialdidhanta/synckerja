import { describe, expect, it } from "vitest";
import { angleConflictFailures, normalizeAngleSet, scoreAngleAudit } from "@/thinking-lab/angle/setAudit";
import { selectAngleStage } from "@/thinking-lab/angle/lock";

const fingerprint = "angle-set";

function resolved(raw: Record<string, unknown>) {
  return normalizeAngleSet(raw, fingerprint);
}

describe("angle sibling audit", () => {
  it("fails only the unique broad container", () => {
    const set = resolved({
      coreDistinct: false,
      materialOverlapPairs: [],
      containmentPairs: [
        { containerCode: "AN05", containedCode: "AN01", explanation: "AN01 sits inside AN05" },
        { containerCode: "AN05", containedCode: "AN03", explanation: "AN03 sits inside AN05" },
        { containerCode: "AN05", containedCode: "AN04", explanation: "AN04 sits inside AN05" },
      ],
      resolution: "RESOLVED",
      unresolvedReasons: [],
    });
    expect([...angleConflictFailures(set)].sort()).toEqual(["AN05"]);
    const items = scoreAngleAudit({
      codes: ["AN01", "AN03", "AN04", "AN05"],
      siblingSet: set,
      siblingSetCurrent: true,
    });
    expect(items.map((item) => item.verdict)).toEqual(["AUDIT_PASS", "AUDIT_PASS", "AUDIT_PASS", "AUDIT_FAIL"]);
  });
});

describe("selectAngleStage", () => {
  it("asks for one more angle when coverage has a gap and there is room", () => {
    expect(
      selectAngleStage({
        admittedCount: 3,
        verdicts: ["AUDIT_PASS", "AUDIT_PASS", "AUDIT_PASS"],
        challengerComplete: false,
        materialGap: true,
        canAdd: true,
        repairsUsed: false,
        lockOk: false,
      }),
    ).toBe("generate");
  });

  it("stops after one fix while the audit still fails", () => {
    expect(
      selectAngleStage({
        admittedCount: 3,
        verdicts: ["AUDIT_FAIL", "AUDIT_PASS", "AUDIT_PASS"],
        challengerComplete: false,
        materialGap: false,
        canAdd: true,
        repairsUsed: true,
        lockOk: false,
      }),
    ).toBeNull();
  });
});
