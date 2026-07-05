import { useTranslation } from "react-i18next";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import type { AutomationFlowNodeType } from "@/5-3-automation-flow/types/automationFlowGraph.types";

type AddNodeCascadeMenuProps = {
  onAdd: (type: AutomationFlowNodeType) => void;
};

const ADDABLE: AutomationFlowNodeType[] = [
  "condition",
  "action_send_message",
  "time_delay",
  "action_wait_reply",
  "action_update_contact",
  "action_assign_to",
  "action_http_request",
  "end",
];

export function AddNodeCascadeMenu({ onAdd }: AddNodeCascadeMenuProps) {
  const { t } = useTranslation();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          {t("omnichannel.automationFlow.editor.addNode")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {ADDABLE.map((type) => (
          <DropdownMenuItem key={type} onClick={() => onAdd(type)}>
            {t(`omnichannel.automationFlow.editor.nodeType.${type}`)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
