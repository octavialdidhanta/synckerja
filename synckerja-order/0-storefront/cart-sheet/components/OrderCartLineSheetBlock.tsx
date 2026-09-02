import { Minus, Plus } from "lucide-react";
import type { CustomerVisitCartLine } from "@/5-2-customer-visits/checkout/lib/customerVisitCheckout.types";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { formatOrderRp } from "../../lib/formatOrderRp";
import { formatCartLineSummary } from "../lib/formatCartLineSummary";
import { ORDER_CART_SHEET_I18N } from "../lib/orderCartSheetCopy";

const ACCENT = "#E91E8C";

export function OrderCartLineSheetBlock({
  line,
  canEdit,
  disabled,
  onEdit,
  onSetQty,
}: {
  line: CustomerVisitCartLine;
  canEdit: boolean;
  disabled?: boolean;
  onEdit: () => void;
  onSetQty: (quantity: number) => void;
}) {
  const { t } = useAppTranslation();
  const summaries = formatCartLineSummary(line);
  const note = line.kitchenNote?.trim() ?? "";
  const lineTotal = line.unitPrice * line.quantity;

  return (
    <div className="border-b border-neutral-200 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {summaries.map((row, index) => (
            <p key={`${index}-${row}`} className="text-[13px] font-medium leading-snug text-neutral-900">
              {row}
            </p>
          ))}
          {canEdit ? (
            <button
              type="button"
              disabled={disabled}
              onClick={onEdit}
              className="mt-1 text-[13px] font-semibold disabled:opacity-40"
              style={{ color: ACCENT }}
            >
              {t(ORDER_CART_SHEET_I18N.edit, "Edit")}
            </button>
          ) : null}
          <p className="mt-2 text-[13px] text-neutral-400">
            {note || t(ORDER_CART_SHEET_I18N.noNotes, "No notes yet")}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <p className="text-[13px] font-medium text-neutral-900">{formatOrderRp(lineTotal)}</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={disabled}
              onClick={() => onSetQty(line.quantity - 1)}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-neutral-300 bg-white disabled:opacity-40"
              aria-label={t("synckerjaOrder.store.decreaseQty", "Decrease {{name}}", {
                name: line.serviceName,
              })}
            >
              <Minus className="h-3.5 w-3.5" strokeWidth={2.25} />
            </button>
            <span className="min-w-[1.25rem] text-center text-[13px] font-semibold text-neutral-900">
              {line.quantity}
            </span>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onSetQty(line.quantity + 1)}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-neutral-300 bg-white disabled:opacity-40"
              aria-label={t("synckerjaOrder.store.increaseQty", "Increase {{name}}", {
                name: line.serviceName,
              })}
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2.25} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
