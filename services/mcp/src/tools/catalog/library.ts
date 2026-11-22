import { z } from "zod";
import type { McpAuthContext } from "../../authz/context";
import type {
  CatalogReferenceList,
  CatalogShotJobList,
  CatalogTextBlocks,
} from "../../db/catalog";

export const getCatalogStyleInput = z.object({}).strict();
export const getCatalogPromptsInput = z.object({}).strict();
export const listCatalogReferencesInput = z.object({}).strict();
export const listCatalogShotJobsInput = z.object({}).strict();

export const getCatalogReferenceInput = z
  .object({
    id: z.string().trim().min(1).max(80),
  })
  .strict();

export const getCatalogShotJobInput = getCatalogReferenceInput;

export function getCatalogStyleResult(
  ctx: McpAuthContext,
  args: unknown,
  get: (ctx: McpAuthContext) => Promise<CatalogTextBlocks>,
): Promise<CatalogTextBlocks> {
  if (!getCatalogStyleInput.safeParse(args ?? {}).success) throw new Error("invalid_input");
  return get(ctx);
}

export function getCatalogPromptsResult(
  ctx: McpAuthContext,
  args: unknown,
  get: (ctx: McpAuthContext) => Promise<CatalogTextBlocks>,
): Promise<CatalogTextBlocks> {
  if (!getCatalogPromptsInput.safeParse(args ?? {}).success) throw new Error("invalid_input");
  return get(ctx);
}

export function listCatalogReferencesResult(
  ctx: McpAuthContext,
  args: unknown,
  list: (ctx: McpAuthContext) => Promise<CatalogReferenceList>,
): Promise<CatalogReferenceList> {
  if (!listCatalogReferencesInput.safeParse(args ?? {}).success) throw new Error("invalid_input");
  return list(ctx);
}

export function getCatalogReferenceResult(
  ctx: McpAuthContext,
  args: unknown,
  get: (ctx: McpAuthContext, id: string) => Promise<Record<string, unknown>>,
): Promise<Record<string, unknown>> {
  const parsed = getCatalogReferenceInput.safeParse(args);
  if (!parsed.success) throw new Error("invalid_input");
  return get(ctx, parsed.data.id);
}

export function listCatalogShotJobsResult(
  ctx: McpAuthContext,
  args: unknown,
  list: (ctx: McpAuthContext) => Promise<CatalogShotJobList>,
): Promise<CatalogShotJobList> {
  if (!listCatalogShotJobsInput.safeParse(args ?? {}).success) throw new Error("invalid_input");
  return list(ctx);
}

export function getCatalogShotJobResult(
  ctx: McpAuthContext,
  args: unknown,
  get: (ctx: McpAuthContext, id: string) => Promise<Record<string, unknown>>,
): Promise<Record<string, unknown>> {
  const parsed = getCatalogShotJobInput.safeParse(args);
  if (!parsed.success) throw new Error("invalid_input");
  return get(ctx, parsed.data.id);
}
