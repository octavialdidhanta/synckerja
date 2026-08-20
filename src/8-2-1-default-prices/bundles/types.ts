export type CatalogBundleItem = {
  id?: string;
  product_id: string;
  quantity: number;
};

export type CatalogBundleSalesTypePrice = {
  sales_type_id: string;
  price: number;
};

export type CatalogBundle = {
  id: string;
  organization_id: string;
  name: string;
  photo_path: string | null;
  photo_url: string | null;
  bundle_price: number;
  use_sales_type_prices: boolean;
  sales_type_prices: CatalogBundleSalesTypePrice[];
  sort_order: number;
  is_active: boolean;
  items: CatalogBundleItem[];
  outlet_ids: string[];
};

export type CatalogBundleSave = {
  id: string;
  name: string;
  photo_path: string | null;
  bundle_price: number;
  use_sales_type_prices: boolean;
  sales_type_prices: CatalogBundleSalesTypePrice[];
  is_active: boolean;
  items: Array<{ product_id: string; quantity: number }>;
  outlet_ids: string[];
};

export type BundleItemDraft = {
  key: string;
  product_id: string;
  quantity: string;
};

export type BundleDraft = {
  id: string;
  name: string;
  photo_path: string | null;
  is_active: boolean;
  items: BundleItemDraft[];
  bundle_price_display: string;
  use_sales_type_prices: boolean;
  sales_type_price_displays: Record<string, string>;
  outlet_ids: string[];
};

export function newBundleItemDraft(): BundleItemDraft {
  return {
    key: `item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    product_id: "",
    quantity: "1",
  };
}

export function emptyBundleDraft(): BundleDraft {
  return {
    id: crypto.randomUUID(),
    name: "",
    photo_path: null,
    is_active: true,
    items: [],
    bundle_price_display: "",
    use_sales_type_prices: false,
    sales_type_price_displays: {},
    outlet_ids: [],
  };
}

function displayPrice(value: number): string {
  return Number.isFinite(value) ? String(Math.round(value)) : "";
}

export function draftFromBundle(bundle: CatalogBundle): BundleDraft {
  const sales_type_price_displays: Record<string, string> = {};
  for (const row of bundle.sales_type_prices) {
    sales_type_price_displays[row.sales_type_id] = displayPrice(row.price);
  }
  return {
    id: bundle.id,
    name: bundle.name,
    photo_path: bundle.photo_path,
    is_active: bundle.is_active,
    items: bundle.items.map((item) => ({
      key: item.id ?? newBundleItemDraft().key,
      product_id: item.product_id,
      quantity: String(item.quantity || 1),
    })),
    bundle_price_display: displayPrice(bundle.bundle_price),
    use_sales_type_prices: Boolean(bundle.use_sales_type_prices),
    sales_type_price_displays,
    outlet_ids: [...bundle.outlet_ids],
  };
}

function isDisplayPriceValid(value: string): boolean {
  const price = Number(value);
  return value.trim().length > 0 && Number.isFinite(price) && price >= 0;
}

export function parsedSalesTypePrices(draft: BundleDraft): CatalogBundleSalesTypePrice[] {
  return Object.entries(draft.sales_type_price_displays).map(([sales_type_id, raw]) => ({
    sales_type_id,
    price: Number(raw),
  }));
}

export function bundlePriceFromDraft(draft: BundleDraft): number {
  if (!draft.use_sales_type_prices) {
    return Number(draft.bundle_price_display);
  }
  const prices = parsedSalesTypePrices(draft).map((row) => row.price);
  return prices.length > 0 ? Math.min(...prices) : 0;
}

export function isBundleDraftValid(draft: BundleDraft): boolean {
  if (!draft.name.trim()) return false;
  if (draft.items.length < 2) return false;
  const ids = new Set<string>();
  for (const item of draft.items) {
    const qty = Number(item.quantity);
    if (!item.product_id || !Number.isFinite(qty) || qty < 1) return false;
    if (ids.has(item.product_id)) return false;
    ids.add(item.product_id);
  }
  if (draft.outlet_ids.length < 1) return false;
  if (draft.use_sales_type_prices) {
    const entries = Object.entries(draft.sales_type_price_displays);
    if (entries.length < 1) return false;
    return entries.every(([, raw]) => isDisplayPriceValid(raw));
  }
  return isDisplayPriceValid(draft.bundle_price_display);
}
