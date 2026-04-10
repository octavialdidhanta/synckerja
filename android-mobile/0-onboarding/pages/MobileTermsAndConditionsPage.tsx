import { TermsAndConditionsScreen } from "@/0-onboarding/screens/TermsAndConditionsScreen";
import { SynckerjaBrandMark } from "@/shared/components/mobile/SynckerjaBrandMark";
import { MobileOnboardingViewport } from "@/shared/components/mobile/MobileOnboardingViewport";

export default function MobileTermsAndConditionsPage() {
  return (
    <MobileOnboardingViewport scrollAlways>
      <TermsAndConditionsScreen brandMark={<SynckerjaBrandMark size="sm" />} />
    </MobileOnboardingViewport>
  );
}
