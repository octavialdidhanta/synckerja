import { Button } from "@/shared/components/ui/button";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { personalCustomerName } from "@/pos-receipt-feedback/lib/isGenericCustomerName";
import type { CustomerVisitCartLine } from "@/5-2-customer-visits/checkout/lib/customerVisitCheckout.types";
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
  canSend: boolean;
  canRefund: boolean;
  refundBusy?: boolean;
  cartSnapshot?: CustomerVisitCartLine[] | null;
  salesTypeNameById: Map<string, string>;
  applicationMethod: PosActivityApplicationMethod;
  taxLabel: string;
  gratuityLabel: string;
  onSendReceipt: () => void;
  onSelectRefund: () => void;
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
  canSend,
  canRefund,
  refundBusy,
  cartSnapshot,
  salesTypeNameById,
  applicationMethod,
  taxLabel,
  gratuityLabel,
  onSendReceipt,
  onSelectRefund,
}: Props) {
  const { t, language } = useAppTranslation();
  const locale = typeof language === "string" ? language : "id";

  if (!detail && !loading) {
    return (
      <div className="flex h-full min-h-0 min-w-0 flex-1 items-center justify-center px-6">
        <p className="text-center text-sm text-slate-400">
          {t(POS_ACTIVITY_I18N.selectPrompt, "Select a transaction to view details.")}
        </p>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="flex h-full min-h-0 min-w-0 flex-1 items-center justify-center px-6">
        <p className="text-sm text-slate-400">
          {t(POS_ACTIVITY_I18N.loading, "Loading activity…")}
        </p>
      </div>
    );
  }

  const isRefunded = detail.refund_status === "full";
  const customer =
    personalCustomerName(detail.client_name) ||
    t(POS_ACTIVITY_I18N.walkIn, "Walk-in");
  const receipt = formatPosActivityReceiptNumber(detail.id) || t(POS_ACTIVITY_I18N.dash, "—");

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div className="flex flex-shrink-0 gap-2 border-b border-slate-100 p-4">
        <Button
          type="button"
          variant="outline"
          className="h-11 min-w-0 flex-1 border-primary text-primary hover:bg-primary/5"
          disabled={!canSend}
          onClick={onSendReceipt}
        >
          {t(POS_ACTIVITY_I18N.sendReceipt, "Send receipt")}
        </Button>
        {isRefunded ? (
          <div className="flex h-11 min-w-0 flex-1 items-center justify-center rounded-md border border-amber-200 bg-amber-50 text-sm font-medium text-amber-800">
            {t(POS_ACTIVITY_I18N.refundedBadge, "Refunded")}
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="h-11 min-w-0 flex-1"
            disabled={!canRefund || refundBusy}
            onClick={onSelectRefund}
          >
            {t(POS_ACTIVITY_I18N.selectRefund, "Select refund")}
          </Button>
        )}
      </div>

      <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain p-4 [-ms-overflow-style:none] [scrollbar-width:none] [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:hidden">
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
