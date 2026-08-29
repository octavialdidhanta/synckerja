export const NULL_VARIANT_SENTINEL = "00000000-0000-0000-0000-000000000000";

export type PosSessionStockReserve = {
  id: string;
  organization_id: string;
  outlet_id: string;
  session_id: string;
  product_id: string;
  variant_id: string;
  reserved_qty: number;
  last_reference_id: string;
  last_reserved_at: string;
  created_at: string;
  updated_at: string;
};

export function reserveVariantKey(variantId: string | null | undefined): string {
  return variantId && variantId !== NULL_VARIANT_SENTINEL ? variantId : NULL_VARIANT_SENTINEL;
}

export function reserveVariantRpcValue(variantId: string | null | undefined): string | null {
  const key = reserveVariantKey(variantId);
  return key === NULL_VARIANT_SENTINEL ? null : key;
}
