import type {
  CatalogStockMovementRow,
  CatalogStockMovementType,
  InventorySummaryLine,
  InventorySummaryStockItem,
} from "../types";

export type SummaryPeriod = {
  start: Date;
  end: Date;
};

function itemKey(row: {
  itemKind: string;
  productId?: string | null;
  variantId?: string | null;
  ingredientId?: string | null;
}): string {
  return [
    row.itemKind,
    row.productId ?? "",
    row.variantId ?? "",
    row.ingredientId ?? "",
  ].join(":");
}

function movementKey(row: CatalogStockMovementRow): string {
  return itemKey({
    itemKind: row.item_kind,
    productId: row.product_id,
    variantId: row.variant_id,
    ingredientId: row.ingredient_id,
  });
}

function qtyAt(args: {
  currentQty: number;
  movements: CatalogStockMovementRow[];
  at: Date;
}): number {
  const after = args.movements
    .filter((row) => new Date(row.occurred_at).getTime() > args.at.getTime())
    .reduce((sum, row) => sum + row.qty_delta, 0);
  return args.currentQty - after;
}

function sumType(
  movements: CatalogStockMovementRow[],
  period: SummaryPeriod,
  types: CatalogStockMovementType[],
): number {
  const start = period.start.getTime();
  const end = period.end.getTime();
  return movements
    .filter((row) => {
      const t = new Date(row.occurred_at).getTime();
      return t >= start && t <= end && types.includes(row.movement_type);
    })
    .reduce((sum, row) => sum + row.qty_delta, 0);
}

export function buildInventorySummaryLines(args: {
  items: InventorySummaryStockItem[];
  movements: CatalogStockMovementRow[];
  period: SummaryPeriod;
}): InventorySummaryLine[] {
  const byItem = new Map<string, CatalogStockMovementRow[]>();
  for (const row of args.movements) {
    const key = movementKey(row);
    const list = byItem.get(key) ?? [];
    list.push(row);
    byItem.set(key, list);
  }

  return args.items.map((item) => {
    if (item.isParent) {
      return {
        ...item,
        beginning: 0,
        purchaseOrder: 0,
        sales: 0,
        transfer: 0,
        adjustment: 0,
        ending: 0,
      };
    }
    const rows = byItem.get(itemKey(item)) ?? [];
    return {
      ...item,
      beginning: qtyAt({ currentQty: item.currentQty, movements: rows, at: args.period.start }),
      purchaseOrder: sumType(rows, args.period, ["purchase_order"]),
      sales: sumType(rows, args.period, ["sale", "recipe_consume"]),
      transfer: sumType(rows, args.period, ["transfer"]),
      adjustment: sumType(rows, args.period, ["adjustment", "opening"]),
      ending: qtyAt({ currentQty: item.currentQty, movements: rows, at: args.period.end }),
    };
  });
}

export function filterSummaryLines(lines: InventorySummaryLine[], query: string): InventorySummaryLine[] {
  const q = query.trim().toLowerCase();
  if (!q) return lines;
  const keep = new Set<string>();
  for (const line of lines) {
    const hay = `${line.name} ${line.variantName ?? ""} ${line.categoryName}`.toLowerCase();
    if (!hay.includes(q)) continue;
    keep.add(itemKey(line));
    if (line.variantId && line.productId) {
      keep.add(itemKey({ itemKind: "product", productId: line.productId, variantId: null, ingredientId: null }));
    }
  }
  return lines.filter((line) => keep.has(itemKey(line)));
}
