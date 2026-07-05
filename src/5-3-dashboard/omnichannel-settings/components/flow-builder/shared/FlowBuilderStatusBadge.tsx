import { cn } from "@/shared/lib/utils";
import type { FlowBuilderRowStatus } from "@/5-3-dashboard/omnichannel-settings/types/flowBuilder.types";

type FlowBuilderStatusBadgeProps = {
  status: FlowBuilderRowStatus;
  label: string;
};

export function FlowBuilderStatusBadge({ status, label }: FlowBuilderStatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
        status === "ACTIVE" && "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
        status === "DRAFT" && "bg-muted text-muted-foreground",
        status === "OTHER" && "bg-amber-500/15 text-amber-800 dark:text-amber-400",
      )}
    >
      {label}
    </span>
  );
}
