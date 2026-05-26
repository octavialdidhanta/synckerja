/**
 * Canonical omnichannel assignee send gate.
 * Keep in sync with supabase/functions/_shared/omnichannelAssigneeGate.ts
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type AssigneeMismatchResult = {
  ok: false;
  code: "NOT_ASSIGNEE";
  error: string;
  status: 403;
};

export function assigneeMismatchResponse(): AssigneeMismatchResult {
  return {
    ok: false,
    code: "NOT_ASSIGNEE",
    error: "Hanya agen yang ditetapkan (assignee) pada percakapan ini yang dapat membalas.",
    status: 403,
  };
}

export function assertSenderIsActiveAssignee(
  conversationAssigneeId: string | null | undefined,
  senderEmployeeId: string,
): AssigneeMismatchResult | null {
  const convId = conversationAssigneeId == null ? "" : String(conversationAssigneeId).trim();
  if (!convId) return null;
  if (convId === senderEmployeeId) return null;
  return assigneeMismatchResponse();
}

export function jsonGateError(
  result: { code: string; error: string; status: number },
  corsHeaders: Record<string, string>,
): Response {
  return new Response(JSON.stringify({ error: result.error, code: result.code }), {
    status: result.status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
