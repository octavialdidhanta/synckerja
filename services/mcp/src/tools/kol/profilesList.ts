import type { McpAuthContext } from "../../authz/context";
import type { KolProfileRow } from "../../db/phase2Reads";
import { emptyInput } from "../inputs";

export const kolProfilesInput = emptyInput;

export function kolProfilesResult(
  ctx: McpAuthContext,
  list: (ctx: McpAuthContext) => Promise<KolProfileRow[]>,
): Promise<KolProfileRow[]> {
  return list(ctx);
}
