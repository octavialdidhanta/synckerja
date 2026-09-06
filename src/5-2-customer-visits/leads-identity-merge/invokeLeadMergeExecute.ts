import { supabase } from "@/shared/lib/supabaseClient";
import type { LeadMergeExecuteResult } from "./types";

/**
 * Soft-archive duplicate leads for one org. Requires confirm=true (RPC rejects otherwise).
 */
export async function invokeLeadMergeExecute(
  organizationId: string,
  confirm: boolean,
): Promise<LeadMergeExecuteResult> {
  const { data, error } = await supabase.rpc("merge_customer_lead_duplicates_execute", {
    p_organization_id: organizationId,
    p_confirm: confirm,
  });
  if (error) throw error;
  return data as LeadMergeExecuteResult;
}
