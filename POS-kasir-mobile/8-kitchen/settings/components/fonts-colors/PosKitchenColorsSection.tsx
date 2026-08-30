import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { KITCHEN_SALES_TYPE_BUCKETS } from "../../../lib/kitchenSalesTypeBucket";
import type { KitchenSalesTypeBucket } from "../../../lib/kitchenSalesTypeBucket";
import type {
  KitchenStatusColorKey,
  KitchenThemeColors,
} from "../../lib/defaultKitchenTheme";
import { POS_KITCHEN_SETTINGS_I18N } from "../../lib/posKitchenSettingsCopy";
import { PosKitchenColorRow } from "./PosKitchenColorRow";

const ORDER_LABELS: Record<
  KitchenSalesTypeBucket,
  { key: string; fallback: string }
> = {
  dine_in: {
    key: POS_KITCHEN_SETTINGS_I18N.orderTypeDineIn,
    fallback: "Dine in",
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

const STATUS_ROWS: {
  key: KitchenStatusColorKey;
  labelKey: string;
  fallback: string;
}[] = [
  {
    key: "on_time",
    labelKey: POS_KITCHEN_SETTINGS_I18N.statusOnTime,
    fallback: "On time",
  },
  {
    key: "caution",
    labelKey: POS_KITCHEN_SETTINGS_I18N.statusCaution,
    fallback: "Caution",
  },
  {
    key: "late",
    labelKey: POS_KITCHEN_SETTINGS_I18N.statusLate,
    fallback: "Late",
  },
];

type Props = {
  value: KitchenThemeColors;
  onChange: (next: KitchenThemeColors) => void;
};

export function PosKitchenColorsSection({ value, onChange }: Props) {
  const { t } = useAppTranslation();

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="mb-3 text-base font-bold text-slate-900">
        {t(POS_KITCHEN_SETTINGS_I18N.colorsHeading, "Colors")}
      </h3>

      <h4 className="mb-1 text-sm font-bold text-teal-700">
        {t(POS_KITCHEN_SETTINGS_I18N.colorsOrderTypes, "Order Types")}
      </h4>
      <div className="mb-4">
        {KITCHEN_SALES_TYPE_BUCKETS.map((bucket) => {
          const meta = ORDER_LABELS[bucket];
          return (
            <PosKitchenColorRow
              key={bucket}
              label={t(meta.key, meta.fallback)}
              value={value.order_types[bucket]}
              onChange={(hex) =>
                onChange({
                  ...value,
                  order_types: { ...value.order_types, [bucket]: hex },
                })
              }
            />
          );
        })}
      </div>

      <h4 className="mb-1 text-sm font-bold text-teal-700">
        {t(POS_KITCHEN_SETTINGS_I18N.colorsStatus, "Status")}
      </h4>
      <div>
        {STATUS_ROWS.map((row) => (
          <PosKitchenColorRow
            key={row.key}
            label={t(row.labelKey, row.fallback)}
            value={value.status[row.key]}
            onChange={(hex) =>
              onChange({
                ...value,
                status: { ...value.status, [row.key]: hex },
              })
            }
          />
        ))}
      </div>
    </section>
  );
}
