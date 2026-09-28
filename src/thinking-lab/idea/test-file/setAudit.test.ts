import { describe, expect, it } from "vitest";
import { buildIdeaDownTopPrompt, normalizeIdeaDownTop } from "@/thinking-lab/idea/downTop";
import { ideaReplacementPasses, parseIdeaFixOptions } from "@/thinking-lab/idea/fix";
import { evaluateIdeaLock, selectIdeaStage } from "@/thinking-lab/idea/lock";
import { ideaConflictFailures, normalizeIdeaSet, scoreIdeaAudit } from "@/thinking-lab/idea/setAudit";

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

describe("idea down-top", () => {
  it("passes only a climb where the proof can appear", () => {
    const items = normalizeIdeaDownTop(
      {
        items: [
          { code: "ID01", viewerClimb: "CLIMBS", subjectMatch: "MATCH", proofCanAppear: true, bigThoughtNote: "" },
          { code: "ID02", viewerClimb: "OTHER", subjectMatch: "MATCH", proofCanAppear: true, bigThoughtNote: "" },
          { code: "ID03", viewerClimb: "NEGATIVE", subjectMatch: "MATCH", proofCanAppear: true, bigThoughtNote: "" },
          { code: "ID04", viewerClimb: "CLIMBS", subjectMatch: "MATCH", proofCanAppear: false, bigThoughtNote: "The Big Thought cannot be shown." },
          { code: "ID06", viewerClimb: "CLIMBS", subjectMatch: "OTHER", proofCanAppear: true, bigThoughtNote: "" },
        ],
      },
      ["ID01", "ID02", "ID03", "ID04", "ID05", "ID06"],
    );
    expect(items.map((item) => item.verdict)).toEqual(["PASS", "FAIL", "FAIL", "FAIL", "UNRESOLVED", "FAIL"]);
    expect(items[3]?.bigThoughtNote).toContain("Big Thought");
  });

  it("stays unresolved when a missing proof does not point at the Big Thought", () => {
    const [item] = normalizeIdeaDownTop(
      { items: [{ code: "ID01", viewerClimb: "CLIMBS", subjectMatch: "MATCH", proofCanAppear: false, bigThoughtNote: "" }] },
      ["ID01"],
    );
    expect(item?.verdict).toBe("UNRESOLVED");
  });

  it("names the chain the viewer must climb", () => {
    const prompt = buildIdeaDownTopPrompt({
      masterStatement: "Master",
      masterSubject: "the parent",
      bigThoughtStatement: "Because",
      angleStatement: "Observation",
      rows: [{ code: "ID01", statement: "A situation" }],
    });
    expect(prompt).toContain("rises to this Angle, then this Big Thought, then this Master Thought");
    expect(prompt).toContain("the parent");
    expect(prompt).toContain("name this Big Thought");
    const unsealed = normalizeIdeaDownTop(
      { items: [{ code: "ID01", viewerClimb: "CLIMBS", subjectMatch: "MATCH", proofCanAppear: true, bigThoughtNote: "" }] },
      ["ID01"],
      false,
    );
    expect(unsealed[0]?.verdict).toBe("UNRESOLVED");
  });
});

describe("idea lock", () => {
  const pass = ["AUDIT_PASS", "AUDIT_PASS", "AUDIT_PASS", "AUDIT_PASS", "AUDIT_PASS"] as const;
  const climbed = ["PASS", "PASS", "PASS", "PASS", "PASS"] as const;

  it("locks only after sibling audit and down-top both pass", () => {
    expect(
      evaluateIdeaLock({
        admittedCount: 5,
        verdicts: [...pass],
        downTop: [...climbed],
        downTopCurrent: true,
      }).ok,
    ).toBe(true);
    expect(
      evaluateIdeaLock({
        admittedCount: 5,
        verdicts: [...pass],
        downTop: ["PASS", "FAIL", "PASS", "PASS", "PASS"],
        downTopCurrent: true,
      }),
    ).toEqual({ ok: false, reason: "DOWN_TOP" });
  });

  it("asks for down-top after a passing sibling audit", () => {
    expect(
      selectIdeaStage({
        admittedCount: 5,
        verdicts: [...pass],
        downTop: [],
        downTopCurrent: false,
        repairsUsed: false,
        lockOk: false,
      }),
    ).toBe("downtop");
  });

  it("offers fix when a down-top failure rejects the mechanism", () => {
    expect(
      selectIdeaStage({
        admittedCount: 5,
        verdicts: [...pass],
        downTop: ["FAIL", "PASS", "PASS", "PASS", "PASS"],
        downTopCurrent: true,
        repairsUsed: false,
        lockOk: false,
      }),
    ).toBe("fix");
  });
});
