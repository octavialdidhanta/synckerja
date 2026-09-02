import { X } from "lucide-react";
import type { CustomerVisitCartLine } from "@/5-2-customer-visits/checkout/lib/customerVisitCheckout.types";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import type { PublicOrderCatalogItem } from "@/synckerja-order/shared/lib/orderTypes";
import { ORDER_STOREFRONT_PX } from "../../lib/orderStorefrontGutter";
import {
  orderBackdropMotionClass,
  orderSheetPanelMotionClass,
  useOrderSurfaceMotion,
} from "../../lib/useOrderSurfaceMotion";
import { ORDER_CART_SHEET_I18N } from "../lib/orderCartSheetCopy";
import { OrderCartLineSheetBlock } from "./OrderCartLineSheetBlock";

const ACCENT = "#E91E8C";

export function OrderCartLineSheet({
  item,
  lines,
  canCustomize,
  disabled,
  onClose,
  onEdit,
  onMakeAnother,
  onSetQty,
}: {
  item: PublicOrderCatalogItem;
  lines: CustomerVisitCartLine[];
  canCustomize: boolean;
  disabled?: boolean;
  onClose: () => void;
  onEdit: (line: CustomerVisitCartLine) => void;
  onMakeAnother: () => void;
  onSetQty: (lineKey: string, quantity: number) => void;
}) {
  const { t } = useAppTranslation();
  const { exiting, requestClose } = useOrderSurfaceMotion(onClose);

  return (
    <div className="absolute inset-0 z-[35] flex flex-col justify-end">
      <button
        type="button"
        className={`absolute inset-0 bg-black/40 ${orderBackdropMotionClass(exiting)}`}
        aria-label={t(ORDER_CART_SHEET_I18N.close, "Close")}
        onClick={requestClose}
      />
      <div
        className={`relative z-10 max-h-[min(78dvh,640px)] w-full overflow-hidden rounded-t-2xl bg-white pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] shadow-[0_-8px_32px_rgba(0,0,0,0.12)] ${orderSheetPanelMotionClass(exiting)}`}
      >
        <div className={`flex items-center justify-between gap-3 py-3 ${ORDER_STOREFRONT_PX}`}>
          <h2 className="min-w-0 truncate text-[15px] font-bold uppercase tracking-wide text-neutral-900">
            {item.name}
          </h2>
          <button
            type="button"
            onClick={requestClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center text-neutral-500"
            aria-label={t(ORDER_CART_SHEET_I18N.close, "Close")}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className={`max-h-[min(58dvh,480px)] overflow-y-auto ${ORDER_STOREFRONT_PX}`}>
          {lines.map((line) => (
            <OrderCartLineSheetBlock
              key={line.lineKey}
              line={line}
              canEdit={canCustomize}
              disabled={disabled}
              onEdit={() => onEdit(line)}
              onSetQty={(quantity) => onSetQty(line.lineKey, quantity)}
            />
          ))}
          <button
            type="button"
            disabled={disabled}
            onClick={onMakeAnother}
            className="my-3 h-11 w-full rounded-xl border text-[14px] font-semibold disabled:opacity-40"
            style={{ borderColor: ACCENT, color: ACCENT }}
          >
            {t(ORDER_CART_SHEET_I18N.makeAnother, "Make another")}
          </button>
        </div>
      </div>
    </div>
  );
}
