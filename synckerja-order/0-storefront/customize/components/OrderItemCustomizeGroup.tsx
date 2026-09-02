import { Check } from "lucide-react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import type { PublicOrderModifierGroup } from "@/synckerja-order/shared/lib/orderTypes";
import { ORDER_STOREFRONT_PX } from "../../lib/orderStorefrontGutter";
import { canIncreaseOptionQty, optionQtyValue, type OptionQtyById } from "../lib/orderCustomizeOptionQty";
import { ORDER_CUSTOMIZE_I18N } from "../lib/orderCustomizeCopy";
import { OrderItemCustomizeOptionQtyRow } from "./OrderItemCustomizeOptionQtyRow";
import { OrderItemCustomizeOptionRow } from "./OrderItemCustomizeOptionRow";

export function OrderItemCustomizeGroup({
  group,
  selectedIds,
  qtyByOption,
  valid,
  onToggle,
  onQty,
}: {
  group: PublicOrderModifierGroup;
  selectedIds: string[];
  qtyByOption?: OptionQtyById;
  valid: boolean;
  onToggle: (optionId: string, outOfStock: boolean) => void;
  onQty: (optionId: string, delta: number, outOfStock: boolean) => void;
}) {
  const { t } = useAppTranslation();
  const hint = group.is_required
    ? t(ORDER_CUSTOMIZE_I18N.mustSelectMax, "Must be selected max. {{count}}", {
        count: group.max_selected,
      })
    : t(ORDER_CUSTOMIZE_I18N.optionalMax, "Optional · max. {{count}}", { count: group.max_selected });
  const qtyMode = Boolean(group.option_qty_enabled);
  const canPlus = canIncreaseOptionQty({ group, qtyByOption, outOfStock: false });

  return (
    <section className={`border-b border-neutral-200 ${ORDER_STOREFRONT_PX} py-3`}>
      <div className="mb-1 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[14px] font-bold uppercase text-neutral-900">{group.name}</p>
          <p className="text-[12px] text-neutral-400">{hint}</p>
        </div>
        {valid ? (
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
            <Check className="h-3.5 w-3.5" strokeWidth={3} />
          </span>
        ) : (
          <span className="h-6 w-6 shrink-0 rounded-full border border-neutral-200" />
        )}
      </div>
      <div className="divide-y divide-neutral-100">
        {group.options.map((opt) =>
          qtyMode ? (
            <OrderItemCustomizeOptionQtyRow
              key={opt.id}
              name={opt.name}
              extraPrice={opt.extra_price}
              quantity={optionQtyValue(qtyByOption, opt.id)}
              canIncrease={canPlus}
              outOfStock={opt.out_of_stock}
              onDecrease={() => onQty(opt.id, -1, opt.out_of_stock)}
              onIncrease={() => onQty(opt.id, 1, opt.out_of_stock)}
            />
          ) : (
            <OrderItemCustomizeOptionRow
              key={opt.id}
              name={opt.name}
              extraPrice={opt.extra_price}
              selected={selectedIds.includes(opt.id)}
              disabled={opt.out_of_stock}
              outOfStock={opt.out_of_stock}
              onToggle={() => onToggle(opt.id, opt.out_of_stock)}
            />
          ),
        )}
      </div>
    </section>
  );
}
