import { CreatePlanFlow } from "@/0-onboarding/screens/CreatePlanFlow";
import { MobileOnboardingViewport } from "@/shared/components/mobile/MobileOnboardingViewport";

export default function MobileCreatePlanPage() {
  return (
    <MobileOnboardingViewport scrollAlways>
      <CreatePlanFlow />
    </MobileOnboardingViewport>
  );
}
