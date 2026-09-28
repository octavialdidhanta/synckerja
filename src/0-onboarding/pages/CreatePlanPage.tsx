import { CreatePlanPageShell } from "@/0-onboarding/components/CreatePlanPageShell";
import { CreatePlanFlow } from "@/0-onboarding/screens/CreatePlanFlow";

export default function CreatePlanPage() {
  return (
    <CreatePlanPageShell>
      <div className="flex min-h-full w-full flex-col">
        <div className="my-auto flex w-full min-w-0 flex-col items-center">
          <CreatePlanFlow />
        </div>
      </div>
    </CreatePlanPageShell>
  );
}
