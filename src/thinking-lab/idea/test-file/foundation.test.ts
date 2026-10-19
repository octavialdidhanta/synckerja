import { describe, expect, it } from "vitest";
import { sameIdeaConcept } from "@/thinking-lab/idea/conceptIdentity";
import { canShowGenerateIdea, evaluateIdeaParent } from "@/thinking-lab/idea/eligibility";
import { buildIdeaGeneratePrompt, countAdmittedIdeas, planIdeaGenerate, runIdeaGenerate } from "@/thinking-lab/idea/generate";
import { admitIdea, visibleIdeas } from "@/thinking-lab/idea/policy";
import {
  buildIdeaJudgePrompt,
  deriveIdeaRelation,
  holdCauseUntilSubject,
  judgeIdea,
  normalizeIdeaFacts,
  rejectAnnouncedConclusion,
} from "@/thinking-lab/idea/semantic";
import type { IdeaSemanticFacts } from "@/thinking-lab/idea/types";
import { angleFingerprint, territoryFingerprint, bigThoughtFingerprint } from "@/thinking-lab/shared/fingerprint";

const APPLE_ANGLE = "Innovation does not always mean adding something; sometimes innovation means removing what is unnecessary.";
const APPLE_IDEA =
  "Compare two products that perform the same task: one overloaded with features and controls, and one simplified to only the essential functions, then observe which one enables the user to complete the task more easily.";

function facts(overrides: Partial<IdeaSemanticFacts> = {}): IdeaSemanticFacts {
  return {
    code: "ID01",
    whatItSays: "A concrete concept",
    subject: "A concrete concept",
    relationToParent: "UNRESOLVED",
    parentFit: true,
    conceptualForm: "IDEA_CONCEPT",
    creativeMechanism: "COMPARISON",
    conceptualCompleteness: "SUFFICIENT",
    executionIndependence: "INDEPENDENT",
    boundedness: "BOUNDED",
    causeLock: "LOCKED",
    mechanismKeys: [{ otherExplanation: "Another cause", close: "The setup removes it" }],
    situationForm: "SITUATION",
    resolution: "UNRESOLVED",
    unresolvedReasons: [],
    ...overrides,
  };
}

function sealed(overrides: Record<string, unknown> = {}) {
  return normalizeIdeaFacts({
    code: "ID01",
    whatItSays: "A concrete concept",
    subject: "A concrete concept",
    parentFit: true,
    conceptualForm: "IDEA_CONCEPT",
    creativeMechanism: "COMPARISON",
    conceptualCompleteness: "SUFFICIENT",
    executionIndependence: "INDEPENDENT",
    boundedness: "BOUNDED",
    causeLock: "LOCKED",
    mechanismKeys: [{ otherExplanation: "Another cause", close: "The setup removes it" }],
    situationForm: "SITUATION",
    ...overrides,
  });
}

const chain = {
  territory: {
    id: "tr",
    status: "locked",
    statement: "Innovation",
    semanticFingerprint: territoryFingerprint({
      statement: "Innovation",
      bigThoughtFingerprint: bigThoughtFingerprint({ statement: "Belief", masterThoughtFingerprint: "master" }),
    }),
    bigThoughtId: "bt",
  },
  bigThought: {
    id: "bt",
    status: "locked",
    statement: "Belief",
    semanticFingerprint: bigThoughtFingerprint({ statement: "Belief", masterThoughtFingerprint: "master" }),
  },
  masterThoughtFingerprint: "master",
};

