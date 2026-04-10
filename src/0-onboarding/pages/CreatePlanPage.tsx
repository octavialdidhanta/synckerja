import { CreatePlanPageShell } from "@/0-onboarding/components/CreatePlanPageShell";
import { CreatePlanFlow } from "@/0-onboarding/screens/CreatePlanFlow";

export default function CreatePlanPage() {
  return (
    <CreatePlanPageShell scrollClassName="items-center justify-center">
      <CreatePlanFlow />
    </CreatePlanPageShell>
  );
}
