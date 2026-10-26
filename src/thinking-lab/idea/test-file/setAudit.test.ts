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

  it("drops a broken gate failure and keeps the audit when lessons are merged", () => {
    const record = readIdeaSetRecord({
      schema: "thinking-lab/idea-set/v1",
      repairCount: 2,
      siblingSet: null,
      audit: {
        fingerprint: "fp",
        items: [
          { code: "ID01", verdict: "AUDIT_FAIL", statementFingerprint: "s1", gateFailure: { gate: "not-a-gate", reason: "x" } },
          { code: "ID02", verdict: "AUDIT_FAIL", gateFailure: { id: "sentenceForm", reason: "Wrong key" } },
          { code: "ID03", verdict: "AUDIT_FAIL", gateFailure: { gate: "sentenceForm", reason: "The act is missing." } },
        ],
      },
      downTop: { fingerprint: "down", items: [{ code: "ID01" }] },
      auditLessons: [{ code: "ID01", statement: "Old sentence", reason: "sentenceForm: The act is missing." }],
    });
    expect(record.audit?.items.find((item) => item.code === "ID01")?.gateFailure).toBeUndefined();
    expect(record.audit?.items.find((item) => item.code === "ID02")?.gateFailure).toBeUndefined();
    expect(record.audit?.items.find((item) => item.code === "ID03")?.gateFailure).toEqual({
      gate: "sentenceForm",
      reason: "The act is missing.",
    });
    const next = {
      ...record,
      auditLessons: mergeIdeaAuditLessons(record.auditLessons, [
        { code: "ID04", statement: "New sentence", reason: "mechanismShape: This is still an observation." },
      ]),
    };
    expect(next.audit).toBe(record.audit);
    expect(next.downTop).toEqual({ fingerprint: "down", items: [{ code: "ID01" }] });
    expect(next.auditLessons.map((lesson) => lesson.statement)).toEqual(["Old sentence", "New sentence"]);
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
    expect(record.discovery).toBeNull();
  });

  it("keeps a stored discovery and drops a broken answer", () => {
    const record = readIdeaSetRecord({
      schema: "thinking-lab/idea-set/v1",
      repairCount: 0,
      siblingSet: null,
      audit: null,
      downTop: null,
      auditLessons: [],
      discovery: {
        angleFingerprint: "angle-fp",
        decisions: [
          { category: "Situation", question: "Di mana mekanisme ini terjadi?", answer: "Serah terima sif perawat" },
          { category: "", question: "Kosong", answer: "Tidak dipakai" },
          { category: "Extra", question: "Pertanyaan keempat", answer: "Tidak diambil" },
          { category: "Extra", question: "Pertanyaan kelima", answer: "Tidak diambil" },
        ],
      },
    });
    expect(record.discovery).toEqual({
      angleFingerprint: "angle-fp",
      decisions: [
        { category: "Situation", question: "Di mana mekanisme ini terjadi?", answer: "Serah terima sif perawat" },
        { category: "Extra", question: "Pertanyaan keempat", answer: "Tidak diambil" },
        { category: "Extra", question: "Pertanyaan kelima", answer: "Tidak diambil" },
      ],
    });
    expect(
      readIdeaSetRecord({
        schema: "thinking-lab/idea-set/v1",
        discovery: { angleFingerprint: "", decisions: [] },
      }).discovery,
    ).toBeNull();
    expect(
      readIdeaSetRecord({
        schema: "thinking-lab/idea-set/v1",
        discovery: { angleFingerprint: "angle-fp", decisions: [{ question: "Tanpa jawaban" }] },
      }).discovery,
    ).toBeNull();
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
