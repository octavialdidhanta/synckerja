import { z } from "zod";
import type { McpAuthContext } from "../../authz/context";
import type { LeadMagnetDeliveryResult } from "../../db/leadMagnet";

export const deliveryAttachInput = z.object({
  campaign_id: z.string().uuid(),
  file_url: z.string().trim().min(1).max(2000),
}).strict();

export function deliveryAttachResult(
  ctx: McpAuthContext,
  input: { campaignId: string; fileUrl: string },
  attach: (ctx: McpAuthContext, input: { campaignId: string; fileUrl: string }) => Promise<LeadMagnetDeliveryResult>,
): Promise<LeadMagnetDeliveryResult> {
  return attach(ctx, input);
}
