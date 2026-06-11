import { formatDmActualValue } from "@/6-0-digital-marketing-shared/dmReportTargetActuals";
import type { DmReportMetricDirectionsMap } from "@/6-0-digital-marketing-shared/dmReportMetricDirections";
import {
  DeviationProgressBar,
  formatSignedDeviationPercent,
} from "@/6-0-digital-marketing-shared/components/DeviationProgressBar";
import {
  computeDmReportTargetDeviationPercentage,
  computeDmReportTargetOkrPercentage,
  computeDmReportTargetProgressPercentage,
  dmReportMetricDirection,
} from "@/6-0-digital-marketing-shared/dmReportTargetProgressMath";
import type { DmReportChannel } from "@/6-0-digital-marketing-shared/dmReportTargetTypes";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";

export type DmReportMetricProgressInput = {
  metricKey: string;
  channel: DmReportChannel | string;
  actual: number | null;
  target: number;
  metricDirections?: DmReportMetricDirectionsMap | null;
};

/** Report aggregate utilization (not OKR deviation). */
export function getDmReportBarProgressPercent(input: DmReportMetricProgressInput): number {
  if (input.actual == null || input.target <= 0) return 0;
  return computeDmReportTargetProgressPercentage(
    input.actual,
    input.target,
    input.metricKey,
    input.metricDirections,
  );
}

export function getDmReportDeviationPercent(input: DmReportMetricProgressInput): number {
  if (input.actual == null || input.target <= 0) return 0;
  return computeDmReportTargetDeviationPercentage(
    input.actual,
    input.target,
    input.metricKey,
    input.metricDirections,
  );
}

export function getDmReportOkrScorePercent(input: DmReportMetricProgressInput): number {
  if (input.actual == null || input.target <= 0) return 0;
  return computeDmReportTargetOkrPercentage(
    input.actual,
    input.target,
    input.metricKey,
    input.metricDirections,
  );
}

type TranslateFn = (
  key: string,
  fallback?: string,
  variables?: Record<string, string | number>,
) => string;

export function getDmReportOkrHeadlineLabel(
  input: DmReportMetricProgressInput,
  t: TranslateFn,
): string {
  const okrScore = Math.round(getDmReportOkrScorePercent(input));
  return t("digitalMarketing.dmReportTargets.progressOkrHeadline", "OKR {{okr}}%", {
    okr: okrScore,
  });
}

export function getDmReportDeviationLabel(
  input: DmReportMetricProgressInput,
  t: TranslateFn,
): string {
  const deviation = getDmReportDeviationPercent(input);
  const signed = formatSignedDeviationPercent(deviation);
  const isLowerBetter =
    dmReportMetricDirection(input.metricKey, input.metricDirections) === "lower_is_better";

  if (deviation === 0) {
    return t("digitalMarketing.dmReportTargets.progressDeviationOnTargetShort", "On target");
  }

  if (isLowerBetter) {
    if (deviation < 0) {
      return t(
        "digitalMarketing.dmReportTargets.progressDeviationOverCapShort",
        "{{signed}} over cap",
        { signed },
      );
    }
    return t(
      "digitalMarketing.dmReportTargets.progressDeviationUnderCapShort",
      "{{signed}} under cap",
      { signed },
    );
  }

  if (deviation < 0) {
    return t(
      "digitalMarketing.dmReportTargets.progressDeviationBelowGoalShort",
      "{{signed}} below goal",
      { signed },
    );
  }
  return t(
    "digitalMarketing.dmReportTargets.progressDeviationAboveGoalShort",
    "{{signed}} above goal",
    { signed },
  );
}

export function getDmReportProgressCenterLabel(
  input: DmReportMetricProgressInput,
  t: TranslateFn,
): string {
  const deviation = getDmReportDeviationPercent(input);
  const okrScore = Math.round(getDmReportOkrScorePercent(input));
  const signed = formatSignedDeviationPercent(deviation);
  const isLowerBetter =
    dmReportMetricDirection(input.metricKey, input.metricDirections) === "lower_is_better";

  if (deviation === 0) {
    return t("digitalMarketing.dmReportTargets.progressDeviationOnTarget", "On target · OKR {{okr}}%", {
      okr: okrScore,
    });
  }

  if (isLowerBetter) {
    if (deviation < 0) {
      return t(
        "digitalMarketing.dmReportTargets.progressDeviationOverCap",
        "{{dev}} over cap · OKR {{okr}}%",
        { dev: signed, okr: okrScore },
      );
    }
    return t(
      "digitalMarketing.dmReportTargets.progressDeviationUnderCap",
      "{{dev}} under cap · OKR {{okr}}%",
      { dev: signed, okr: okrScore },
    );
  }

  if (deviation < 0) {
    return t(
      "digitalMarketing.dmReportTargets.progressDeviationBelowGoal",
      "{{dev}} below goal · OKR {{okr}}%",
      { dev: signed, okr: okrScore },
    );
  }
  return t(
    "digitalMarketing.dmReportTargets.progressDeviationAboveGoal",
    "{{dev}} above goal · OKR {{okr}}%",
    { dev: signed, okr: okrScore },
  );
}

type Props = {
  input: DmReportMetricProgressInput;
  className?: string;
  showLabel?: boolean;
  size?: "sm" | "md";
};

export function DmReportMetricProgressDisplay({
  input,
  className,
  showLabel = true,
  size = "md",
}: Props) {
  const { t } = useAppTranslation();
  const deviationPercent = getDmReportDeviationPercent(input);

  if (input.target <= 0 || input.actual == null) return null;

  const actualLabel = formatDmActualValue(
    input.channel as DmReportChannel,
    input.metricKey,
    input.actual,
    null,
  );
  const targetLabel = formatDmActualValue(
    input.channel as DmReportChannel,
    input.metricKey,
    input.target,
    null,
  );

  return (
    <div className={cn("space-y-1", className)}>
      {showLabel ? (
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="font-medium tabular-nums text-foreground">
            {actualLabel} / {targetLabel}
          </span>
          <span className="tabular-nums">{getDmReportProgressCenterLabel(input, t)}</span>
        </div>
      ) : null}
      <DeviationProgressBar
        deviationPercent={deviationPercent}
        size={size}
        className={size === "sm" ? "gap-1" : undefined}
      />
    </div>
  );
}
