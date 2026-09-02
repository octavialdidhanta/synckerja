import type { CustomerVisitCartLine } from "@/5-2-customer-visits/checkout/lib/customerVisitCheckout.types";
import type { PublicOrderCatalogItem, PublicOrderCategory } from "@/synckerja-order/shared/lib/orderTypes";

export type CrossSellPairing = {
  fromCategoryId: string;
  toCategoryId: string;
};

export function pairingsFromCategories(categories: PublicOrderCategory[]): CrossSellPairing[] {
  const rows: CrossSellPairing[] = [];
  for (const category of categories) {
    const to = category.related_category_id?.trim();
    if (!to) continue;
    rows.push({ fromCategoryId: category.id, toCategoryId: to });
  }
  return rows;
}

/** Items from paired categories that are not already in the cart. */
export function pickRelatedMenuItems(args: {
  lines: Array<Pick<CustomerVisitCartLine, "catalogId" | "productCategoryId">>;
  items: PublicOrderCatalogItem[];
  pairings: CrossSellPairing[];
  limit?: number;
}): PublicOrderCatalogItem[] {
  const limit = Math.max(1, args.limit ?? 8);
  const inCart = new Set(args.lines.map((line) => line.catalogId));
  const fromCats = new Set(
    args.lines.map((line) => line.productCategoryId).filter((id): id is string => Boolean(id)),
  );
  const toCats = new Set<string>();
  for (const pair of args.pairings) {
    if (fromCats.has(pair.fromCategoryId)) toCats.add(pair.toCategoryId);
  }
  if (toCats.size === 0) return [];
  const picked = args.items.filter((item) => {
    if (inCart.has(item.id)) return false;
    if (item.pos_status === "hidden" || item.pos_status === "sold_out") return false;
    const categoryId = item.product_category_id;
    return Boolean(categoryId && toCats.has(categoryId));
  });
  picked.sort((a, b) => a.name.localeCompare(b.name));
  return picked.slice(0, limit);
}
