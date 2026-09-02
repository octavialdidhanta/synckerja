export type OrderCheckoutFeeLine = {
  name: string;
  amount: number;
  amount_percent?: number;
};

export type OrderCheckoutPreview = {
  ok: boolean;
  error?: string;
  subtotal: number;
  taxBase?: number;
  taxLines: OrderCheckoutFeeLine[];
  gratuityLines: OrderCheckoutFeeLine[];
  taxTotal: number;
  gratuityTotal: number;
  grandTotal: number;
  applicationMethod?: string;
};

export function emptyOrderCheckoutPreview(subtotal: number): OrderCheckoutPreview {
  const amount = Math.max(0, Math.round(subtotal || 0));
  return {
    ok: true,
    subtotal: amount,
    taxLines: [],
    gratuityLines: [],
    taxTotal: 0,
    gratuityTotal: 0,
    grandTotal: amount,
  };
}

export function otherFeeLines(preview: OrderCheckoutPreview): OrderCheckoutFeeLine[] {
  return [...preview.taxLines, ...preview.gratuityLines].filter((line) => line.amount > 0);
}

export function otherFeesTotal(preview: OrderCheckoutPreview): number {
  return Math.max(0, Math.round((preview.taxTotal || 0) + (preview.gratuityTotal || 0)));
}
