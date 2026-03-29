import { SubscriptionSectionLayout } from "@/10-subscription/shared/SubscriptionSectionLayout";
import { PaymentHistory } from "@/10-subscription/management/components/PaymentHistory";

export default function ManagementPage() {
  return (
    <SubscriptionSectionLayout>
      <div className="seamless-scroll max-h-[calc(100vh-120px)] overflow-y-auto p-6">
        <div className="mx-auto max-w-4xl">
          <PaymentHistory />
        </div>
      </div>
    </SubscriptionSectionLayout>
  );
}
