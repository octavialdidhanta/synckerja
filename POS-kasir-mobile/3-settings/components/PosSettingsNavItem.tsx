import { cn } from "@/shared/lib/utils";

type Props = {
  label: string;
  statusLabel?: string;
  active?: boolean;
  onClick: () => void;
};

export function PosSettingsNavItem({ label, statusLabel, active, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex w-full items-center gap-2 border-b border-slate-200 px-3 py-3 text-left text-sm transition-colors last:border-b-0",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40",
        active
          ? "bg-primary font-semibold text-white"
          : "bg-white text-slate-900 hover:bg-slate-50/80",
      )}
    >
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {statusLabel ? (
        <span
          className={cn(
            "flex-shrink-0 text-xs font-normal",
            active ? "text-white/80" : "text-slate-400",
          )}
        >
          {statusLabel}
        </span>
      ) : null}
    </button>
  );
}
