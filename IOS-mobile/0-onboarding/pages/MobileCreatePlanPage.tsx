import { CreatePlanFlow } from "@/0-onboarding/screens/CreatePlanFlow";
import { SynckerjaBrandMark } from "@/shared/components/mobile/SynckerjaBrandMark";
import { MobileOnboardingViewport } from "@/shared/components/mobile/MobileOnboardingViewport";

export default function MobileCreatePlanPage() {
  return (
    <MobileOnboardingViewport scrollAlways>
      <CreatePlanFlow brandMark={<SynckerjaBrandMark />} />
    </MobileOnboardingViewport>
  );
}
