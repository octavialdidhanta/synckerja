import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { XenditEnvConfig } from "../xenditEnv.ts";
import { reconcileOrgSubAccounts } from "./reconcileSubAccount.ts";

export async function listSubAccountsForOrg(
  admin: SupabaseClient,
  env: XenditEnvConfig | null,
  organizationId: string,
  reconcile = true,
): Promise<Record<string, unknown>[]> {
  if (reconcile && env) {
    return reconcileOrgSubAccounts(admin, env, organizationId);
  }
  const { data, error } = await admin
    .from("xendit_sub_accounts")
    .select("*")
    .eq("organization_id", organizationId)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Record<string, unknown>[];
}
