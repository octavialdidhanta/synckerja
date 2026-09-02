import { Minus, Plus } from "lucide-react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { formatOrderRp } from "../../lib/formatOrderRp";
import { ORDER_CUSTOMIZE_I18N } from "../lib/orderCustomizeCopy";

const ACCENT = "#E91E8C";

export function OrderItemCustomizeOptionQtyRow({
  name,
  extraPrice,
  quantity,
  canIncrease,
  outOfStock,
  onDecrease,
  onIncrease,
}: {
  name: string;
  extraPrice?: number;
  quantity: number;
  canIncrease: boolean;
  outOfStock?: boolean;
  onDecrease: () => void;
  onIncrease: () => void;
}) {
  const { t } = useAppTranslation();
  const qty = Math.max(0, quantity);
  return (
    <div className="flex w-full items-center gap-3 py-3">
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-semibold uppercase text-neutral-900">{name}</span>
        {outOfStock ? (
          <span className="mt-0.5 block text-[11px] text-neutral-400">
            {t(ORDER_CUSTOMIZE_I18N.outOfStock, "Out of stock")}
          </span>
        ) : extraPrice && extraPrice > 0 ? (
          <span className="mt-0.5 block text-[11px] text-neutral-400">+{formatOrderRp(extraPrice)}</span>
        ) : null}
      </span>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          disabled={qty <= 0 || outOfStock}
          onClick={onDecrease}
          className="flex h-7 w-7 items-center justify-center rounded-full disabled:opacity-40"
          style={{ backgroundColor: ACCENT }}
          aria-label={t(ORDER_CUSTOMIZE_I18N.decreaseQty, "Decrease {{name}}", { name })}
        >
          <Minus className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />
        </button>
        <span className="min-w-[1.25rem] text-center text-[14px] font-semibold text-neutral-900">{qty}</span>
        <button
          type="button"
          disabled={!canIncrease || outOfStock}
          onClick={onIncrease}
          className="flex h-7 w-7 items-center justify-center rounded-full disabled:opacity-40"
          style={{ backgroundColor: ACCENT }}
          aria-label={t(ORDER_CUSTOMIZE_I18N.increaseQty, "Increase {{name}}", { name })}
        >
          <Plus className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}
