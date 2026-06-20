/** Instagram Business Account IDs from Graph API typically start with 178414. */
export function isLikelyInstagramBusinessAccountId(id: string): boolean {
  const trimmed = id.trim();
  return /^178414\d+$/.test(trimmed);
}

export function pickCanonicalInstagramBusinessAccountId(candidates: readonly string[]): string {
  const unique = [...new Set(candidates.map((c) => c.trim()).filter(Boolean))];
  if (unique.length === 0) return "";
  const preferred = unique.filter(isLikelyInstagramBusinessAccountId);
  const pool = preferred.length > 0 ? preferred : unique;
  return pool.sort((a, b) => b.length - a.length)[0] ?? unique[0];
}

export function normalizeInstagramUsername(username: string | null | undefined): string {
  return (username ?? "").trim().replace(/^@+/i, "").toLowerCase();
}

export function instagramConversationCustomerDedupeKey(
  customerIgId: string | null | undefined,
  customerExternalId: string | null | undefined,
  customerName: string | null | undefined,
): string {
  const external = (customerExternalId ?? "").trim();
  if (external) return external.toLowerCase();

  const name = (customerName ?? "").trim();
  if (name.startsWith("@")) {
    return name.slice(1).toLowerCase();
  }

  return (customerIgId ?? "").trim().toLowerCase();
}

type SupabaseAdmin = {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, val: string) => {
        eq: (col2: string, val2: boolean) => Promise<{ data: unknown[] | null }>;
      };
    };
    update: (row: Record<string, unknown>) => {
      eq: (col: string, val: string) => Promise<{ error: { message?: string } | null }>;
    };
  };
};

/** Deactivate duplicate active rows that share the same @username (Meta FBE sometimes returns two business IDs). */
export async function dedupeOrganizationInstagramAccountsByUsername(
  supabaseAdmin: SupabaseAdmin,
  orgId: string,
): Promise<number> {
  const { data } = await supabaseAdmin
    .from("organization_instagram_accounts")
    .select("id, instagram_business_account_id, instagram_username, updated_at, created_at")
    .eq("organization_id", orgId)
    .eq("is_active", true);

  const rows = (data ?? []) as Array<{
    id: string;
    instagram_business_account_id: string;
    instagram_username: string | null;
    updated_at?: string;
    created_at?: string;
  }>;

  const byUsername = new Map<string, typeof rows>();
  for (const row of rows) {
    const uname = normalizeInstagramUsername(row.instagram_username);
    if (!uname) continue;
    const list = byUsername.get(uname) ?? [];
    list.push(row);
    byUsername.set(uname, list);
  }

  let deactivated = 0;
  for (const [, group] of byUsername) {
    if (group.length <= 1) continue;
    const sorted = [...group].sort((a, b) => {
      const aCanon = isLikelyInstagramBusinessAccountId(a.instagram_business_account_id) ? 0 : 1;
      const bCanon = isLikelyInstagramBusinessAccountId(b.instagram_business_account_id) ? 0 : 1;
      if (aCanon !== bCanon) return aCanon - bCanon;
      return (b.updated_at ?? b.created_at ?? "").localeCompare(a.updated_at ?? a.created_at ?? "");
    });
    for (const dup of sorted.slice(1)) {
      const { error } = await supabaseAdmin
        .from("organization_instagram_accounts")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("id", dup.id);
      if (!error) deactivated += 1;
    }
  }
  return deactivated;
}
