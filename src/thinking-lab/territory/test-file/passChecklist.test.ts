import { describe, expect, it, vi } from "vitest";
import {
  buildTerritoryPassPrompt,
  finishSiblingCheck,
  fixPriorForNextTerritoryName,
  parseTerritoryPassCheck,
  readTerritoryGeneratePasses,
  runTerritoryAdmissionChecks,
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
    expect(prompt).toContain("pass is false when the name is not an area in the audience's world");
    expect(prompt).not.toContain("pass is false only when");
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

  it("asks an unreadable check once more before failing it", async () => {
    const ask = vi.fn(async () => '{"pass":true,"reason":""}');
    ask.mockImplementationOnce(async () => "not json");
    const result = await runTerritoryIndividualChecks({
      statement: "Makan siang kantor",
      parentStatement: parent,
      question: "Kenapa makan di luar bisa lebih hemat?",
      ask,
      onStep: () => undefined,
    });
    expect(ask).toHaveBeenCalledTimes(5);
    expect(result.passed).toBe(true);
    expect(result.checks.find((check) => check.id === "partOfBigThought")?.state).toBe("pass");
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

  it("asks only the two Generate checks", async () => {
    const ask = vi.fn(async (prompt: string) =>
      prompt.includes("how the audience would name")
        ? '{"pass":false,"reason":"Istilah internal."}'
        : '{"pass":true,"reason":""}',
    );
    const result = await runTerritoryAdmissionChecks({
      statement: "Skala ekonomi",
      parentStatement: parent,
      audience: "orang kantoran",
      ask,
      onStep: () => undefined,
    });
    expect(ask).toHaveBeenCalledTimes(2);
    expect(result.passed).toBe(false);
    expect(result.checks.map((check) => check.id)).toEqual(["partOfBigThought", "audienceLanguage"]);
    expect(result.checks.find((check) => check.id === "audienceLanguage")?.state).toBe("fail");
  });

  it("does not ask Generate checks again when that name already passed them", async () => {
    const ask = vi.fn(async (prompt: string) => {
      if (prompt.includes("not a keyword") || prompt.includes("how the audience would name")) {
        return '{"pass":false,"reason":"should not be asked"}';
      }
      return '{"pass":true,"reason":""}';
    });
    const result = await runTerritoryIndividualChecks({
      statement: "Makan siang kantor",
      parentStatement: parent,
      question: "Kenapa makan di luar bisa lebih hemat?",
      carried: readTerritoryGeneratePasses(["partOfBigThought", "audienceLanguage"]),
      ask,
      onStep: () => undefined,
    });
    expect(result.passed).toBe(true);
    expect(ask).toHaveBeenCalledTimes(2);
    expect(result.checks.find((check) => check.id === "partOfBigThought")?.state).toBe("pass");
    expect(result.checks.find((check) => check.id === "audienceLanguage")?.state).toBe("pass");
    expect(result.checks.find((check) => check.id === "questionArises")?.state).toBe("pass");
    expect(result.checks.find((check) => check.id === "wideEnough")?.state).toBe("pass");
  });

  it("starts from the first check when the name has no Generate passes", async () => {
    const ask = vi.fn(async () => '{"pass":true,"reason":""}');
    const result = await runTerritoryIndividualChecks({
      statement: "Makan siang kantor",
      parentStatement: parent,
      question: "Kenapa makan di luar bisa lebih hemat?",
      carried: readTerritoryGeneratePasses(["partOfBigThought"]),
      ask,
      onStep: () => undefined,
    });
    expect(readTerritoryGeneratePasses(["partOfBigThought"])).toEqual([]);
    expect(ask).toHaveBeenCalledTimes(4);
    expect(result.checks.find((check) => check.id === "partOfBigThought")?.state).toBe("pass");
  });

  it("asks the two Generate checks again when the name changes", () => {
    const next = fixPriorForNextTerritoryName(
      [
        { id: "partOfBigThought", state: "pass" },
        { id: "audienceLanguage", state: "pass" },
        { id: "questionArises", state: "fail", reason: "A different question." },
        { id: "wideEnough", state: "pass" },
        { id: "siblingsDistinct", state: "pending" },
      ],
      "Makan siang kantor",
      "Bekal kantor",
    );
    expect(next.find((check) => check.id === "partOfBigThought")?.state).toBe("pending");
    expect(next.find((check) => check.id === "audienceLanguage")?.state).toBe("pending");
    expect(next.find((check) => check.id === "questionArises")?.state).toBe("fail");
    expect(next.find((check) => check.id === "wideEnough")?.state).toBe("pass");
  });
});
