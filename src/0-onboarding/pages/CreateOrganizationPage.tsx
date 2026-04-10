import { OnboardingSplitLayout } from "@/0-onboarding/components/OnboardingSplitLayout";
import { useCreateOrganizationGate } from "@/0-onboarding/hooks/useCreateOrganizationGate";
import {
  CreateOrganizationFormColumn,
  CreateOrganizationLoadingCard,
} from "@/0-onboarding/screens/CreateOrganizationScreen";

export default function CreateOrganizationPage() {
  const loading = useCreateOrganizationGate();

  return (
    <OnboardingSplitLayout
      scrollClassName={loading ? "items-center justify-center" : "items-start"}
    >
      {loading ? <CreateOrganizationLoadingCard /> : <CreateOrganizationFormColumn />}
    </OnboardingSplitLayout>
  );
}
