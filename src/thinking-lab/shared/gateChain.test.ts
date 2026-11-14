import { describe, expect, it, vi } from "vitest";
import { runGateChain } from "@/thinking-lab/shared/gateChain";
import { SWITCHED_OFF_REASON, UNDECIDED_REASON } from "@/thinking-lab/shared/batchGates";

const IDS = ["a", "b", "c", "d"] as const;

/** Answers the batched prompt "batch:a,b" for every listed id; `fails` fail with their reason. */
function model(fails: Record<string, string> = {}) {
  return vi.fn(async (prompt: string) => {
    if (prompt.startsWith("batch:")) {
      const ids = prompt.slice(6).split(",");
      return JSON.stringify({ checks: ids.map((id) => ({ id, pass: !fails[id], reason: fails[id] ?? "" })) });
    }
    const id = prompt.slice(4);
    return JSON.stringify(fails[id] ? { pass: false, reason: fails[id] } : { pass: true, reason: "" });
  });
}

const prompts = {
  batchPrompt: (ids: readonly string[]) => `batch:${ids.join(",")}`,
  prompt: (id: string) => `one:${id}`,
};

describe("runGateChain", () => {
  it("asks every open check in one call and stops at the first failure", async () => {
    const ask = model({ b: "B is wrong." });
    const run = await runGateChain({ ids: IDS, ...prompts, ask });
    expect(ask).toHaveBeenCalledTimes(1);
    expect(run.failure).toEqual({ gate: "b", reason: "B is wrong." });
    expect(run.checks.map((check) => check.state)).toEqual(["pass", "fail", "pending", "pending"]);
  });

  it("passes switched-off and kept checks without asking them", async () => {
    const ask = model();
    const run = await runGateChain({ ids: IDS, skip: ["a"], keep: ["b", "c"], ...prompts, ask });
    expect(ask.mock.calls.map(([prompt]) => prompt)).toEqual(["one:d"]);
    expect(run.passed).toBe(true);
    expect(run.checks[0]).toEqual({ id: "a", state: "pass", reason: SWITCHED_OFF_REASON });
  });

  it("does not ask anything after a check that fails in code", async () => {
    const ask = model();
    const run = await runGateChain({
      ids: IDS,
      decided: (id) => (id === "b" ? { pass: false, reason: "Decided in code." } : null),
      ...prompts,
      ask,
    });
    // Only "a" is left before the stop, so it is asked alone.
    expect(ask.mock.calls.map(([prompt]) => prompt)).toEqual(["one:a"]);
    expect(run.failure).toEqual({ gate: "b", reason: "Decided in code." });
  });

  it("lets a check fetch its input at its turn and keeps it out of the batch", async () => {
    const ask = model();
    let input = "";
    const run = await runGateChain({
      ids: IDS,
      batchable: (id) => id !== "c",
      before: async (id) => {
        if (id === "c") input = "fetched";
        return null;
      },
      batchPrompt: prompts.batchPrompt,
      prompt: (id) => `one:${id}${id === "c" ? `:${input}` : ""}`,
      ask,
    });
    expect(ask.mock.calls.map(([prompt]) => prompt)).toEqual(["batch:a,b,d", "one:c:fetched"]);
    expect(run.passed).toBe(true);
  });

  it("asks a check alone twice when the batch cannot be read, then fails it as undecided", async () => {
    const ask = vi.fn(async () => "not json");
    const run = await runGateChain({ ids: ["a", "b"] as const, ...prompts, ask });
    expect(ask).toHaveBeenCalledTimes(4);
    expect(run.failure).toEqual({ gate: "a", reason: UNDECIDED_REASON });
  });

  it("lets settle turn a fail that does not meet the rule into a pass", async () => {
    const ask = model({ a: "Not a real problem." });
    const run = await runGateChain({
      ids: ["a", "b"] as const,
      settle: (id, answer) => (id === "a" ? { pass: true, reason: "" } : answer),
      ...prompts,
      ask,
    });
    expect(run.passed).toBe(true);
  });
});
