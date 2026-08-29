import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { POS_SETTINGS_I18N } from "../../lib/posSettingsCopy";

/** Placeholder for Barcode Scanner / EDC / Customer Display. */
export function PosHardwareSoonPanel() {
  const { t } = useAppTranslation();

  return (
    <div className="pb-6">
      <div className="border-b border-slate-100 px-4 py-4">
        <p className="text-sm text-slate-400">
          {t(POS_SETTINGS_I18N.hardwareSoon, "Coming soon")}
        </p>
      </div>
    </div>
  );
}
