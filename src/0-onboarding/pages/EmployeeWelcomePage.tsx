import { OnboardingSplitLayout } from "@/0-onboarding/components/OnboardingSplitLayout";
import { useEmployeeWelcomeGate } from "@/0-onboarding/hooks/useEmployeeWelcomeGate";
import { EmployeeWelcomeContent, EmployeeWelcomeSpinner } from "@/0-onboarding/screens/EmployeeWelcomeScreen";

export default function EmployeeWelcomePage() {
  const phase = useEmployeeWelcomeGate();

  return (
    <OnboardingSplitLayout scrollClassName="items-center justify-center">
      {phase === "checking" ? <EmployeeWelcomeSpinner /> : <EmployeeWelcomeContent />}
    </OnboardingSplitLayout>
  );
}
