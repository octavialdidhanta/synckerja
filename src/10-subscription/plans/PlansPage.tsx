import { SubscriptionSectionLayout } from "@/10-subscription/shared/SubscriptionSectionLayout";
import HRISSubscriptionPlansTab from "@/10-subscription/plans/HRISSubscriptionPlansTab";

export default function PlansPage() {
  return (
    <SubscriptionSectionLayout>
      <div className="box-border flex min-h-[calc(100dvh-220px)] min-w-0 w-full max-w-full flex-col overflow-hidden px-4 pb-2 pt-1">
        <HRISSubscriptionPlansTab />
      </div>
    </SubscriptionSectionLayout>
  );
}
