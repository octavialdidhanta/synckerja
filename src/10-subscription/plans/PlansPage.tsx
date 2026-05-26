import { SubscriptionSectionLayout } from "@/10-subscription/shared/SubscriptionSectionLayout";
import HRISSubscriptionPlansTab from "@/10-subscription/plans/HRISSubscriptionPlansTab";

export default function PlansPage() {
  return (
    <SubscriptionSectionLayout>
      <div className="box-border flex h-full min-h-0 min-w-0 w-full max-w-full flex-1 flex-col overflow-hidden px-4 pb-2 pt-1">
        <HRISSubscriptionPlansTab />
        <div className="h-2 flex-shrink-0 [@media(max-height:900px)]:h-3 [@media(max-height:760px)]:h-4" aria-hidden />
      </div>
    </SubscriptionSectionLayout>
  );
}
