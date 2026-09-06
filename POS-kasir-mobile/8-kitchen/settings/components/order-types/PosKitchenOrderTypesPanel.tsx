import { Switch } from "@/shared/components/ui/switch";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import type { KitchenSalesTypeBucket } from "../../../lib/kitchenSalesTypeBucket";
import { KITCHEN_SALES_TYPE_BUCKETS } from "../../../lib/kitchenSalesTypeBucket";
import { POS_KITCHEN_SETTINGS_I18N } from "../../lib/posKitchenSettingsCopy";
import type { KitchenOrderTypeVisibility } from "../../lib/posKitchenSettingsTypes";

const LABELS: Record<
  KitchenSalesTypeBucket,
  { key: string; fallback: string }
> = {
  dine_in: {
    key: POS_KITCHEN_SETTINGS_I18N.orderTypeDineIn,
    fallback: "Dinein",
  },
  takeaway: {
    key: POS_KITCHEN_SETTINGS_I18N.orderTypeTakeaway,
    fallback: "Takeaway",
  },
  delivery: {
    key: POS_KITCHEN_SETTINGS_I18N.orderTypeDelivery,
    fallback: "Delivery",
  },
  pickup: {
    key: POS_KITCHEN_SETTINGS_I18N.orderTypePickup,
    fallback: "Pickup",
  },
};

type Props = {
  value: KitchenOrderTypeVisibility;
  onChange: (next: KitchenOrderTypeVisibility) => void;
};

export function PosKitchenOrderTypesPanel({ value, onChange }: Props) {
  const { t } = useAppTranslation();

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="mb-3 text-sm font-bold text-slate-900">
        {t(POS_KITCHEN_SETTINGS_I18N.orderTypes, "Order Types")}
      </h3>
      <ul className="divide-y divide-slate-100">
        {KITCHEN_SALES_TYPE_BUCKETS.map((bucket) => {
          const meta = LABELS[bucket];
          return (
            <li
              key={bucket}
              className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
            >
              <span className="text-sm font-medium text-slate-800">
                {t(meta.key, meta.fallback)}
              </span>
              <Switch
                checked={value[bucket]}
                onCheckedChange={(checked) =>
                  onChange({ ...value, [bucket]: checked })
                }
                aria-label={t(meta.key, meta.fallback)}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
