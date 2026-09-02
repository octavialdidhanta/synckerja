import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { formatOrderRp } from "../../lib/formatOrderRp";
import { ORDER_CHECKOUT_I18N } from "../lib/orderCheckoutCopy";
import {
  otherFeeLines,
  otherFeesTotal,
  type OrderCheckoutPreview,
} from "../lib/orderCheckoutPreview";

export function OrderPaymentDetailsCard({ preview }: { preview: OrderCheckoutPreview }) {
  const { t } = useAppTranslation();
  const [open, setOpen] = useState(false);
  const fees = otherFeeLines(preview);
  const feeTotal = otherFeesTotal(preview);

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-3">
      <h2 className="mb-3 text-[15px] font-bold uppercase tracking-wide text-neutral-900">
        {t(ORDER_CHECKOUT_I18N.paymentDetails, "Payment Details")}
      </h2>
      <div className="flex items-center justify-between text-[13px] text-neutral-800">
        <span>{t(ORDER_CHECKOUT_I18N.subtotal, "Subtotal")}</span>
        <span>{formatOrderRp(preview.subtotal)}</span>
      </div>
      <button
        type="button"
        className="mt-2 flex w-full items-center justify-between text-[13px] text-neutral-800"
        onClick={() => {
          if (fees.length > 0) setOpen((prev) => !prev);
        }}
        disabled={fees.length === 0}
      >
        <span className="inline-flex items-center gap-1">
          {t(ORDER_CHECKOUT_I18N.otherFees, "Other fees")}
          {fees.length > 0 ? (
            <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
          ) : null}
        </span>
        <span>{formatOrderRp(feeTotal)}</span>
      </button>
      {open && fees.length > 0 ? (
        <ul className="mt-1 space-y-1 pl-3 text-[12px] text-neutral-500">
          {fees.map((line) => (
            <li key={`${line.name}-${line.amount}`} className="flex items-center justify-between">
              <span>{line.name}</span>
              <span>{formatOrderRp(line.amount)}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-3 flex items-center justify-between border-t border-neutral-100 pt-3 text-[14px] font-semibold text-neutral-900">
        <span>{t(ORDER_CHECKOUT_I18N.total, "Total")}</span>
        <span>{formatOrderRp(preview.grandTotal)}</span>
      </div>
    </section>
  );
}
