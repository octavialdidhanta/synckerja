import type { SupabaseClient } from "@supabase/supabase-js";
import type { SupplierRow } from "../tools/inventory/supplierList";

type Session = { userId: string; organizationId: string };

/** Suppliers of the session organization only; bank details are never returned. */
export async function listCatalogSuppliers(
  admin: SupabaseClient,
  ctx: Session,
  search: string | null,
): Promise<SupplierRow[]> {
  const { data, error } = await admin.rpc("mcp_list_catalog_suppliers", {
    p_user_id: ctx.userId,
    p_organization_id: ctx.organizationId,
    p_search: search,
  });
  if (error) {
    if (error.message.includes("not_a_member")) throw new Error("not_a_member");
    if (error.message.includes("invalid_input")) throw new Error("invalid_input");
    throw new Error("query_failed");
  }
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id),
    name: String(row.name ?? ""),
    phone: typeof row.phone === "string" ? row.phone : null,
    city: typeof row.city === "string" ? row.city : null,
  }));
}
