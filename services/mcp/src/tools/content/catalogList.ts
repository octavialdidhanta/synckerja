import type { McpAuthContext } from "../../authz/context";
import type { ContentCatalogRow } from "../../db/contentBriefs";
import { emptyInput } from "../inputs";

export const catalogInput = emptyInput;

export function catalogResult(
  ctx: McpAuthContext,
  list: (ctx: McpAuthContext) => Promise<ContentCatalogRow[]>,
): Promise<ContentCatalogRow[]> {
  return list(ctx);
}
