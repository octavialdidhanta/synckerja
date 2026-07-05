import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { cn } from "@/shared/lib/utils";
import { AddStepCascadeMenu } from "@/5-3-automation-flow/components/editor/palette/AddStepCascadeMenu";
import type { AutomationFlowNodeType } from "@/5-3-automation-flow/types/automationFlowGraph.types";

type EdgeAddStepButtonProps = {
  onSelect: (nodeType: AutomationFlowNodeType) => void;
  size?: "sm" | "md";
  className?: string;
};

function stopCanvasEvent(event: React.SyntheticEvent) {
  event.stopPropagation();
}

export function EdgeAddStepButton({ onSelect, size = "md", className }: EdgeAddStepButtonProps) {
  const { t } = useTranslation();
  const isSmall = size === "sm";

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "nodrag nopan nowheel flex items-center justify-center rounded-md border border-border bg-white shadow-sm hover:bg-muted",
            isSmall ? "h-6 w-6" : "h-7 w-7",
            className,
          )}
          aria-label={t("omnichannel.automationFlow.editor.addNode")}
          onPointerDown={stopCanvasEvent}
          onClick={stopCanvasEvent}
        >
          <Plus className={cn("text-muted-foreground", isSmall ? "h-3 w-3" : "h-4 w-4")} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="center" className="w-[180px]">
        <AddStepCascadeMenu onSelect={onSelect} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
