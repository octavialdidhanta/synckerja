import { CheckCircle2 } from "lucide-react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { formatOrderRp } from "../../lib/formatOrderRp";
import { ORDER_STOREFRONT_PX } from "../../lib/orderStorefrontGutter";
import { CASHIER_TICKET_I18N } from "../lib/cashierTicketCopy";

const ACCENT = "#E91E8C";

export function OrderCashierQrPaidView({
  storeName,
  tableNumber,
  grandTotal,
  onOrderAgain,
}: {
  storeName: string;
  tableNumber: string;
  grandTotal: number;
  onOrderAgain: () => void;
}) {
  const { t } = useAppTranslation();

  return (
    <div className={`flex min-h-0 flex-1 flex-col items-center justify-center ${ORDER_STOREFRONT_PX} py-6 text-center`}>
      <CheckCircle2 className="h-16 w-16 text-emerald-500" strokeWidth={1.5} aria-hidden />
      <p className="mt-4 text-[18px] font-bold text-neutral-900">
        {t(CASHIER_TICKET_I18N.paidSuccess, "Payment successful")}
      </p>
      {storeName ? (
        <p className="mt-2 text-[14px] font-medium text-neutral-700">{storeName}</p>
      ) : null}
      <p className="mt-1 text-[13px] text-neutral-500">
        {t(CASHIER_TICKET_I18N.table, "Table")}: {tableNumber}
      </p>
      <p className="mt-4 text-[14px] text-neutral-600">
        {t(CASHIER_TICKET_I18N.total, "Total")}{" "}
        <span className="text-[18px] font-bold text-neutral-900">{formatOrderRp(grandTotal)}</span>
      </p>
      <p className="mt-4 max-w-[280px] text-[13px] leading-relaxed text-neutral-500">
        {t(
          CASHIER_TICKET_I18N.returnToMenuHint,
          "Returning to menu shortly — you can order again.",
        )}
      </p>
      <button
        type="button"
        onClick={onOrderAgain}
        className="mt-6 rounded-full px-6 py-2.5 text-[14px] font-semibold text-white"
        style={{ backgroundColor: ACCENT }}
      >
        {t(CASHIER_TICKET_I18N.orderAgain, "Order again")}
      </button>
    </div>
  );
}
