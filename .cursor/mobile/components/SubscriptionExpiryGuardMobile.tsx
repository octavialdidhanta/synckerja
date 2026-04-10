/**
 * Mobile-specific Subscription Expiry Guard
 *
 * Subscription expiry is enforced for web mobile and Android (Capacitor) by the same
 * SubscriptionExpiryGuard in App.tsx. When subscription/trial is expired:
 * - All routes (including /, /profile, /schedule, /client-visit, /reports) are blocked.
 * - User sees SubscriptionExpiredPage with isMobile=true (safe area, touch-friendly layout).
 *
 * This wrapper exists for documentation and optional future mobile-specific logic.
 */

import { ReactNode } from 'react';
import { SubscriptionExpiryGuard } from '@/components/SubscriptionExpiryGuard';

interface SubscriptionExpiryGuardMobileProps {
  children: ReactNode;
}

/**
 * Mobile wrapper for SubscriptionExpiryGuard.
 * Same guard protects desktop and mobile; expired page is mobile-optimized when isMobile.
 */
export const SubscriptionExpiryGuardMobile = ({ children }: SubscriptionExpiryGuardMobileProps) => {
  return <SubscriptionExpiryGuard>{children}</SubscriptionExpiryGuard>;
};

