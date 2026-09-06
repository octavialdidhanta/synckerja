import { supabase } from "@/shared/lib/supabaseClient";
import type { LeadMergeExecuteResult } from "../types";

export async function invokeIdentityGraphMergeExecute(
  organizationId: string,
  confirm: boolean,
): Promise<LeadMergeExecuteResult> {
  const { data, error } = await supabase.rpc("merge_identity_graph_leads_execute", {
    p_organization_id: organizationId,
    p_confirm: confirm,
  });
  if (error) throw error;
  return data as LeadMergeExecuteResult;
}
