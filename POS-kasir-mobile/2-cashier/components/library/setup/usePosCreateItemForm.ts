import type { DefaultPriceCreate } from "@/8-2-1-default-prices/types/defaultPrices";
import {
  masterUnitPriceFromVariants,
  persistableVariants,
} from "@/8-2-1-default-prices/product-variants";
import {
  emptyOutletStock,
  type VariantDraft,
} from "@/8-2-1-default-prices/product-variants/types";
import { stripToDigits } from "@/8-2-1-default-prices/utils/formatIdUnitPrice";

export type PosCreateItemFormState = {
  name: string;
  categoryId: string | null;
  priceDisplay: string;
  catalogSku: string;
  variants: VariantDraft[];
  /** Modifier group ids to link after product create (BO assignProducts). */
  pendingModifierGroupIds: string[];
};

export const POS_CREATE_ITEM_FORM_EMPTY: PosCreateItemFormState = {
  name: "",
  categoryId: null,
  priceDisplay: "",
  catalogSku: "",
  variants: [],
  pendingModifierGroupIds: [],
};

export function parsePosCreateItemPrice(display: string): number | null {
  const digits = stripToDigits(display);
  if (!digits) return null;
  const n = Number(digits);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function buildPosCreateItemPayload(args: {
  organizationId: string;
  outletId: string;
  form: PosCreateItemFormState;
}): { ok: true; payload: DefaultPriceCreate } | { ok: false; error: "name" | "price" | "outlet" } {
  const name = args.form.name.trim();
  if (!name) return { ok: false, error: "name" };
  const outletId = args.outletId.trim();
  if (!outletId) return { ok: false, error: "outlet" };

  const persistedVariants = persistableVariants(args.form.variants);
  const hasVariants = persistedVariants.length > 0;

  let unitPrice: number;
  if (hasVariants) {
    unitPrice = masterUnitPriceFromVariants(persistedVariants, 0);
    if (!(unitPrice > 0)) return { ok: false, error: "price" };
  } else {
    const parsed = parsePosCreateItemPrice(args.form.priceDisplay);
    if (parsed == null) return { ok: false, error: "price" };
    unitPrice = parsed;
  }

  const sku = hasVariants ? null : args.form.catalogSku.trim() || null;
  const payload: DefaultPriceCreate = {
    id: crypto.randomUUID(),
    organization_id: args.organizationId,
    kind: "product",
    service_id: null,
    sub_service_id: null,
    name,
    unit_price: unitPrice,
    photo_path: null,
    catalog_sku: sku,
    product_category_id: args.form.categoryId?.trim() || null,
    pos_status: "available",
    outlet_ids: [outletId],
    selected_outlet_id: outletId,
    selected_outlet_stock: emptyOutletStock(),
    track_stock: false,
    unit: "pcs",
    use_sales_type_prices: false,
    variants: persistedVariants,
    sales_type_prices: [],
    order_publish: true,
  };
  return { ok: true, payload };
}
