import { describe, expect, it, vi } from "vitest";
import {
  buildTerritoryPassPrompt,
  finishSiblingCheck,
  parseTerritoryPassCheck,
  runTerritoryIndividualChecks,
  runTerritoryOpenChecks,
} from "@/thinking-lab/territory/passChecklist";

const parent = "Makan di luar hemat dan menawarkan lauk yang lebih variatif, karena penyedia membeli bahan dalam jumlah besar.";

describe("territory pass checklist", () => {
  it("asks each check in the pass order", () => {
    const prompt = buildTerritoryPassPrompt({
      id: "partOfBigThought",
      statement: "Makan siang kantor",
      parentStatement: parent,
    });
    expect(prompt).toContain("not a keyword copied from the Big Thought");
    expect(prompt).toContain("does not make the name a copied keyword");
    expect(prompt).toContain("does not make pass false");
    expect(prompt).toContain("return pass true");
    expect(prompt).toContain("Makan siang kantor");
    expect(
      buildTerritoryPassPrompt({
        id: "questionArises",
        statement: "Makan siang kantor",
        parentStatement: parent,
        question: "Kenapa makan di luar bisa lebih hemat daripada bekal?",
      }),
    ).toContain("Kenapa makan di luar bisa lebih hemat daripada bekal?");
    expect(
      buildTerritoryPassPrompt({
        id: "questionArises",
        statement: "Makan siang kantor",
        parentStatement: parent,
        question: "Kenapa makan di luar bisa lebih hemat daripada bekal?",
      }),
    ).toContain("Judge the supplied question only.");
    expect(
      buildTerritoryPassPrompt({
        id: "wideEnough",
        statement: "Makan siang kantor",
        parentStatement: parent,
      }),
    ).toContain("several different Angles");
  });

  it("treats an undecided answer as a failure", () => {
    expect(parseTerritoryPassCheck(null)).toEqual({ pass: false, reason: "This check could not be decided." });
    expect(parseTerritoryPassCheck('{"pass":"maybe"}')).toEqual({
      pass: false,
      reason: "This check could not be decided.",
    });
    expect(parseTerritoryPassCheck('{"pass":false,"reason":"Nama ini hanya kata kunci."}')).toEqual({
      pass: false,
      reason: "Nama ini hanya kata kunci.",
    });
  });

  it("stops at the first failed check and does not ask the later ones", async () => {
    const ask = vi.fn(async (prompt: string) => {
      if (prompt.includes("not a keyword")) return '{"pass":true,"reason":""}';
      if (prompt.includes("how the audience would name")) return '{"pass":false,"reason":"Istilah internal."}';
      return '{"pass":true,"reason":""}';
    });
    const seen: string[] = [];
    const result = await runTerritoryIndividualChecks({
      statement: "Skala ekonomi",
      parentStatement: parent,
      audience: "orang kantoran",
      question: "Kenapa makan di luar bisa lebih hemat?",
      ask,
      onStep: (checks) => {
        const current = checks.find((check) => check.state === "running" || check.state === "fail");
        if (current) seen.push(`${current.id}:${current.state}`);
      },
    });
    expect(ask).toHaveBeenCalledTimes(2);
    expect(result.passed).toBe(false);
    expect(result.checks.find((check) => check.id === "partOfBigThought")?.state).toBe("pass");
    expect(result.checks.find((check) => check.id === "audienceLanguage")).toMatchObject({
      state: "fail",
      reason: "Istilah internal.",
    });
    expect(result.checks.find((check) => check.id === "questionArises")?.state).toBe("pending");
    expect(result.checks.find((check) => check.id === "wideEnough")?.state).toBe("pending");
    expect(result.checks.find((check) => check.id === "siblingsDistinct")?.state).toBe("pending");
    expect(seen).toContain("audienceLanguage:fail");
    expect(finishSiblingCheck(result.checks, true, "").find((check) => check.id === "siblingsDistinct")?.state).toBe(
      "pending",
    );
  });

  it("re-asks only the failed name check and the checks that have not run", async () => {
    const ask = vi.fn(async (prompt: string) => {
      if (prompt.includes("how the audience would name")) return '{"pass":true,"reason":""}';
      if (prompt.includes("question the Big Thought answers")) return '{"pass":true,"reason":""}';
      if (prompt.includes("several different Angles")) return '{"pass":true,"reason":""}';
      return '{"pass":false,"reason":"should not be asked"}';
    });
    const ensureQuestion = vi.fn(async () => "Pertanyaan baru");
    const result = await runTerritoryOpenChecks({
      statement: "Bekal kantor",
      parentStatement: parent,
      audience: "orang kantoran",
      question: "Kenapa makan di luar bisa lebih hemat?",
      prior: [
        { id: "partOfBigThought", state: "pass" },
        { id: "audienceLanguage", state: "fail", reason: "Istilah internal." },
        { id: "questionArises", state: "pending" },
        { id: "wideEnough", state: "pending" },
        { id: "siblingsDistinct", state: "pending" },
      ],
      ensureQuestion,
      ask,
      onStep: () => undefined,
    });
    expect(ask).toHaveBeenCalledTimes(3);
    expect(ask.mock.calls.some(([prompt]) => String(prompt).includes("not a keyword"))).toBe(false);
    expect(ensureQuestion).not.toHaveBeenCalled();
    expect(result.passed).toBe(true);
    expect(result.question).toBe("Kenapa makan di luar bisa lebih hemat?");
    expect(result.checks.find((check) => check.id === "audienceLanguage")?.state).toBe("pass");
    expect(result.checks.find((check) => check.id === "siblingsDistinct")?.state).toBe("pending");
  });

  it("keeps a passed question and does not ask for another one", async () => {
    const ask = vi.fn(async () => '{"pass":true,"reason":""}');
    const ensureQuestion = vi.fn(async () => "Pertanyaan baru");
    const result = await runTerritoryOpenChecks({
      statement: "Bekal kantor",
      parentStatement: parent,
      audience: "orang kantoran",
      question: "Kenapa makan di luar bisa lebih hemat?",
      prior: [
        { id: "partOfBigThought", state: "pass" },
        { id: "audienceLanguage", state: "fail", reason: "Istilah internal." },
        { id: "questionArises", state: "pass" },
        { id: "wideEnough", state: "pass" },
        { id: "siblingsDistinct", state: "pending" },
      ],
      ensureQuestion,
      ask,
      onStep: () => undefined,
    });
    expect(ask).toHaveBeenCalledTimes(1);
    expect(ensureQuestion).not.toHaveBeenCalled();
    expect(result.passed).toBe(true);
    expect(result.question).toBe("Kenapa makan di luar bisa lebih hemat?");
  });
});
