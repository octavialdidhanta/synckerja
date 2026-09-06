import { ArrowLeft } from "lucide-react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { personalCustomerName } from "@/pos-receipt-feedback/lib/isGenericCustomerName";
import type { CustomerVisitCartLine } from "@/5-2-customer-visits/checkout/lib/customerVisitCheckout.types";
import { POS_PANEL } from "@/pos-mobile/shared/lib/posPanelChrome";
import { formatPosActivityReceiptNumber } from "../lib/formatPosActivityReceiptNumber";
import { mapPosActivityPaymentLabel } from "../lib/mapPosActivityPaymentLabel";
import type { PosActivityApplicationMethod } from "../lib/computePosActivityDisplayTotals";
import { POS_ACTIVITY_I18N } from "../lib/posActivityCopy";
import type { PosActivityDetail } from "../lib/posActivityTypes";
import { PosActivityDetailMeta } from "./PosActivityDetailMeta";
import { PosActivityProductSection } from "./PosActivityProductSection";

type Props = {
  detail: PosActivityDetail | null;
  loading?: boolean;
  cartSnapshot?: CustomerVisitCartLine[] | null;
  salesTypeNameById: Map<string, string>;
  applicationMethod: PosActivityApplicationMethod;
  taxLabel: string;
  gratuityLabel: string;
  /** Phone detail: show back to list. */
  onBack?: () => void;
};

function formatPurchaseTime(
  iso: string,
  t: (key: string, fallback?: string, vars?: Record<string, string | number>) => string,
  locale: string,
): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const loc = locale.startsWith("en") ? "en-GB" : "id-ID";
  const date = d.toLocaleDateString(loc, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const time = d.toLocaleTimeString(loc, {
    hour: "2-digit",
    minute: "2-digit",
  });
  return t(POS_ACTIVITY_I18N.purchaseTimeFormat, "{{date}} at {{time}}", {
    date,
    time,
  });
}

export function PosActivityDetailPane({
  detail,
  loading,
  cartSnapshot,
  salesTypeNameById,
  applicationMethod,
  taxLabel,
  gratuityLabel,
  onBack,
}: Props) {
  const { t, language } = useAppTranslation();
  const locale = typeof language === "string" ? language : "id";

  if (!detail && !loading) {
    return (
      <div className="flex h-full min-h-0 min-w-0 flex-1 items-center justify-center bg-slate-100 px-6">
        <p className="text-center text-sm text-slate-400">
          {t(POS_ACTIVITY_I18N.selectPrompt, "Select a transaction to view details.")}
        </p>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-slate-100">
        {onBack ? (
          <div className={POS_PANEL.header}>
            <button
              type="button"
              onClick={onBack}
              onPointerDown={(e) => e.stopPropagation()}
              className={POS_PANEL.headerBack}
              aria-label={t(POS_ACTIVITY_I18N.phonePaneList, "Back")}
              data-no-pane-swipe
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h2 className={POS_PANEL.headerTitle}>
              {t(POS_ACTIVITY_I18N.title, "Activity")}
            </h2>
          </div>
        ) : null}
        <div className="flex flex-1 items-center justify-center px-6">
          <p className="text-sm text-slate-400">
            {t(POS_ACTIVITY_I18N.loading, "Loading activity…")}
          </p>
        </div>
      </div>
    );
  }

  const customer =
    personalCustomerName(detail.client_name) ||
    t(POS_ACTIVITY_I18N.walkIn, "Walk-in");
  const receipt = formatPosActivityReceiptNumber(detail.id) || t(POS_ACTIVITY_I18N.dash, "—");

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-slate-100">
      {onBack ? (
        <div className={cn(POS_PANEL.header, "sticky top-0 z-20")}>
          <button
            type="button"
            onClick={onBack}
            onPointerDown={(e) => e.stopPropagation()}
            className={POS_PANEL.headerBack}
            aria-label={t(POS_ACTIVITY_I18N.phonePaneList, "Back")}
            data-no-pane-swipe
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h2 className={POS_PANEL.headerTitle}>
            {t(POS_ACTIVITY_I18N.title, "Activity")}
          </h2>
        </div>
      ) : null}

      <div
        className={cn(
          "scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain [-ms-overflow-style:none] [scrollbar-width:none] [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:hidden",
          POS_PANEL.body,
        )}
      >
        <PosActivityDetailMeta
          paymentMethod={mapPosActivityPaymentLabel(detail.payment_method, t)}
          receiptNumber={receipt}
          purchaseTime={formatPurchaseTime(detail.created_at, t, locale)}
          customer={customer}
        />
        <PosActivityProductSection
          detail={detail}
          cartSnapshot={cartSnapshot}
          salesTypeNameById={salesTypeNameById}
          applicationMethod={applicationMethod}
          taxLabel={taxLabel}
          gratuityLabel={gratuityLabel}
        />
      </div>
    </div>
  );
}
