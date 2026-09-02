import { Check } from "lucide-react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { ORDER_CUSTOMIZE_I18N } from "../lib/orderCustomizeCopy";

const ACCENT = "#E91E8C";

export function OrderItemCustomizeOptionRow({
  name,
  extraPrice,
  selected,
  disabled,
  outOfStock,
  extraLabel,
  onToggle,
}: {
  name: string;
  extraPrice?: number;
  selected: boolean;
  disabled?: boolean;
  outOfStock?: boolean;
  extraLabel?: string;
  onToggle: () => void;
}) {
  const { t } = useAppTranslation();
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onToggle}
      className="flex w-full items-center gap-3 py-3 text-left disabled:opacity-40"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-semibold uppercase text-neutral-900">{name}</span>
        {outOfStock ? (
          <span className="mt-0.5 block text-[11px] text-neutral-400">
            {t(ORDER_CUSTOMIZE_I18N.outOfStock, "Out of stock")}
          </span>
        ) : extraLabel ? (
          <span className="mt-0.5 block text-[11px] text-neutral-400">{extraLabel}</span>
        ) : extraPrice && extraPrice > 0 ? (
          <span className="mt-0.5 block text-[11px] text-neutral-400">+{extraPrice.toLocaleString("id-ID")}</span>
        ) : null}
      </span>
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2"
        style={{
          borderColor: selected ? ACCENT : "#D4D4D4",
          backgroundColor: selected ? ACCENT : "white",
        }}
      >
        {selected ? <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} /> : null}
      </span>
    </button>
  );
}
