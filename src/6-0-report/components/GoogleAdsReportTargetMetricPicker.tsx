import { useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { buildSummaryMetricOptions } from "@/google-ads/metrics/googleAdsSummaryMetricOptions";
import { useGoogleAdsMetricCatalog } from "@/google-ads/hooks/useGoogleAdsMetricCatalog";
import { GOOGLE_ADS_REPORT_TARGET_MAX_METRICS } from "@/6-0-digital-marketing-shared/googleAdsReportTargetTypes";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
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

type Props = {
  selectedMetrics: string[];
  onChange: (metrics: string[]) => void;
  disabled?: boolean;
};

export function GoogleAdsReportTargetMetricPicker({
  selectedMetrics,
  onChange,
  disabled = false,
}: Props) {
  const { t } = useAppTranslation();
  const { organizationId } = useCurrentOrg();
  const [open, setOpen] = useState(false);
  const { data: catalog } = useGoogleAdsMetricCatalog(organizationId, "campaign", true);

  const options = useMemo(
    () => buildSummaryMetricOptions("campaign", catalog, []),
    [catalog],
  );

  const labelByKey = useMemo(() => {
    const map = new Map<string, string>();
    for (const opt of options) map.set(opt.key, opt.label);
    return map;
  }, [options]);

  const groups = useMemo(() => {
    const byGroup = new Map<string, typeof options>();
    for (const opt of options) {
      const list = byGroup.get(opt.groupId) ?? [];
      list.push(opt);
      byGroup.set(opt.groupId, list);
    }
    return [...byGroup.entries()].map(([groupId, items]) => ({
      groupId,
      groupLabel: items[0]?.groupLabel ?? groupId,
      items,
    }));
  }, [options]);

  const atMax = selectedMetrics.length >= GOOGLE_ADS_REPORT_TARGET_MAX_METRICS;

  const toggleMetric = (key: string) => {
    if (selectedMetrics.includes(key)) {
      onChange(selectedMetrics.filter((k) => k !== key));
      return;
    }
    if (atMax) return;
    onChange([...selectedMetrics, key]);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {selectedMetrics.map((key) => (
          <Badge key={key} variant="secondary" className="gap-1 pr-1">
            {labelByKey.get(key) ?? key}
            <button
              type="button"
              className="rounded-sm hover:bg-muted"
              disabled={disabled}
              onClick={() => onChange(selectedMetrics.filter((k) => k !== key))}
              aria-label={t("digitalMarketing.googleAdsReportTargets.removeMetric", "Remove metric")}
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
          {t("digitalMarketing.googleAdsReportTargets.addMetric", "Add metric")}
        </Button>
        <span className="text-xs text-muted-foreground">
          {t(
            "digitalMarketing.googleAdsReportTargets.metricLimit",
            "{{count}}/{{max}} metrics",
            { count: selectedMetrics.length, max: GOOGLE_ADS_REPORT_TARGET_MAX_METRICS },
          )}
        </span>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[80vh] max-w-md overflow-hidden p-0">
          <DialogHeader className="px-4 pt-4">
            <DialogTitle>
              {t("digitalMarketing.googleAdsReportTargets.selectMetrics", "Select metrics")}
            </DialogTitle>
          </DialogHeader>
          <Command className="border-t">
            <CommandInput
              placeholder={t(
                "digitalMarketing.googleAdsReportTargets.searchMetrics",
                "Search metrics…",
              )}
            />
            <CommandList className="max-h-[50vh]">
              <CommandEmpty>
                {t("digitalMarketing.googleAdsReportTargets.noMetrics", "No metrics found.")}
              </CommandEmpty>
              {groups.map((group) => (
                <CommandGroup key={group.groupId} heading={group.groupLabel}>
                  {group.items.map((opt) => {
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
                            {t("digitalMarketing.googleAdsReportTargets.selected", "Selected")}
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
