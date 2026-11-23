import { z } from "zod";
import type { McpAuthContext } from "../../authz/context";

export const listIndustryTemplatesInput = z.object({}).strict();
export const getCatalogSettingsInput = z.object({}).strict();
export const listCatalogTagsInput = z.object({}).strict();
export const applyIndustryTemplateInput = z
  .object({
    code: z.string().trim().min(1).max(32),
  })
  .strict();

export function listIndustryTemplatesResult(
  ctx: McpAuthContext,
  args: unknown,
  list: (ctx: McpAuthContext) => Promise<unknown>,
): Promise<unknown> {
  if (!listIndustryTemplatesInput.safeParse(args ?? {}).success) throw new Error("invalid_input");
  return list(ctx);
}

export function getCatalogSettingsResult(
  ctx: McpAuthContext,
  args: unknown,
  get: (ctx: McpAuthContext) => Promise<unknown>,
): Promise<unknown> {
  if (!getCatalogSettingsInput.safeParse(args ?? {}).success) throw new Error("invalid_input");
  return get(ctx);
}

export function listCatalogTagsResult(
  ctx: McpAuthContext,
  args: unknown,
  get: (ctx: McpAuthContext) => Promise<unknown>,
): Promise<unknown> {
  if (!listCatalogTagsInput.safeParse(args ?? {}).success) throw new Error("invalid_input");
  return get(ctx).then((row) => {
    const settings = row as { tag_defs?: unknown };
    return { tags: Array.isArray(settings?.tag_defs) ? settings.tag_defs : [] };
  });
}

export function applyIndustryTemplateResult(
  ctx: McpAuthContext,
  args: unknown,
  apply: (ctx: McpAuthContext, code: string) => Promise<unknown>,
): Promise<unknown> {
  const parsed = applyIndustryTemplateInput.safeParse(args);
  if (!parsed.success) throw new Error("invalid_input");
  return apply(ctx, parsed.data.code);
}
