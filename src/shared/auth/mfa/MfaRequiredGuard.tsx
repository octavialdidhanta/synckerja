import { Navigate, useLocation } from "react-router-dom";
import { useRequireMfaForRole } from "./useRequireMfaForRole";
import { mfaSecuritySettingsPath } from "./mfaSettingsPaths";

type Props = {
  children: React.ReactNode;
};

/** Blocks Xendit/finance routes until Owner/Admin completes 2FA (after grace period). */
export function MfaRequiredGuard({ children }: Props) {
  const location = useLocation();
  const { loading, mustEnroll } = useRequireMfaForRole();

  if (loading) return null;

  if (mustEnroll) {
    const returnTo = encodeURIComponent(location.pathname + location.search);
    return (
      <Navigate
        to={mfaSecuritySettingsPath({ setup2fa: "required", returnTo })}
        replace
      />
    );
  }

  return <>{children}</>;
}
