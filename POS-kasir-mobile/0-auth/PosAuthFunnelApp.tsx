import { useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { RequireAuth } from "@/shared/components/RequireAuth";
import { RequireMfaSession } from "@/shared/auth/mfa/RequireMfaSession";
import { OrganizationAccessGuard } from "@/shared/components/OrganizationAccessGuard";
import { SubscriptionExpiryGuard } from "@/10-subscription/shared/SubscriptionExpiryGuard";
import { RequirePosTabletAccess } from "./components/RequirePosTabletAccess";
import { PosAuthFunnelLayout } from "./layout/PosAuthFunnelLayout";
import PosWelcomePage from "../0-welcome/pages/PosWelcomePage";
import PosLoginPage from "./pages/PosLoginPage";
import PosLoginPasswordPage from "./pages/PosLoginPasswordPage";
import PosMfaVerifyPage from "./pages/PosMfaVerifyPage";
import PosRegisterPage from "./pages/PosRegisterPage";
import PosForgotPasswordPage from "./pages/PosForgotPasswordPage";
import PosSelectOutletPage from "../1-outlet-select/pages/PosSelectOutletPage";
import { posAuthFlickerLog } from "./lib/posAuthFlickerLog";

/**
 * Single lazy boundary for the entire POS auth funnel.
 * Child steps are eager imports so welcome → login → password → MFA never
 * re-enter React.Suspense (that was the logo / shell flicker between steps).
 */
export default function PosAuthFunnelApp() {
  const { pathname } = useLocation();

  useEffect(() => {
    posAuthFlickerLog("funnel_app_mount", { pathname });
    return () => posAuthFlickerLog("funnel_app_unmount", { pathname });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once
  }, []);

  useEffect(() => {
    posAuthFlickerLog("funnel_app_path", { pathname });
  }, [pathname]);

  return (
    <Routes>
      <Route element={<PosAuthFunnelLayout />}>
        <Route index element={<PosWelcomePage />} />
        <Route path="login" element={<PosLoginPage />} />
        <Route path="login/password" element={<PosLoginPasswordPage />} />
        <Route path="login/mfa" element={<PosMfaVerifyPage />} />
        <Route path="register" element={<PosRegisterPage />} />
        <Route path="forgot-password" element={<PosForgotPasswordPage />} />
        <Route element={<RequireAuth />}>
          <Route element={<RequireMfaSession />}>
            <Route element={<OrganizationAccessGuard />}>
              <Route element={<SubscriptionExpiryGuard />}>
                <Route element={<RequirePosTabletAccess />}>
                  <Route path="select-outlet" element={<PosSelectOutletPage />} />
                </Route>
              </Route>
            </Route>
          </Route>
        </Route>
      </Route>
    </Routes>
  );
}
