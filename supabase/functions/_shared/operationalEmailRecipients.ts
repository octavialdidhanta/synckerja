import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

/** Verified alert recipients + owner/admin profile emails (deduped, lowercase). */
export async function collectOperationalEmailRecipients(
  admin: SupabaseClient,
  orgId: string,
): Promise<Set<string>> {
  const emails = new Set<string>();
  const [{ data: recipients }, { data: roles }] = await Promise.all([
    admin
      .from("operational_email_recipients")
      .select("email, status")
      .eq("organization_id", orgId)
      .eq("status", "verified"),
    admin
      .from("user_roles")
      .select("user_id, role")
      .eq("organization_id", orgId)
      .in("role", ["owner", "admin", "Owner", "Admin"]),
  ]);
  for (const r of recipients ?? []) {
    const email = String((r as { email?: string }).email ?? "")
      .trim()
      .toLowerCase();
    if (email) emails.add(email);
  }
  const ownerAdminIds = (roles ?? [])
    .map((r) => String((r as { user_id?: string }).user_id ?? ""))
    .filter(Boolean);
  if (ownerAdminIds.length > 0) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("user_id, email")
      .in("user_id", ownerAdminIds);
    for (const p of profiles ?? []) {
      const email = String((p as { email?: string }).email ?? "")
        .trim()
        .toLowerCase();
      if (email) emails.add(email);
    }
  }
  return emails;
}
