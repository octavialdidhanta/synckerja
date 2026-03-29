import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { supabase } from "@/shared/lib/supabaseClient";
import { useActiveOrganization } from "@/10-subscription/shared/useActiveOrganization";
import { useSubscriptionExpiry } from "@/10-subscription/hooks/useSubscriptionExpiry";
import { useSubscriptionExpiryRealtime } from "@/10-subscription/hooks/useSubscriptionExpiryRealtime";
import { SubscriptionExpiredPage } from "@/10-subscription/shared/SubscriptionExpiredPage";
import { Loader2 } from "lucide-react";

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
  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState<{ id: string } | null>(null);
  const { organizationId, loading: orgLoading } = useActiveOrganization();
  const { expiryStatus, isLoading: subLoading } = useSubscriptionExpiry();
  const [isChecking, setIsChecking] = useState(true);

  useSubscriptionExpiryRealtime();

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setUser(session?.user ? { id: session.user.id } : null);
      setAuthLoading(false);
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

  const waitingForOrg = Boolean(user) && organizationId === null && orgLoading;

  const isAllowedRoute = ALLOWED_EXPIRED_ROUTES.some((route) => {
    const pathname = location.pathname;
    return pathname === route || pathname.startsWith(`${route}/`);
  });

  useEffect(() => {
    if (authLoading || subLoading || !user) {
      setIsChecking(false);
      return;
    }
    if (isAllowedRoute) {
      setIsChecking(false);
      return;
    }
    if (expiryStatus.isExpired) {
      setIsChecking(false);
      return;
    }
    setIsChecking(false);
  }, [authLoading, subLoading, user, expiryStatus.isExpired, isAllowedRoute]);

  const isAnyLoading = authLoading || subLoading || isChecking || waitingForOrg;

  if (isAnyLoading && user) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" aria-hidden />
      </div>
    );
  }

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
