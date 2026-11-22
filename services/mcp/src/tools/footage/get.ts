import { z } from "zod";
import type { McpAuthContext } from "../../authz/context";
import type { FootageClip } from "../../db/footage";

export const getFootageInput = z
  .object({
    file_key: z.string().trim().min(1).max(2000),
  })
  .strict();

export function getFootageResult(
  ctx: McpAuthContext,
  args: unknown,
  get: (ctx: McpAuthContext, fileKey: string) => Promise<FootageClip>,
): Promise<FootageClip> {
  const parsed = getFootageInput.safeParse(args);
  if (!parsed.success) throw new Error("invalid_input");
  return get(ctx, parsed.data.file_key);
}
