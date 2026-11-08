export type SummaryMovement = {
  itemKind: "product" | "ingredient";
  productId: string | null;
  variantId: string | null;
  ingredientId: string | null;
  movementType: "opening" | "purchase_order" | "sale" | "transfer" | "adjustment" | "recipe_consume" | "production";
  qtyDelta: number;
  occurredAt: string;
};

export type SummaryItem = {
  itemKind: "product" | "ingredient";
  productId: string | null;
  variantId: string | null;
  ingredientId: string | null;
  currentQty: number;
};

export type SummaryColumns = {
  beginning: number;
  purchaseOrder: number;
  sales: number;
  transfer: number;
  adjustment: number;
  ending: number;
};

function sameItem(item: SummaryItem, movement: SummaryMovement): boolean {
  return item.itemKind === movement.itemKind
    && item.productId === movement.productId
    && item.variantId === movement.variantId
    && item.ingredientId === movement.ingredientId;
}

function qtyAt(currentQty: number, movements: SummaryMovement[], at: Date): number {
  const after = movements
    .filter((row) => new Date(row.occurredAt).getTime() > at.getTime())
    .reduce((sum, row) => sum + row.qtyDelta, 0);
  return currentQty - after;
}

function sumType(
  movements: SummaryMovement[],
  start: Date,
  end: Date,
  types: SummaryMovement["movementType"][],
): number {
  const from = start.getTime();
  const to = end.getTime();
  return movements
    .filter((row) => {
      const time = new Date(row.occurredAt).getTime();
      return time >= from && time <= to && types.includes(row.movementType);
    })
    .reduce((sum, row) => sum + row.qtyDelta, 0);
}

/** Same column rules as the Inventory Summary page and mcp_list_inventory_summary. */
export function summaryColumns(
  item: SummaryItem,
  movements: SummaryMovement[],
  period: { start: Date; end: Date },
): SummaryColumns {
  const rows = movements.filter((row) => sameItem(item, row));
  return {
    beginning: qtyAt(item.currentQty, rows, period.start),
    purchaseOrder: sumType(rows, period.start, period.end, ["purchase_order", "production"]),
    sales: sumType(rows, period.start, period.end, ["sale", "recipe_consume"]),
    transfer: sumType(rows, period.start, period.end, ["transfer"]),
    adjustment: sumType(rows, period.start, period.end, ["adjustment", "opening"]),
    ending: qtyAt(item.currentQty, rows, period.end),
  };
}
