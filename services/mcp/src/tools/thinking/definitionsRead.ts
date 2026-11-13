import { z } from "zod";
import type { McpAuthContext } from "../../authz/context";
import type { ChainDefinition } from "../../../../../src/thinking-lab/shared/definitions";

export const definitionsReadInput = z.object({
  language: z.enum(["id", "en"]).optional(),
}).strict();

export type DefinitionsRead = { language: "id" | "en" };
export type DefinitionsReadResult = { levels: ChainDefinition[] };

export function definitionsReadResult(
  ctx: McpAuthContext,
  args: Record<string, unknown>,
  read: (ctx: McpAuthContext, input: DefinitionsRead) => Promise<DefinitionsReadResult>,
): Promise<DefinitionsReadResult> {
  const parsed = definitionsReadInput.safeParse(args);
  if (!parsed.success) throw new Error("invalid_input");
  return read(ctx, { language: parsed.data.language ?? "id" });
}
