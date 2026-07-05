import { Info } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Progress } from "@/shared/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";
import { FLOW_BUILDER_ACTIVE_FLOWS_LIMIT } from "@/5-3-dashboard/omnichannel-settings/constants/flowBuilderFilters";

type FlowBuilderActiveFlowsLimitProps = {
  activeCount: number;
  limit?: number;
};

export function FlowBuilderActiveFlowsLimit({
  activeCount,
  limit = FLOW_BUILDER_ACTIVE_FLOWS_LIMIT,
}: FlowBuilderActiveFlowsLimitProps) {
  const { t } = useTranslation();
  const percent = limit > 0 ? Math.min(100, Math.round((activeCount / limit) * 100)) : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm text-foreground">
        <span className="font-medium">{t("omnichannel.settings.flowBuilder.listing.activeFlowsLimit")}</span>
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
                aria-label={t("omnichannel.settings.flowBuilder.listing.activeFlowsLimitHint")}
              >
                <Info className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs text-xs">
              {t("omnichannel.settings.flowBuilder.listing.activeFlowsLimitHint")}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <span className="ml-auto tabular-nums text-muted-foreground">
          {activeCount}/{limit}
        </span>
      </div>
      <Progress value={percent} className="h-2 bg-muted" />
    </div>
  );
}
