import type { ComponentType, ReactNode } from "react";
import { cn } from "@/shared/lib/utils";
import { prefetchAppRoute } from "@/shared/routing/prefetchAppRoute";

export type MobileNavTabButtonProps = {
  /** Route path for chunk prefetch on focus; access is not shown in the footer. */
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
 * Bottom-nav / footer tab — no padlock (sidebar shows lock state).
 * Tap always navigates; {@link ModuleShellContentGate} shows deny panel when access is restricted.
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
  return (
    <button
      type="button"
      onClick={onActivate}
      onFocus={() => prefetchAppRoute(pagePath)}
      className={cn(
        "flex flex-col items-center px-1 py-2 touch-manipulation select-none",
        isActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
        className,
      )}
    >
      <Icon className={cn(iconClassName, "shrink-0")} aria-hidden />
      <span className={labelClassName}>{label}</span>
    </button>
  );
}
