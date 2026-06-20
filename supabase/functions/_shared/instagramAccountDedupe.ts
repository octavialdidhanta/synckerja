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

/** Prefer webhook sender id (external) over resolved messaging id — keeps IGSID/business-id drift in one bucket. */
export function instagramConversationCustomerDedupeKey(
  customerIgId: string | null | undefined,
  customerExternalId: string | null | undefined,
  customerName: string | null | undefined,
): string {
  const external = (customerExternalId ?? "").trim().toLowerCase();
  if (external) return external;

  const ig = (customerIgId ?? "").trim().toLowerCase();
  if (ig) return ig;

  const name = (customerName ?? "").trim();
  if (name.startsWith("@")) return name.slice(1).toLowerCase();

  return "";
}

export function instagramCustomerIdentityTokens(
  customerIgId: string | null | undefined,
  customerExternalId: string | null | undefined,
  customerName: string | null | undefined,
): Set<string> {
  const tokens = new Set<string>();
  const ig = (customerIgId ?? "").trim().toLowerCase();
  const ext = (customerExternalId ?? "").trim().toLowerCase();
  if (ig) tokens.add(ig);
  if (ext) tokens.add(ext);
  const name = (customerName ?? "").trim();
  if (name.startsWith("@")) tokens.add(`@${name.slice(1).toLowerCase()}`);
  return tokens;
}

export function instagramCustomerIdentitiesOverlap(
  a: {
    customer_ig_id: string;
    customer_external_id?: string | null;
    customer_name?: string | null;
  },
  b: {
    customer_ig_id: string;
    customer_external_id?: string | null;
    customer_name?: string | null;
  },
): boolean {
  const ta = instagramCustomerIdentityTokens(a.customer_ig_id, a.customer_external_id, a.customer_name);
  const tb = instagramCustomerIdentityTokens(b.customer_ig_id, b.customer_external_id, b.customer_name);
  for (const t of ta) {
    if (tb.has(t)) return true;
  }
  return false;
}

export type InstagramConvMergeRow = {
  id: string;
  first_inbound_at: string | null;
  customer_name: string | null;
  customer_ig_id: string;
  customer_external_id?: string | null;
  last_message_at?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
};

function pickBestMessagingCustomerId(ids: string[]): string {
  const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
  if (unique.length === 0) return "";
  const nonBusiness = unique.filter((id) => !isLikelyInstagramBusinessAccountId(id));
  if (nonBusiness.length > 0) return nonBusiness.sort((a, b) => b.length - a.length)[0];
  return unique.sort((a, b) => b.length - a.length)[0];
}

function scoreInstagramConvKeeper(row: InstagramConvMergeRow): number {
  let score = 0;
  if (row.customer_name?.trim()) score += 20;
  if (row.customer_external_id?.trim()) score += 10;
  if (!isLikelyInstagramBusinessAccountId(row.customer_ig_id)) score += 5;
  if (row.last_message_at) score += 1;
  return score;
}

type SupabaseMergeClient = {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, val: string) => {
        eq: (col2: string, val2: string) => Promise<{ data: unknown[] | null }>;
        maybeSingle: () => Promise<{ data: Record<string, unknown> | null }>;
      };
    };
    update: (row: Record<string, unknown>) => {
      eq: (col: string, val: string) => Promise<{ error: { message?: string } | null }>;
    };
    delete: () => {
      eq: (col: string, val: string) => Promise<{ error: { message?: string } | null }>;
    };
  };
};

/** Merge duplicate IG threads (IGSID vs business account id drift) into one conversation row. */
export async function mergeInstagramConversationDuplicates(
  supabase: SupabaseMergeClient,
  rows: InstagramConvMergeRow[],
): Promise<InstagramConvMergeRow> {
  if (rows.length === 0) {
    throw new Error("mergeInstagramConversationDuplicates: no rows");
  }
  if (rows.length === 1) return rows[0];

  const sorted = [...rows].sort((a, b) => {
    const scoreDiff = scoreInstagramConvKeeper(b) - scoreInstagramConvKeeper(a);
    if (scoreDiff !== 0) return scoreDiff;
    const at = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
    const bt = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
    return bt - at;
  });
  const keeper = sorted[0];
  const dupes = sorted.slice(1);

  const allIgIds = sorted.map((r) => r.customer_ig_id);
  const allExternal = sorted.map((r) => r.customer_external_id ?? "");
  const bestName = sorted.find((r) => r.customer_name?.trim())?.customer_name ?? keeper.customer_name;
  const messagingId = pickBestMessagingCustomerId(allIgIds);
  const externalId =
    allExternal.map((v) => v.trim()).find(Boolean) ??
    allIgIds.map((v) => v.trim()).find((id) => id && id !== messagingId) ??
    "";

  for (const dup of dupes) {
    await supabase
      .from("instagram_messages")
      .update({ conversation_id: keeper.id })
      .eq("conversation_id", dup.id);

    await supabase.from("instagram_conversation_cycles").delete().eq("conversation_id", dup.id);

    const { error: delErr } = await supabase.from("instagram_conversations").delete().eq("id", dup.id);
    if (delErr) {
      console.error("mergeInstagramConversationDuplicates: delete failed", dup.id, delErr);
    }
  }

  await supabase
    .from("instagram_conversations")
    .update({
      customer_ig_id: messagingId || keeper.customer_ig_id,
      ...(externalId ? { customer_external_id: externalId } : {}),
      ...(bestName?.trim() ? { customer_name: bestName.trim() } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", keeper.id);

  return {
    ...keeper,
    customer_ig_id: messagingId || keeper.customer_ig_id,
    customer_external_id: externalId || keeper.customer_external_id,
    customer_name: bestName ?? keeper.customer_name,
  };
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
