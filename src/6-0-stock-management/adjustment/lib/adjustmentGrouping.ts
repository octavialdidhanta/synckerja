import type { CatalogStockItemKind } from "../../summary/types";
import type { InventoryAdjustmentBatch, InventoryAdjustmentMovementLine } from "../types";

export type InventoryAdjustmentMovementRow = {
  id: string;
  reference_id: string | null;
  reference_type: string | null;
  note: string | null;
  occurred_at: string;
  item_kind: CatalogStockItemKind | null;
  product_id: string | null;
  variant_id: string | null;
  ingredient_id: string | null;
  qty_delta: number;
  qty_after: number;
  /** Outlet avg cost per unit stored with the adjustment; null/undefined = no buy price yet. */
  unit_cost?: number | null;
};

/** Rupiah value of one movement: qty_delta × unit cost, rounded to whole rupiah. */
export function adjustmentMovementValue(qtyDelta: number, unitCost: number | null | undefined): number | null {
  if (unitCost == null || !Number.isFinite(unitCost) || unitCost <= 0) return null;
  const value = Math.round(qtyDelta * unitCost);
  return Object.is(value, -0) ? 0 : value;
}

/** Sums adjustment batches into the page summary cards. */
export function summarizeAdjustmentBatches(batches: InventoryAdjustmentBatch[]): {
  totalAdjustmentExpense: number;
  totalAdjustmentIncome: number;
  itemsWithoutCost: number;
} {
  let totalAdjustmentExpense = 0;
  let totalAdjustmentIncome = 0;
  let itemsWithoutCost = 0;
  for (const batch of batches) {
    totalAdjustmentExpense += batch.totalExpense;
    totalAdjustmentIncome += batch.totalIncome;
    itemsWithoutCost += batch.lines.filter((l) => l.value == null).length;
  }
  return { totalAdjustmentExpense, totalAdjustmentIncome, itemsWithoutCost };
}

function batchKey(row: InventoryAdjustmentMovementRow): string {
  return row.reference_id ?? row.id;
}

export function groupAdjustmentMovements(movements: InventoryAdjustmentMovementRow[]): InventoryAdjustmentBatch[] {
  const groups = new Map<
    string,
    {
      referenceId: string;
      occurredAtTs: number;
      note: string | null;
      totalQtyDelta: number;
      totalExpense: number;
      totalIncome: number;
      hasMissingCost: boolean;
      itemKind: CatalogStockItemKind;
      linesByKey: Map<string, InventoryAdjustmentMovementLine>;
    }
  >();

  for (const row of movements) {
    const key = batchKey(row);
    const itemKind: CatalogStockItemKind =
      (row.item_kind as CatalogStockItemKind | null) ??
      (row.product_id ? "product" : "ingredient");

    if (!row.product_id && !row.ingredient_id) continue;

    const existing =
      groups.get(key) ??
      ({
        referenceId: key,
        occurredAtTs: new Date(row.occurred_at).getTime(),
        note: row.note,
        totalQtyDelta: 0,
        totalExpense: 0,
        totalIncome: 0,
        hasMissingCost: false,
        itemKind,
        linesByKey: new Map(),
      } as const);

    if (!groups.has(key)) groups.set(key, existing);

    const group = groups.get(key)!;
    group.totalQtyDelta += row.qty_delta;

    const unitCost = row.unit_cost != null && Number.isFinite(row.unit_cost) && row.unit_cost > 0 ? row.unit_cost : null;
    const value = adjustmentMovementValue(row.qty_delta, unitCost);
    if (value == null) {
      if (row.qty_delta !== 0) group.hasMissingCost = true;
    } else if (value < 0) {
      group.totalExpense += -value;
    } else {
      group.totalIncome += value;
    }

    const rowTs = new Date(row.occurred_at).getTime();
    if (rowTs > group.occurredAtTs) {
      group.occurredAtTs = rowTs;
      group.note = row.note;
    }

    const inStock = row.qty_after - row.qty_delta;

    if (row.product_id) {
      const lineKey = `${row.product_id}:${row.variant_id ?? "none"}`;
      group.linesByKey.set(lineKey, {
        itemKind: "product",
        productId: row.product_id,
        productName: "",
        variantId: row.variant_id,
        variantName: null,
        inStock,
        actualStock: row.qty_after,
        qtyDelta: row.qty_delta,
        unitCost,
        value,
      });
    } else if (row.ingredient_id) {
      const lineKey = `ingredient:${row.ingredient_id}`;
      group.linesByKey.set(lineKey, {
        itemKind: "ingredient",
        ingredientId: row.ingredient_id,
        ingredientName: "",
        inStock,
        actualStock: row.qty_after,
        qtyDelta: row.qty_delta,
        unitCost,
        value,
      });
    }
  }

  return [...groups.values()]
    .map((g) => ({
      itemKind: g.itemKind,
      referenceId: g.referenceId,
      occurredAt: new Date(g.occurredAtTs).toISOString(),
      note: g.note,
      totalQtyDelta: g.totalQtyDelta,
      totalExpense: g.totalExpense,
      totalIncome: g.totalIncome,
      hasMissingCost: g.hasMissingCost,
      itemsLabel: "",
      lines: [...g.linesByKey.values()],
    }))
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
}

