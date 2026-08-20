import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { signCatalogProductPhotos } from "@/8-2-1-default-prices/lib/catalogProductPhoto";
import { syncCatalogStockToTarget } from "@/stock-management/catalog-ledger/applyCatalogStockMovement";
import type {
  CatalogIngredient,
  CatalogIngredientCategoryAssignment,
  CatalogIngredientKind,
  CatalogIngredientOutletStock,
  CatalogIngredientSave,
} from "../types";

export const CATALOG_INGREDIENTS_QUERY_KEY = "catalog-ingredients";

type IngredientRow = Omit<CatalogIngredient, "outlet_ids" | "outlet_stocks"> & {
  catalog_ingredient_outlets?: Array<{
    outlet_id: string;
    in_stock: number | string;
    alert_enabled: boolean;
    alert_at: number | string | null;
    track_cogs: boolean;
    avg_cost: number | string;
  }> | null;
};

function mapStock(link: NonNullable<IngredientRow["catalog_ingredient_outlets"]>[number]): CatalogIngredientOutletStock {
  const inStock = Number(link.in_stock);
  const alertAt = link.alert_at == null || link.alert_at === "" ? null : Number(link.alert_at);
  const avgCost = Number(link.avg_cost);
  return {
    outlet_id: link.outlet_id,
    in_stock: Number.isFinite(inStock) && inStock >= 0 ? inStock : 0,
    alert_enabled: Boolean(link.alert_enabled),
    alert_at: alertAt != null && Number.isFinite(alertAt) && alertAt >= 0 ? alertAt : null,
    track_cogs: Boolean(link.track_cogs),
    avg_cost: Number.isFinite(avgCost) && avgCost >= 0 ? avgCost : 0,
  };
}

function mapRow(row: IngredientRow, photo_url: string | null = null): CatalogIngredient {
  const { catalog_ingredient_outlets: links, ...rest } = row;
  const outlet_stocks = (links ?? []).map(mapStock);
  const kind: CatalogIngredientKind = rest.kind === "semi_finished" ? "semi_finished" : "raw";
  return {
    ...rest,
    kind,
    category_id: rest.category_id ?? null,
    track_inventory: Boolean(rest.track_inventory),
    photo_path: rest.photo_path ?? null,
    photo_url,
    outlet_ids: outlet_stocks.map((stock) => stock.outlet_id),
    outlet_stocks,
  };
}

