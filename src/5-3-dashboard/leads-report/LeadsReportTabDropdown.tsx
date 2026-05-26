import { ChevronDown } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import {
  LEADS_REPORT_IDLE_TAB_ID,
  LEADS_REPORT_MAIN_TAB_IDS,
  type LeadsReportTabId,
} from "./leadsReportTabs";
import { getLeadsReportTabLabel } from "./leadsReportTabLabels";

export type LeadsReportTabDropdownProps = {
  activeTab: string;
  onTabChange: (tab: LeadsReportTabId) => void;
  /** When true and `canViewIdleAgents`, Idle Agents appears in the menu (desktop default). */
  includeIdleAgents?: boolean;
  canViewIdleAgents?: boolean;
  className?: string;
  triggerClassName?: string;
};

export function LeadsReportTabDropdown({
  activeTab,
  onTabChange,
  includeIdleAgents = false,
  canViewIdleAgents = false,
  className,
  triggerClassName,
}: LeadsReportTabDropdownProps) {
  const { t } = useAppTranslation();
  const showIdleInMenu = includeIdleAgents && canViewIdleAgents;

  return (
    <div className={cn("w-full min-w-0", className)}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className={cn("w-full justify-between", triggerClassName)}
          >
            {getLeadsReportTabLabel(t, activeTab)}
            <ChevronDown className="ml-2 h-4 w-4 shrink-0" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-[8rem]">
          {LEADS_REPORT_MAIN_TAB_IDS.map((tabId) => (
            <DropdownMenuItem key={tabId} onClick={() => onTabChange(tabId)}>
              {getLeadsReportTabLabel(t, tabId)}
            </DropdownMenuItem>
          ))}
          {showIdleInMenu ? (
            <DropdownMenuItem onClick={() => onTabChange(LEADS_REPORT_IDLE_TAB_ID)}>
              {getLeadsReportTabLabel(t, LEADS_REPORT_IDLE_TAB_ID)}
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
