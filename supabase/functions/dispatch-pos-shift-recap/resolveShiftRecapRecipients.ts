import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { dedupeEmails } from "./buildShiftRecapEmailHtml.ts";

export async function resolveShiftRecapRecipients(
  admin: SupabaseClient,
  organizationId: string,
  closedByUserId: string | null,
): Promise<string[]> {
  const emails: string[] = [];

  const [{ data: recipients }, { data: roles }] = await Promise.all([
    admin
      .from("operational_email_recipients")
      .select("email, status")
      .eq("organization_id", organizationId)
      .eq("status", "verified"),
    admin
      .from("user_roles")
      .select("user_id, role")
      .eq("organization_id", organizationId)
      .in("role", ["owner", "admin", "Owner", "Admin"]),
  ]);

  for (const r of recipients ?? []) {
    const email = String((r as { email?: string }).email ?? "").trim();
    if (email) emails.push(email);
  }

  const ownerAdminIds = (roles ?? [])
    .map((r) => String((r as { user_id?: string }).user_id ?? ""))
    .filter(Boolean);

  const userIds = new Set(ownerAdminIds);
  if (closedByUserId) userIds.add(closedByUserId);

  if (userIds.size > 0) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("user_id, email")
      .in("user_id", [...userIds]);
    for (const p of profiles ?? []) {
      const email = String((p as { email?: string }).email ?? "").trim();
      if (email) emails.push(email);
    }

    const { data: employees } = await admin
      .from("employees")
      .select("user_id, email")
      .eq("organization_id", organizationId)
      .in("user_id", [...userIds]);
    for (const e of employees ?? []) {
      const email = String((e as { email?: string }).email ?? "").trim();
      if (email) emails.push(email);
    }
  }

  return dedupeEmails(emails);
}
