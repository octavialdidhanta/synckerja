import { describe, expect, it } from "vitest";
import {
  angleCodesHeldPass,
  angleConflictFailures,
  angleFailureLessons,
  holdPassingAngleVerdicts,
  mergeAngleAuditLessons,
  normalizeAngleSet,
  readAngleSetRecord,
  scoreAngleAudit,
  usableAngleFixLessons,
} from "@/thinking-lab/angle/setAudit";
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

  it("keeps a locked Angle passed when a new sibling overlaps it", () => {
    const scored = scoreAngleAudit({
      codes: ["AN01", "AN04"],
      siblingSet: resolved({
        coreDistinct: false,
        materialOverlapPairs: [{ angleCodeA: "AN01", angleCodeB: "AN04", explanation: "Same point of view" }],
        containmentPairs: [],
        resolution: "RESOLVED",
        unresolvedReasons: [],
      }),
      siblingSetCurrent: true,
    });
    const held = angleCodesHeldPass(
      [
        { code: "AN01", status: "locked" },
        { code: "AN04", status: "candidate" },
      ],
      [null, null],
    );
    expect(holdPassingAngleVerdicts(scored, held).map((item) => item.verdict)).toEqual(["AUDIT_PASS", "AUDIT_FAIL"]);
  });
});

describe("angle audit lessons", () => {
  it("keeps an old record without lessons and does not store the same lesson twice", () => {
    const stored = readAngleSetRecord({
      schema: "thinking-lab/angle-set/v1",
      repairCount: 0,
      siblingSet: null,
      audit: null,
      challenger: null,
    });
    expect(stored.auditLessons).toEqual([]);
    const lesson = {
      code: "AN02",
      statement: "Porsi kecil membuat harga terlihat hemat",
      reason: "observationJob: Kalimat ini masuk sebagai karena.",
    };
    const merged = mergeAngleAuditLessons(stored.auditLessons, [lesson, lesson]);
    expect(merged).toEqual([lesson]);
    const set = resolved({
      coreDistinct: false,
      materialOverlapPairs: [{ angleCodeA: "AN01", angleCodeB: "AN02", explanation: "Sudut yang sama" }],
      containmentPairs: [],
      resolution: "RESOLVED",
      unresolvedReasons: [],
    });
    expect(
      angleFailureLessons({
        rows: [
          { code: "AN01", statement: "Dapur warung membeli bahan sekaligus" },
          { code: "AN02", statement: "Harga terlihat hemat" },
        ],
        items: [
          { code: "AN01", verdict: "AUDIT_PASS" },
          { code: "AN02", verdict: "AUDIT_FAIL" },
        ],
        siblingSet: set,
      }),
    ).toEqual([{ code: "AN02", statement: "Harga terlihat hemat", reason: "AN01 · AN02: Sudut yang sama" }]);
  });

  it("keeps the explained failure and drops the generic note for the same sentence", () => {
    const lessons = usableAngleFixLessons(
      [
        {
          code: "AN02",
          statement: "Porsi kecil",
          reason: "AN01 · AN02: Sudut yang sama",
        },
        { code: "AN02", statement: "Porsi kecil", reason: "Sibling audit failed this Angle." },
        { code: "AN02", statement: "Menu harian", reason: "Sibling audit failed this Angle." },
      ],
      "AN02",
    );
    expect(lessons.map((lesson) => lesson.statement)).toEqual(["Porsi kecil", "Menu harian"]);
  });
});

describe("selectAngleStage", () => {
  it("locks a passing set without waiting for a third angle", () => {
    expect(
      selectAngleStage({
        admittedCount: 2,
        verdicts: ["AUDIT_PASS", "AUDIT_PASS"],
        challengerComplete: false,
        materialGap: false,
        canAdd: true,
        repairsUsed: false,
        lockOk: true,
      }),
    ).toBe("lock");
  });

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
