import { z } from "zod";
import type { McpAuthContext } from "../../authz/context";
import type { FootageSearchFilters, FootageSearchResult } from "../../db/footage";

export const searchFootageInput = z
  .object({
    location: z.string().trim().min(1).max(500).optional(),
    product: z.string().trim().min(1).max(500).optional(),
    scene_kind: z.string().trim().min(1).max(80).optional(),
    hijab: z.boolean().optional(),
    watermark: z.boolean().optional(),
    media_type: z.enum(["video", "image"]).optional(),
    unused: z.boolean().optional(),
    limit: z.number().int().min(1).max(50).optional(),
  })
  .strict();

export function searchFootageResult(
  ctx: McpAuthContext,
  args: unknown,
  search: (ctx: McpAuthContext, input: FootageSearchFilters) => Promise<FootageSearchResult>,
): Promise<FootageSearchResult> {
  const parsed = searchFootageInput.safeParse(args);
  if (!parsed.success) throw new Error("invalid_input");
  return search(ctx, parsed.data);
}
