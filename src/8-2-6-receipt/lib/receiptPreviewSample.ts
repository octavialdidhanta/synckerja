import { formatReceiptRupiah } from "./formatReceiptPhone";

export type ReceiptPreviewModifier = {
  label: string;
  price?: number;
};

export type ReceiptPreviewItem = {
  name: string;
  quantity: number;
  price: number;
  modifiers: ReceiptPreviewModifier[];
  promoLabel?: string;
  promoAmount?: number;
};

export const RECEIPT_PREVIEW_SAMPLE_ITEMS: ReceiptPreviewItem[] = [
  {
    name: "Milk Tea",
    quantity: 1,
    price: 25000,
    modifiers: [
      { label: "Venti" },
      { label: "Pearl - Sweet", price: 2000 },
    ],
    promoLabel: "Promo Sultan (0.5%)",
    promoAmount: 1000,
  },
  {
    name: "Beef Wellington",
    quantity: 1,
    price: 75000,
    modifiers: [{ label: "Potato - Mashed", price: 10000 }],
  },
];

export const RECEIPT_PREVIEW_SAMPLE_META = {
  receiptNumber: "QGKTER5",
  servedBy: "John Doe",
  collectedBy: "Anne Doe",
  cashTendered: 150000,
  globalDiscountLabel: "Discount Test (Rp)",
  globalDiscountAmount: 10000,
};

export function receiptPreviewItemSubtotal(item: ReceiptPreviewItem): number {
  const modifiers = item.modifiers.reduce((sum, row) => sum + (row.price ?? 0), 0);
  return item.price * item.quantity + modifiers - (item.promoAmount ?? 0);
}

export function formatPreviewQty(quantity: number): string {
  return `×${quantity}`;
}

export { formatReceiptRupiah };
