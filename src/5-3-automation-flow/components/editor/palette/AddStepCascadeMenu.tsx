import { useTranslation } from "react-i18next";
import { ChevronRight, GitBranch, Clock, Zap } from "lucide-react";
import {
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/shared/components/ui/dropdown-menu";
import type { AutomationFlowNodeType } from "@/5-3-automation-flow/types/automationFlowGraph.types";

type AddStepCascadeMenuProps = {
  onSelect: (type: AutomationFlowNodeType) => void;
  onClose?: () => void;
};

const ACTION_ITEMS: Array<{ type: AutomationFlowNodeType; labelKey: string; enabled: boolean }> = [
  {
    type: "action_send_message",
    labelKey: "omnichannel.automationFlow.editor.nodeType.action_send_message",
    enabled: true,
  },
  {
    type: "action_send_message",
    labelKey: "omnichannel.automationFlow.editor.action.sendMedia",
    enabled: false,
  },
  {
    type: "action_assign_to",
    labelKey: "omnichannel.automationFlow.editor.action.assignTo",
    enabled: true,
  },
];

export function AddStepCascadeMenu({ onSelect, onClose }: AddStepCascadeMenuProps) {
  const { t } = useTranslation();

  const handleSelect = (type: AutomationFlowNodeType) => {
    onSelect(type);
    onClose?.();
  };

  return (
    <>
      <DropdownMenuItem disabled className="gap-2 opacity-50">
        <GitBranch className="h-4 w-4 text-amber-500" />
        <span className="flex-1">{t("omnichannel.automationFlow.editor.addStep.condition")}</span>
        <span className="text-[10px] text-muted-foreground">{t("omnichannel.automationFlow.create.comingSoon")}</span>
      </DropdownMenuItem>

      <DropdownMenuSub>
        <DropdownMenuSubTrigger className="gap-2">
          <Zap className="h-4 w-4 text-blue-500" />
          <span className="flex-1">{t("omnichannel.automationFlow.editor.addStep.action")}</span>
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent className="w-[200px]">
          <DropdownMenuItem className="gap-2" onClick={() => handleSelect("action_send_message")}>
            <Zap className="h-4 w-4 text-blue-500" />
            <span>{t("omnichannel.automationFlow.editor.nodeType.action_send_message")}</span>
          </DropdownMenuItem>
          {ACTION_ITEMS.slice(1).map((item, index) => (
            <DropdownMenuItem
              key={`${item.labelKey}-${index}`}
              disabled={!item.enabled}
              className="gap-2"
              onClick={() => item.enabled && handleSelect(item.type)}
            >
              <Zap className="h-4 w-4 text-blue-500" />
              <span className="flex-1">{t(item.labelKey)}</span>
              {!item.enabled ? (
                <span className="text-[10px] text-muted-foreground">{t("omnichannel.automationFlow.create.comingSoon")}</span>
              ) : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuSubContent>
      </DropdownMenuSub>

      <DropdownMenuItem className="gap-2" onClick={() => handleSelect("time_delay")}>
        <Clock className="h-4 w-4 text-violet-500" />
        <span>{t("omnichannel.automationFlow.editor.addStep.timeDelay")}</span>
      </DropdownMenuItem>
    </>
  );
}
