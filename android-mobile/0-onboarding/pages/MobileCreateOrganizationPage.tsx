import { useCreateOrganizationGate } from "@/0-onboarding/hooks/useCreateOrganizationGate";
import {
  CreateOrganizationFormColumn,
  CreateOrganizationLoadingCard,
} from "@/0-onboarding/screens/CreateOrganizationScreen";
import { MobileOnboardingViewport } from "@/shared/components/mobile/MobileOnboardingViewport";

export default function MobileCreateOrganizationPage() {
  const loading = useCreateOrganizationGate();

  return (
    <MobileOnboardingViewport scrollAlways>
      {loading ? <CreateOrganizationLoadingCard /> : <CreateOrganizationFormColumn />}
    </MobileOnboardingViewport>
  );
}
