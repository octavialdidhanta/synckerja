// Thin factory types shared by Angle and Territory pass-check modules.
// Prompts and business rules stay in each level file; only the runner contract is shared here.
import type { GateAnswer } from "./batchGates";
import { runGateChain, type GateChainRun } from "./gateChain";

export type LevelGateHooks<Id extends string> = {
  ids: readonly Id[];
  skip?: readonly string[];
  keep?: readonly string[];
  decided?: (id: Id) => GateAnswer | null;
  batchable?: (id: Id) => boolean;
  before?: (id: Id) => Promise<GateAnswer | null>;
  settle?: (id: Id, answer: GateAnswer) => GateAnswer;
  batchPrompt: (ids: readonly Id[]) => string;
  prompt: (id: Id) => string;
  ask: (prompt: string) => Promise<string | null>;
  onStep?: (checks: Array<{ id: Id; state: "pending" | "running" | "pass" | "fail"; reason?: string }>) => void | Promise<void>;
};

/** Runs the shared gateChain runner with level-specific prompts and hooks. */
export async function runLevelGateChain<Id extends string>(hooks: LevelGateHooks<Id>): Promise<GateChainRun<Id>> {
  return runGateChain(hooks);
}