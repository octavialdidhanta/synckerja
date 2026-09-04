import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PosBrandMark } from "@/pos-mobile/shared/components/PosBrandMark";
import { Button } from "@/shared/components/ui/button";
import { useAuth } from "@/shared/auth/contexts/AuthContext";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { PosAuthViewport } from "@/pos-mobile/shared/layout/PosAuthViewport";
import { usePosTabletShell } from "@/pos-mobile/shared/hooks/usePosTabletShell";
import { clearPosSelectedOutlet } from "@/pos-mobile/1-outlet-select/lib/posSelectedOutletStorage";
import type { PosTabletAccessReason } from "@/pos-mobile/shared/access";
import { POS_AUTH_PATHS } from "../lib/posAuthPaths";
import { POS_TABLET_ACCESS_I18N } from "../lib/posTabletAccessCopy";
import { useMarkPosAuthSurface } from "../lib/useMarkPosAuthSurface";
import { clearPosAuthSurface } from "../lib/posAuthSurface";

type PosAccessDeniedPageProps = {
  reason?: PosTabletAccessReason;
};

/**
 * Shown when tablet dual-gate denies access (POS add-on inactive or not in Slot Karyawan).
 */
export default function PosAccessDeniedPage({ reason = "not_staff" }: PosAccessDeniedPageProps) {
  usePosTabletShell();
  useMarkPosAuthSurface();
  const { t } = useAppTranslation();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const isAddon = reason === "addon_inactive";

  const onLogout = () => {
    if (busy) return;
    setBusy(true);
    void (async () => {
      try {
        clearPosSelectedOutlet();
        clearPosAuthSurface();
        await signOut();
        navigate(POS_AUTH_PATHS.login, { replace: true });
      } finally {
        setBusy(false);
      }
    })();
  };

  return (
    <PosAuthViewport className="bg-white">
      <div className="mb-6 flex justify-center md:mb-8">
        <PosBrandMark />
      </div>
      <div className="flex w-full flex-col items-center gap-4 text-center">
        <h1 className="text-xl font-semibold text-slate-900">
          {isAddon
            ? t(POS_TABLET_ACCESS_I18N.denyAddonTitle, "POS add-on inactive")
            : t(POS_TABLET_ACCESS_I18N.denyStaffTitle, "POS access denied")}
        </h1>
        <p className="max-w-xs text-sm text-slate-600">
          {isAddon
            ? t(POS_TABLET_ACCESS_I18N.denyAddonBody, "Activate the POS add-on in the back office.")
            : t(POS_TABLET_ACCESS_I18N.denyStaffBody, "Ask an admin to add you to Employee Slots.")}
        </p>
        <Button
          type="button"
          className="mt-2 w-full max-w-xs"
          disabled={busy}
          onClick={onLogout}
        >
          {t(POS_TABLET_ACCESS_I18N.denyLogout, "Log out")}
        </Button>
        <Link
          to={POS_AUTH_PATHS.login}
          className="text-sm font-medium text-primary hover:underline"
          onClick={() => {
            clearPosSelectedOutlet();
            clearPosAuthSurface();
          }}
        >
          {t(POS_TABLET_ACCESS_I18N.denyBackToLogin, "Back to POS login")}
        </Link>
      </div>
    </PosAuthViewport>
  );
}
