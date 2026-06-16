import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const STATUS_MAP: Record<string, string[]> = {
  new: ["Open", "New"],
  contacted: ["On Progress", "Contacted", "In Progress"],
  deal: ["Converted", "Deal", "Closed Won"],
  lost: ["Lost", "Closed", "Closed Lost"],
};

export async function resolveLeadStatusId(
  admin: SupabaseClient,
  organizationId: string,
  apiStatus?: string | null,
): Promise<string | null> {
  const key = (apiStatus ?? "new").trim().toLowerCase();
  const candidates = STATUS_MAP[key] ?? STATUS_MAP.new;

  for (const name of candidates) {
    const { data } = await admin
      .from("lead_statuses")
      .select("id")
      .eq("organization_id", organizationId)
      .ilike("name", name)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    if (data?.id) return data.id as string;
  }

  const { data: fallback } = await admin
    .from("lead_statuses")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle();

  return (fallback?.id as string | undefined) ?? null;
}

export async function resolveConvertedStatusId(
  admin: SupabaseClient,
  organizationId: string,
): Promise<string | null> {
  return resolveLeadStatusId(admin, organizationId, "deal");
}

export async function getOrCreateSystemActor(
  admin: SupabaseClient,
  organizationId: string,
): Promise<{ userId: string; displayName: string }> {
  const { data, error } = await admin.rpc("get_or_create_org_api_system_actor", {
    p_organization_id: organizationId,
  });

  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.user_id) {
    throw new Error("System actor tidak ditemukan untuk organisasi ini.");
  }
  return {
    userId: String(row.user_id),
    displayName: String(row.display_name ?? "Synckerja API"),
  };
}