describe("idea relations", () => {
  it("accepts a comparison idea", () => {
    const row = sealed({ creativeMechanism: "COMPARISON" });
    expect(row.relationToParent).toBe("VALID_IDEA");
    expect(admitIdea(row)).toBe("GENERATE_VALID");
  });

  it("accepts an experiment idea", () => {
    expect(sealed({ creativeMechanism: "EXPERIMENT" }).relationToParent).toBe("VALID_IDEA");
  });

  it("rejects a finished story", () => {
    expect(sealed({ creativeMechanism: "NARRATIVE" }).relationToParent).toBe("EXECUTION_LIKE");
  });

  it("rejects a mechanism that is not a demonstration, experiment, comparison, or situation", () => {
    expect(sealed({ creativeMechanism: "METAPHOR" }).relationToParent).toBe("UNDERDEVELOPED_CONCEPT");
    expect(sealed({ creativeMechanism: "OBSERVATION" }).relationToParent).toBe("ANGLE_LIKE");
  });

  it("rejects a locked cause that has no separate keys", () => {
    expect(sealed({ mechanismKeys: [] }).relationToParent).toBe("CAUSE_UNLOCKED");
  });

  it("rejects a candidate outside the parent angle", () => {
    expect(deriveIdeaRelation(facts({ parentFit: false, conceptualForm: "BIG_THOUGHT_LIKE" }))).toBe("OUT_OF_PARENT_SCOPE");
  });

  it("rejects an angle-like candidate", () => {
    expect(deriveIdeaRelation(facts({ conceptualForm: "ANGLE_LIKE" }))).toBe("ANGLE_LIKE");
  });

  it("rejects a territory-like candidate", () => {
    expect(deriveIdeaRelation(facts({ conceptualForm: "TERRITORY_LIKE" }))).toBe("TERRITORY_LIKE");
  });

  it("rejects a big-thought-like candidate", () => {
    expect(deriveIdeaRelation(facts({ conceptualForm: "BIG_THOUGHT_LIKE", boundedness: "UNBOUNDED" }))).toBe("BIG_THOUGHT_LIKE");
  });

  it("rejects an execution-like candidate", () => {
    expect(deriveIdeaRelation(facts({ conceptualForm: "EXECUTION_LIKE" }))).toBe("EXECUTION_LIKE");
    expect(deriveIdeaRelation(facts({ executionIndependence: "EXECUTION_BOUND", conceptualCompleteness: "UNRESOLVED" }))).toBe(
      "EXECUTION_LIKE",
    );
  });

  it("rejects an underdeveloped concept", () => {
    expect(deriveIdeaRelation(facts({ conceptualCompleteness: "INSUFFICIENT" }))).toBe("UNDERDEVELOPED_CONCEPT");
  });

  it("rejects an unbounded idea", () => {
    expect(deriveIdeaRelation(facts({ boundedness: "UNBOUNDED" }))).toBe("UNBOUNDED_IDEA");
  });

  it("rejects a verbal explanation of the Big Thought", () => {
    expect(deriveIdeaRelation(facts({ situationForm: "VERBAL" }))).toBe("BIG_THOUGHT_LIKE");
    expect(admitIdea(sealed({ situationForm: "VERBAL" }))).toBe("GENERATE_REJECT");
  });

  it("treats an announced conclusion as verbal and keeps a stated result", async () => {
    const announced =
      "Sebuah layanan yang menyediakan tenaga kerja khusus untuk menyiapkan bekal dipekerjakan, menunjukkan bahwa biaya total bekal melebihi harga makan siang di luar.";
    const stated =
      "Sebuah layanan yang menyediakan tenaga kerja khusus untuk menyiapkan bekal dipekerjakan, dan upah tenaga kerja itu membuat biaya total bekal melebihi harga makan siang di luar.";
    const rejected = rejectAnnouncedConclusion(sealed({ situationForm: "SITUATION" }), announced);
    expect(rejected.situationForm).toBe("VERBAL");
    expect(rejected.relationToParent).toBe("BIG_THOUGHT_LIKE");
    expect(admitIdea(rejected)).toBe("GENERATE_REJECT");
    const kept = rejectAnnouncedConclusion(sealed({ situationForm: "SITUATION" }), stated);
    expect(kept.situationForm).toBe("SITUATION");
    expect(kept.relationToParent).toBe("VALID_IDEA");
    const judged = await judgeIdea(
      { parentStatement: APPLE_ANGLE, masterSubject: "the tool", candidate: { code: "ID05", statement: announced } },
      async () =>
        JSON.stringify({
          code: "ID05",
          subject: "Upah tenaga bekal",
          whatItSays: announced,
          parentFit: true,
          conceptualForm: "IDEA_CONCEPT",
          creativeMechanism: "COMPARISON",
          conceptualCompleteness: "SUFFICIENT",
          executionIndependence: "INDEPENDENT",
          boundedness: "BOUNDED",
          situationForm: "SITUATION",
          causeLock: "LOCKED",
          mechanismKeys: [{ otherExplanation: "Waktu persiapan bekal itu gratis", close: "Ada harga untuk setiap menit yang dihemat" }],
        }),
    );
    expect(judged.situationForm).toBe("VERBAL");
    expect(judged.relationToParent).toBe("BIG_THOUGHT_LIKE");
  });

  it("rejects a situation that leaves another explanation open", () => {
    const row = sealed({ causeLock: "OPEN" });
    expect(row.relationToParent).toBe("CAUSE_UNLOCKED");
    expect(admitIdea(row)).toBe("GENERATE_REJECT");
  });

  it("stays unresolved when the new job facts are missing", () => {
    const row = normalizeIdeaFacts({
      code: "ID01",
      whatItSays: "A concrete concept",
      parentFit: true,
      conceptualForm: "IDEA_CONCEPT",
      creativeMechanism: "COMPARISON",
      conceptualCompleteness: "SUFFICIENT",
      executionIndependence: "INDEPENDENT",
      boundedness: "BOUNDED",
    });
    expect(row.relationToParent).toBe("UNRESOLVED");
    expect(row.unresolvedReasons).toContain("SITUATION_FORM_UNRESOLVED");
    expect(row.unresolvedReasons).toContain("CAUSE_LOCK_UNRESOLVED");
  });

  it("stays unresolved when a required fact is unresolved", () => {
    const row = sealed({ conceptualCompleteness: "UNRESOLVED" });
    expect(row.relationToParent).toBe("UNRESOLVED");
    expect(admitIdea(row)).toBe("UNRESOLVED");
  });

  it("keeps parent fit ahead of later form", () => {
    expect(deriveIdeaRelation(facts({ parentFit: false, conceptualForm: "ANGLE_LIKE", boundedness: "UNBOUNDED" }))).toBe(
      "OUT_OF_PARENT_SCOPE",
    );
  });

  it("lets a resolved higher rejection beat a lower unresolved fact", () => {
    expect(
      deriveIdeaRelation(facts({ conceptualForm: "ANGLE_LIKE", conceptualCompleteness: "UNRESOLVED", boundedness: "UNRESOLVED" })),
    ).toBe("ANGLE_LIKE");
    expect(deriveIdeaRelation(facts({ conceptualCompleteness: "INSUFFICIENT", executionIndependence: "UNRESOLVED" }))).toBe(
      "UNDERDEVELOPED_CONCEPT",
    );
  });

  it("keeps the Apple comparison as a valid idea", () => {
    const row = sealed({
      whatItSays: "A comparison of an overloaded product and a simplified product",
      creativeMechanism: "COMPARISON",
    });
    expect(row.relationToParent).toBe("VALID_IDEA");
    expect(admitIdea(row)).toBe("GENERATE_VALID");
    const prompt = buildIdeaJudgePrompt({ parentStatement: APPLE_ANGLE, candidate: { code: "ID01", statement: APPLE_IDEA } });
    expect(prompt).toContain("concrete mechanism");
    expect(prompt).toContain("is not SITUATION");
    expect(prompt).toContain("must not verbally explain the Big Thought");
    expect(prompt).toContain("mechanismKeys");
    expect(prompt).toContain("named Master Thought subject");
    const named = buildIdeaJudgePrompt({
      parentStatement: APPLE_ANGLE,
      masterSubject: "the tool",
      candidate: { code: "ID01", statement: APPLE_IDEA },
    });
    expect(named).toContain("the tool");
    const held = holdCauseUntilSubject(sealed({ causeLock: "LOCKED" }), "");
    expect(held.relationToParent).toBe("UNRESOLVED");
    expect(holdCauseUntilSubject(sealed({ causeLock: "LOCKED" }), "the tool").relationToParent).toBe("VALID_IDEA");
    expect(prompt).toContain(APPLE_IDEA);
    expect(prompt.toLowerCase()).not.toContain("iphone");
  });
});

