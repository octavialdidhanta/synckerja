// One runner for the pass checks of one card: the checks run in order and the run stops at the first one
// that does not pass. Each level (Big Thought, Territory, Angle) gives its check ids, its prompts, and the
// checks it decides in code; the order, the batching, the retries and the switches are the same everywhere.
// Relative imports only: the MCP server loads this file.
import { SWITCHED_OFF_REASON, UNDECIDED_REASON, answerGate, askBatchGates, type GateAnswer } from "./batchGates";

export type GateStepState = "pending" | "running" | "pass" | "fail";

export type GateStep<Id extends string> = { id: Id; state: GateStepState; reason?: string };

export type GateChainRun<Id extends string> = {
  checks: GateStep<Id>[];
  passed: boolean;
  /** The check that stopped the run, or null when every check passed. */
  failure: { gate: Id; reason: string } | null;
};

export async function runGateChain<Id extends string>(input: {
  /** The checks, in the order they run. */
  ids: readonly Id[];
  /** Checks switched OFF for this organization: they pass without being asked. */
  skip?: readonly string[];
  /** Checks that already passed on this exact card: they stay passed. */
  keep?: readonly string[];
  /** A check decided without a model (a fail or a pass), or null when the model decides it. */
  decided?: (id: Id) => GateAnswer | null;
  /** Whether a check may join the one batched call. Default: every check the model decides. */
  batchable?: (id: Id) => boolean;
  /** Runs when a check's turn comes, before the model; it may decide the check (a missing input). */
  before?: (id: Id) => Promise<GateAnswer | null>;
  /** Reads the model's answer before it counts: a fail that does not meet the check's own rule may pass. */
  settle?: (id: Id, answer: GateAnswer) => GateAnswer;
  /** Every listed check in one prompt. */
  batchPrompt: (ids: readonly Id[]) => string;
  /** One check alone. Read at the check's turn, so it sees what `before` fetched. */
  prompt: (id: Id) => string;
  ask: (prompt: string) => Promise<string | null>;
  onStep?: (checks: GateStep<Id>[]) => void | Promise<void>;
}): Promise<GateChainRun<Id>> {
  const skip = new Set<string>(input.skip ?? []);
  const keep = new Set<string>(input.keep ?? []);
  const checks: GateStep<Id>[] = input.ids.map((id) => ({ id, state: "pending" }));
  const snapshot = () => checks.map((check) => ({ ...check }));
  const set = async (index: number, step: GateStep<Id>) => {
    checks[index] = step;
    await input.onStep?.(snapshot());
  };
  await input.onStep?.(snapshot());
  const open = input.ids.filter((id) => !skip.has(id) && !keep.has(id));
  // The run stops at the first check that fails in code, so no check after it is asked.
  const stop = input.ids.findIndex((id) => open.includes(id) && input.decided?.(id)?.pass === false);
  const byModel = open.filter(
    (id) =>
      (stop < 0 || input.ids.indexOf(id) < stop) && !input.decided?.(id) && (input.batchable?.(id) ?? true),
  );
  const batched =
    byModel.length > 1
      ? ((await askBatchGates({ prompt: input.batchPrompt(byModel), ids: byModel, ask: input.ask })) ??
        new Map<string, GateAnswer>())
      : new Map<string, GateAnswer>();
  for (const [index, id] of input.ids.entries()) {
    if (skip.has(id)) {
      await set(index, { id, state: "pass", reason: SWITCHED_OFF_REASON });
      continue;
    }
    if (keep.has(id)) {
      await set(index, { id, state: "pass" });
      continue;
    }
    await set(index, { id, state: "running" });
    const coded = input.decided?.(id) ?? (await input.before?.(id));
    const answer =
      coded ??
      (input.settle ?? ((_id: Id, value: GateAnswer) => value))(
        id,
        await answerGate({ batched: batched.get(id), prompt: () => input.prompt(id), ask: input.ask }),
      );
    if (!answer.pass) {
      const reason = answer.reason || UNDECIDED_REASON;
      await set(index, { id, state: "fail", reason });
      return { checks: snapshot(), passed: false, failure: { gate: id, reason } };
    }
    await set(index, { id, state: "pass" });
  }
  return { checks: snapshot(), passed: true, failure: null };
}
