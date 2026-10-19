import { describe, expect, it, vi } from "vitest";
import {
  admittedTerritorySetChanged,
  buildTerritoryGeneratePrompt,
  planTerritoryGenerate,
  runTerritoryGenerate,
} from "@/thinking-lab/territory/generate";
import type { TerritorySemanticFacts } from "@/thinking-lab/territory/types";
import type { IndividualAdmission } from "@/thinking-lab/shared/verdict";

const BANNED = ["tithing", "tithe", "obc", "charity", "apple", "iphone"];

type Saved = {
  code: string;
  statement: string;
  admission: IndividualAdmission;
  bigThoughtId: string;
  parentCode: string;
};

function validFacts(code: string): TerritorySemanticFacts {
  return {
    code,
    whatItSays: "A bounded child space",
    relationToParent: "VALID_TERRITORY",
    parentFit: true,
    conceptualForm: "TERRITORY_SPACE",
    parentScopeDuplication: false,
    generativity: "SUFFICIENT",
    boundedness: "BOUNDED",
    nominalForm: "NOMINAL",
    audienceLanguage: "AUDIENCE",
    livedQuestion: true,
    resolution: "RESOLVED",
    unresolvedReasons: [],
  };
}

function unresolvedFacts(code: string): TerritorySemanticFacts {
  return {
    ...validFacts(code),
    relationToParent: "UNRESOLVED",
    generativity: "UNRESOLVED",
    resolution: "UNRESOLVED",
    unresolvedReasons: ["GENERATIVITY_UNRESOLVED"],
  };
}

describe("admittedTerritorySetChanged", () => {
  it("stays false when Generate admits nothing new", () => {
    const before = [{ code: "TR01", admission: "GENERATE_VALID" as const }];
    expect(admittedTerritorySetChanged(before, before)).toBe(false);
    expect(
      admittedTerritorySetChanged(before, [
        ...before,
        { code: "TR02", admission: "GENERATE_REJECT" as const },
      ]),
    ).toBe(false);
  });

  it("is true when a new Territory is admitted", () => {
    expect(
      admittedTerritorySetChanged(
        [{ code: "TR01", admission: "GENERATE_VALID" }],
        [
          { code: "TR01", admission: "GENERATE_VALID" },
          { code: "TR02", admission: "GENERATE_VALID" },
        ],
      ),
    ).toBe(true);
  });
});

describe("planTerritoryGenerate", () => {
  it("stops at the cap and after two rounds", () => {
    expect(planTerritoryGenerate({ activeCount: 6, generateValidCount: 1, round: 1 })).toEqual({
      needed: 0,
      stop: "CAP",
    });
    expect(planTerritoryGenerate({ activeCount: 3, generateValidCount: 0, round: 3 })).toEqual({
      needed: 0,
      stop: "ROUNDS",
    });
    expect(planTerritoryGenerate({ activeCount: 0, generateValidCount: 3, round: 1 })).toEqual({
      needed: 0,
      stop: "ENOUGH",
    });
    expect(planTerritoryGenerate({ activeCount: 3, generateValidCount: 3, round: 1, topUp: true })).toEqual({
      needed: 1,
      stop: null,
    });
    expect(planTerritoryGenerate({ activeCount: 6, generateValidCount: 6, round: 1, topUp: true })).toEqual({
      needed: 0,
      stop: "CAP",
    });
  });
});

