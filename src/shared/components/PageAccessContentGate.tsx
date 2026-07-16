import type { ReactNode } from "react";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { useDepartmentAccess } from "@/shared/auth/page-access/useDepartmentAccess";
import { useCentralizedUserData } from "@/shared/auth/contexts/CentralizedUserDataContext";
import { AccessDeniedContentPanel } from "@/shared/components/AccessDeniedContentPanel";
import { SalesModuleUpsellPage } from "@/shared/auth/module-access/SalesModuleUpsellPage";
import { cn } from "@/shared/lib/utils";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

export type PageAccessContentGateProps = {
  pagePath: string;
  children: ReactNode;
  className?: string;
};

/**
 * Enforces page access for the main content area only. Use with {@link PageAccessGuard}
 * `preserveAppChromeOnDeny` so sidebar, sub-sidebar, and module HeaderAndTab remain visible.
 */
export function PageAccessContentGate({ pagePath, children, className }: PageAccessContentGateProps) {
  const { t } = useAppTranslation();
  const {
    canAccessPage,
    accessDecisionPending,
    moduleAccessPending,
    getDepartmentRestrictionMessage,
    getSalesModuleUpsellForPath,
  } = useDepartmentAccess();
  const { centralProfileHydrated } = useCentralizedUserData();

  const pending = accessDecisionPending || !centralProfileHydrated || moduleAccessPending;

  if (pending) {
    return (
      <div
        className={cn("flex min-h-[min(20rem,45vh)] flex-1 flex-col gap-3 p-4", className)}
        aria-busy
        aria-label={t("pageAccess.loading", "Loading…")}
      >
        <Skeleton className="h-10 w-full max-w-md rounded-md" />
        <Skeleton className="h-4 w-4/5 max-w-lg" />
        <Skeleton className="h-32 w-full flex-1 rounded-lg" />
      </div>
    );
  }

  if (!canAccessPage(pagePath)) {
    const upsellModule = getSalesModuleUpsellForPath(pagePath);
    if (upsellModule) {
      return (
        <div
          className={cn(
            "flex w-full min-w-0 flex-1 flex-col items-center justify-center p-6",
            "min-h-[calc(100vh-12rem)]",
            className,
          )}
        >
          <SalesModuleUpsellPage moduleKey={upsellModule} />
        </div>
      );
    }

    return (
      <AccessDeniedContentPanel
        className={cn("h-full min-h-0", className)}
        restrictionMessage={getDepartmentRestrictionMessage()}
      />
    );
  }

  return <div className={className}>{children}</div>;
}
