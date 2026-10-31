import type { McpAuthContext } from "../../authz/context";
import type { AdsAccountRow } from "../../db/phase2Reads";
import { emptyInput } from "../inputs";

export const adsAccountsInput = emptyInput;

export function adsAccountsResult(
  ctx: McpAuthContext,
  list: (ctx: McpAuthContext) => Promise<AdsAccountRow[]>,
): Promise<AdsAccountRow[]> {
  return list(ctx);
}
