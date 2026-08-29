import type { CustomerVisitCatalogItem } from "@/5-2-customer-visits/checkout/lib/customerVisitCheckout.types";
import { POS_CASHIER_I18N } from "./posCashierCopy";
import type {
  PosLibraryCategoryMeta,
  PosLibrarySection,
} from "./posLibrarySections";

const SYSTEM_SECTIONS: PosLibrarySection[] = [
  {
    kind: "system",
    id: "discount",
    labelKey: POS_CASHIER_I18N.libraryDiscount,
    fallbackLabel: "Discount",
  },
  {
    kind: "system",
    id: "all_products",
    labelKey: POS_CASHIER_I18N.libraryAllProducts,
    fallbackLabel: "All Products",
  },
  {
    kind: "system",
    id: "all_bundles",
    labelKey: POS_CASHIER_I18N.libraryAllBundles,
    fallbackLabel: "All Bundling Packages",
  },
];

/**
 * Build Library hub rows: pinned system sections + outlet categories that have ≥1 visible product.
 * Category order: outlet override map, else BO sort_order.
 */
export function buildPosLibrarySections(args: {
  categories: PosLibraryCategoryMeta[];
  products: CustomerVisitCatalogItem[];
  orderByCategoryId: Map<string, number>;
}): PosLibrarySection[] {
  const visibleCategoryIds = new Set<string>();
  for (const item of args.products) {
    if (item.kind !== "product" || !item.productCategoryId) continue;
    visibleCategoryIds.add(item.productCategoryId);
  }

  const categories = args.categories
    .filter((c) => visibleCategoryIds.has(c.id))
    .slice()
    .sort((a, b) => {
      const oa = args.orderByCategoryId.get(a.id);
      const ob = args.orderByCategoryId.get(b.id);
      if (oa != null && ob != null && oa !== ob) return oa - ob;
      if (oa != null && ob == null) return -1;
      if (oa == null && ob != null) return 1;
      if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
      return a.name.localeCompare(b.name);
    });

  return [
    ...SYSTEM_SECTIONS,
    ...categories.map(
      (c): PosLibrarySection => ({
        kind: "category",
        id: c.id,
        name: c.name,
      }),
    ),
  ];
}

export function filterPosLibrarySections(
  sections: PosLibrarySection[],
  query: string,
  translate: (key: string, fallback: string) => string,
): PosLibrarySection[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return sections;
  return sections.filter((s) => {
    const label =
      s.kind === "system" ? translate(s.labelKey, s.fallbackLabel) : s.name;
    return label.toLowerCase().includes(needle);
  });
}

/** First character for category avatar (supports bracket names like "[Idham]"). */
export function libraryCategoryInitial(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  return trimmed[0]!.toUpperCase();
}
