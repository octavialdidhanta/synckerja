import { useMemo } from "react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import type { CatalogCheckoutSettings } from "@/8-2-1-default-prices/checkout/types";
import type { CatalogRateLine } from "@/8-2-1-default-prices/checkout/lib/computeCatalogCheckoutTotals";
import { computeCatalogCheckoutTotals } from "@/8-2-1-default-prices/checkout/lib/computeCatalogCheckoutTotals";
import type { ReceiptDraft } from "../types";
import {
  formatPreviewQty,
  formatReceiptRupiah,
  RECEIPT_PREVIEW_SAMPLE_ITEMS,
  RECEIPT_PREVIEW_SAMPLE_META,
  receiptPreviewItemSubtotal,
} from "../lib/receiptPreviewSample";
import { formatReceiptPhoneDisplay, storedPhoneFromNational } from "../lib/formatReceiptPhone";
import { resolveReceiptDisplay } from "../lib/resolveReceiptDisplay";
import type { PosReceiptBranding, PosReceiptTransaction } from "../lib/posReceipt.types";
import { PosReceiptDocument } from "./PosReceiptDocument";

type ReceiptPreviewProps = {
  draft: ReceiptDraft;
  hasOutletLogo: boolean;
  logoUrl: string | null;
  checkout: CatalogCheckoutSettings | null;
  outletTaxes?: CatalogRateLine[];
  outletGratuities?: CatalogRateLine[];
};

export function ReceiptPreview({
  draft,
  hasOutletLogo,
  logoUrl,
  checkout,
  outletTaxes = [],
  outletGratuities = [],
}: ReceiptPreviewProps) {
  const { t } = useAppTranslation();
  const now = useMemo(() => new Date(), []);
  const dateLabel = now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const timeLabel = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });

  const itemsSubtotal = RECEIPT_PREVIEW_SAMPLE_ITEMS.reduce((sum, item) => sum + receiptPreviewItemSubtotal(item), 0);
  const afterDiscount = Math.max(0, itemsSubtotal - RECEIPT_PREVIEW_SAMPLE_META.globalDiscountAmount);
  const checkoutTotals = computeCatalogCheckoutTotals({
    subtotal: afterDiscount,
    settings: checkout,
    taxes: outletTaxes,
    gratuities: outletGratuities,
  });
  const change = Math.max(0, RECEIPT_PREVIEW_SAMPLE_META.cashTendered - checkoutTotals.grandTotal);

  const display = resolveReceiptDisplay({
    outletName: draft.outletName,
    businessName: draft.businessName,
    city: draft.city,
    province: draft.province,
    postalCode: draft.postalCode,
    phone: formatReceiptPhoneDisplay(storedPhoneFromNational(draft.phoneNational)),
    hasOutletLogo,
    footerNotes: draft.footerNotes,
  });

  const branding: PosReceiptBranding = {
    display,
    logoUrl,
    hasOutletLogo,
    social: {
      websiteUrl: draft.websiteUrl,
      twitterUrl: draft.twitterUrl,
      facebookUrl: draft.facebookUrl,
      instagramUrl: draft.instagramUrl,
      tiktokUrl: draft.tiktokUrl,
      whatsappUrl: draft.whatsappUrl,
    },
  };

  const transaction: PosReceiptTransaction = {
    dateLabel,
    timeLabel,
    receiptNumber: RECEIPT_PREVIEW_SAMPLE_META.receiptNumber,
    servedBy: RECEIPT_PREVIEW_SAMPLE_META.servedBy,
    collectedBy: RECEIPT_PREVIEW_SAMPLE_META.collectedBy,
    lineItems: RECEIPT_PREVIEW_SAMPLE_ITEMS.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.price,
      lineTotal: receiptPreviewItemSubtotal(item),
      modifiers: item.modifiers,
      promoLabel: item.promoLabel,
      promoAmount: item.promoAmount,
    })),
    globalDiscountLabel: RECEIPT_PREVIEW_SAMPLE_META.globalDiscountLabel,
    globalDiscountAmount: RECEIPT_PREVIEW_SAMPLE_META.globalDiscountAmount,
    subtotal: checkoutTotals.subtotal,
    gratuityLines: checkoutTotals.gratuityLines,
    taxLines: checkoutTotals.taxLines,
    grandTotal: checkoutTotals.grandTotal,
    cashTendered: RECEIPT_PREVIEW_SAMPLE_META.cashTendered,
    change,
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-md border border-gray-200 bg-gray-50">
      <p className="shrink-0 border-b border-gray-200 bg-white px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {t("receiptSettings.preview.title", "Receipt preview")}
      </p>
      <div className="scrollbar-hide flex min-h-0 flex-1 justify-center overflow-y-auto px-4 py-6 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <PosReceiptDocument
          branding={branding}
          transaction={transaction}
          showServedCollected
          showLinks
          showNote
        />
      </div>
    </div>
  );
}

// Re-export format helpers used by preview sample
export { formatPreviewQty, formatReceiptRupiah };
