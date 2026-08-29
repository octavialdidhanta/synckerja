import type { LucideIcon } from "lucide-react";
import { cn } from "@/shared/lib/utils";

type Props = {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  badge?: number;
  onClick: () => void;
};

/**
 * Single brand-blue sidebar row — uppercase label, optional badge.
 */
export function PosSidebarNavItem({ icon: Icon, label, active, badge, onClick }: Props) {
  const showBadge = typeof badge === "number" && badge > 0;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex w-full min-h-12 items-center gap-3 px-4 text-left text-sm font-semibold uppercase tracking-wide text-white transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/40",
        active ? "bg-brand-blue-deep" : "bg-transparent hover:bg-brand-blue-deep/80 active:bg-brand-blue-deep",
      )}
    >
      <Icon className="h-5 w-5 flex-shrink-0" aria-hidden />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {showBadge ? (
        <span className="flex h-5 min-w-5 flex-shrink-0 items-center justify-center rounded-full bg-white px-1.5 text-[10px] font-bold text-primary">
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
    </button>
  );
}
