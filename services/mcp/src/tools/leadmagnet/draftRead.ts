import { z } from "zod";
import type { McpAuthContext } from "../../authz/context";
import type { LeadMagnetDraft } from "../../db/leadMagnet";

export const draftReadInput = z.object({
  campaign_id: z.string().uuid().optional(),
}).strict();

export function draftReadResult(
  ctx: McpAuthContext,
  campaignId: string | null,
  list: (ctx: McpAuthContext, campaignId: string | null) => Promise<LeadMagnetDraft[]>,
): Promise<LeadMagnetDraft[]> {
  return list(ctx, campaignId);
}
