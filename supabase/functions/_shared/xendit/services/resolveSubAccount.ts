import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { XenditEnvConfig } from "../xenditEnv.ts";
import { reconcileXenditSubAccountRow } from "./reconcileSubAccount.ts";

export type XenditSubAccountRow = Record<string, unknown>;

export async function getOrgXenditSettings(
  admin: SupabaseClient,
  organizationId: string,
): Promise<Record<string, unknown> | null> {
  const { data, error } = await admin
    .from("organization_xendit_settings")
    .select("*")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Record<string, unknown> | null) ?? null;
}

export async function listOrgSubAccounts(
  admin: SupabaseClient,
  organizationId: string,
): Promise<XenditSubAccountRow[]> {
  const { data, error } = await admin
    .from("xendit_sub_accounts")
    .select("*")
    .eq("organization_id", organizationId)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as XenditSubAccountRow[];
}

export async function getPrimarySubAccount(
  admin: SupabaseClient,
  organizationId: string,
): Promise<XenditSubAccountRow | null> {
  const { data, error } = await admin
    .from("xendit_sub_accounts")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("is_primary", true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (data) return data as XenditSubAccountRow;

  const { data: fallback, error: fbErr } = await admin
    .from("xendit_sub_accounts")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (fbErr) throw new Error(fbErr.message);
  return (fallback as XenditSubAccountRow | null) ?? null;
}

/** Resolve primary xenPlatform sub-account for VA / disburse / balance. */
export async function resolvePrimarySubAccount(
  admin: SupabaseClient,
  env: XenditEnvConfig,
  organizationId: string,
): Promise<{ subAccountId: string; accountRow: XenditSubAccountRow }> {
  let row = await getPrimarySubAccount(admin, organizationId);
  if (row?.xendit_sub_account_id) {
    row = await reconcileXenditSubAccountRow(admin, env, organizationId, row);
  }
  if (row?.xendit_sub_account_id) {
    return {
      subAccountId: String(row.xendit_sub_account_id),
      accountRow: row,
    };
  }
  throw new Error(
    "Akun Xendit belum dibuat. Daftarkan bisnis di halaman Perbankan Xendit terlebih dahulu.",
  );
}

export async function getSubAccountById(
  admin: SupabaseClient,
  organizationId: string,
  subAccountRowId: string,
): Promise<XenditSubAccountRow | null> {
  const { data, error } = await admin
    .from("xendit_sub_accounts")
    .select("*")
    .eq("id", subAccountRowId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as XenditSubAccountRow | null) ?? null;
}

export async function getSubAccountByEmail(
  admin: SupabaseClient,
  organizationId: string,
  email: string,
): Promise<XenditSubAccountRow | null> {
  const { data, error } = await admin
    .from("xendit_sub_accounts")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("email", email.trim().toLowerCase())
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as XenditSubAccountRow | null) ?? null;
}

export const SUB_ACCOUNT_EMAIL_EXISTS_CODE = "sub_account_email_already_exists";

export async function assertSubAccountEmailAvailable(
  admin: SupabaseClient,
  organizationId: string,
  email: string,
): Promise<void> {
  const existing = await getSubAccountByEmail(admin, organizationId, email);
  if (existing) {
    throw new Error(SUB_ACCOUNT_EMAIL_EXISTS_CODE);
  }
}
