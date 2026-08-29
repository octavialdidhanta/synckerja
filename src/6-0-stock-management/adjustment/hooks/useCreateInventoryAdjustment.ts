import { useMutation, useQueryClient } from "@tanstack/react-query";
import { invalidateCatalogStockCaches } from "@/8-2-3-ingredient/library/hooks/invalidateCatalogStockCaches";
import { applyCatalogStockMovement } from "@/stock-management/catalog-ledger/applyCatalogStockMovement";

const INVENTORY_ADJUSTMENT_REFERENCE_TYPE = "inventory_adjustment";

export type CreateInventoryAdjustmentLineDraft =
  | {
      itemKind: "product";
      productId: string;
      variantId: string | null;
      qtyDelta: number;
    }
  | {
      itemKind: "ingredient";
      ingredientId: string;
      qtyDelta: number;
    };

export function useCreateInventoryAdjustment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (args: {
      organizationId: string;
      outletId: string;
      note: string;
      lines: CreateInventoryAdjustmentLineDraft[];
    }) => {
      const referenceId = crypto.randomUUID();
      const note = args.note.trim();

      // Write each non-zero line as an individual ledger movement,
      // while sharing the same reference_id so the UI can group them.
      for (const line of args.lines) {
        if (!Number.isFinite(line.qtyDelta) || line.qtyDelta === 0) continue;
        if (line.itemKind === "product") {
          await applyCatalogStockMovement({
            organizationId: args.organizationId,
            outletId: args.outletId,
            itemKind: "product",
            productId: line.productId,
            variantId: line.variantId,
            movementType: "adjustment",
            qtyDelta: line.qtyDelta,
            note,
            referenceType: INVENTORY_ADJUSTMENT_REFERENCE_TYPE,
            referenceId,
          });
        } else {
          await applyCatalogStockMovement({
            organizationId: args.organizationId,
            outletId: args.outletId,
            itemKind: "ingredient",
            ingredientId: line.ingredientId,
            movementType: "adjustment",
            qtyDelta: line.qtyDelta,
            note,
            referenceType: INVENTORY_ADJUSTMENT_REFERENCE_TYPE,
            referenceId,
          });
        }
      }

      return { referenceId };
    },
    onSuccess: async (_data, vars) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["inventory-adjustments"] }),
        invalidateCatalogStockCaches(queryClient, vars.organizationId),
      ]);
    },
  });
}

