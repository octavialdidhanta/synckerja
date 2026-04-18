import { cn } from "@/shared/lib/utils";

export function TemplateStatusBadge({ label }: { label: string }) {
  const lower = label.toLowerCase();
  const isActive = lower.includes("active");
  const isRejected = lower.includes("rejected");
  const isPaused = lower.includes("paused") || lower.includes("disabled") || lower.includes("archived");

  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        isRejected && "border-red-200 bg-red-50 text-red-800",
        !isRejected && isPaused && "border-slate-200 bg-slate-50 text-slate-700",
        !isRejected && !isPaused && isActive && "border-emerald-200 bg-emerald-50 text-emerald-800",
        !isRejected && !isPaused && !isActive && "border-amber-200 bg-amber-50 text-amber-900",
      )}
    >
      <span className="truncate">{label}</span>
    </span>
  );
}
