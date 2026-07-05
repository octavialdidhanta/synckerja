import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";
import { FlowNodeContextMenu } from "@/5-3-automation-flow/components/editor/canvas/nodes/FlowNodeContextMenu";

type FlowNodeHeaderProps = {
  nodeId: string;
  title: string;
  icon: ReactNode;
  hasStepsBelow?: boolean;
  onCopyBlock?: (nodeId: string) => void;
  onCopyBlockAndBelow?: (nodeId: string) => void;
  onDeleteBlock?: (nodeId: string) => void;
  onDeleteBelow?: (nodeId: string) => void;
  className?: string;
};

export function FlowNodeHeader({
  nodeId,
  title,
  icon,
  hasStepsBelow = false,
  onCopyBlock,
  onCopyBlockAndBelow,
  onDeleteBlock,
  onDeleteBelow,
  className,
}: FlowNodeHeaderProps) {
  return (
    <div className={cn("flex items-center gap-2 bg-blue-600 px-3 py-2 text-white", className)}>
      <span className="shrink-0">{icon}</span>
      <span className="min-w-0 flex-1 truncate text-sm font-semibold">{title}</span>
      <FlowNodeContextMenu
        nodeId={nodeId}
        hasStepsBelow={hasStepsBelow}
        onCopyBlock={onCopyBlock}
        onCopyBlockAndBelow={onCopyBlockAndBelow}
        onDeleteBlock={onDeleteBlock}
        onDeleteBelow={onDeleteBelow}
      />
    </div>
  );
}
