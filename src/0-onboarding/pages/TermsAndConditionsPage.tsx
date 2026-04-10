import { OnboardingSplitLayout } from "@/0-onboarding/components/OnboardingSplitLayout";
import { TermsAndConditionsScreen } from "@/0-onboarding/screens/TermsAndConditionsScreen";

export default function TermsAndConditionsPage() {
  return (
    <OnboardingSplitLayout fillViewport scrollClassName="items-start">
      <TermsAndConditionsScreen />
    </OnboardingSplitLayout>
  );
}