describe("runTerritoryGenerate", () => {
  it("denies generation before calling the model when the parent gate fails", async () => {
    const propose = vi.fn(async () => ["A space"]);
    for (const reason of ["PARENT_MISSING", "PARENT_UNLOCKED", "PARENT_STALE"] as const) {
      propose.mockClear();
      const result = await runTerritoryGenerate({
        loadParent: async () => ({ ok: false, reason }),
        incumbents: [],
        propose,
        judge: async () => validFacts("TR01"),
        persist: async () => {
          throw new Error("persist should not run");
        },
      });
      expect(result.outcome).toBe("DENIED");
      expect(result.reason).toBe(reason);
      expect(propose).not.toHaveBeenCalled();
    }
  });

  it("keeps each generated territory on the Big Thought that was revalidated", async () => {
    const saved: Saved[] = [];
    const runFor = (parent: { id: string; code: string; statement: string }) =>
      runTerritoryGenerate({
        loadParent: async () => ({ ok: true, parent }),
        incumbents: [],
        propose: async () => ["One space", "Another space", "A third space"],
        judge: async (_parent, code) => validFacts(code),
        persist: async (input) => {
          const row = {
            code: input.code,
            statement: input.statement,
            admission: input.admission,
            bigThoughtId: input.parent.id,
            parentCode: input.parent.code,
          };
          saved.push(row);
          return row;
        },
      });
    await runFor({ id: "bt-1", code: "BT01", statement: "First parent" });
    await runFor({ id: "bt-2", code: "BT02", statement: "Second parent" });
    expect(saved.filter((row) => row.parentCode === "BT01").map((row) => row.bigThoughtId)).toEqual([
      "bt-1",
      "bt-1",
      "bt-1",
    ]);
    expect(saved.filter((row) => row.parentCode === "BT02").every((row) => row.bigThoughtId === "bt-2")).toBe(true);
    expect(saved.filter((row) => row.parentCode === "BT02").some((row) => row.bigThoughtId === "bt-1")).toBe(false);
  });

  it("stops after two rounds when nothing is admitted", async () => {
    const propose = vi.fn(async () => ["A space", "Another space", "A third space"]);
    const result = await runTerritoryGenerate({
      loadParent: async () => ({ ok: true, parent: { id: "bt-1", code: "BT01", statement: "Parent" } }),
      incumbents: [],
      propose,
      judge: async (_parent, code) => unresolvedFacts(code),
      persist: async (input) => ({
        code: input.code,
        statement: input.statement,
        admission: input.admission,
        bigThoughtId: input.parent.id,
        parentCode: input.parent.code,
      }),
    });
    expect(propose).toHaveBeenCalledTimes(2);
    expect(
      propose.mock.calls[1]?.[2].slice(0, 3).every((row: { relationToParent?: string }) => row.relationToParent === "UNRESOLVED"),
    ).toBe(true);
    expect(result.generateValid).toBe(0);
    expect(result.outcome).toBe("INSUFFICIENT_VALID_TERRITORIES");
    expect(result.incumbents).toHaveLength(6);
  });

  it("adds one Territory beside an already locked set and keeps those incumbents", async () => {
    const propose = vi.fn(async () => ["A further space", "Ignored"]);
    const locked = ["TR01", "TR02", "TR03"].map((code) => ({
      code,
      statement: code,
      admission: "GENERATE_VALID" as const,
      bigThoughtId: "bt-1",
    }));
    const result = await runTerritoryGenerate({
      loadParent: async () => ({ ok: true, parent: { id: "bt-1", code: "BT01", statement: "Parent" } }),
      incumbents: locked,
      topUp: true,
      propose,
      judge: async (_parent, code) => validFacts(code),
      persist: async (input) => ({
        code: input.code,
        statement: input.statement,
        admission: input.admission,
        bigThoughtId: input.parent.id,
      }),
    });
    expect(propose).toHaveBeenCalledTimes(1);
    expect(propose.mock.calls[0]?.[0].needed).toBe(1);
    expect(propose.mock.calls[0]?.[2].map((row: { code: string }) => row.code)).toEqual(["TR01", "TR02", "TR03"]);
    expect(result.incumbents.map((row) => row.code)).toEqual(["TR01", "TR02", "TR03", "TR04"]);
    expect(result.generateValid).toBe(4);
  });

  it("does not count a name longer than three words as admitted", async () => {
    const result = await runTerritoryGenerate({
      loadParent: async () => ({ ok: true, parent: { id: "bt-1", code: "BT01", statement: "Parent" } }),
      incumbents: [],
      propose: async () => ["Pekerjaan yang Membutuhkan Konsistensi"],
      judge: async (_parent, code) => validFacts(code),
      persist: async (input) => ({
        code: input.code,
        statement: input.statement,
        admission: input.admission,
        bigThoughtId: input.parent.id,
      }),
    });
    expect(result.generateValid).toBe(0);
    expect(result.incumbents.every((row) => row.admission === "GENERATE_REJECT")).toBe(true);
    const prompt = buildTerritoryGeneratePrompt({
      parentStatement: "Parent",
      incumbents: result.incumbents,
      needed: 1,
    });
    expect(prompt).toContain("Why it failed: The name is longer than three words. Write a noun of at most three words.");
  });

  it("does not count an activity name as admitted", async () => {
    let calls = 0;
    const result = await runTerritoryGenerate({
      loadParent: async () => ({ ok: true, parent: { id: "bt-1", code: "BT01", statement: "Parent" } }),
      incumbents: [],
      propose: async () => {
        calls += 1;
        return calls === 1 ? ["Pelaksanaan Prosedur", "Pengenalan Pekerjaan", "Serah Terima Tugas"] : [];
      },
      judge: async (_parent, code) => validFacts(code),
      persist: async (input) => ({
        code: input.code,
        statement: input.statement,
        admission: input.admission,
        bigThoughtId: input.parent.id,
      }),
    });
    const byName = new Map(result.incumbents.map((row) => [row.statement, row.admission]));
    expect(byName.get("Pelaksanaan Prosedur")).toBe("GENERATE_REJECT");
    expect(byName.get("Pengenalan Pekerjaan")).toBe("GENERATE_REJECT");
    expect(byName.get("Serah Terima Tugas")).toBe("GENERATE_VALID");
    expect(result.generateValid).toBe(1);
  });
});

