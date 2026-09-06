import { formatStoreCheckoutRp } from "@/5-2-customer-visits/checkout/lib/catalogLabel";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import {
  computePosActivityDisplayTotals,
  type PosActivityApplicationMethod,
} from "../lib/computePosActivityDisplayTotals";
import { POS_ACTIVITY_I18N } from "../lib/posActivityCopy";
import type { PosActivityDetail } from "../lib/posActivityTypes";

type Props = {
  detail: PosActivityDetail;
  applicationMethod: PosActivityApplicationMethod;
  taxLabel: string;
  gratuityLabel: string;
};

function TotalsRow({
  label,
  value,
  emphasis,
  className,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex justify-between gap-3 border-b border-slate-200 px-3 py-3 last:border-b-0",
        emphasis
          ? "border-slate-700/40 bg-slate-800 font-semibold text-white"
          : "text-slate-700",
        className,
      )}
    >
      <span className="min-w-0">{label}</span>
      <span
        className={cn(
          "flex-shrink-0 tabular-nums",
          emphasis ? "text-white" : "text-slate-900",
        )}
      >
        {value}
      </span>
    </div>
  );
}

export function PosActivityTotalsBlock({
  detail,
  applicationMethod,
  taxLabel,
  gratuityLabel,
}: Props) {
  const { t } = useAppTranslation();
  const totals = computePosActivityDisplayTotals({
    checkout_subtotal: detail.checkout_subtotal,
    checkout_tax_amount: detail.checkout_tax_amount,
    checkout_gratuity_amount: detail.checkout_gratuity_amount,
    total_amount: detail.total_amount,
    total_paid_amount: detail.total_paid_amount,
    payment_method: detail.payment_method,
    cash_tendered: detail.cash_tendered,
    application_method: applicationMethod,
  });

  const includedSuffix = totals.taxIncluded
    ? ` ${t(POS_ACTIVITY_I18N.taxIncluded, "(included)")}`
    : "";

  const showPaymentBlock =
    (totals.showTendered && totals.tendered != null) ||
    (totals.showChange && totals.change != null) ||
    totals.showPaid ||
    Boolean(
      detail.payment_reference &&
        detail.payment_method &&
        detail.payment_method !== "cash",
    );

  return (
    <div className="bg-slate-50/80 text-sm">
      {totals.subtotal != null ? (
        <TotalsRow
          label={t(POS_ACTIVITY_I18N.subtotal, "Subtotal")}
          value={formatStoreCheckoutRp(totals.subtotal)}
        />
      ) : null}

      {totals.showTax ? (
        <TotalsRow
          label={`${taxLabel}${includedSuffix}`}
          value={formatStoreCheckoutRp(totals.taxAmount)}
        />
      ) : null}

      {totals.showGratuity ? (
        <TotalsRow
          label={`${gratuityLabel}${includedSuffix}`}
          value={formatStoreCheckoutRp(totals.gratuityAmount)}
        />
      ) : null}

      <TotalsRow
        label={t(POS_ACTIVITY_I18N.total, "Total")}
        value={formatStoreCheckoutRp(totals.displayTotal)}
        emphasis
      />

      {showPaymentBlock ? (
        <>
          {totals.showTendered && totals.tendered != null ? (
            <TotalsRow
              label={t(POS_ACTIVITY_I18N.payment, "Payment")}
              value={formatStoreCheckoutRp(totals.tendered)}
            />
          ) : null}

          {totals.showChange && totals.change != null ? (
            <TotalsRow
              label={t(POS_ACTIVITY_I18N.change, "Change")}
              value={formatStoreCheckoutRp(totals.change)}
            />
          ) : null}

          {totals.showPaid ? (
            <TotalsRow
              label={t(POS_ACTIVITY_I18N.paid, "Paid")}
              value={formatStoreCheckoutRp(totals.displayTotal)}
            />
          ) : null}

          {detail.payment_reference &&
          detail.payment_method &&
          detail.payment_method !== "cash" ? (
            <div className="flex justify-between gap-3 border-b border-slate-200 px-3 py-3 text-xs text-slate-500 last:border-b-0">
              <span>{t(POS_ACTIVITY_I18N.paymentReference, "Reference")}</span>
              <span className="truncate text-right">{detail.payment_reference}</span>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
