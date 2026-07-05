import { cn } from "@/shared/lib/utils";
import {
  flowBuilderAvatarColorClass,
  flowBuilderUserInitials,
} from "@/5-3-dashboard/omnichannel-settings/lib/flow-builder/flowBuilderUserUtils";
import type { FlowBuilderUserRef } from "@/5-3-dashboard/omnichannel-settings/types/flowBuilder.types";

type FlowBuilderUserCellProps = {
  user: FlowBuilderUserRef | null;
  emptyLabel: string;
  className?: string;
};

export function FlowBuilderUserCell({ user, emptyLabel, className }: FlowBuilderUserCellProps) {
  if (!user) {
    return <span className={cn("text-sm text-muted-foreground", className)}>{emptyLabel}</span>;
  }

  const initials = flowBuilderUserInitials(user.fullName);
  const colorClass = flowBuilderAvatarColorClass(user.fullName || user.email);
  const orgSuffix = user.orgName ? ` (${user.orgName})` : "";

  return (
    <div className={cn("flex min-w-0 items-center gap-2", className)}>
      <span
        className={cn(
          "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white",
          colorClass,
        )}
        aria-hidden
      >
        {initials}
      </span>
      <span className="min-w-0 truncate text-sm text-foreground">
        {user.fullName}
        {orgSuffix}
      </span>
    </div>
  );
}
