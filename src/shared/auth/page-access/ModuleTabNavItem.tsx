import type { ComponentType, ReactNode } from "react";
import { Lock } from "lucide-react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { prefetchAppRoute } from "@/shared/routing/prefetchAppRoute";
import { useHeaderTabPageAccess } from "@/shared/auth/page-access/useHeaderTabPageAccess";

export type ModuleTabNavItemProps = {
  /** Path checked against `permission_configurations` (same as {@link PageAccessContentGate}). */
  pagePath: string;
  label: ReactNode;
  icon: ComponentType<{ className?: string }>;
  isActive: boolean;
  onActivate: () => void;
  className?: string;
  activeClassName?: string;
  inactiveClassName?: string;
  lockedClassName?: string;
};

/**
 * Single module tab with padlock when page access denies `pagePath`.
 * Use in every HeaderAndTab so locks stay in sync with {@link ModuleShellContentGate}.
 */
export function ModuleTabNavItem({
  pagePath,
  label,
  icon: Icon,
  isActive,
  onActivate,
  className,
  activeClassName = "border-primary text-primary",
  inactiveClassName = "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
  lockedClassName = "border-transparent text-muted-foreground opacity-60",
}: ModuleTabNavItemProps) {
  const { t } = useAppTranslation();
  const { isTabLocked } = useHeaderTabPageAccess();
  const locked = isTabLocked(pagePath);

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      onMouseEnter={() => prefetchAppRoute(pagePath)}
      onFocus={() => prefetchAppRoute(pagePath)}
      onClick={onActivate}
      title={
        locked
          ? t("accessDenied.message", "You do not have permission to view this page.")
          : undefined
      }
      className={cn(
        "flex cursor-pointer items-center space-x-1.5 border-b-2 px-1 py-1.5 text-sm font-medium transition-colors",
        locked ? lockedClassName : isActive ? activeClassName : inactiveClassName,
        className,
      )}
      style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      <span>{label}</span>
      {locked ? <Lock className="ml-1 h-3.5 w-3.5 shrink-0" aria-hidden /> : null}
    </button>
  );
}
