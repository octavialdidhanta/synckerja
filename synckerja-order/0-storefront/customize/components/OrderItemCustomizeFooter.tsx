import { Minus, Plus } from "lucide-react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { formatOrderRp } from "../../lib/formatOrderRp";
import { ORDER_STOREFRONT_PX } from "../../lib/orderStorefrontGutter";
import { ORDER_CUSTOMIZE_I18N } from "../lib/orderCustomizeCopy";

const ACCENT = "#E91E8C";

export function OrderItemCustomizeFooter({
  qty,
  total,
  disabled,
  name,
  saveMode,
  qtyLocked,
  onDecrease,
  onIncrease,
  onAdd,
}: {
  qty: number;
  total: number;
  disabled?: boolean;
  name: string;
  saveMode?: boolean;
  qtyLocked?: boolean;
  onDecrease: () => void;
  onIncrease: () => void;
  onAdd: () => void;
}) {
  const { t } = useAppTranslation();
  const cta = saveMode
    ? t(ORDER_CUSTOMIZE_I18N.save, "Save - {{price}}", { price: formatOrderRp(total) })
    : t(ORDER_CUSTOMIZE_I18N.addOrders, "Add Orders - {{price}}", { price: formatOrderRp(total) });
  return (
    <div className={`border-t border-neutral-200 bg-white ${ORDER_STOREFRONT_PX} pb-4 pt-3 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]`}>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[14px] text-neutral-800">
          {t(ORDER_CUSTOMIZE_I18N.totalOrder, "Total Order")}
        </p>
        <div className="flex items-center gap-4">
          <button
            type="button"
            disabled={qtyLocked}
            onClick={onDecrease}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-300 disabled:opacity-40"
            aria-label={t("synckerjaOrder.store.decreaseQty", "Decrease {{name}}", { name })}
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="min-w-[1.25rem] text-center text-[15px] font-semibold">{qty}</span>
          <button
            type="button"
            disabled={qtyLocked}
            onClick={onIncrease}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-300 disabled:opacity-40"
            aria-label={t("synckerjaOrder.store.increaseQty", "Increase {{name}}", { name })}
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={onAdd}
        className="h-12 w-full rounded-xl text-[15px] font-bold text-white disabled:opacity-40"
        style={{ backgroundColor: ACCENT }}
      >
        {cta}
      </button>
    </div>
  );
}
