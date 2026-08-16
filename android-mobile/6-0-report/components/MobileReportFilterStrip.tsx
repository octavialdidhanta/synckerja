import { cn } from "@/shared/lib/utils";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { Button } from "@/shared/components/ui/button";
import { MobileTrafficDateRangeDrawer } from "@/mobile/6-0-web-traffic/components/MobileTrafficDateRangeDrawer";
import { MobileReportServicePicker } from "@/mobile/6-0-report/components/MobileReportServicePicker";
import type { GoogleAdsDateRangeSelection } from "@/6-0-google-ads/lib/googleAdsDatePresets";
import type {
  ReportServiceFilterOption,
  ReportServiceFilterValue,
} from "@/6-0-digital-marketing-shared/reportServiceFilter";

type Props = {
  dateSelection: GoogleAdsDateRangeSelection;
  onDateSelectionChange: (value: GoogleAdsDateRangeSelection) => void;
  filtersHydrated: boolean;
  calendarYearPresetYears?: number[];
  accountEarliestYmd?: string | null;
  allTimeHint?: string;
  calendarYearFilterHint?: string;
  onCustomDateClick: () => void;
  compareEnabled: boolean;
  onCompareChange: (enabled: boolean) => void;
  serviceOptions: ReportServiceFilterOption[];
  serviceFilter: ReportServiceFilterValue;
  onServiceFilterChange: (value: ReportServiceFilterValue) => void;
  className?: string;
};

/**
 * Full-bleed horizontal filter strip: Date → Service → Compare.
 */
export function MobileReportFilterStrip({
  dateSelection,
  onDateSelectionChange,
  filtersHydrated,
  calendarYearPresetYears,
  accountEarliestYmd,
  allTimeHint,
  calendarYearFilterHint,
  onCustomDateClick,
  compareEnabled,
  onCompareChange,
  serviceOptions,
  serviceFilter,
  onServiceFilterChange,
  className,
}: Props) {
  const { t } = useAppTranslation();

  return (
    <div className={cn("-mx-2 min-w-0 border-y border-border bg-card", className)}>
      <div
        className={cn(
          "nested-scroll-touch-chain-xy scrollbar-hide min-w-0 w-full overflow-x-auto overflow-y-hidden",
          "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        )}
      >
        <div className="inline-flex w-max items-center gap-2 py-2">
          <span className="inline-block w-4 shrink-0 grow-0 basis-4" aria-hidden />
          <div className="min-w-[11rem] max-w-[16rem] shrink-0">
            <MobileTrafficDateRangeDrawer
              value={dateSelection}
              onChange={onDateSelectionChange}
              filtersHydrated={filtersHydrated}
              calendarYearPresetYears={calendarYearPresetYears}
              accountEarliestYmd={accountEarliestYmd}
              allTimeHint={allTimeHint}
              calendarYearFilterHint={calendarYearFilterHint}
              onCustomClick={onCustomDateClick}
              fieldLabel={t("digitalMarketing.report.dateRangeLabel", "Date range")}
              triggerClassName="h-auto min-h-9 w-full max-w-[16rem] flex-col items-start gap-0 px-3 py-1.5 text-xs font-normal"
            />
          </div>

          <div className="min-w-[11rem] max-w-[16rem] shrink-0">
            <MobileReportServicePicker
              options={serviceOptions}
              value={serviceFilter}
              onChange={onServiceFilterChange}
              disabled={!filtersHydrated}
            />
          </div>

          <Button
            type="button"
            variant={compareEnabled ? "default" : "outline"}
            size="sm"
            className="h-auto min-h-9 shrink-0 flex-col items-start gap-0 px-3 py-1.5 text-left text-xs font-normal"
            disabled={!filtersHydrated}
            onClick={() => onCompareChange(!compareEnabled)}
            aria-pressed={compareEnabled}
            title={t(
              "digitalMarketing.report.compareToggleHint",
              "Charts (Spend, CPA, Conv. leads) show monthly data for the chart year. Table and KPIs keep the date filter above.",
            )}
          >
            <span className="text-[10px] font-medium uppercase tracking-wide opacity-80">
              {t("digitalMarketing.report.compareToggle", "Compare")}
            </span>
            <span className="text-xs font-medium">
              {compareEnabled
                ? t("digitalMarketing.report.compareOn", "On")
                : t("digitalMarketing.report.compareOff", "Off")}
            </span>
          </Button>
          <span className="inline-block w-4 shrink-0 grow-0 basis-4" aria-hidden />
        </div>
      </div>
    </div>
  );
}
