import { describe, expect, it, vi } from "vitest";
import {
  buildIdeaPassPrompt,
  finishIdeaSiblingCheck,
  ideaChecklistPassed,
  ideaVerdictForStage,
  parseIdeaPassCheck,
  runIdeaIndividualChecks,
  runIdeaOpenChecks,
  type IdeaPassCheck,
} from "@/thinking-lab/idea/passChecklist";

const parent = "Porsi kecil membuat harga terlihat hemat";
const keys = [{ otherExplanation: "Porsi memang kecil", close: "Bandingkan harga per ons" }];

describe("idea pass checklist", () => {
  it("asks the sentence form before the later checks", () => {
    const prompt = buildIdeaPassPrompt({
      id: "sentenceForm",
      statement: "Kita bandingkan harga per ons sehingga hematnya terlihat",
      parentStatement: parent,
    });
    expect(prompt).toContain("what is made, invited, shown, or created");
    expect(prompt).toContain("Kita bandingkan harga per ons sehingga hematnya terlihat");
    expect(
      buildIdeaPassPrompt({
        id: "causeLock",
        statement: "Kita bandingkan harga per ons sehingga hematnya terlihat",
        parentStatement: parent,
        masterSubject: "Skala bahan",
        mechanismKeys: keys,
      }),
    ).toContain("Master Thought subject: Skala bahan");
    expect(
      buildIdeaPassPrompt({
        id: "vehicle",
        statement: "Kita bandingkan harga per ons sehingga hematnya terlihat",
        parentStatement: parent,
      }),
    ).toContain("comparison, a contrast, an experiment, a demonstration, or a situation");
  });

  it("treats an undecided answer as a failure", () => {
    expect(parseIdeaPassCheck(null)).toEqual({ pass: false, reason: "This check could not be decided." });
    expect(parseIdeaPassCheck('{"pass":false,"reason":"Ini masih pengamatan."}')).toEqual({
      pass: false,
      reason: "Ini masih pengamatan.",
    });
  });

  it("stops at the first failed check and does not ask the later ones", async () => {
    const ask = vi.fn(async (prompt: string) => {
      if (prompt.includes("what is made, invited, shown, or created")) return '{"pass":true,"reason":""}';
      if (prompt.includes("distinctive stake of this Angle")) return '{"pass":false,"reason":"Masih berdiri tanpa Angle."}';
      return '{"pass":true,"reason":""}';
    });
    const result = await runIdeaIndividualChecks({
      statement: "Kita bandingkan harga per ons sehingga hematnya terlihat",
      parentStatement: parent,
      masterSubject: "Skala bahan",
      mechanismKeys: keys,
      ask,
      onStep: () => undefined,
    });
    expect(ask).toHaveBeenCalledTimes(2);
    expect(result.passed).toBe(false);
    expect(result.checks.find((check) => check.id === "sentenceForm")?.state).toBe("pass");
    expect(result.checks.find((check) => check.id === "stakeHolds")).toMatchObject({
      state: "fail",
      reason: "Masih berdiri tanpa Angle.",
    });
    expect(result.checks.find((check) => check.id === "mechanismShape")?.state).toBe("pending");
    expect(result.checks.find((check) => check.id === "causeLock")?.state).toBe("pending");
    expect(result.checks.find((check) => check.id === "siblingsDistinct")?.state).toBe("pending");
    expect(finishIdeaSiblingCheck(result.checks, true, "").find((check) => check.id === "siblingsDistinct")?.state).toBe(
      "pending",
    );
  });

  it("fails the cause lock without a model call when the subject or the keys are missing", async () => {
    const ask = vi.fn(async () => '{"pass":true,"reason":""}');
    const missingSubject = await runIdeaIndividualChecks({
      statement: "Kita bandingkan harga per ons sehingga hematnya terlihat",
      parentStatement: parent,
      mechanismKeys: keys,
      ask,
      onStep: () => undefined,
    });
    expect(missingSubject.checks.find((check) => check.id === "causeLock")).toMatchObject({
      state: "fail",
      reason: "The Master Thought subject was not named.",
    });
    expect(ask).toHaveBeenCalledTimes(6);

    const missingKeys = await runIdeaIndividualChecks({
      statement: "Kita bandingkan harga per ons sehingga hematnya terlihat",
      parentStatement: parent,
      masterSubject: "Skala bahan",
      mechanismKeys: [],
      ask,
      onStep: () => undefined,
    });
    expect(missingKeys.checks.find((check) => check.id === "causeLock")).toMatchObject({
      state: "fail",
      reason: "The keys that close other explanations did not come back.",
    });
    expect(ask).toHaveBeenCalledTimes(12);
  });

  it("re-asks only the failed check and the checks that have not run", async () => {
    const ask = vi.fn(async (prompt: string) => {
      if (prompt.includes("the situation is where the reason happens")) return '{"pass":true,"reason":""}';
      if (prompt.includes("separate keys")) return '{"pass":true,"reason":""}';
      return '{"pass":false,"reason":"should not be asked"}';
    });
    const result = await runIdeaOpenChecks({
      statement: "Mengumpulkan limbah non-makanan dari satu kali masak memperlihatkan tumpukan kemasan",
      parentStatement: parent,
      masterSubject: "Skala bahan",
      mechanismKeys: keys,
      prior: [
        { id: "sentenceForm", state: "pass" },
        { id: "stakeHolds", state: "pass" },
        { id: "mechanismShape", state: "pass" },
        { id: "vehicle", state: "pass" },
        { id: "recognizable", state: "pass" },
        { id: "situationFelt", state: "fail", reason: "Ini menyatakan kesimpulan." },
        { id: "causeLock", state: "pending" },
        { id: "siblingsDistinct", state: "pending" },
      ],
      ask,
      onStep: () => undefined,
    });
    expect(ask).toHaveBeenCalledTimes(2);
    expect(ask.mock.calls.some(([prompt]) => String(prompt).includes("distinctive stake"))).toBe(false);
    expect(result.passed).toBe(true);
    expect(result.checks.find((check) => check.id === "situationFelt")?.state).toBe("pass");
    expect(result.checks.find((check) => check.id === "causeLock")?.state).toBe("pass");
    expect(result.checks.find((check) => check.id === "siblingsDistinct")?.state).toBe("pending");
  });

  it("fails an announced conclusion in code and still allows the result to be stated", async () => {
    const ask = vi.fn(async (prompt: string) => {
      if (prompt.includes("the situation is where the reason happens")) return '{"pass":true,"reason":""}';
      return '{"pass":true,"reason":""}';
    });
    const announced =
      "Sebuah layanan yang menyediakan tenaga kerja khusus untuk menyiapkan bekal dipekerjakan, menunjukkan bahwa biaya total bekal melebihi harga makan siang di luar.";
    const stated =
      "Sebuah layanan yang menyediakan tenaga kerja khusus untuk menyiapkan bekal dipekerjakan, dan upah tenaga kerja itu membuat biaya total bekal melebihi harga makan siang di luar.";
    const failed = await runIdeaIndividualChecks({
      statement: announced,
      parentStatement: parent,
      masterSubject: "Skala bahan",
      mechanismKeys: keys,
      ask,
      onStep: () => undefined,
    });
    expect(failed.passed).toBe(false);
    expect(failed.checks.find((check) => check.id === "situationFelt")).toMatchObject({
      state: "fail",
      reason: "Kalimat ini mengumumkan kesimpulannya. Tetap tulis apa yang menjadi benar, tanpa menunjukkan, membuktikan, atau menyoroti bahwa.",
    });
    expect(failed.checks.find((check) => check.id === "causeLock")?.state).toBe("pending");
    expect(ask.mock.calls.some(([prompt]) => String(prompt).includes("the situation is where the reason happens"))).toBe(false);
    expect(ask).toHaveBeenCalledTimes(5);

    const kept = await runIdeaIndividualChecks({
      statement: stated,
      parentStatement: parent,
      masterSubject: "Skala bahan",
      mechanismKeys: keys,
      ask,
      onStep: () => undefined,
    });
    expect(ask.mock.calls.some(([prompt]) => String(prompt).includes(stated))).toBe(true);
    expect(kept.checks.find((check) => check.id === "situationFelt")?.state).toBe("pass");
    expect(
      buildIdeaPassPrompt({ id: "situationFelt", statement: stated, parentStatement: parent }),
    ).toContain("what the mechanism makes true");
  });

  it("overturns a passed situation check when the sentence still announces the conclusion", async () => {
    const ask = vi.fn(async () => '{"pass":true,"reason":""}');
    const result = await runIdeaOpenChecks({
      statement: "Hiring a cook shows that packed lunch costs more than eating out.",
      parentStatement: parent,
      masterSubject: "Skala bahan",
      mechanismKeys: keys,
      prior: [
        { id: "sentenceForm", state: "pass" },
        { id: "stakeHolds", state: "pass" },
        { id: "mechanismShape", state: "pass" },
        { id: "vehicle", state: "pass" },
        { id: "recognizable", state: "pass" },
        { id: "situationFelt", state: "pass" },
        { id: "causeLock", state: "pass" },
        { id: "siblingsDistinct", state: "pending" },
      ],
      ask,
      onStep: () => undefined,
    });
    expect(ask).not.toHaveBeenCalled();
    expect(result.passed).toBe(false);
    expect(result.checks.find((check) => check.id === "situationFelt")?.reason).toContain("announces the conclusion");
  });

  it("treats a finished checklist as a pass so the stage can lock", () => {
    const passed: IdeaPassCheck[] = [
      { id: "sentenceForm", state: "pass" },
      { id: "stakeHolds", state: "pass" },
      { id: "mechanismShape", state: "pass" },
      { id: "vehicle", state: "pass" },
      { id: "recognizable", state: "pass" },
      { id: "situationFelt", state: "pass" },
      { id: "causeLock", state: "pass" },
      { id: "siblingsDistinct", state: "pass" },
    ];
    const open = passed.map((check) => (check.id === "siblingsDistinct" ? { ...check, state: "pending" as const } : check));
    expect(ideaChecklistPassed(passed)).toBe(true);
    expect(ideaChecklistPassed(open)).toBe(false);
    expect(ideaVerdictForStage(null, passed)).toBe("AUDIT_PASS");
    expect(ideaVerdictForStage("AUDIT_FAIL", passed)).toBe("AUDIT_PASS");
    expect(ideaVerdictForStage(null, open)).toBeNull();
  });
});
