import { useMemo, useState } from "react";
import { Plus, TrendingDown, TrendingUp, X } from "lucide-react";
import { DM_REPORT_TARGET_MAX_METRICS } from "@/6-0-digital-marketing-shared/dmReportTargetTypes";
import {
  defaultDmReportMetricDirection,
  type DmReportMetricDirectionsMap,
} from "@/6-0-digital-marketing-shared/dmReportMetricDirections";
import type { DmReportTargetDirection } from "@/6-0-digital-marketing-shared/dmReportTargetProgressMath";
import {
  REPORT_SUMMARY_METRIC_OPTIONS,
  reportSummaryMetricGroups,
} from "@/6-0-digital-marketing-shared/reportSummaryMetrics";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/shared/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";

type Props = {
  selectedMetrics: string[];
  onChange: (metrics: string[]) => void;
  metricDirections: DmReportMetricDirectionsMap;
  onDirectionChange: (metricKey: string, direction: DmReportTargetDirection) => void;
  disabled?: boolean;
};

function MetricDirectionToggle({
  metricKey,
  direction,
  disabled,
  onDirectionChange,
}: {
  metricKey: string;
  direction: DmReportTargetDirection;
  disabled?: boolean;
  onDirectionChange: (metricKey: string, direction: DmReportTargetDirection) => void;
}) {
  const { t } = useAppTranslation();

  return (
    <div
      className="ml-1 flex flex-col border-l border-border/60 pl-1"
      title={t(
        "digitalMarketing.dmReportTargets.metricDirectionHint",
        "Asc = higher is better · Desc = lower is better",
      )}
    >
      <button
        type="button"
        disabled={disabled}
        className={cn(
          "rounded-sm p-0.5 hover:bg-muted",
          direction === "higher_is_better" ? "text-primary" : "text-muted-foreground/60",
        )}
        title={t("digitalMarketing.dmReportTargets.directionAsc", "Asc = good (higher is better)")}
        onClick={() => onDirectionChange(metricKey, "higher_is_better")}
        aria-label={t("digitalMarketing.dmReportTargets.directionAsc", "Asc = good (higher is better)")}
        aria-pressed={direction === "higher_is_better"}
      >
        <TrendingUp className="h-3 w-3" />
      </button>
      <button
        type="button"
        disabled={disabled}
        className={cn(
          "rounded-sm p-0.5 hover:bg-muted",
          direction === "lower_is_better" ? "text-primary" : "text-muted-foreground/60",
        )}
        title={t("digitalMarketing.dmReportTargets.directionDesc", "Desc = good (lower is better)")}
        onClick={() => onDirectionChange(metricKey, "lower_is_better")}
        aria-label={t("digitalMarketing.dmReportTargets.directionDesc", "Desc = good (lower is better)")}
        aria-pressed={direction === "lower_is_better"}
      >
        <TrendingDown className="h-3 w-3" />
      </button>
    </div>
  );
}

export function DmReportTargetMetricPicker({
  selectedMetrics,
  onChange,
  metricDirections,
  onDirectionChange,
  disabled = false,
}: Props) {
  const { t } = useAppTranslation();
  const [open, setOpen] = useState(false);

  const metricOptions = useMemo(
    () =>
      REPORT_SUMMARY_METRIC_OPTIONS.map((opt) => ({
        ...opt,
        label:
          opt.key === "cost"
            ? t("digitalMarketing.report.tableCost", "Cost")
            : opt.key === "cpc"
              ? t("digitalMarketing.report.tableCpc", "CPC")
              : opt.key === "cpa"
                ? t("digitalMarketing.report.tableCostPerLead", "CPA")
                : opt.key === "converted_leads"
                  ? t("digitalMarketing.report.tableConvertedLeads", "Conv. leads")
                  : opt.key === "impressions"
                    ? t("digitalMarketing.report.tableImpressions", "Impressions")
                    : opt.key === "ctr"
                      ? t("digitalMarketing.report.tableCtr", "CTR")
                      : opt.key === "clicks"
                        ? t("digitalMarketing.report.tableClicks", "Clicks")
                        : opt.label,
        groupLabel: t("digitalMarketing.report.summaryMetricGroupPerformance", "Performance"),
      })),
    [t],
  );

  const labelByKey = useMemo(() => {
    const map = new Map<string, string>();
    for (const opt of metricOptions) map.set(opt.key, opt.label);
    return map;
  }, [metricOptions]);

  const groups = useMemo(() => reportSummaryMetricGroups(metricOptions), [metricOptions]);

  const atMax = selectedMetrics.length >= DM_REPORT_TARGET_MAX_METRICS;

  const toggleMetric = (key: string) => {
    if (selectedMetrics.includes(key)) {
      onChange(selectedMetrics.filter((k) => k !== key));
      return;
    }
    if (atMax) return;
    onDirectionChange(key, metricDirections[key] ?? defaultDmReportMetricDirection(key));
    onChange([...selectedMetrics, key]);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {selectedMetrics.map((key) => (
          <Badge key={key} variant="secondary" className="gap-1 pr-1">
            {labelByKey.get(key) ?? key}
            <MetricDirectionToggle
              metricKey={key}
              direction={metricDirections[key] ?? defaultDmReportMetricDirection(key)}
              disabled={disabled}
              onDirectionChange={onDirectionChange}
            />
            <button
              type="button"
              className="rounded-sm hover:bg-muted"
              disabled={disabled}
              onClick={() => onChange(selectedMetrics.filter((k) => k !== key))}
              aria-label={t("digitalMarketing.dmReportTargets.removeMetric", "Remove metric")}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || atMax}
          onClick={() => setOpen(true)}
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          {t("digitalMarketing.dmReportTargets.addMetric", "Add metric")}
        </Button>
        <span className="text-xs text-muted-foreground">
          {t("digitalMarketing.dmReportTargets.metricLimit", "{{count}}/{{max}} metrics", {
            count: selectedMetrics.length,
            max: DM_REPORT_TARGET_MAX_METRICS,
          })}
          {" · "}
          {t(
            "digitalMarketing.dmReportTargets.metricDirectionRules",
            "↓ Desc: target ≤ actual · ↑ Asc: target ≥ actual",
          )}
        </span>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[80vh] max-w-md overflow-hidden p-0">
          <DialogHeader className="px-4 pt-4">
            <DialogTitle>
              {t("digitalMarketing.dmReportTargets.selectMetrics", "Select metrics")}
            </DialogTitle>
          </DialogHeader>
          <Command className="border-t">
            <CommandInput
              placeholder={t(
                "digitalMarketing.dmReportTargets.searchMetrics",
                "Search metrics…",
              )}
            />
            <CommandList className="max-h-[50vh]">
              <CommandEmpty>
                {t("digitalMarketing.dmReportTargets.noMetrics", "No metrics found.")}
              </CommandEmpty>
              {groups.map((group) => (
                <CommandGroup key={group.id} heading={group.label}>
                  {group.options.map((opt) => {
                    const selected = selectedMetrics.includes(opt.key);
                    const itemDisabled = !selected && atMax;
                    return (
                      <CommandItem
                        key={opt.key}
                        value={`${opt.label} ${opt.key}`}
                        disabled={itemDisabled}
                        onSelect={() => toggleMetric(opt.key)}
                      >
                        <span className={selected ? "font-medium" : undefined}>{opt.label}</span>
                        {selected ? (
                          <span className="ml-auto text-xs text-muted-foreground">
                            {t("digitalMarketing.dmReportTargets.selected", "Selected")}
                          </span>
                        ) : null}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </div>
  );
}
