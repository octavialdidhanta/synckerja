import type { LucideIcon } from "lucide-react";
import { cn } from "@/shared/lib/utils";

type Props = {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  /** Red count badge (sales type / recall / hold). */
  badge?: number;
  /** Large green count under label (OPEN / COMPLETED). */
  count?: number;
  countTone?: "green" | "slate";
  onClick: () => void;
  compact?: boolean;
  /** Phone bottom bar — fixed width, tighter vertical rhythm. */
  horizontal?: boolean;
};

/**
 * Compact KDS sidebar / bottom-nav control — icon + short label + optional badge/count.
 */
export function PosKitchenSidebarNavItem({
  icon: Icon,
  label,
  active,
  badge,
  count,
  countTone = "green",
  onClick,
  compact,
  horizontal,
}: Props) {
  const showBadge = typeof badge === "number" && badge > 0;
  const showCount = typeof count === "number";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "true" : undefined}
      className={cn(
        "relative flex flex-col items-center justify-center gap-0.5 text-center transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-400/60",
        active
          ? "bg-slate-700/80 text-white"
          : "text-slate-300 hover:bg-slate-800/80 hover:text-white",
        horizontal
          ? "min-h-14 min-w-[3.75rem] flex-shrink-0 px-1.5 py-1.5"
          : cn(
              "w-full px-1 py-2",
              compact ? "min-h-12" : "min-h-14",
            ),
      )}
    >
      <span className="relative inline-flex">
        <Icon className="h-5 w-5 flex-shrink-0" aria-hidden />
        {showBadge ? (
          <span className="absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold leading-none text-white">
            {badge > 99 ? "99+" : badge}
          </span>
        ) : null}
      </span>
      <span
        className={cn(
          "max-w-full truncate font-semibold uppercase tracking-wide leading-tight",
          horizontal ? "text-[8px]" : "text-[9px]",
        )}
      >
        {label}
      </span>
      {showCount ? (
        <span
          className={cn(
            "font-bold tabular-nums leading-none",
            horizontal ? "text-xs" : "text-lg",
            countTone === "green" ? "text-emerald-400" : "text-slate-100",
          )}
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}