describe("buildTerritoryGeneratePrompt", () => {
  it("does not use banned domain examples", () => {
    const prompt = buildTerritoryGeneratePrompt({
      parentStatement: "A parent.",
      incumbents: [],
      needed: 3,
    }).toLowerCase();
    for (const word of BANNED) expect(prompt).not.toContain(word);
  });

  it("asks for a claim-free audience area that still needs the Master Thought stake", () => {
    const prompt = buildTerritoryGeneratePrompt({
      parentStatement: "Waktu untuk pertumbuhan investasi lebih panjang.",
      ancestors: [{ label: "Master Thought", statement: "Uang di usia muda lebih berharga ditabung." }],
      incumbents: [],
      needed: 3,
    });
    expect(prompt).toContain("area in the audience's world");
    expect(prompt).toContain("Write a noun or a noun phrase. Do not write a claim, a belief, or a because-clause.");
    expect(prompt).toContain("Kurir paket is the shape of the name");
    expect(prompt).toContain("Write the name only");
    expect(prompt).toContain("It is part of the Big Thought, not a keyword of the Big Thought.");
    expect(prompt).toContain("not an internal strategy term");
    expect(prompt).toContain("must actually show up in that area of real life");
    expect(prompt).toContain("wide enough for several different Angles");
    expect(prompt).toContain("impact, a requirement, or an evaluation");
    expect(prompt).toContain("Do not put the Big Thought's reason into the name.");
    expect(prompt).toContain("once the Master Thought stake is removed");
    expect(prompt).toContain("the part of the belief that is not in the subject");
    expect(prompt).toContain("not rejected only because that name can still be said");
    expect(prompt).toContain("The name is at most three words.");
    expect(prompt).not.toContain("Audience:");
    expect(prompt).not.toContain("orang");
  });

  it("names the Master Thought audience and keeps the four pass conditions", () => {
    const prompt = buildTerritoryGeneratePrompt({
      parentStatement: "Nilai barang konsumtif cepat tergerus.",
      ancestors: [
        {
          label: "Master Thought",
          statement: "Uang di usia muda lebih berharga ditabung daripada dihabiskan untuk mengejar motor paling kencang.",
        },
      ],
      audience: "anak muda hobi motor",
      incumbents: [],
      needed: 3,
    });
    expect(prompt).toContain("It is part of the Big Thought, not a keyword of the Big Thought.");
    expect(prompt).toContain("not an internal strategy term");
    expect(prompt).toContain("This is a test of words, not of topic.");
    expect(prompt).toContain("this audience's real life");
    expect(prompt).toContain("only fits a different audience");
    expect(prompt).toContain("wide enough for several different Angles");
    expect(prompt).toContain("Audience: anak muda hobi motor");
    expect(prompt).toContain("once the Master Thought stake is removed");
  });

  it("tells the next generate why an earlier Territory failed", () => {
    const prompt = buildTerritoryGeneratePrompt({
      parentStatement: "A parent.",
      incumbents: [],
      lessons: [{ code: "TR04", statement: "A failed space", reason: "It overlapped TR02." }],
      needed: 1,
    });
    expect(prompt).toContain("TR04: A failed space");
    expect(prompt).toContain("Why it failed: It overlapped TR02.");
    expect(prompt).toContain("Do not repeat the mistake");
    expect(prompt).toContain("A new name that fails for the same reason is still that mistake.");
  });

  it("carries an out-of-scope rejection into the next generate", () => {
    const prompt = buildTerritoryGeneratePrompt({
      parentStatement: "panduan yang jelas untuk setiap langkah kerja.",
      incumbents: [
        {
          code: "TR01",
          statement: "Proses Kerja Harian",
          admission: "GENERATE_REJECT",
          relationToParent: "OUT_OF_PARENT_SCOPE",
        },
      ],
      needed: 3,
    });
    expect(prompt).toContain("TR01: Proses Kerja Harian");
    expect(prompt).toContain("Why it failed: This is not an area in the audience's world. A keyword of the Big Thought, an internal term, or a claim is the same mistake.");
    expect(prompt).toContain("Do not put the reason into the name.");
  });
});
