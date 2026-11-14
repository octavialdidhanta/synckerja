import { describe, expect, it, vi } from "vitest";
import {
  buildTerritoryPassPrompt,
  firstTerritoryFailure,
  parseTerritoryPassCheck,
  runTerritoryChecks,
  territoryChecksFromStored,
} from "@/thinking-lab/territory/passChecklist";
import { TERRITORY_NAME_LENGTH_REASON } from "@/thinking-lab/territory/generate";

/** Answers a batched prompt from a map of check id to answer; every other check passes. */
function batchAnswer(prompt: string, fails: Record<string, string> = {}): string {
  const ids = [...prompt.matchAll(/^Check (\w+):$/gm)].map((match) => match[1]);
  return JSON.stringify({
    checks: ids.map((id) => (fails[id] ? { id, pass: false, reason: fails[id] } : { id, pass: true, reason: "" })),
  });
}

const isBatch = (prompt: string) => prompt.includes('"checks"');

const parent = "Makan di luar hemat dan menawarkan lauk yang lebih variatif, karena penyedia membeli bahan dalam jumlah besar.";

describe("territory pass checklist", () => {
  it("asks each check in the pass order", () => {
    const prompt = buildTerritoryPassPrompt({
      id: "partOfBigThought",
      statement: "Makan siang kantor",
      parentStatement: parent,
    });
    expect(prompt).toContain("not a keyword copied from the Big Thought");
    expect(prompt).toContain("pass is false when the name is not an area in the audience's world");
    expect(prompt).not.toContain("pass is false only when");
    expect(prompt).toContain("does not make the name a copied keyword");
    expect(prompt).toContain("so general that any Big Thought of this Master Thought could be placed there");
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
        id: "questionArises",
        statement: "Makan siang kantor",
        parentStatement: parent,
        question: "Kenapa makan di luar bisa lebih hemat daripada bekal?",
      }),
    ).toContain("Other questions coming up in that area do not make pass false.");
    expect(
      buildTerritoryPassPrompt({
        id: "wideEnough",
        statement: "Makan siang kantor",
        parentStatement: parent,
      }),
    ).toContain("Name them in your reasoning before you decide.");
    expect(
      buildTerritoryPassPrompt({
        id: "wideEnough",
        statement: "Daging sate",
        parentStatement: parent,
      }),
    ).toContain("at least two different rarely noticed observations in this place, besides the Big Thought's own answer");
    expect(
      buildTerritoryPassPrompt({
        id: "wideEnough",
        statement: "Daging sate",
        parentStatement: parent,
      }),
    ).toContain("When you cannot name two different observations there besides the Big Thought's answer, do not return pass true.");
    expect(
      buildTerritoryPassPrompt({
        id: "wideEnough",
        statement: "Daging sate",
        parentStatement: parent,
      }),
    ).toContain("Kurir motor lebih murah fails because the name is already that one claim.");
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

  it("asks an unreadable batch once more, then each check alone", async () => {
    const ask = vi.fn(async (prompt: string) => (isBatch(prompt) ? "not json" : '{"pass":true,"reason":""}'));
    const result = await runTerritoryChecks({
      statement: "Makan siang kantor",
      parentStatement: parent,
      question: "Kenapa makan di luar bisa lebih hemat?",
      ask,
    });
    // Two batch tries, then the four model checks one by one. No peers: siblingsDistinct passes in code.
    expect(ask).toHaveBeenCalledTimes(6);
    expect(result.passed).toBe(true);
    expect(result.checks.every((check) => check.state === "pass")).toBe(true);
  });

  it("stops at the first failed check and leaves the later ones pending", async () => {
    const ask = vi.fn(async (prompt: string) =>
      isBatch(prompt) ? batchAnswer(prompt, { audienceLanguage: "Istilah internal." }) : '{"pass":true,"reason":""}',
    );
    const seen: string[] = [];
    const result = await runTerritoryChecks({
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
    expect(ask).toHaveBeenCalledTimes(1);
    expect(result.passed).toBe(false);
    expect(firstTerritoryFailure(result.checks)).toEqual({ gate: "audienceLanguage", reason: "Istilah internal." });
    expect(result.checks.find((check) => check.id === "partOfBigThought")?.state).toBe("pass");
    expect(result.checks.find((check) => check.id === "questionArises")?.state).toBe("pending");
    expect(result.checks.find((check) => check.id === "siblingsDistinct")?.state).toBe("pending");
    expect(seen).toContain("audienceLanguage:fail");
  });

  it("fails a name that is too long without asking the model", async () => {
    const ask = vi.fn(async () => '{"pass":true,"reason":""}');
    const result = await runTerritoryChecks({
      statement: "Makan siang kantor yang hemat sekali",
      parentStatement: parent,
      question: "Kenapa makan di luar bisa lebih hemat?",
      ask,
    });
    expect(ask).not.toHaveBeenCalled();
    expect(firstTerritoryFailure(result.checks)).toEqual({ gate: "partOfBigThought", reason: TERRITORY_NAME_LENGTH_REASON });
  });

  it("compares the name with the Territories that already passed", async () => {
    const ask = vi.fn(async (prompt: string) =>
      isBatch(prompt) ? batchAnswer(prompt, { siblingsDistinct: "TR01: wilayah yang sama." }) : '{"pass":true,"reason":""}',
    );
    const result = await runTerritoryChecks({
      statement: "Bekal kantor",
      parentStatement: parent,
      question: "Kenapa makan di luar bisa lebih hemat?",
      peers: [{ code: "TR01", statement: "Makan siang kantor" }],
      ask,
    });
    expect(String(ask.mock.calls[0]?.[0])).toContain("TR01: Makan siang kantor");
    expect(firstTerritoryFailure(result.checks)).toEqual({ gate: "siblingsDistinct", reason: "TR01: wilayah yang sama." });
  });

  it("fails the same name as a passed Territory in code", async () => {
    const ask = vi.fn(async (prompt: string) => (isBatch(prompt) ? batchAnswer(prompt) : '{"pass":true,"reason":""}'));
    const result = await runTerritoryChecks({
      statement: "Makan siang kantor",
      parentStatement: parent,
      question: "Kenapa makan di luar bisa lebih hemat?",
      peers: [{ code: "TR01", statement: "makan siang  kantor" }],
      ask,
    });
    expect(String(ask.mock.calls[0]?.[0])).not.toContain("Check siblingsDistinct:");
    expect(firstTerritoryFailure(result.checks)?.gate).toBe("siblingsDistinct");
  });

  it("does not ask the checks it keeps or the ones switched off", async () => {
    const ask = vi.fn(async (prompt: string) => (isBatch(prompt) ? batchAnswer(prompt) : '{"pass":true,"reason":""}'));
    const result = await runTerritoryChecks({
      statement: "Makan siang kantor",
      parentStatement: parent,
      question: "Kenapa makan di luar bisa lebih hemat?",
      keep: ["partOfBigThought", "audienceLanguage"],
      skip: ["wideEnough"],
      ask,
    });
    // Only questionArises is left for the model, so it is asked alone.
    expect(ask).toHaveBeenCalledTimes(1);
    expect(String(ask.mock.calls[0]?.[0])).toContain("Judge the supplied question only.");
    expect(result.passed).toBe(true);
    expect(result.checks.find((check) => check.id === "wideEnough")?.reason).toBe("Dimatikan untuk organisasi ini.");
  });

  it("fetches the question only when it is missing, and keeps it out of the batch until then", async () => {
    const ask = vi.fn(async (prompt: string) => (isBatch(prompt) ? batchAnswer(prompt) : '{"pass":true,"reason":""}'));
    const ensureQuestion = vi.fn(async () => "Kenapa makan di luar bisa lebih hemat?");
    const result = await runTerritoryChecks({
      statement: "Makan siang kantor",
      parentStatement: parent,
      ensureQuestion,
      ask,
    });
    expect(String(ask.mock.calls[0]?.[0])).not.toContain("Check questionArises:");
    expect(ensureQuestion).toHaveBeenCalledTimes(1);
    expect(result.question).toBe("Kenapa makan di luar bisa lebih hemat?");
    expect(result.passed).toBe(true);
  });

  it("fails questionArises when no question comes back", async () => {
    const ask = vi.fn(async (prompt: string) => (isBatch(prompt) ? batchAnswer(prompt) : '{"pass":true,"reason":""}'));
    const result = await runTerritoryChecks({ statement: "Makan siang kantor", parentStatement: parent, ask });
    expect(firstTerritoryFailure(result.checks)?.gate).toBe("questionArises");
  });

  it("shows a stored result after refresh", () => {
    expect(territoryChecksFromStored({ passed: true }).every((check) => check.state === "pass")).toBe(true);
    expect(territoryChecksFromStored({})).toEqual([]);
    expect(territoryChecksFromStored({ gateFailure: { gate: "questionArises", reason: "Lain." } }).map((check) => check.state)).toEqual([
      "pass",
      "pass",
      "fail",
      "pending",
      "pending",
    ]);
  });
});
