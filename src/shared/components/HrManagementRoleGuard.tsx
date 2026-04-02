import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useCurrentUserRole } from "@/shared/hooks/useCurrentUserRole";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { Button } from "@/shared/components/ui/button";
import { Skeleton } from "@/shared/components/ui/skeleton";

const HR_MANAGEMENT_ROLES = new Set(["owner", "admin", "hr"]);

export type HrManagementRoleGuardProps = {
  children: ReactNode;
  /** i18n keys for access-denied state (defaults: reprimands.*) */
  deniedTitleKey?: string;
  deniedDescriptionKey?: string;
  deniedBackLabelKey?: string;
  deniedNavigateTo?: string;
  /**
   * When false, no inline skeleton while the role query is pending (use when the child route shows its own full-page skeleton).
   * @default true
   */
  showPendingSkeleton?: boolean;
};

export function HrManagementRoleGuard({
  children,
  deniedTitleKey = "reprimands.accessDenied.title",
  deniedDescriptionKey = "reprimands.accessDenied.description",
  deniedBackLabelKey = "reprimands.accessDenied.backToEmployees",
  deniedNavigateTo = "/employees",
  showPendingSkeleton = true,
}: HrManagementRoleGuardProps) {
  const { data: role, isPending } = useCurrentUserRole();
  const { t } = useAppTranslation();
  const navigate = useNavigate();

  if (isPending) {
    if (!showPendingSkeleton) {
      return (
        <div
          className="flex min-h-0 min-w-0 flex-1 flex-col bg-gray-100"
          aria-busy
          aria-label={t("employees.page.loadingAria", "Loading")}
        />
      );
    }
    return (
      <div
        className="flex min-h-0 flex-1 flex-col gap-4 px-4 pb-4 pt-2"
        aria-busy
        aria-label={t("employees.page.loadingAria", "Loading")}
      >
        <Skeleton className="h-8 w-48 max-w-[80%]" />
        <Skeleton className="h-4 w-full max-w-md" />
        <div className="grid min-h-0 flex-1 grid-cols-12 gap-2">
          <div className="col-span-9 space-y-3">
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-40 w-full rounded-lg" />
          </div>
          <div className="col-span-3 space-y-3">
            <Skeleton className="h-32 w-full rounded-lg" />
            <Skeleton className="h-48 w-full rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  if (!role || !HR_MANAGEMENT_ROLES.has(role)) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-4 py-12">
        <h1 className="text-lg font-semibold text-gray-900">
          {t(deniedTitleKey, "Access restricted")}
        </h1>
        <p className="max-w-md text-center text-sm text-gray-600">
          {t(
            deniedDescriptionKey,
            "You need Owner, Admin, or HR role to view this page.",
          )}
        </p>
        <Button
          type="button"
          className="bg-brand-blue text-white hover:bg-brand-blue/90"
          onClick={() => navigate(deniedNavigateTo)}
        >
          {t(deniedBackLabelKey, "Back")}
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
