import { useCentralizedUserData } from "@/shared/auth/contexts/CentralizedUserDataContext";
import { isSubscriptionSelfServiceEnabled } from "@/10-subscription/shared/subscriptionSelfService";

export function useSubscriptionSelfServiceEnabled(): boolean {
  const { organization } = useCentralizedUserData();
  return isSubscriptionSelfServiceEnabled(organization?.subscription_self_service_enabled);
}
