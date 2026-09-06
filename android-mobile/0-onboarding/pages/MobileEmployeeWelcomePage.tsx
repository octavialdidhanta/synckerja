import { useRef } from "react";
import { useEmployeeWelcomeGate } from "@/0-onboarding/hooks/useEmployeeWelcomeGate";
import { EmployeeWelcomeContent, EmployeeWelcomeSpinner } from "@/0-onboarding/screens/EmployeeWelcomeScreen";
import { SynckerjaBrandMark } from "@/shared/components/mobile/SynckerjaBrandMark";
import { PosBrandMark } from "@/pos-mobile/shared/components/PosBrandMark";
import { isPosAuthSurface } from "@/pos-mobile/0-auth/lib/posAuthSurface";
import { usePosAuthFunnelChrome } from "@/pos-mobile/0-auth/layout/PosAuthFunnelChrome";
import { MobileAuthViewport } from "@/shared/components/mobile/MobileAuthViewport";

export default function MobileEmployeeWelcomePage() {
  const phase = useEmployeeWelcomeGate();
  const panelRef = useRef<HTMLDivElement>(null);
  const chromeOwnsBrand = usePosAuthFunnelChrome();
  const brandMark = chromeOwnsBrand ? null : isPosAuthSurface() ? (
    <PosBrandMark className="!-mb-2" />
  ) : (
    <SynckerjaBrandMark size="splash" className="!-mb-2" />
  );

  const body =
    phase === "checking" ? (
      <EmployeeWelcomeSpinner />
    ) : (
      <EmployeeWelcomeContent brandMark={brandMark} />
    );

  if (chromeOwnsBrand) {
    return body;
  }

  return (
    <MobileAuthViewport
      panelRef={panelRef}
      keyboardPaddingBottom={0}
      keyboardOpen={false}
    >
      {body}
    </MobileAuthViewport>
  );
}
