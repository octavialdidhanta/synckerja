import type { CustomerVisitCartLine } from "@/5-2-customer-visits/checkout/lib/customerVisitCheckout.types";

type LineLike = {
  catalogId?: unknown;
  catalog_id?: unknown;
  quantity?: unknown;
};

function catalogIdOf(line: LineLike): string {
  const raw = line.catalogId ?? line.catalog_id;
  return typeof raw === "string" ? raw.trim() : "";
}

function quantityOf(line: LineLike): number {
  const n = Number(line.quantity);
  return Number.isFinite(n) ? n : 0;
}

/** Total bill qty per catalog product (plain + customized lines summed). */
export function qtyByCatalogIdFromCartLines(
  lines: readonly Pick<CustomerVisitCartLine, "catalogId" | "quantity">[] | readonly LineLike[],
): Map<string, number> {
  const map = new Map<string, number>();
  for (const line of lines) {
    const id = catalogIdOf(line as LineLike);
    if (!id) continue;
    const qty = quantityOf(line as LineLike);
    if (qty <= 0) continue;
    map.set(id, (map.get(id) ?? 0) + qty);
  }
  return map;
}
