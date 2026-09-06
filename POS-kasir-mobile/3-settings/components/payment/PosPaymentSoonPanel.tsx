import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { POS_PANEL } from "@/pos-mobile/shared/lib/posPanelChrome";
import { POS_SETTINGS_I18N } from "../../lib/posSettingsCopy";

/** Placeholder panel for Tax / Surcharge / Payment Settings. */
export function PosPaymentSoonPanel() {
  const { t } = useAppTranslation();

  return (
    <div className={POS_PANEL.body}>
      <div className={POS_PANEL.card}>
        <div className={POS_PANEL.row}>
          <p className="text-sm text-slate-400">
            {t(POS_SETTINGS_I18N.paymentSoon, "Coming soon")}
          </p>
        </div>
      </div>
    </div>
  );
}
