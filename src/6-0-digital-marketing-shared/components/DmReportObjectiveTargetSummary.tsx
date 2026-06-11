import { formatDmActualValue } from "@/6-0-digital-marketing-shared/dmReportTargetActuals";
import { resolveDmReportMetricDirection } from "@/6-0-digital-marketing-shared/dmReportMetricDirections";
import type { DmReportMetricDirectionsMap } from "@/6-0-digital-marketing-shared/dmReportMetricDirections";
import type { DmObjectiveMetricDisplay } from "@/6-0-digital-marketing-shared/hooks/useDmReportTargetMetricsByObjectiveId";
import type { DmReportChannel } from "@/6-0-digital-marketing-shared/dmReportTargetTypes";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";

type Props = {
  metric: DmObjectiveMetricDisplay;
  metricDirections?: DmReportMetricDirectionsMap | null;
  className?: string;
  variant?: "inline" | "card";
};

export function formatDmReportObjectiveAchieveValue(
  metric: DmObjectiveMetricDisplay,
  metricDirections?: DmReportMetricDirectionsMap | null,
): string {
  const formatted = formatDmActualValue(
    metric.channel as DmReportChannel,
    metric.metricKey,
    metric.targetValue,
    null,
  );
  if (resolveDmReportMetricDirection(metric.metricKey, metricDirections) === "lower_is_better") {
    return `≤ ${formatted}`;
  }
  return `≥ ${formatted}`;
}

export function DmReportObjectiveTargetSummary({
  metric,
  metricDirections,
  className,
  variant = "inline",
}: Props) {
  const { t } = useAppTranslation();
  const achieveValue = formatDmReportObjectiveAchieveValue(metric, metricDirections);
  const isLowerBetter =
    resolveDmReportMetricDirection(metric.metricKey, metricDirections) === "lower_is_better";

  if (variant === "inline") {
    return (
      <p className={cn("text-xs text-muted-foreground", className)}>
        <span>{t("digitalMarketing.dmReportTargets.okrAchieveLabel", "Target to achieve")}: </span>
        <span className="font-semibold tabular-nums text-foreground">{achieveValue}</span>
        {isLowerBetter ? (
          <span className="ml-1 text-[10px] text-muted-foreground">
            ({t("digitalMarketing.dmReportTargets.okrLowerIsBetterHint", "max")})
          </span>
        ) : null}
      </p>
    );
  }

  return (
    <div className={cn("rounded-lg border border-sky-200 bg-sky-50/80 p-3", className)}>
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-medium text-sky-900">
          {t("digitalMarketing.dmReportTargets.okrAchieveLabel", "Target to achieve")}
        </span>
        <span className="text-sm font-semibold tabular-nums text-foreground">{achieveValue}</span>
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">
        {isLowerBetter
          ? t(
              "digitalMarketing.dmReportTargets.okrLowerIsBetterDesc",
              "Stay at or below this value for the period.",
            )
          : t(
              "digitalMarketing.dmReportTargets.okrHigherIsBetterDesc",
              "Reach at least this value for the period.",
            )}
      </p>
    </div>
  );
}
