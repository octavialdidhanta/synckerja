import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { POS_KITCHEN_SETTINGS_I18N } from "../../lib/posKitchenSettingsCopy";

export function PosKitchenSettingsSoonPanel() {
  const { t } = useAppTranslation();
  return (
    <div className="flex min-h-[200px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white px-4 text-center text-sm text-slate-500">
      {t(POS_KITCHEN_SETTINGS_I18N.soon, "Coming soon")}
    </div>
  );
}
