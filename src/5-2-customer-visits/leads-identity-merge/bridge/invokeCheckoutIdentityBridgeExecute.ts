import { supabase } from "@/shared/lib/supabaseClient";
import type { CheckoutBridgeRpcResult } from "./types";

export async function invokeCheckoutIdentityBridgeExecute(args: {
  organizationId: string;
  phoneLeadId: string;
  emailLeadId: string;
  confirm: boolean;
}): Promise<CheckoutBridgeRpcResult> {
  const { data, error } = await supabase.rpc("merge_checkout_identity_bridge_execute", {
    p_organization_id: args.organizationId,
    p_phone_lead_id: args.phoneLeadId,
    p_email_lead_id: args.emailLeadId,
    p_confirm: args.confirm,
  });
  if (error) throw error;
  return data as CheckoutBridgeRpcResult;
}
