import { useEffect } from "react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { usePosTabletAccess, resolvePosPostOutletPath } from "@/pos-mobile/shared/access";
import {
  clearPosSelectedOutlet,
  readPosSelectedOutletId,
} from "@/pos-mobile/1-outlet-select/lib/posSelectedOutletStorage";
import { usePosAppPermissions } from "@/pos-mobile/shared/hooks/usePosAppPermissions";
import { POS_AUTH_PATHS } from "../lib/posAuthPaths";
import { PosTabletAccessSkeleton } from "./PosTabletAccessSkeleton";
import PosAccessDeniedPage from "../pages/PosAccessDeniedPage";

/**
 * Fail-closed route guard for authenticated `/pos/*` tablet pages.
 * Requires POS add-on + active Employee Slot staff with role.
 * Also enforces App Permission for `/pos/kitchen` (`app.kitchen_display`).
 */
export function RequirePosTabletAccess() {
  const access = usePosTabletAccess();
  const permissions = usePosAppPermissions();
  const location = useLocation();
  const navigate = useNavigate();
  const isSelectOutlet = location.pathname === POS_AUTH_PATHS.selectOutlet;
  const isKitchen = location.pathname === POS_AUTH_PATHS.kitchen;

  useEffect(() => {
    if (access.status !== "allowed") return;
    if (!access.outletsReady) return;
    if (isSelectOutlet) return;

    const outletId = readPosSelectedOutletId();
    if (!outletId) return;
    if (access.canUseOutlet(outletId)) return;

    clearPosSelectedOutlet();
    navigate(POS_AUTH_PATHS.selectOutlet, { replace: true });
  }, [
    access.status,
    access.outletsReady,
    access.canUseOutlet,
    isSelectOutlet,
    navigate,
  ]);

  if (access.status === "loading") {
    return <PosTabletAccessSkeleton />;
  }

  if (access.status === "denied") {
    return <PosAccessDeniedPage reason={access.reason} />;
  }

  if (isKitchen) {
    if (permissions.isLoading) {
      return <PosTabletAccessSkeleton />;
    }
    if (!permissions.canKitchenDisplay()) {
      return (
        <Navigate
          to={resolvePosPostOutletPath({
            canCharge: permissions.canCharge(),
            canKitchenDisplay: false,
          })}
          replace
        />
      );
    }
  }

  return <Outlet />;
}
