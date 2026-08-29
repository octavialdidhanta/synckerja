import type { ReceiptDisplay } from "../lib/resolveReceiptDisplay";

export type PosReceiptLineItem = {
  id?: string;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  modifiers?: Array<{ label: string; price?: number }>;
  promoLabel?: string;
  promoAmount?: number;
};

export type PosReceiptTotalsLine = {
  name: string;
  amount: number;
  amount_percent?: number;
};

export type PosReceiptTransaction = {
  dateLabel: string;
  timeLabel: string;
  receiptNumber?: string;
  servedBy?: string;
  collectedBy?: string;
  tableNumber?: string | null;
  clientName?: string;
  ticketId?: string;
  lineItems: PosReceiptLineItem[];
  globalDiscountLabel?: string;
  globalDiscountAmount?: number;
  subtotal: number;
  gratuityLines: PosReceiptTotalsLine[];
  taxLines: PosReceiptTotalsLine[];
  grandTotal: number;
  paymentMethod?: string;
  paymentReference?: string | null;
  cashTendered?: number | null;
  change?: number | null;
};

export type PosReceiptBranding = {
  display: ReceiptDisplay;
  logoUrl: string | null;
  hasOutletLogo: boolean;
  social: {
    websiteUrl?: string;
    twitterUrl?: string;
    facebookUrl?: string;
    instagramUrl?: string;
    tiktokUrl?: string;
    whatsappUrl?: string;
  };
};

export type PosReceiptResolved = {
  branding: PosReceiptBranding;
  isLoading: boolean;
};
