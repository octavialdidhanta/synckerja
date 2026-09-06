import { supabase } from "@/shared/lib/supabaseClient";
import type { CheckoutBridgeRpcResult } from "./types";

export async function invokeCheckoutIdentityBridgeDryRun(args: {
  organizationId: string;
  phoneLeadId: string;
  emailLeadId: string;
}): Promise<CheckoutBridgeRpcResult> {
  const { data, error } = await supabase.rpc("merge_checkout_identity_bridge_dry_run", {
    p_organization_id: args.organizationId,
    p_phone_lead_id: args.phoneLeadId,
    p_email_lead_id: args.emailLeadId,
  });
  if (error) throw error;
  return data as CheckoutBridgeRpcResult;
}
