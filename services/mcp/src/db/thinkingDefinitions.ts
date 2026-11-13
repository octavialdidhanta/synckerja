import type { SupabaseClient } from "@supabase/supabase-js";
import { thinkingChainDefinitions, type ChainDefinition } from "../../../../src/thinking-lab/shared/definitions";
import { loadCheckSettings, type Deps, type Session } from "./thinkingWrite";

/** The whole chain's definitions and check rules, with this organization's pass-check switches. */
export async function readThinkingDefinitions(
  admin: SupabaseClient,
  ctx: Session,
  input: { language: "id" | "en" },
  deps: Deps = {},
): Promise<{ levels: ChainDefinition[] }> {
  const settings = await loadCheckSettings(admin, ctx, deps);
  return { levels: thinkingChainDefinitions(settings, input.language) };
}
