import React, { useCallback, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/mobile-app/components/ui/drawer";
import {
  computePresetRange,
  dateSelectionForCalendarYear,
  formatGoogleAdsPickerButtonLabel,
  type GoogleAdsDatePresetId,
  type GoogleAdsDateRangeSelection,
} from "@/6-0-google-ads/lib/googleAdsDatePresets";
import { googleAdsAllTimeSelection } from "@/6-0-digital-marketing-shared/lib/resolveReportDateRanges";

type PresetRow = {
  id: GoogleAdsDatePresetId;
  label: string;
};

const PRESET_ROWS: PresetRow[] = [
  { id: "custom", label: "Custom" },
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "this_week_mon_today", label: "This week (Mon – Today)" },
  { id: "last_7_days", label: "Last 7 days" },
  { id: "last_week_mon_sun", label: "Last week (Mon – Sun)" },
  { id: "last_14_days", label: "Last 14 days" },
  { id: "this_month", label: "This month" },
  { id: "last_30_days", label: "Last 30 days" },
  { id: "last_month", label: "Last month" },
  { id: "all_time", label: "All time" },
];

type MobileTrafficDateRangeDrawerProps = {
  value: GoogleAdsDateRangeSelection;
  onChange: (value: GoogleAdsDateRangeSelection) => void;
  filtersHydrated: boolean;
  accountEarliestYmd?: string | null;
  calendarYearPresetYears?: number[];
  allTimeHint?: string;
  calendarYearFilterHint?: string;
  onCustomClick: () => void;
};

export function MobileTrafficDateRangeDrawer({
  value,
  onChange,
  filtersHydrated,
  accountEarliestYmd,
  calendarYearPresetYears = [],
  allTimeHint,
  calendarYearFilterHint,
  onCustomClick,
}: MobileTrafficDateRangeDrawerProps) {
  const { t } = useAppTranslation();
  const [periodDrawerOpen, setPeriodDrawerOpen] = useState(false);
  const [yearDrawerOpen, setYearDrawerOpen] = useState(false);

  const periodLabel = formatGoogleAdsPickerButtonLabel(value);

  const applyPreset = useCallback(
    (preset: GoogleAdsDatePresetId) => {
      if (preset === "custom") {
        setPeriodDrawerOpen(false);
        onCustomClick();
        return;
      }

      if (preset === "all_time") {
        onChange(googleAdsAllTimeSelection());
        setPeriodDrawerOpen(false);
        return;
      }

      if (preset === "calendar_year") {
        setPeriodDrawerOpen(false);
        setYearDrawerOpen(true);
        return;
      }

      const range = computePresetRange(preset, new Date(), {
        accountEarliestYmd,
      });
      onChange({
        preset,
        range,
        rollingDays: 30,
      });
      setPeriodDrawerOpen(false);
    },
    [accountEarliestYmd, onChange, onCustomClick],
  );

  const applyCalendarYear = useCallback(
    (year: number) => {
      onChange(dateSelectionForCalendarYear(year));
      setYearDrawerOpen(false);
    },
    [onChange],
  );

  const yearOptions = useMemo(() => {
    if (calendarYearPresetYears.length > 0) return calendarYearPresetYears;
    const now = new Date().getFullYear();
    return [now, now - 1, now - 2];
  }, [calendarYearPresetYears]);

  if (!filtersHydrated) {
    return <div className="h-9 w-full animate-pulse rounded-md bg-muted" aria-hidden />;
  }

  return (
    <>
      <Drawer open={periodDrawerOpen} onOpenChange={setPeriodDrawerOpen}>
        <DrawerTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-9 w-full min-w-0 gap-2 justify-between text-xs"
            title={periodLabel}
            aria-label={t("traffic.mobile.dateRange", "Tanggal")}
          >
            <span className="min-w-0 flex-1 truncate text-left">{periodLabel}</span>
            <ChevronDown className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
          </Button>
        </DrawerTrigger>
        <DrawerContent className="max-h-[80dvh]">
          <DrawerHeader className="text-left safe-area-top pb-2">
            <DrawerTitle>{t("traffic.mobile.dateRange", "Tanggal")}</DrawerTitle>
          </DrawerHeader>
          <div className="overflow-y-auto px-4 pb-4">
            <div className="grid gap-2">
              {PRESET_ROWS.map((opt) => (
                <DrawerClose asChild key={opt.id}>
                  <Button
                    type="button"
                    variant={value.preset === opt.id ? "default" : "outline"}
                    className="justify-start"
                    onClick={() => applyPreset(opt.id)}
                  >
                    <span className="text-sm">{opt.label}</span>
                  </Button>
                </DrawerClose>
              ))}
              <DrawerClose asChild>
                <Button
                  type="button"
                  variant={value.preset === "calendar_year" ? "default" : "outline"}
                  className="justify-start"
                  onClick={() => applyPreset("calendar_year")}
                >
                  <span className="text-sm">{t("traffic.mobile.dateRange.calendarYear", "Calendar year")}</span>
                </Button>
              </DrawerClose>
            </div>
            {value.preset === "all_time" && allTimeHint ? (
              <p className="mt-3 text-xs text-muted-foreground">{allTimeHint}</p>
            ) : null}
          </div>
        </DrawerContent>
      </Drawer>

      <Drawer open={yearDrawerOpen} onOpenChange={setYearDrawerOpen}>
        <DrawerContent className="max-h-[80dvh]">
          <DrawerHeader className="text-left safe-area-top pb-2">
            <DrawerTitle>{t("traffic.mobile.dateRange.calendarYear", "Calendar year")}</DrawerTitle>
          </DrawerHeader>
          <div className="overflow-y-auto px-4 pb-4">
            {calendarYearFilterHint ? (
              <p className="mb-3 text-xs text-muted-foreground">{calendarYearFilterHint}</p>
            ) : null}
            <div className="grid gap-2">
              {yearOptions.map((year) => (
                <DrawerClose asChild key={year}>
                  <Button
                    type="button"
                    variant={
                      value.preset === "calendar_year" &&
                      value.range.from?.getFullYear() === year
                        ? "default"
                        : "outline"
                    }
                    className="justify-start"
                    onClick={() => applyCalendarYear(year)}
                  >
                    <span className="text-sm">{year}</span>
                  </Button>
                </DrawerClose>
              ))}
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
