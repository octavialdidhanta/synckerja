import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  findActiveContactGateEnrollment,
  handleInboundContact,
} from "../contactGate/handleInboundContact.ts";
import type { LeadMagnetInboundMessageTriggerInput } from "../types.ts";

export async function handleLeadMagnetInboundMessage(
  admin: SupabaseClient,
  input: LeadMagnetInboundMessageTriggerInput,
): Promise<boolean> {
  const body = input.messageBody.trim();
  if (!body) return false;

  const match = await findActiveContactGateEnrollment(admin, {
    organizationId: input.organizationId,
    participantScopedId: input.participantScopedId,
    messageBody: body,
  });

  if (!match) return false;

  return handleInboundContact(admin, {
    enrollment: match.enrollment,
    campaign: match.campaign,
    accessToken: input.accessToken,
    pageId: input.pageId,
    messageBody: body,
    mode: match.mode,
  });
}
