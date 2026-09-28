import { describe, expect, it, vi } from "vitest";
import { buildAngleGeneratePrompt, planAngleGenerate, runAngleGenerate } from "@/thinking-lab/angle/generate";
import type { AngleSemanticFacts } from "@/thinking-lab/angle/types";
import type { IndividualAdmission } from "@/thinking-lab/shared/verdict";

const BANNED = ["tithing", "tithe", "obc", "charity", "apple", "iphone"];

type Saved = {
  code: string;
  statement: string;
  admission: IndividualAdmission;
  territoryId: string;
  parentCode: string;
};

function validFacts(code: string): AngleSemanticFacts {
  return {
    code,
    whatItSays: "A specific point of view",
    relationToParent: "VALID_ANGLE",
    parentFit: true,
    conceptualForm: "ANGLE_PROPOSITION",
    ideaGenerativity: "SUFFICIENT",
    boundedness: "BOUNDED",
    jobForm: "OBSERVATION",
    resolution: "RESOLVED",
    unresolvedReasons: [],
  };
}

function rejectedFacts(code: string): AngleSemanticFacts {
  return {
    ...validFacts(code),
    relationToParent: "IDEA_LIKE",
    conceptualForm: "IDEA_LIKE",
  };
}

describe("planAngleGenerate", () => {
  it("stops at the cap, after two rounds, and when three are admitted", () => {
    expect(planAngleGenerate({ activeCount: 6, generateValidCount: 1, round: 1 })).toEqual({
      needed: 0,
      stop: "CAP",
    });
    expect(planAngleGenerate({ activeCount: 3, generateValidCount: 0, round: 3 })).toEqual({
      needed: 0,
      stop: "ROUNDS",
    });
    expect(planAngleGenerate({ activeCount: 0, generateValidCount: 3, round: 1 })).toEqual({
      needed: 0,
      stop: "ENOUGH",
    });
  });
});

describe("runAngleGenerate", () => {
  it("denies generation before calling the model when the Territory gate fails", async () => {
    const propose = vi.fn(async () => ["A point of view"]);
    for (const reason of ["PARENT_MISSING", "PARENT_UNLOCKED", "PARENT_STALE", "PARENT_CHAIN_INVALID"] as const) {
      propose.mockClear();
      const result = await runAngleGenerate({
        loadParent: async () => ({ ok: false, reason }),
        incumbents: [],
        propose,
        judge: async () => validFacts("AN01"),
        persist: async () => {
          throw new Error("persist should not run");
        },
      });
      expect(result.outcome).toBe("DENIED");
      expect(result.reason).toBe(reason);
      expect(propose).not.toHaveBeenCalled();
    }
  });

  it("keeps each generated angle on the Territory that was revalidated", async () => {
    const saved: Saved[] = [];
    const runFor = (parent: { id: string; code: string; statement: string; territoryFingerprint: string }) =>
      runAngleGenerate({
        loadParent: async () => ({ ok: true, parent }),
        incumbents: [],
        propose: async () => ["One view", "Another view", "A third view"],
        judge: async (_parent, code) => validFacts(code),
        persist: async (input) => {
          const row = {
            code: input.code,
            statement: input.statement,
            admission: input.admission,
            territoryId: input.parent.id,
            parentCode: input.parent.code,
          };
          saved.push(row);
          return row;
        },
      });
    await runFor({ id: "tr-1", code: "TR01", statement: "First space", territoryFingerprint: "fp-1" });
    await runFor({ id: "tr-2", code: "TR02", statement: "Second space", territoryFingerprint: "fp-2" });
    expect(saved.filter((row) => row.parentCode === "TR01").map((row) => row.territoryId)).toEqual([
      "tr-1",
      "tr-1",
      "tr-1",
    ]);
    expect(saved.filter((row) => row.parentCode === "TR02").every((row) => row.territoryId === "tr-2")).toBe(true);
    expect(saved.some((row) => row.parentCode === "TR02" && row.territoryId === "tr-1")).toBe(false);
  });

  it("persists rejected candidates", async () => {
    const saved: Saved[] = [];
    const result = await runAngleGenerate({
      loadParent: async () => ({
        ok: true,
        parent: { id: "tr-1", code: "TR01", statement: "A space", territoryFingerprint: "fp-1" },
      }),
      incumbents: [],
      propose: async () => ["A concrete concept"],
      judge: async (_parent, code) => rejectedFacts(code),
      persist: async (input) => {
        const row = {
          code: input.code,
          statement: input.statement,
          admission: input.admission,
          territoryId: input.parent.id,
          parentCode: input.parent.code,
        };
        saved.push(row);
        return row;
      },
    });
    expect(saved.map((row) => row.admission)).toContain("GENERATE_REJECT");
    expect(result.incumbents.some((row) => row.admission === "GENERATE_REJECT")).toBe(true);
    expect(result.generateValid).toBe(0);
  });
});

describe("buildAngleGeneratePrompt", () => {
  it("does not use banned domain examples", () => {
    const prompt = buildAngleGeneratePrompt({
      parentStatement: "A space.",
      incumbents: [],
      needed: 3,
    }).toLowerCase();
    for (const word of BANNED) expect(prompt).not.toContain(word);
  });
});
