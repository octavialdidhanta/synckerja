import { supabase } from "@/shared/lib/supabaseClient";
import type { LeadMergeDryRunResult } from "../types";

export async function invokeTypoEmailMergeDryRun(
  organizationId: string,
): Promise<LeadMergeDryRunResult> {
  const { data, error } = await supabase.rpc("merge_typo_email_leads_dry_run", {
    p_organization_id: organizationId,
  });
  if (error) throw error;
  return data as LeadMergeDryRunResult;
}