describe("idea eligibility", () => {
  const territoryFp = chain.territory.semanticFingerprint;
  const angleStatement = APPLE_ANGLE;
  const angleFp = angleFingerprint({ statement: angleStatement, territoryFingerprint: territoryFp });
  const angle = { id: "an", status: "locked", statement: angleStatement, semanticFingerprint: angleFp, territoryId: "tr" };

  it("blocks Generate Idea when the angle is not locked or current", () => {
    expect(canShowGenerateIdea(angle, territoryFp)).toBe(true);
    expect(canShowGenerateIdea({ ...angle, status: "candidate" }, territoryFp)).toBe(false);
    expect(canShowGenerateIdea({ ...angle, semanticFingerprint: "stale" }, territoryFp)).toBe(false);
    expect(evaluateIdeaParent({ ...chain, angle: { ...angle, status: "candidate" } }).ok).toBe(false);
  });

  it("rejects an angle attached to the wrong territory", () => {
    const gate = evaluateIdeaParent({ ...chain, angle, expectedTerritoryId: "other" });
    expect(gate.ok).toBe(false);
  });
});

describe("idea persistence helpers", () => {
  it("keeps rejected candidates in the stored set and shows only admitted ideas under the angle", () => {
    const rows = [
      { angleId: "an-1", admission: "GENERATE_VALID" as const, code: "ID01" },
      { angleId: "an-1", admission: "GENERATE_REJECT" as const, code: "ID02" },
      { angleId: "an-2", admission: "GENERATE_VALID" as const, code: "ID03" },
    ];
    expect(rows.map((row) => row.code)).toEqual(["ID01", "ID02", "ID03"]);
    expect(visibleIdeas(rows, "an-1").map((row) => row.code)).toEqual(["ID01"]);
  });

  it("persists a rejected candidate during generate", async () => {
    const stored: Array<{ admission: string }> = [];
    const result = await runIdeaGenerate({
      loadParent: async () => ({ ok: true, parent: { id: "an", code: "AN01", statement: APPLE_ANGLE, angleFingerprint: "fp" } }),
      incumbents: [],
      propose: async () => ["A point of view only"],
      judge: async () => facts({ conceptualForm: "ANGLE_LIKE", relationToParent: "ANGLE_LIKE", resolution: "RESOLVED" }),
      persist: async (row) => {
        stored.push({ admission: row.admission });
        return { code: row.code, statement: row.statement, admission: row.admission, angleId: "an" };
      },
    });
    expect(stored[0]?.admission).toBe("GENERATE_REJECT");
    expect(result.outcome).toBe("INSUFFICIENT_VALID_IDEAS");
    expect(planIdeaGenerate({ activeCount: 10, generateValidCount: 1, round: 1 }).stop).toBe("CAP");
  });

  it("reads locked ideas when generating the next wave and skips the same meaning", async () => {
    const locked = {
      code: "ID01",
      statement: "Compare an overloaded control panel with a simplified one.",
      admission: "GENERATE_VALID" as const,
      angleId: "an",
      locked: true,
    };
    expect(countAdmittedIdeas([locked])).toBe(0);
    const prompt = buildIdeaGeneratePrompt({
      parentStatement: APPLE_ANGLE,
      incumbents: [locked, { code: "ID02", statement: "A rejected observation.", locked: false }],
      needed: 1,
    });
    expect(prompt).toContain("Locked Ideas already sealed:");
    expect(prompt).toContain(locked.statement);
    expect(prompt).toContain("Do not reuse its meaning.");
    expect(prompt).toContain("Do not write a finished story.");
    expect(prompt).toContain("State what becomes true in the sentence so the mechanism can be understood.");
    expect(prompt).toContain("menunjukkan bahwa");
    expect(prompt).toContain("When the Angle is not English, do not write the statement or the keys in English.");
    expect(prompt).not.toContain("We [make / invite / show / create]");
    expect(prompt).toContain("A rejected observation.");
    const stored: string[] = [];
    const seen: string[][] = [];
    const result = await runIdeaGenerate({
      loadParent: async () => ({ ok: true, parent: { id: "an", code: "AN01", statement: APPLE_ANGLE, angleFingerprint: "fp" } }),
      incumbents: [locked],
      propose: async (_plan, _parent, incumbents) => {
        seen.push(incumbents.filter((row) => row.locked).map((row) => row.statement));
        return [locked.statement, "Remove one control and watch the task finish."];
      },
      judge: async () => sealed({ creativeMechanism: "EXPERIMENT" }),
      persist: async (row) => {
        stored.push(row.statement);
        return { code: row.code, statement: row.statement, admission: row.admission, angleId: "an", locked: false };
      },
    });
    expect(seen[0]).toEqual([locked.statement]);
    expect(stored).not.toContain(locked.statement);
    expect(stored).toContain("Remove one control and watch the task finish.");
    expect(result.generateValid).toBeGreaterThan(0);
  });
});

describe("idea concept identity", () => {
  it("treats a platform-only change as the same concept", () => {
    const base = "Compare an overloaded control panel with a simplified one and see which task finishes more easily.";
    expect(sameIdeaConcept(`${base}\nPost it as a carousel`, `${base}\nPost it as a video`)).toBe(true);
  });

  it("treats a title-only change as the same concept", () => {
    const body = "Compare an overloaded control panel with a simplified one and see which task finishes more easily.";
    expect(sameIdeaConcept(`Feature pile\n${body}`, `Less is more\n${body}`)).toBe(true);
    expect(sameIdeaConcept(body, "Run an experiment that removes one control at a time.")).toBe(false);
  });
});
