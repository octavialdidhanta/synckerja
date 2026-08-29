import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { usePosSessionLeave } from "@/pos-mobile/shared/PosSessionLeaveProvider";
import { POS_SETTINGS_I18N } from "../../lib/posSettingsCopy";

/**
 * Coral full-width logout under settings left nav (same leave-gate as cashier drawer).
 */
export function PosSettingsLogoutButton() {
  const { t } = useAppTranslation();
  const leave = usePosSessionLeave();

  return (
    <button
      type="button"
      onClick={() => leave.requestLeave("logout")}
      className="w-full rounded-md bg-destructive px-4 py-3 text-sm font-bold uppercase tracking-wide text-destructive-foreground shadow-sm transition hover:bg-destructive/90 active:bg-destructive/80"
    >
      {t(POS_SETTINGS_I18N.logout, "KELUAR")}
    </button>
  );
}
