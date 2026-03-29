import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { supabase } from "@/shared/lib/supabaseClient";
import { useSubscriptionExpiry } from "@/10-subscription/hooks/useSubscriptionExpiry";
import { useSubscriptionExpiryRealtime } from "@/10-subscription/hooks/useSubscriptionExpiryRealtime";
import { SubscriptionExpiredPage } from "@/10-subscription/shared/SubscriptionExpiredPage";

const ALLOWED_EXPIRED_ROUTES = [
  "/login",
  "/forgot-password",
  "/reset-password",
  "/register",
  "/verify-email",
  "/email-verified",
  "/create-organization",
  "/create-plan",
  "/subscription/plans",
  "/subscription/management",
];

export function SubscriptionExpiryGuard() {
  const location = useLocation();
  const [user, setUser] = useState<{ id: string } | null>(null);
  const { expiryStatus } = useSubscriptionExpiry();

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

  const isAllowedRoute = ALLOWED_EXPIRED_ROUTES.some((route) => {
    const pathname = location.pathname;
    return pathname === route || pathname.startsWith(`${route}/`);
  });

  // Do not replace <Outlet /> with a full-viewport spinner while org or subscription
  // is still resolving — that hides AppShellLayout (header/sidebar). Pages use skeletons instead.

  if (!user) {
    return <Outlet />;
  }

  if (isAllowedRoute) {
    return <Outlet />;
  }

  if (expiryStatus.isExpired) {
    return <SubscriptionExpiredPage expiryStatus={expiryStatus} />;
  }

  return <Outlet />;
}