export function useCatalogIngredients() {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [CATALOG_INGREDIENTS_QUERY_KEY, organizationId],
    queryFn: async (): Promise<CatalogIngredient[]> => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from("catalog_ingredients")
        .select(
          "id, organization_id, name, kind, category_id, unit_code, track_inventory, sort_order, photo_path, catalog_ingredient_outlets(outlet_id, in_stock, alert_enabled, alert_at, track_cogs, avg_cost)",
        )
        .eq("organization_id", organizationId)
        .eq("is_deleted", false)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;
      const rows = (data ?? []) as IngredientRow[];
      const photoMap = await signCatalogProductPhotos(rows.map((row) => row.photo_path ?? ""));
      return rows.map((row) =>
        mapRow(row, row.photo_path ? (photoMap.get(row.photo_path) ?? null) : null),
      );
    },
    enabled: !!organizationId,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [CATALOG_INGREDIENTS_QUERY_KEY, organizationId] });
    queryClient.invalidateQueries({ queryKey: ["inventory-summary"] });
  };

  const save = useMutation({
    mutationFn: async (payload: CatalogIngredientSave) => {
      if (!organizationId) throw new Error("Organization ID is required");
      const name = payload.name.trim();
      if (!name) throw new Error("ingredient_name_required");
      const unit_code = payload.unit_code.trim();
      if (!unit_code) throw new Error("ingredient_unit_required");
      if (!payload.outlet_id) throw new Error("ingredient_outlet_required");

      const kind: CatalogIngredientKind = payload.kind === "semi_finished" ? "semi_finished" : "raw";
      let track_inventory = Boolean(payload.track_inventory);
      const in_stock = Number(payload.in_stock);
      if (track_inventory && (!Number.isFinite(in_stock) || in_stock < 0)) {
        throw new Error("ingredient_stock_required");
      }
      const avg_cost = Number(payload.avg_cost);
      const track_cogs = track_inventory && Boolean(payload.track_cogs);
      if (track_cogs && (!Number.isFinite(avg_cost) || avg_cost < 0)) {
        throw new Error("ingredient_cogs_required");
      }
      const alert_atRaw = payload.alert_at == null ? null : Number(payload.alert_at);
      const alert_at =
        payload.alert_enabled && alert_atRaw != null && Number.isFinite(alert_atRaw) && alert_atRaw >= 0
          ? alert_atRaw
          : null;

      let ingredientId = payload.id ?? "";
      const existing = payload.id ? (query.data ?? []).find((row) => row.id === payload.id) : undefined;
      const previousStock = existing?.outlet_stocks.find((row) => row.outlet_id === payload.outlet_id);
      if (payload.id) {
        if (existing?.track_inventory) track_inventory = true;
        const { error } = await supabase
          .from("catalog_ingredients")
          .update({
            name,
            kind,
            category_id: payload.category_id ?? null,
            unit_code,
            track_inventory,
            photo_path: payload.photo_path ?? null,
          })
          .eq("id", payload.id);
        if (error) throw error;
        ingredientId = payload.id;
      } else {
        const insertRow: Record<string, unknown> = {
          organization_id: organizationId,
          name,
          kind,
          category_id: payload.category_id ?? null,
          unit_code,
          track_inventory,
          sort_order: (query.data?.length ?? 0) + 1,
          is_deleted: false,
        };
        if (payload.id) insertRow.id = payload.id;
        if (payload.photo_path != null) insertRow.photo_path = payload.photo_path;
        const { data, error } = await supabase
          .from("catalog_ingredients")
          .insert(insertRow)
          .select("id")
          .single();
        if (error) throw error;
        ingredientId = data.id as string;
      }

      const outletFields = {
        organization_id: organizationId,
        in_stock: previousStock?.in_stock ?? 0,
        alert_enabled: track_inventory && Boolean(payload.alert_enabled),
        alert_at: track_inventory ? alert_at : null,
        track_cogs,
        avg_cost: track_cogs ? avg_cost : 0,
      };

      const { error: upsertError } = await supabase.from("catalog_ingredient_outlets").upsert(
        {
          ingredient_id: ingredientId,
          outlet_id: payload.outlet_id,
          ...outletFields,
        },
        { onConflict: "ingredient_id,outlet_id" },
      );
      if (upsertError) throw upsertError;
      if (track_inventory) {
        await syncCatalogStockToTarget({
          organizationId,
          outletId: payload.outlet_id,
          itemKind: "ingredient",
          ingredientId,
          previousQty: previousStock?.in_stock ?? 0,
          targetQty: in_stock,
          previouslyTracked: Boolean(existing?.track_inventory),
        });
      }
      return ingredientId;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("catalog_ingredients").update({ is_deleted: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const setIngredientCategories = useMutation({
    mutationFn: async (changes: CatalogIngredientCategoryAssignment[]) => {
      if (changes.length === 0) return;
      const toClear: string[] = [];
      const toAssign = new Map<string, string[]>();
      for (const change of changes) {
        if (!change.category_id) {
          toClear.push(change.id);
          continue;
        }
        const ids = toAssign.get(change.category_id) ?? [];
        ids.push(change.id);
        toAssign.set(change.category_id, ids);
      }
      if (toClear.length > 0) {
        const { error } = await supabase
          .from("catalog_ingredients")
          .update({ category_id: null })
          .in("id", toClear);
        if (error) throw error;
      }
      for (const [categoryId, ids] of toAssign) {
        const { error } = await supabase
          .from("catalog_ingredients")
          .update({ category_id: categoryId })
          .in("id", ids);
        if (error) throw error;
      }
    },
    onSuccess: invalidate,
  });

  return {
    rows: query.data ?? [],
    isLoading: query.isLoading,
    save: save.mutateAsync,
    remove: remove.mutateAsync,
    setIngredientCategories: setIngredientCategories.mutateAsync,
    isSaving: save.isPending || remove.isPending || setIngredientCategories.isPending,
  };
}
