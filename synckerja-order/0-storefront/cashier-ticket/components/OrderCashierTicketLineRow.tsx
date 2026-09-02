import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { formatOrderRp } from "../../lib/formatOrderRp";
import { formatCartLineSummary } from "../../cart-sheet/lib/formatCartLineSummary";
import { ORDER_CHECKOUT_I18N } from "../../checkout/lib/orderCheckoutCopy";
import type { CashierTicketLine } from "../lib/parseCashierTicketCart";

export function OrderCashierTicketLineRow({ line }: { line: CashierTicketLine }) {
  const { t } = useAppTranslation();
  const summaries = formatCartLineSummary(line);
  const note = line.kitchenNote?.trim() ?? "";
  const lineTotal = line.unitPrice * line.quantity;

  return (
    <div className="border-b border-neutral-200 py-3">
      <p className="text-[14px] font-semibold uppercase leading-snug text-neutral-900">
        {line.serviceName}
      </p>
      <div className="mt-1 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {summaries.map((row, index) => (
            <p key={`${index}-${row}`} className="text-[13px] leading-snug text-neutral-700">
              {row}
            </p>
          ))}
          <p className="mt-2 text-[13px] text-neutral-400">
            {note || t(ORDER_CHECKOUT_I18N.noNotes, "No notes yet")}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="min-w-[1.25rem] text-center text-[13px] font-semibold text-neutral-900">
            x{line.quantity}
          </span>
          <p className="text-[13px] font-medium text-neutral-900">{formatOrderRp(lineTotal)}</p>
        </div>
      </div>
    </div>
  );
}
