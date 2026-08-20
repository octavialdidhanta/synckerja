import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import { groupAdjustmentMovements, type InventoryAdjustmentMovementRow } from "../lib/adjustmentGrouping";
import type {
  InventoryAdjustmentBatch,
  InventoryAdjustmentIngredientLine,
  InventoryAdjustmentKindFilter,
  InventoryAdjustmentMovementLine,
  InventoryAdjustmentProductLine,
  InventoryAdjustmentStats,
} from "../types";

export const INVENTORY_ADJUSTMENTS_QUERY_KEY = "inventory-adjustments";
const INVENTORY_ADJUSTMENT_REFERENCE_TYPE = "inventory_adjustment";

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function buildProductItemsLabelForBatch(args: {
  batchLines: { productId: string; productName: string; variantId: string | null; variantName: string | null }[];
}): string {
  const byProduct = new Map<
    string,
    {
      productName: string;
      variantCount: number;
    }
  >();

  for (const line of args.batchLines) {
    const existing = byProduct.get(line.productId) ?? {
      productName: line.productName,
      variantCount: 0,
    };
    if (line.variantId) existing.variantCount += 1;
    byProduct.set(line.productId, existing);
  }

  const parts = [...byProduct.entries()].map(([_, v]) =>
    v.variantCount > 0 ? `${v.productName} (${v.variantCount} variants)` : `${v.productName}`,
  );
  return parts.join(", ");
}

function buildIngredientItemsLabelForBatch(args: { batchLines: { ingredientId: string; ingredientName: string }[] }): string {
  // Each ingredient should appear once per batch due to grouping by ingredient_id.
  return [...new Set(args.batchLines.map((l) => l.ingredientName).filter(Boolean))].join(", ");
}

export function useInventoryAdjustmentsQuery(args: {
  organizationId: string | null;
  outletId: string | null;
  kind: InventoryAdjustmentKindFilter;
  periodStart: Date;
  periodEnd: Date;
}) {
  return useQuery({
    queryKey: [
      INVENTORY_ADJUSTMENTS_QUERY_KEY,
      args.organizationId,
      args.outletId,
      args.kind,
      args.periodStart.toISOString(),
      args.periodEnd.toISOString(),
    ],
    enabled: Boolean(args.organizationId && args.outletId),
    queryFn: async (): Promise<{ batches: InventoryAdjustmentBatch[]; stats: InventoryAdjustmentStats }> => {
      if (!args.organizationId || !args.outletId) {
        return {
          batches: [],
          stats: { adjustmentsCount: 0, itemsAdjusted: 0, totalAdjustmentExpense: 0, totalAdjustmentIncome: 0 },
        };
      }

      const itemKind = args.kind === "ingredients" ? "ingredient" : "product";

      const { data, error } = await supabase
        .from("catalog_stock_movements")
        .select(
          "id, reference_id, reference_type, note, occurred_at, item_kind, product_id, variant_id, ingredient_id, qty_delta, qty_after",
        )
        .eq("organization_id", args.organizationId)
        .eq("outlet_id", args.outletId)
        .eq("item_kind", itemKind)
        .eq("movement_type", "adjustment")
        .eq("reference_type", INVENTORY_ADJUSTMENT_REFERENCE_TYPE)
        .gte("occurred_at", args.periodStart.toISOString())
        .lte("occurred_at", args.periodEnd.toISOString())
        .order("occurred_at", { ascending: true });
      if (error) throw error;

      const movements: InventoryAdjustmentMovementRow[] = (data ?? []).map((row) => ({
        id: String(row.id),
        reference_id: (row.reference_id as string | null) ?? null,
        reference_type: (row.reference_type as string | null) ?? null,
        note: (row.note as string | null) ?? null,
        occurred_at: String(row.occurred_at),
        item_kind: (row.item_kind as "product" | "ingredient" | null) ?? null,
        product_id: (row.product_id as string | null) ?? null,
        variant_id: (row.variant_id as string | null) ?? null,
        ingredient_id: (row.ingredient_id as string | null) ?? null,
        qty_delta: num(row.qty_delta),
        qty_after: num(row.qty_after),
      }));

      const batches = groupAdjustmentMovements(movements);

      let productsById = new Map<string, string>();
      let variantsById = new Map<string, string>();
      let ingredientsById = new Map<string, string>();

      if (args.kind === "item_library") {
        const productIds = [
          ...new Set(
            movements
              .map((m) => m.product_id)
              .filter((id): id is string => Boolean(id)),
          ),
        ];
        const variantIds = [
          ...new Set(
            movements
              .map((m) => m.variant_id)
              .filter((id): id is string => Boolean(id)),
          ),
        ];

        const { data: productsData } = productIds.length
          ? await supabase.from("default_prices").select("id, name").in("id", productIds)
          : { data: [] };
        productsById = new Map((productsData ?? []).map((p) => [String(p.id), (p.name as string | null) ?? "—"]));

        const { data: variantsData } = variantIds.length
          ? await supabase
              .from("catalog_product_variants")
              .select("id, name, product_id")
              .in("id", variantIds)
          : { data: [] };
        variantsById = new Map((variantsData ?? []).map((v) => [String(v.id), (v.name as string | null) ?? "—"]));
      } else {
        const ingredientIds = [
          ...new Set(
            movements
              .map((m) => m.ingredient_id)
              .filter((id): id is string => Boolean(id)),
          ),
        ];

        const { data: ingredientsData } = ingredientIds.length
          ? await supabase.from("catalog_ingredients").select("id, name").in("id", ingredientIds)
          : { data: [] };
        ingredientsById = new Map(
          (ingredientsData ?? []).map((r) => [String(r.id), (r.name as string | null) ?? "—"]),
        );
      }

      const batchesWithLabels = batches.map((batch) => {
        if (args.kind === "item_library") {
          const linesWithNames: InventoryAdjustmentMovementLine[] = batch.lines.map((line) => {
            if (line.itemKind !== "product") return line;
            return {
              ...line,
              productName: productsById.get(line.productId) ?? "—",
              variantName: line.variantId ? variantsById.get(line.variantId) ?? "—" : null,
            };
          });

          const productLines = linesWithNames.filter(
            (l): l is InventoryAdjustmentProductLine => l.itemKind === "product",
          );

          return {
            ...batch,
            lines: linesWithNames,
            itemsLabel: buildProductItemsLabelForBatch({
              batchLines: productLines.map((l) => ({
                productId: l.productId,
                productName: l.productName,
                variantId: l.variantId,
                variantName: l.variantName,
              })),
            }),
          };
        }

        const linesWithNames: InventoryAdjustmentMovementLine[] = batch.lines.map((line) => {
          if (line.itemKind !== "ingredient") return line;
          return {
            ...line,
            ingredientName: ingredientsById.get(line.ingredientId) ?? "—",
          };
        });

        const ingredientLines = linesWithNames.filter(
          (l): l is InventoryAdjustmentIngredientLine => l.itemKind === "ingredient",
        );

        return {
          ...batch,
          lines: linesWithNames,
          itemsLabel: buildIngredientItemsLabelForBatch({
            batchLines: ingredientLines.map((l) => ({
              ingredientId: l.ingredientId,
              ingredientName: l.ingredientName,
            })),
          }),
        };
      });

      return {
        batches: batchesWithLabels,
        stats: {
          adjustmentsCount: batchesWithLabels.length,
          itemsAdjusted: movements.length,
          totalAdjustmentExpense: 0,
          totalAdjustmentIncome: 0,
        },
      };
    },
  });
}

