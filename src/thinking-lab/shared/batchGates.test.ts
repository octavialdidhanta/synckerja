import { describe, expect, it } from "vitest";
import { runBigThoughtOpenChecks, runGenerateAdmissionChecks } from "@/thinking-lab/big-thought/passChecks";
import { runTerritoryIndividualChecks } from "@/thinking-lab/territory/passChecklist";
import { runAngleIndividualChecks } from "@/thinking-lab/angle/passChecklist";
import { runIdeaChecks } from "@/thinking-lab/idea/check/run";
import { askBatchGates, buildBatchGatePrompt, isUndecided, parseBatchGates } from "@/thinking-lab/shared/batchGates";

describe("batched pass checks", () => {
  it("keeps each check's own rule and lists every id", () => {
    const prompt = buildBatchGatePrompt({
      item: "Territory",
      language: "Big Thought",
      gates: [{ id: "a", rules: ["rule A"] }, { id: "b", rules: ["rule B"], extra: ["extra B"] }],
      context: ["Territory: X"],
    });
    expect(prompt.includes("exactly one entry for each check id: a, b.")).toBe(true);
    expect(prompt.includes("Check a:\nrule A")).toBe(true);
    expect(prompt.includes("Check b:\nrule B\nextra B")).toBe(true);
  });

  it("reads answers and refuses a reply that misses a check", () => {
    const answers = parseBatchGates('{"checks":[{"id":"a","pass":true},{"id":"b","pass":false,"reason":"why"}]}', ["a", "b"]);
    expect(answers?.get("a")?.pass).toBe(true);
    expect(answers?.get("b")?.reason).toBe("why");
    expect(parseBatchGates('{"checks":[{"id":"a","pass":true}]}', ["a", "b"])).toBe(null);
    expect(isUndecided(parseBatchGates('{"checks":[{"id":"a"}]}', ["a"])?.get("a"))).toBe(true);
  });

  it("asks once, again once when unreadable, then gives up", async () => {
    let calls = 0;
    const answers = await askBatchGates({ prompt: "p", ids: ["a"], ask: async () => { calls += 1; return "nope"; } });
    expect(answers).toBe(null);
    expect(calls).toBe(2);
  });
});


/** A model that answers a batched prompt with one verdict per listed id, and a single check with pass. */
function batchModel(fail: Record<string, string> = {}) {
  let calls = 0;
  const ask = async (prompt: string) => {
    calls += 1;
    const listed = /check id: ([^\n]+)\./.exec(prompt);
    if (listed) {
      const ids = listed[1].split(", ");
      return JSON.stringify({ checks: ids.map((id) => ({ id, pass: !fail[id], reason: fail[id] ?? "" })) });
    }
    return '{"pass":true,"reason":""}';
  };
  return { ask, count: () => calls };
}

describe("runners with batch on", () => {
  it("checks every open Big Thought gate in one call and stops at the first failure", async () => {
    const model = batchModel({ premise: "Klaim mutlak." });
    const result = await runBigThoughtOpenChecks({
      batch: true,
      statement: "karena kambingnya muda",
      parentStatement: "MT",
      others: [{ code: "BT01", statement: "karena bumbunya pas" }],
      prior: [],
      ask: model.ask,
    });
    expect(model.count()).toBe(1);
    expect(result.passed).toBe(false);
    expect(result.failure?.gate).toBe("premise");
    expect(result.items.find((item) => item.id === "duplicate")?.state).toBe("pending");
  });

  it("falls back to one call per check when the batch reply cannot be read", async () => {
    let calls = 0;
    const result = await runBigThoughtOpenChecks({
      batch: true,
      statement: "karena kambingnya muda",
      parentStatement: "MT",
      others: [],
      prior: [],
      ask: async (prompt) => {
        calls += 1;
        return prompt.startsWith("Decide each") ? "garbage" : '{"pass":true,"reason":""}';
      },
    });
    expect(result.passed).toBe(true);
    expect(calls).toBe(2 + 5);
  });

  it("admits a generated sentence with one call", async () => {
    const model = batchModel();
    const result = await runGenerateAdmissionChecks({ batch: true, statement: "karena X", parentStatement: "MT", ask: model.ask });
    expect(result.passed).toBe(true);
    expect(model.count()).toBe(1);
  });

  it("checks a Territory in one call when its question is known", async () => {
    const model = batchModel();
    const result = await runTerritoryIndividualChecks({
      batch: true,
      statement: "Steakhouse",
      parentStatement: "BT",
      question: "Kenapa daging bisa juicy?",
      ask: model.ask,
      onStep: () => {},
    });
    expect(result.passed).toBe(true);
    expect(model.count()).toBe(1);
  });

  it("checks an Angle in one call, keeping the subject and example checks that need no model", async () => {
    const model = batchModel({ clearBoundary: "Terlalu luas." });
    const result = await runAngleIndividualChecks({
      batch: true,
      statement: "Orang bayar mahal buat suasana steakhouse, padahal yang diingat rasa dagingnya.",
      parentStatement: "Steakhouse",
      subject: "rasa daging yang diingat",
      example: "Pulang dari steakhouse, yang diceritain ke teman cuma rasa steaknya.",
      ask: model.ask,
      onStep: () => {},
    });
    expect(model.count()).toBe(1);
    expect(result.passed).toBe(false);
    expect(result.checks.find((check) => check.id === "clearBoundary")?.state).toBe("fail");
  });

  it("checks an Idea in one call", async () => {
    const model = batchModel();
    const result = await runIdeaChecks({
      statement: "Kita ajak dua orang blind test sate kambing muda dan steak, sehingga rasa yang diingat terlihat tanpa nama tempat.",
      angle: "Orang bayar mahal buat suasana, padahal yang diingat rasanya.",
      territory: "Makan malam di luar",
      bigThought: "Rasa yang diingat datang dari dagingnya.",
      masterThought: "Rasa daging lebih menentukan daripada suasana tempat.",
      masterSubject: "sate kambing muda",
      mechanismKeys: [{ otherExplanation: "lapar", close: "dua-duanya dicicipi saat sama-sama kenyang" }],
      failures: [],
      peers: [{ code: "ID01", statement: "Kita bandingkan dua bumbu sehingga beda rasanya terasa.", mechanism: "" }],
      historyAvailable: true,
      ask: model.ask,
    });
    expect(result.decision).toBe("LOLOS");
    expect(model.count()).toBe(1);
  });
});

