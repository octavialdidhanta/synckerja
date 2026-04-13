import { useCreateOrganizationGate } from "@/0-onboarding/hooks/useCreateOrganizationGate";
import {
  CreateOrganizationFormColumn,
  CreateOrganizationLoadingCard,
} from "@/0-onboarding/screens/CreateOrganizationScreen";
import { MobileOnboardingViewport } from "@/shared/components/mobile/MobileOnboardingViewport";

export default function MobileCreateOrganizationPage() {
  const loading = useCreateOrganizationGate();

  return (
    <MobileOnboardingViewport
      scrollAlways
      className="bg-gradient-to-b from-brand-blue-soft/50 via-gray-100 to-gray-100 dark:from-brand-blue/20 dark:via-background dark:to-background"
    >
      {loading ? <CreateOrganizationLoadingCard /> : <CreateOrganizationFormColumn />}
    </MobileOnboardingViewport>
  );
}
