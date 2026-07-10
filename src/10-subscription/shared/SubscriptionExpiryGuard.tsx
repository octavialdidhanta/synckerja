import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { supabase } from "@/shared/lib/supabaseClient";
import { useOrgBootstrapPending } from "@/shared/auth/hooks/useOrgBootstrapPending";
import { useSubscriptionExpiry } from "@/10-subscription/hooks/useSubscriptionExpiry";
import { useSubscriptionExpiryRealtime } from "@/10-subscription/hooks/useSubscriptionExpiryRealtime";
import { SubscriptionExpiredPage } from "@/10-subscription/shared/SubscriptionExpiredPage";
import { isAllowedWhenExpired } from "@/10-subscription/shared/subscriptionExpiryPolicy";
import { useSubscriptionSelfServiceEnabled } from "@/shared/auth/hooks/useSubscriptionSelfServiceEnabled";

export function SubscriptionExpiryGuard() {
  const location = useLocation();
  const selfServiceEnabled = useSubscriptionSelfServiceEnabled();
  const [user, setUser] = useState<{ id: string } | null>(null);
  const { organizationId, orgBootstrapPending } = useOrgBootstrapPending();
  const { expiryStatus, isLoading, error, subscriptionStatus } = useSubscriptionExpiry();

  useSubscriptionExpiryRealtime();

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setUser(session?.user ? { id: session.user.id } : null);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!mounted) return;
      setUser(session?.user ? { id: session.user.id } : null);
    });
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const isAllowedRoute = isAllowedWhenExpired(location.pathname, {
    subscriptionSelfServiceEnabled: selfServiceEnabled,
  });

  // Do not replace <Outlet /> with a full-viewport spinner while org or subscription
  // is still resolving — that hides AppShellLayout (header/sidebar). Pages use skeletons instead.

  if (!user) {
    return <Outlet />;
  }

  if (isAllowedRoute) {
    return <Outlet />;
  }

  const statusResolved = !orgBootstrapPending && !!organizationId && !isLoading;

  // Fail-open when status cannot be loaded (e.g. missing subscription row) to avoid locking entire org.
  if (statusResolved && (error || subscriptionStatus === null)) {
    if (error) {
      console.warn("[SubscriptionExpiryGuard] subscription status unavailable:", error);
    }
    return <Outlet />;
  }

  if (expiryStatus.isExpired) {
    return <SubscriptionExpiredPage expiryStatus={expiryStatus} selfServiceEnabled={selfServiceEnabled} />;
  }

  return <Outlet />;
}
