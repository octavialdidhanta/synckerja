import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import type { KitchenSalesTypeBucket } from "../../../lib/kitchenSalesTypeBucket";
import {
  KITCHEN_FIRE_TRIGGERS,
  type KitchenFireBySalesType,
  type KitchenFireTrigger,
} from "../../../lib/kitchenFirePolicy";
import { POS_KITCHEN_SETTINGS_I18N } from "../../lib/posKitchenSettingsCopy";

const BUCKET_LABEL: Record<KitchenSalesTypeBucket, keyof typeof POS_KITCHEN_SETTINGS_I18N> = {
  dine_in: "orderTypeDineIn",
  takeaway: "orderTypeTakeaway",
  delivery: "orderTypeDelivery",
  pickup: "orderTypePickup",
};

type Props = {
  value: KitchenFireBySalesType;
  onChange: (next: KitchenFireBySalesType) => void;
};

export function PosKitchenTransitionTimesPanel({ value, onChange }: Props) {
  const { t } = useAppTranslation();

  const setBucket = (bucket: KitchenSalesTypeBucket, trigger: KitchenFireTrigger) => {
    onChange({ ...value, [bucket]: trigger });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">
          {t(POS_KITCHEN_SETTINGS_I18N.firePolicyTitle, "Send orders to kitchen")}
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          {t(
            POS_KITCHEN_SETTINGS_I18N.firePolicyHint,
            "Choose when tickets appear on the Kitchen Display. Independent from Bluetooth printers.",
          )}
        </p>
        <ul className="mt-4 divide-y divide-slate-100">
          {(Object.keys(BUCKET_LABEL) as KitchenSalesTypeBucket[]).map((bucket) => (
            <li key={bucket} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <span className="text-sm font-medium text-slate-800">
                {t(POS_KITCHEN_SETTINGS_I18N[BUCKET_LABEL[bucket]], bucket)}
              </span>
              <div className="flex gap-2">
                {KITCHEN_FIRE_TRIGGERS.map((trigger) => {
                  const active = value[bucket] === trigger;
                  const label =
                    trigger === "save_bill"
                      ? t(POS_KITCHEN_SETTINGS_I18N.fireOnSaveBill, "Save Bill")
                      : t(POS_KITCHEN_SETTINGS_I18N.fireOnPay, "On Pay");
                  return (
                    <button
                      key={trigger}
                      type="button"
                      onClick={() => setBucket(bucket, trigger)}
                      className={`min-h-9 rounded-lg px-3 text-xs font-semibold transition ${
                        active
                          ? "bg-slate-900 text-white shadow-sm"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-slate-500">
          {t(
            POS_KITCHEN_SETTINGS_I18N.firePolicyPayFirstNote,
            "Walk-in direct pay always fires on pay when nothing was sent yet.",
          )}
        </p>
      </div>
      <div className="rounded-xl border border-dashed border-slate-200 bg-white/60 p-4 text-sm text-slate-500">
        {t(
          POS_KITCHEN_SETTINGS_I18N.transitionSlaSoon,
          "Automatic status transition times (SLA) — coming soon.",
        )}
      </div>
    </div>
  );
}
