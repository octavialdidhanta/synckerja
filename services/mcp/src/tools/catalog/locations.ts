import { z } from "zod";
import type { McpAuthContext } from "../../authz/context";
import type { CatalogAddress, CatalogLocation, CatalogLocationList } from "../../db/catalog";

export const listCatalogLocationsInput = z.object({}).strict();

export const getCatalogLocationInput = z
  .object({
    id: z.string().trim().min(1).max(80).optional(),
    name: z.string().trim().min(1).max(200).optional(),
  })
  .strict()
  .refine((value) => Boolean(value.id || value.name));

export function listCatalogLocationsResult(
  ctx: McpAuthContext,
  args: unknown,
  list: (ctx: McpAuthContext) => Promise<CatalogLocationList>,
): Promise<CatalogLocationList> {
  if (!listCatalogLocationsInput.safeParse(args ?? {}).success) throw new Error("invalid_input");
  return list(ctx);
}

export function getCatalogLocationResult(
  ctx: McpAuthContext,
  args: unknown,
  get: (ctx: McpAuthContext, address: CatalogAddress) => Promise<CatalogLocation>,
): Promise<CatalogLocation> {
  const parsed = getCatalogLocationInput.safeParse(args);
  if (!parsed.success) throw new Error("invalid_input");
  return get(ctx, { id: parsed.data.id, name: parsed.data.name });
}
