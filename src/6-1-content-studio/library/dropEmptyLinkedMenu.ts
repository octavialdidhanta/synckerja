import { supabase } from "@/shared/lib/supabaseClient";
import { isMissingRelationError } from "../shared/catalogQuery";

/** A linked product stays when its subcategory is deleted only if a description or a live photo is already stored. */
export function menuIdsToDrop(menus: { id: string; fieldCount: number; livePhotoCount: number }[]): string[] {
  return menus.filter((menu) => menu.fieldCount === 0 && menu.livePhotoCount === 0).map((menu) => menu.id);
}

/** Remove Content Studio products that only exist because of this subcategory. */
export async function dropEmptyCatalogMenusForSubcategory(organizationId: string, subServiceId: string): Promise<void> {
  const menus = await supabase
    .from("catalog_menus")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("sub_service_id", subServiceId);
  if (menus.error) {
    if (isMissingRelationError(menus.error)) return;
    throw menus.error;
  }
  const rows = menus.data ?? [];
  if (!rows.length) return;

  const counted = await Promise.all(
    rows.map(async (row) => {
      const [fields, photos] = await Promise.all([
        supabase.from("catalog_menu_fields").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("menu_id", row.id),
        supabase
          .from("catalog_menu_photos")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", organizationId)
          .eq("menu_id", row.id)
          .is("deleted_at", null),
      ]);
      if (fields.error) throw fields.error;
      if (photos.error) throw photos.error;
      return { id: row.id, fieldCount: fields.count ?? 0, livePhotoCount: photos.count ?? 0 };
    }),
  );

  const ids = menuIdsToDrop(counted);
  if (!ids.length) return;
  const { error } = await supabase.from("catalog_menus").delete().eq("organization_id", organizationId).in("id", ids);
  if (error) throw error;
}
