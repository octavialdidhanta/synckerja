import { describe, expect, it } from "vitest";
import { buildIdeaFixOptionsPrompt, ideaReplacementPasses, parseIdeaFixOptions } from "@/thinking-lab/idea/fix";
import { evaluateIdeaLock, selectIdeaStage } from "@/thinking-lab/idea/lock";
import {
  ideaConflictFailures,
  ideaFailureLessons,
  mergeIdeaAuditLessons,
  normalizeIdeaSet,
  readIdeaSetRecord,
  scoreIdeaAudit,
  usableIdeaFixLessons,
} from "@/thinking-lab/idea/setAudit";

const fingerprint = "idea-set";

describe("idea sibling audit", () => {
  it("fails both sides of an overlap inside one Angle", () => {
    const set = normalizeIdeaSet(
      {
        coreDistinct: false,
        materialOverlapPairs: [{ ideaCodeA: "ID01", ideaCodeB: "ID02", explanation: "Same situation" }],
        containmentPairs: [],
        resolution: "RESOLVED",
        unresolvedReasons: [],
      },
      fingerprint,
    );
    expect([...ideaConflictFailures(set)].sort()).toEqual(["ID01", "ID02"]);
    expect(
      scoreIdeaAudit({ codes: ["ID01", "ID02", "ID03"], siblingSet: set, siblingSetCurrent: true }).map(
        (item) => item.verdict,
      ),
    ).toEqual(["AUDIT_FAIL", "AUDIT_FAIL", "AUDIT_PASS"]);
  });

  it("offers a replacement only when the swapped code already passes", () => {
    const passing = normalizeIdeaSet(
      {
        coreDistinct: true,
        materialOverlapPairs: [],
        containmentPairs: [],
        resolution: "RESOLVED",
        unresolvedReasons: [],
      },
      fingerprint,
    );
    expect(ideaReplacementPasses(passing, "ID02")).toBe(true);
    expect(parseIdeaFixOptions({ statements: ["One", "One", "Two"] })).toEqual(["One", "Two"]);
  });
});

describe("idea lock", () => {
  const pass = ["AUDIT_PASS", "AUDIT_PASS", "AUDIT_PASS", "AUDIT_PASS", "AUDIT_PASS"] as const;

  it("locks when every admitted idea passes, including a set smaller than the generate target", () => {
    expect(
      evaluateIdeaLock({
        admittedCount: 5,
        verdicts: [...pass],
      }).ok,
    ).toBe(true);
    expect(
      evaluateIdeaLock({
        admittedCount: 2,
        verdicts: ["AUDIT_PASS", "AUDIT_PASS"],
      }).ok,
    ).toBe(true);
  });

  it("asks for audit until every idea has a verdict", () => {
    expect(
      selectIdeaStage({
        admittedCount: 5,
        verdicts: [...pass].slice(0, 4),
        repairsUsed: false,
        lockOk: false,
      }),
    ).toBe("audit");
  });

  it("offers lock when the sibling audit passes and the count is ready", () => {
    expect(
      selectIdeaStage({
        admittedCount: 5,
        verdicts: [...pass],
        repairsUsed: false,
        lockOk: true,
      }),
    ).toBe("lock");
  });

  it("offers fix for a failed sibling audit until a repair has already run", () => {
    const failed = ["AUDIT_FAIL", "AUDIT_PASS", "AUDIT_PASS", "AUDIT_PASS", "AUDIT_PASS"] as const;
    expect(
      selectIdeaStage({
        admittedCount: 5,
        verdicts: [...failed],
        repairsUsed: false,
        lockOk: false,
      }),
    ).toBe("fix");
    expect(
      selectIdeaStage({
        admittedCount: 5,
        verdicts: [...failed],
        repairsUsed: true,
        lockOk: false,
      }),
    ).toBeNull();
  });

  it("reads an older record without lessons as an empty lesson list", () => {
    const record = readIdeaSetRecord({
      schema: "thinking-lab/idea-set/v1",
      repairCount: 1,
      siblingSet: null,
      audit: null,
      downTop: null,
    });
    expect(record.auditLessons).toEqual([]);
    expect(record.repairCount).toBe(1);
    expect(record.downTop).toBeNull();
  });

  it("keeps one copy of the same statement and reason", () => {
    const lesson = { code: "ID01", statement: "Kita bandingkan harga per ons", reason: "vehicle: Ini narasi." };
    expect(mergeIdeaAuditLessons([lesson], [lesson, { ...lesson, code: "ID09" }])).toEqual([lesson]);
  });

  it("names the overlapping sibling and drops a generic note for that same sentence", () => {
    const set = normalizeIdeaSet(
      {
        coreDistinct: false,
        materialOverlapPairs: [{ ideaCodeA: "ID01", ideaCodeB: "ID02", explanation: "Same situation" }],
        containmentPairs: [],
        resolution: "RESOLVED",
        unresolvedReasons: [],
      },
      fingerprint,
    );
    const lessons = ideaFailureLessons({
      rows: [{ code: "ID01", statement: "Kita bandingkan harga per ons" }],
      items: [{ code: "ID01", verdict: "AUDIT_FAIL" }],
      siblingSet: set,
    });
    expect(lessons[0]?.reason).toContain("ID01 · ID02: Same situation");
    const mixed = [
      ...lessons,
      { code: "ID01", statement: "Kita bandingkan harga per ons", reason: "Sibling audit failed this Idea." },
      { code: "ID01", statement: "Kalimat lain", reason: "Sibling audit failed this Idea." },
    ];
    expect(usableIdeaFixLessons(mixed, "ID01").map((lesson) => lesson.statement)).toEqual([
      "Kita bandingkan harga per ons",
      "Kalimat lain",
    ]);
  });

  it("asks for one replacement and includes the earlier failure", () => {
    const prompt = buildIdeaFixOptionsPrompt({
      parentStatement: "Porsi kecil membuat harga terlihat hemat",
      masterSubject: "Skala bahan",
      failed: { code: "ID01", statement: "Kita mengamati bagaimana harga turun" },
      keepers: [],
      conflicts: [],
      lessons: [
        {
          code: "ID01",
          statement: "Kita mengamati bagaimana harga turun",
          reason: "mechanismShape: Ini masih pengamatan.",
        },
      ],
    });
    expect(prompt).toContain("Propose one replacement Idea");
    expect(prompt).toContain("ID01: Kita mengamati bagaimana harga turun");
    expect(prompt).toContain("Why it failed: mechanismShape: Ini masih pengamatan.");
  });

  it("offers lock when two admitted ideas have both passed", () => {
    expect(
      selectIdeaStage({
        admittedCount: 2,
        verdicts: ["AUDIT_PASS", "AUDIT_PASS"],
        repairsUsed: false,
        lockOk: true,
      }),
    ).toBe("lock");
  });
});
