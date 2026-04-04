import { type ReactNode, useEffect, useRef, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { XCircle } from "lucide-react";
import { useAuth } from "@/shared/auth/contexts/AuthContext";
import { useCentralizedUserData } from "@/shared/auth/contexts/CentralizedUserDataContext";
import { useDepartmentAccess } from "@/shared/auth/page-access/useDepartmentAccess";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Button } from "@/shared/components/ui/button";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";

export type PageAccessGuardProps = {
  children: ReactNode;
  redirectTo?: string;
  requiresPermissions?: boolean;
  /** Override path checked against permission_configurations */
  pagePath?: string;
  showAccessDeniedPage?: boolean;
  /**
   * Full-route loading UI that matches the destination page layout (e.g. incomes skeleton).
   * When set, shown immediately while auth/access/config resolve — avoids centered placeholder
   * then swapping to the real module shell on hard refresh.
   */
  loadingShell?: ReactNode;
  /** Shell background behind `loadingShell` (e.g. `bg-gray-100` for KOL modules). */
  loadingShellWrapperClassName?: string;
};

const DENY_DEBOUNCE_MS = 250;
const LOADING_UI_MS = 250;

/**
 * Auth + DB-backed page access inside AppShell (no StandardLayout).
 */
export function PageAccessGuard({
  children,
  redirectTo = "/login",
  requiresPermissions = true,
  pagePath,
  showAccessDeniedPage = true,
  loadingShell,
  loadingShellWrapperClassName,
}: PageAccessGuardProps) {
  const { user, loading } = useAuth();
  const { t } = useAppTranslation();
  const location = useLocation();
  const {
    canAccessPage,
    getAccessLevel,
    getDepartmentRestrictionMessage,
    configLoading,
  } = useDepartmentAccess();
  const { hasOrganization, organization, employee, isOwner } = useCentralizedUserData();

  const pathToCheck = pagePath || location.pathname;

  const isLoadingOrgData = requiresPermissions && !!user && !organization && hasOrganization;
  const isLoading = loading || (requiresPermissions && configLoading) || isLoadingOrgData;

  const [showDeniedAfterDebounce, setShowDeniedAfterDebounce] = useState(false);
  const denyDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!requiresPermissions || !user) {
      if (denyDebounceRef.current) {
        clearTimeout(denyDebounceRef.current);
        denyDebounceRef.current = null;
      }
      setShowDeniedAfterDebounce(false);
      return;
    }
    const hasPageAccess = canAccessPage(pathToCheck);
    if (hasPageAccess) {
      if (denyDebounceRef.current) {
        clearTimeout(denyDebounceRef.current);
        denyDebounceRef.current = null;
      }
      setShowDeniedAfterDebounce(false);
      return;
    }
    denyDebounceRef.current = setTimeout(() => {
      denyDebounceRef.current = null;
      setShowDeniedAfterDebounce(true);
    }, DENY_DEBOUNCE_MS);
    return () => {
      if (denyDebounceRef.current) {
        clearTimeout(denyDebounceRef.current);
        denyDebounceRef.current = null;
      }
    };
  }, [requiresPermissions, user, pathToCheck, canAccessPage]);

  const isResolvingAccess =
    requiresPermissions &&
    !!user &&
    !canAccessPage(pathToCheck) &&
    !showDeniedAfterDebounce;

  const [showLoadingUI, setShowLoadingUI] = useState(false);
  const loadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isLoading || isResolvingAccess) {
      loadingTimeoutRef.current = setTimeout(() => setShowLoadingUI(true), LOADING_UI_MS);
      return () => {
        if (loadingTimeoutRef.current) {
          clearTimeout(loadingTimeoutRef.current);
          loadingTimeoutRef.current = null;
        }
      };
    }
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
      loadingTimeoutRef.current = null;
    }
    setShowLoadingUI(false);
  }, [isLoading, isResolvingAccess]);

  // While auth is still hydrating, `user` is null — must not redirect to /login before
  // `showLoadingUI` flips (250ms), or refresh on guarded routes looks like a logout.
  /** Tanpa delay 250ms: layout-matched shell harus tampil segera saat auth/org/config resolve (Loading Skeleton rule). */
  const guardShellBlocking = (loading && !user) || isLoading || isResolvingAccess;

  const shouldShowLoading =
    (loading && !user) || (showLoadingUI && isLoading) || isResolvingAccess;

  /**
   * Selama `guardShellBlocking`, jika route menyediakan `loadingShell`, selalu pakai itu
   * (layout penuh). Jangan fallback ke skeleton tengah `max-w-xs` — itu terlihat "pendek"
   * dan tidak mirror halaman (mis. KOL dashboard).
   */
  if (loadingShell != null && guardShellBlocking) {
    return (
      <div
        className={cn(
          "flex h-full min-h-0 min-w-0 flex-1 flex-col",
          loadingShellWrapperClassName ?? "bg-background",
        )}
        aria-busy
        aria-label={t("pageAccess.loading", "Loading…")}
      >
        {loadingShell}
        <span className="sr-only">{t("pageAccess.loading", "Loading…")}</span>
      </div>
    );
  }

  if (shouldShowLoading) {
    return (
      <div
        className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 py-12"
        aria-busy
        aria-label={t("pageAccess.loading", "Loading…")}
      >
        <div className="flex w-full max-w-xs flex-col gap-3 px-4">
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-4 w-4/5 max-w-[280px]" />
          <Skeleton className="h-4 w-3/5 max-w-[200px]" />
        </div>
        <span className="sr-only">{t("pageAccess.loading", "Loading…")}</span>
      </div>
    );
  }

  if (!user) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  if (user && employee && organization) {
    const employeeStatus =
      (employee as { status?: string; employee_status_name?: string }).status ||
      (employee as { employee_status_name?: string }).employee_status_name;
    const statusLower = employeeStatus?.toLowerCase();
    const isTerminatedOrInactive = statusLower === "terminated" || statusLower === "inactive";

    if (isTerminatedOrInactive && !isOwner) {
      return (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center p-6">
          <div className="mx-auto max-w-md text-center">
            <div className="bg-destructive/10 mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full">
              <XCircle className="text-destructive h-12 w-12" />
            </div>
            <h2 className="text-foreground mb-3 text-xl font-semibold">
              {t("accessDenied.title", "Access denied")}
            </h2>
            <p className="text-muted-foreground mb-6">
              {t(
                "accessDenied.terminatedMessage",
                "Your employee status is terminated or inactive."
              )}
            </p>
            <Button className="w-full" onClick={() => (window.location.href = "/")}>
              {t("accessDenied.backToHome", "Back to home")}
            </Button>
          </div>
        </div>
      );
    }
  }

  if (requiresPermissions && user && showDeniedAfterDebounce) {
    const hasPageAccess = canAccessPage(pathToCheck);
    if (!hasPageAccess) {
      if (showAccessDeniedPage) {
        return (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center p-6">
            <div className="mx-auto max-w-md text-center">
              <div className="bg-destructive/10 mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full">
                <XCircle className="text-destructive h-12 w-12" />
              </div>
              <h2 className="text-foreground mb-3 text-xl font-semibold">
                {t("accessDenied.title", "Access denied")}
              </h2>
              <p className="text-muted-foreground mb-6">
                {t(
                  "accessDenied.message",
                  "You do not have permission to view this page."
                )}
              </p>
              <div className="bg-muted/50 mb-6 rounded-lg p-4 text-left text-sm">
                <p>
                  <span className="font-medium">
                    {t("accessDenied.accessLevel", "Access level")}:
                  </span>{" "}
                  {getAccessLevel()}
                </p>
                {getDepartmentRestrictionMessage() && (
                  <p className="mt-2">
                    <span className="font-medium">
                      {t("accessDenied.restriction", "Restriction")}:
                    </span>{" "}
                    {getDepartmentRestrictionMessage()}
                  </p>
                )}
              </div>
              <Button className="w-full" onClick={() => (window.location.href = "/")}>
                {t("accessDenied.backToHome", "Back to home")}
              </Button>
            </div>
          </div>
        );
      }
      return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
}
