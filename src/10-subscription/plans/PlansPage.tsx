import { SubscriptionSectionLayout } from "@/10-subscription/shared/SubscriptionSectionLayout";
import HRISSubscriptionPlansTab from "@/10-subscription/plans/HRISSubscriptionPlansTab";

export default function PlansPage() {
  return (
    <SubscriptionSectionLayout>
      <div className="box-border flex h-full min-h-0 flex-1 flex-col overflow-hidden px-4 pb-2 pt-1">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <HRISSubscriptionPlansTab />
        </div>
      </div>
    </SubscriptionSectionLayout>
  );
}
