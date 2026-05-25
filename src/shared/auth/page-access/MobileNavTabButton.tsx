import type { ComponentType, ReactNode } from "react";
import { Lock } from "lucide-react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { prefetchAppRoute } from "@/shared/routing/prefetchAppRoute";
import { useHeaderTabPageAccess } from "@/shared/auth/page-access/useHeaderTabPageAccess";

export type MobileNavTabButtonProps = {
  pagePath: string;
  label: ReactNode;
  icon: ComponentType<{ className?: string }>;
  isActive: boolean;
  onActivate: () => void;
  className?: string;
  iconClassName?: string;
  labelClassName?: string;
};

/**
 * Bottom-nav / footer tab with padlock when page access denies `pagePath`.
 * Nav items stay visible; tap still navigates — content gate shows deny panel.
 */
export function MobileNavTabButton({
  pagePath,
  label,
  icon: Icon,
  isActive,
  onActivate,
  className,
  iconClassName = "mb-1 h-5 w-5",
  labelClassName = "text-[10px] leading-tight",
}: MobileNavTabButtonProps) {
  const { t } = useAppTranslation();
  const { isTabLocked } = useHeaderTabPageAccess();
  const locked = isTabLocked(pagePath);

  return (
    <button
      type="button"
      onClick={onActivate}
      onFocus={() => prefetchAppRoute(pagePath)}
      title={
        locked
          ? t("accessDenied.message", "You do not have permission to view this page.")
          : undefined
      }
      className={cn(
        "flex flex-col items-center px-1 py-2 touch-manipulation select-none",
        locked && "opacity-70",
        isActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
        className,
      )}
    >
      <Icon className={cn(iconClassName, "shrink-0")} aria-hidden />
      <span className={cn(labelClassName, "flex items-center gap-0.5")}>
        {label}
        {locked ? <Lock className="h-3 w-3 shrink-0" aria-hidden /> : null}
      </span>
    </button>
  );
}
