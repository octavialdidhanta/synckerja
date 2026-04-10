import { useRef } from "react";
import { useEmployeeWelcomeGate } from "@/0-onboarding/hooks/useEmployeeWelcomeGate";
import { EmployeeWelcomeContent, EmployeeWelcomeSpinner } from "@/0-onboarding/screens/EmployeeWelcomeScreen";
import { SynckerjaBrandMark } from "@/shared/components/mobile/SynckerjaBrandMark";
import { MobileAuthViewport } from "@/shared/components/mobile/MobileAuthViewport";

export default function MobileEmployeeWelcomePage() {
  const phase = useEmployeeWelcomeGate();
  const panelRef = useRef<HTMLDivElement>(null);

  return (
    <MobileAuthViewport
      panelRef={panelRef}
      keyboardPaddingBottom={0}
      keyboardOpen={false}
    >
      {phase === "checking" ? (
        <EmployeeWelcomeSpinner />
      ) : (
        <EmployeeWelcomeContent brandMark={<SynckerjaBrandMark />} />
      )}
    </MobileAuthViewport>
  );
}
