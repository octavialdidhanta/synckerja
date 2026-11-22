import { z } from "zod";
import type { McpAuthContext } from "../../authz/context";
import type { CatalogAddress, CatalogProduct, CatalogProductList } from "../../db/catalog";

export const listCatalogProductsInput = z.object({}).strict();

const catalogAddressInput = z
  .object({
    id: z.string().trim().min(1).max(80).optional(),
    name: z.string().trim().min(1).max(200).optional(),
  })
  .strict()
  .refine((value) => Boolean(value.id || value.name));

export const getCatalogProductInput = catalogAddressInput;

export function listCatalogProductsResult(
  ctx: McpAuthContext,
  args: unknown,
  list: (ctx: McpAuthContext) => Promise<CatalogProductList>,
): Promise<CatalogProductList> {
  if (!listCatalogProductsInput.safeParse(args ?? {}).success) throw new Error("invalid_input");
  return list(ctx);
}

export function getCatalogProductResult(
  ctx: McpAuthContext,
  args: unknown,
  get: (ctx: McpAuthContext, address: CatalogAddress) => Promise<CatalogProduct>,
): Promise<CatalogProduct> {
  const parsed = getCatalogProductInput.safeParse(args);
  if (!parsed.success) throw new Error("invalid_input");
  return get(ctx, { id: parsed.data.id, name: parsed.data.name });
}
