/**
 * Mobile-specific Subscription Expiry Guard
 *
 * Subscription expiry is enforced for web mobile and Android (Capacitor) by the same
 * `SubscriptionExpiryGuard` in App.tsx.
 */

import type { ReactNode } from "react";
import { SubscriptionExpiryGuard } from "@/10-subscription/shared/SubscriptionExpiryGuard";

interface SubscriptionExpiryGuardMobileProps {
  children: ReactNode;
}

export const SubscriptionExpiryGuardMobile = ({ children }: SubscriptionExpiryGuardMobileProps) => {
  return <SubscriptionExpiryGuard>{children}</SubscriptionExpiryGuard>;
};
