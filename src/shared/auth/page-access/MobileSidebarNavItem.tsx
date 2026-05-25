import type { ComponentType, ReactNode } from "react";
import { Lock } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { useHeaderTabPageAccess } from "@/shared/auth/page-access/useHeaderTabPageAccess";

export type MobileSidebarNavItemProps = {
  pagePath: string;
  to: string;
  icon: ComponentType<{ className?: string }>;
  label: ReactNode;
  onNavigate?: () => void;
  className?: string;
  activeClassName?: string;
};

/**
 * Mobile drawer sidebar link with padlock when access is denied.
 */
export function MobileSidebarNavItem({
  pagePath,
  to,
  icon: Icon,
  label,
  onNavigate,
  className,
  activeClassName = "bg-primary/10 text-primary font-medium",
}: MobileSidebarNavItemProps) {
  const { t } = useAppTranslation();
  const { isTabLocked } = useHeaderTabPageAccess();
  const locked = isTabLocked(pagePath);

  return (
    <NavLink
      to={to}
      onClick={onNavigate}
      title={
        locked
          ? t("accessDenied.message", "You do not have permission to view this page.")
          : undefined
      }
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
          locked && "opacity-70",
          isActive ? activeClassName : "text-foreground hover:bg-muted/60",
          className,
        )
      }
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      <span className="flex min-w-0 flex-1 items-center gap-1 truncate">
        {label}
        {locked ? <Lock className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden /> : null}
      </span>
    </NavLink>
  );
}
