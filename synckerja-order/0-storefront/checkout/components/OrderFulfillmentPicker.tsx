import { ShoppingBag, Utensils } from "lucide-react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { ORDER_STOREFRONT_PX } from "../../lib/orderStorefrontGutter";
import { ORDER_CHECKOUT_I18N } from "../lib/orderCheckoutCopy";
import type { OrderFulfillment } from "../lib/orderFulfillment";

const ACCENT = "#E91E8C";

export function OrderFulfillmentPicker({
  value,
  onChange,
  disabled,
}: {
  value: OrderFulfillment;
  onChange: (next: OrderFulfillment) => void;
  disabled?: boolean;
}) {
  const { t } = useAppTranslation();

  const options: { id: OrderFulfillment; icon: typeof Utensils; label: string }[] = [
    {
      id: "dine_in",
      icon: Utensils,
      label: t(ORDER_CHECKOUT_I18N.dineIn, "Dine In"),
    },
    {
      id: "takeaway",
      icon: ShoppingBag,
      label: t(ORDER_CHECKOUT_I18N.takeAway, "Take Away"),
    },
  ];

  return (
    <div className={`${ORDER_STOREFRONT_PX} py-3`}>
      <p className="mb-2 text-[14px] font-medium text-neutral-800">
        {t(ORDER_CHECKOUT_I18N.orderType, "Order Type")}
      </p>
      <div className="grid grid-cols-2 gap-2">
        {options.map((opt) => {
          const selected = value === opt.id;
          const Icon = opt.icon;
          return (
            <button
              key={opt.id}
              type="button"
              disabled={disabled}
              onClick={() => onChange(opt.id)}
              className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-[13px] font-semibold transition-colors disabled:opacity-50 ${
                selected
                  ? "border-transparent text-white"
                  : "border-neutral-200 bg-white text-neutral-800"
              }`}
              style={selected ? { backgroundColor: ACCENT } : undefined}
              aria-pressed={selected}
            >
              <Icon className="h-4 w-4" strokeWidth={2} />
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
