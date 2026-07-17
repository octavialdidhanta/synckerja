import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleLeadMagnetCommentTrigger } from "./commentTriggerHandler.ts";
import { handleLeadMagnetInboundMessage } from "./inbound/handleInboundMessage.ts";
import { handleLeadMagnetPostbackTrigger } from "./postbackHandler.ts";
import { resolveLeadMagnetEntitlement } from "./leadMagnetEntitlement.ts";
import type { LeadMagnetRuntimeInput } from "./types.ts";

export async function runLeadMagnetRuntime(
  admin: SupabaseClient,
  input: LeadMagnetRuntimeInput,
): Promise<boolean> {
  try {
    const entitlement = await resolveLeadMagnetEntitlement(admin, input.organizationId);
    if (!entitlement.entitled) {
      console.log("[lead-magnet] skip runtime — not entitled", input.organizationId, entitlement.reason);
      return false;
    }

    if (input.trigger === "comment") {
      return await handleLeadMagnetCommentTrigger(admin, input);
    }
    if (input.trigger === "inbound_message") {
      return await handleLeadMagnetInboundMessage(admin, input);
    }
    const result = await handleLeadMagnetPostbackTrigger(admin, input);
    return result.handled;
  } catch (err) {
    console.error("[lead-magnet] runtime error:", err);
    return false;
  }
}

export async function invokeLeadMagnetRuntime(
  input: LeadMagnetRuntimeInput,
): Promise<void> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) return;

  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/lead-magnet-runtime`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("[lead-magnet] runtime invoke failed:", res.status, errText);
    }
  } catch (err) {
    console.error("[lead-magnet] runtime invoke error:", err);
  }
}
