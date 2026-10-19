import { describe, expect, it } from "vitest";
import { judgeAndSealTerritory } from "@/thinking-lab/territory/generate";
import {
  applyLivedCheck,
  applyPlaceCheck,
  buildTerritoryLivedFitPrompt,
  buildTerritoryPlacePrompt,
  buildTerritorySceneJudgePrompt,
  parseTerritoryLivedFit,
  parseTerritoryPlace,
  parseTerritorySceneJudge,
} from "@/thinking-lab/territory/checks";
import type { TerritorySemanticFacts } from "@/thinking-lab/territory/types";

function validFacts(): TerritorySemanticFacts {
  return {
    code: "TR01",
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

const validJudge = JSON.stringify({
  whatItSays: "A bounded child space",
  parentFit: true,
  conceptualForm: "TERRITORY_SPACE",
  parentScopeDuplication: false,
  generativity: "SUFFICIENT",
  boundedness: "BOUNDED",
  nominalForm: "NOMINAL",
  audienceLanguage: "AUDIENCE",
  livedQuestion: true,
});

describe("territory checks", () => {
  it("asks the place decision on its own", () => {
    const prompt = buildTerritoryPlacePrompt({
      statement: "Manajemen Proyek",
      parentStatement: "pengetahuan dan pengalaman tidak terdokumentasi",
    });
    expect(prompt).toContain("area is true only when this is a noun or a noun phrase");
    expect(prompt).toContain("Kurir paket is true");
    expect(prompt).toContain("keyword of the Big Thought");
    expect(prompt).not.toContain("orang");
    expect(parseTerritoryPlace('{"area":false}')).toBe(false);
    expect(parseTerritoryPlace("")).toBe("unresolved");
  });

  it("rejects a department even after the bundled judge passed", () => {
    const rejected = applyPlaceCheck(validFacts(), false);
    expect(rejected.relationToParent).toBe("OUT_OF_PARENT_SCOPE");
    expect(applyPlaceCheck(validFacts(), "unresolved").relationToParent).toBe("OUT_OF_PARENT_SCOPE");
    expect(applyPlaceCheck(validFacts(), true).relationToParent).toBe("VALID_TERRITORY");
  });

  it("rejects a place where this question does not come up", () => {
    const prompt = buildTerritoryLivedFitPrompt({
      statement: "Layanan Pelanggan",
      question: "mengapa tim saya selalu memulai dari nol saat menghadapi masalah serupa?",
    });
    expect(prompt).toContain("lived is true only when that question often comes up");
    expect(prompt).toContain("other questions also come up there");
    expect(prompt).not.toContain("only nearby");
    expect(prompt).not.toContain("orang");
    expect(parseTerritoryLivedFit('{"lived":false}')).toBe(false);
    const rejected = applyLivedCheck(validFacts(), false);
    expect(rejected.relationToParent).toBe("QUESTION_NOT_LIVED");
    expect(applyLivedCheck(validFacts(), "unresolved").relationToParent).toBe("QUESTION_NOT_LIVED");
  });

  it("keeps a scene only when a separate step says it does not copy the reason", () => {
    const prompt = buildTerritorySceneJudgePrompt({
      territory: "Manajemen Proyek",
      sentence: "karena tidak ada sistem yang menyimpan pelajaran dari pengalaman sebelumnya",
      parentStatement: "pengetahuan dan pengalaman tidak terdokumentasi",
    });
    expect(prompt).toContain("A different step wrote this sentence");
    expect(prompt).toContain("Do not rewrite it");
    expect(prompt).not.toContain("orang");
    expect(parseTerritorySceneJudge('{"copiesReason":true}')).toBe("COPY");
    expect(parseTerritorySceneJudge('{"copiesReason":false}')).toBe("SITUATION");
    expect(parseTerritorySceneJudge(null)).toBe("UNRESOLVED");
  });

  it("does not run the long judge when the name is not a place", async () => {
    const seen: string[] = [];
    const facts = await judgeAndSealTerritory({
      parentStatement: "Parent",
      answeredQuestion: "langkah berikutnya yang mana?",
      code: "TR02",
      statement: "Manajemen Proyek",
      ask: async (prompt) => {
        seen.push(prompt);
        if (prompt.includes('"area"')) return JSON.stringify({ area: false });
        if (prompt.includes('"lived"')) return JSON.stringify({ lived: true });
        return validJudge;
      },
    });
    expect(facts.relationToParent).toBe("OUT_OF_PARENT_SCOPE");
    expect(seen.some((prompt) => prompt.includes("conceptual space"))).toBe(false);
  });

  it("does not admit a place when the question is missing", async () => {
    const seen: string[] = [];
    const facts = await judgeAndSealTerritory({
      parentStatement: "Parent",
      code: "TR02",
      statement: "Serah terima shift",
      ask: async (prompt) => {
        seen.push(prompt);
        if (prompt.includes('"area"')) return JSON.stringify({ area: true });
        return validJudge;
      },
    });
    expect(facts.relationToParent).toBe("QUESTION_NOT_LIVED");
    expect(seen).toHaveLength(1);
  });

  it("runs the long judge only after the place and the question both pass", async () => {
    const seen: string[] = [];
    const facts = await judgeAndSealTerritory({
      parentStatement: "Parent",
      answeredQuestion: "langkah berikutnya yang mana?",
      code: "TR02",
      statement: "Serah terima shift",
      ask: async (prompt) => {
        seen.push(prompt);
        if (prompt.includes('"area"')) return JSON.stringify({ area: true });
        if (prompt.includes('"lived"')) return JSON.stringify({ lived: true });
        if (prompt.includes("conceptual space")) {
          return JSON.stringify({ generativity: "SUFFICIENT", unresolvedReasons: [] });
        }
        return validJudge;
      },
    });
    expect(facts.relationToParent).toBe("VALID_TERRITORY");
    expect(seen.some((prompt) => prompt.includes("conceptual space"))).toBe(true);
  });
});
