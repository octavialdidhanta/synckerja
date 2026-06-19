import type { XenditSubAccountRow, XenditSubAccountWallet } from "@/xendit/types/xendit";

const HIDDEN_STATUSES = new Set(["failed", "suspended"]);

export function isSubAccountSelectable(row: XenditSubAccountRow): boolean {
  const status = String(row.status ?? "").toLowerCase();
  if (HIDDEN_STATUSES.has(status)) return false;
  return Boolean(row.xendit_sub_account_id?.trim());
}

export function buildSubAccountLabel(row: Pick<XenditSubAccountRow, "email" | "business_name" | "xendit_sub_account_id">): string {
  const business = row.business_name?.trim();
  const email = row.email?.trim();
  if (business && email) return `${business} · ${email}`;
  return business || email || row.xendit_sub_account_id || "—";
}

export function buildWalletLabel(wallet: Pick<XenditSubAccountWallet, "business_name" | "email" | "xendit_sub_account_id">): string {
  return buildSubAccountLabel({
    business_name: wallet.business_name ?? "",
    email: wallet.email ?? "",
    xendit_sub_account_id: wallet.xendit_sub_account_id,
  });
}

export function resolveSubAccountLabelByXenditId(
  subAccounts: XenditSubAccountRow[] | undefined,
  xenditSubAccountId: string | null | undefined,
): string | null {
  const id = xenditSubAccountId?.trim();
  if (!id) return null;
  const row = subAccounts?.find((s) => s.xendit_sub_account_id === id);
  if (row) return buildSubAccountLabel(row);
  return id.length > 12 ? `${id.slice(0, 8)}…` : id;
}

export function countSelectableSubAccounts(subAccounts: XenditSubAccountRow[] | undefined): number {
  return (subAccounts ?? []).filter(isSubAccountSelectable).length;
}
