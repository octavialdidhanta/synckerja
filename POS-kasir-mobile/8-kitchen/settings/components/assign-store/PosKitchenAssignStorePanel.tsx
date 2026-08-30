import { LayoutGrid, LogOut, Store } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { POS_AUTH_PATHS } from "@/pos-mobile/0-auth/lib/posAuthPaths";
import { usePosAppPermissions } from "@/pos-mobile/shared/hooks/usePosAppPermissions";
import {
  PosSessionLeaveProvider,
  usePosSessionLeave,
} from "@/pos-mobile/shared/PosSessionLeaveProvider";
import { POS_KITCHEN_SETTINGS_I18N } from "../../lib/posKitchenSettingsCopy";

type Props = {
  outletName: string;
  /** Close settings overlay before navigating to cashier. */
  onBeforeNavigateToPos?: () => void;
};

function AssignStoreInner({ outletName, onBeforeNavigateToPos }: Props) {
  const { t } = useAppTranslation();
  const navigate = useNavigate();
  const leave = usePosSessionLeave();
  const permissions = usePosAppPermissions();
  const canBackToPos = permissions.canCharge();

  return (
    <div className="mx-auto max-w-md space-y-4 rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
          <Store className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-slate-900">
            {t(POS_KITCHEN_SETTINGS_I18N.assignStoreTitle, "Assign Store")}
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            {t(
              POS_KITCHEN_SETTINGS_I18N.assignStoreHint,
              "Switch outlet or sign out without leaving the kitchen display.",
            )}
          </p>
        </div>
      </div>

      <div className="rounded-lg bg-slate-50 px-3 py-2.5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          {t(POS_KITCHEN_SETTINGS_I18N.currentOutlet, "Current outlet")}
        </p>
        <p className="mt-0.5 truncate text-sm font-semibold text-slate-900">
          {outletName || "—"}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {canBackToPos ? (
          <button
            type="button"
            onClick={() => {
              onBeforeNavigateToPos?.();
              navigate(POS_AUTH_PATHS.cashier);
            }}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 text-sm font-bold text-white transition hover:bg-teal-700"
          >
            <LayoutGrid className="h-4 w-4" aria-hidden />
            {t(POS_KITCHEN_SETTINGS_I18N.backToPos, "Back to Point of Sale")}
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => leave.requestLeave("switch-outlet")}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
        >
          <Store className="h-4 w-4" aria-hidden />
          {t(POS_KITCHEN_SETTINGS_I18N.switchOutlet, "Switch outlet")}
        </button>
        <button
          type="button"
          onClick={() => leave.requestLeave("logout")}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-rose-500 px-4 text-sm font-bold text-white transition hover:bg-rose-600"
        >
          <LogOut className="h-4 w-4" aria-hidden />
          {t(POS_KITCHEN_SETTINGS_I18N.logout, "Log out")}
        </button>
      </div>
    </div>
  );
}

export function PosKitchenAssignStorePanel(props: Props) {
  return (
    <PosSessionLeaveProvider>
      <AssignStoreInner {...props} />
    </PosSessionLeaveProvider>
  );
}
