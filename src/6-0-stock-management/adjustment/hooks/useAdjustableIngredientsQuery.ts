import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";

export type AdjustableIngredient = {
  ingredientId: string;
  ingredientName: string;
  unit?: string;
  inStock: number;
};

const INVENTORY_ADJUSTABLE_INGREDIENTS_QUERY_KEY = "inventory-adjustable-ingredients";

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function useAdjustableIngredientsQuery(args: { organizationId: string | null; outletId: string | null }) {
  return useQuery({
    queryKey: [INVENTORY_ADJUSTABLE_INGREDIENTS_QUERY_KEY, args.organizationId, args.outletId],
    enabled: Boolean(args.organizationId && args.outletId),
    queryFn: async (): Promise<AdjustableIngredient[]> => {
      if (!args.organizationId || !args.outletId) return [];

      const { data, error } = await supabase
        .from("catalog_ingredients")
        .select("id, name, unit_code, track_inventory, catalog_ingredient_outlets(outlet_id, in_stock)")
        .eq("organization_id", args.organizationId)
        .eq("is_deleted", false)
        .eq("track_inventory", true);

      if (error) throw error;

      const rows = (data ?? []) as Array<{
        id: string;
        name: string | null;
        unit_code: string | null;
        catalog_ingredient_outlets: Array<{ outlet_id: string; in_stock: number | string }> | null;
      }>;

      const adjustable: AdjustableIngredient[] = [];
      for (const row of rows) {
        const stock = (row.catalog_ingredient_outlets ?? []).find((l) => l.outlet_id === args.outletId);
        if (!stock) continue;

        adjustable.push({
          ingredientId: String(row.id),
          ingredientName: row.name?.trim() || "—",
          unit: row.unit_code?.trim() || undefined,
          inStock: num(stock.in_stock),
        });
      }

      adjustable.sort((a, b) => a.ingredientName.localeCompare(b.ingredientName));
      return adjustable;
    },
  });
}

