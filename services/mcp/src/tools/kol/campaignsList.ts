import type { McpAuthContext } from "../../authz/context";
import type { KolCampaignRow } from "../../db/phase2Reads";
import { emptyInput } from "../inputs";

export const kolCampaignsInput = emptyInput;

export function kolCampaignsResult(
  ctx: McpAuthContext,
  list: (ctx: McpAuthContext) => Promise<KolCampaignRow[]>,
): Promise<KolCampaignRow[]> {
  return list(ctx);
}
