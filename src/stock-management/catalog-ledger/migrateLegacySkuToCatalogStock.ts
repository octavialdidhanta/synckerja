import { supabase } from "@/shared/lib/supabaseClient";

export type MigrateLegacySkuToCatalogStockResult = {
  ok?: boolean;
  error?: string;
  migrated: number;
  skipped: number;
  outlet_id?: string;
};

export async function migrateLegacySkuToCatalogStock(
  organizationId: string,
): Promise<MigrateLegacySkuToCatalogStockResult> {
  const { data, error } = await supabase.rpc("migrate_legacy_sku_to_catalog_stock", {
    p_organization_id: organizationId,
  });
  if (error) throw error;
  const payload = (data ?? {}) as Record<string, unknown>;
  if (payload.error === "catalog_stock_outlet_required") {
    throw new Error("catalog_stock_outlet_required");
  }
  return {
    ok: payload.ok === true,
    migrated: Number(payload.migrated) || 0,
    skipped: Number(payload.skipped) || 0,
    outlet_id: typeof payload.outlet_id === "string" ? payload.outlet_id : undefined,
  };
}
