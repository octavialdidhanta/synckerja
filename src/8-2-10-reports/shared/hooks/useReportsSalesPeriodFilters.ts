import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { POS_OUTLET_FILTER_ALL } from "@/8-2-2-outlets/lib/assignedOutlets";
import { useSelectedPosOutlet } from "@/8-2-2-outlets/hooks/useSelectedPosOutlet";
import {
  computeSalesSummaryPresetRange,
  defaultSalesSummaryDateRange,
  salesSummaryRangeToTimestamps,
} from "../../sales-summary/lib/salesSummaryDatePresets";
import type {
  SalesSummaryDatePresetId,
  SalesSummaryDateRange,
  SalesSummaryTimeFilter,
} from "../../sales-summary/lib/salesSummaryTypes";
import {
  SALES_SUMMARY_DEFAULT_END_TIME,
  SALES_SUMMARY_DEFAULT_START_TIME,
} from "../../sales-summary/lib/salesSummaryTypes";

const PRESET_IDS = new Set<SalesSummaryDatePresetId>([
  "today",
  "yesterday",
  "this_week",
  "last_week",
  "this_month",
  "last_month",
  "this_year",
  "last_year",
  "custom",
]);

function parsePreset(raw: string | null): SalesSummaryDatePresetId {
  if (raw && PRESET_IDS.has(raw as SalesSummaryDatePresetId)) {
    return raw as SalesSummaryDatePresetId;
  }
  return "this_month";
}

function isYmd(raw: string | null): raw is string {
  return Boolean(raw && /^\d{4}-\d{2}-\d{2}$/.test(raw));
}

/** URL-synced outlet + date + all-day filters for Sales reports (Summary, Gross Profit, …). */
export function useReportsSalesPeriodFilters() {
  const [searchParams, setSearchParams] = useSearchParams();
  const outlet = useSelectedPosOutlet(true, { allowAll: true });

  const dateRange: SalesSummaryDateRange = useMemo(() => {
    const preset = parsePreset(searchParams.get("preset"));
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");
    if (isYmd(fromParam) && isYmd(toParam)) {
      return { preset, from: fromParam, to: toParam };
    }
    if (preset !== "custom") {
      const computed = computeSalesSummaryPresetRange(preset);
      return { preset, ...computed };
    }
    return defaultSalesSummaryDateRange();
  }, [searchParams]);

  const timeFilter: SalesSummaryTimeFilter = useMemo(() => {
    const allDay = searchParams.get("allDay") !== "0";
    return {
      allDay,
      startTime: searchParams.get("startTime") || SALES_SUMMARY_DEFAULT_START_TIME,
      endTime: searchParams.get("endTime") || SALES_SUMMARY_DEFAULT_END_TIME,
    };
  }, [searchParams]);

  const patchParams = useCallback(
    (patch: Record<string, string | null>) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        for (const [key, value] of Object.entries(patch)) {
          if (value == null || value === "") next.delete(key);
          else next.set(key, value);
        }
        return next;
      }, { replace: true });
    },
    [setSearchParams],
  );

  const setDateRange = useCallback(
    (range: SalesSummaryDateRange) => {
      patchParams({
        preset: range.preset,
        from: range.from,
        to: range.to,
      });
    },
    [patchParams],
  );

  const setTimeFilter = useCallback(
    (next: SalesSummaryTimeFilter) => {
      patchParams({
        allDay: next.allDay ? "1" : "0",
        startTime: next.allDay ? null : next.startTime,
        endTime: next.allDay ? null : next.endTime,
      });
    },
    [patchParams],
  );

  const setDateRangeAndTime = useCallback(
    (range: SalesSummaryDateRange, time: SalesSummaryTimeFilter) => {
      patchParams({
        preset: range.preset,
        from: range.from,
        to: range.to,
        allDay: time.allDay ? "1" : "0",
        startTime: time.allDay ? null : time.startTime,
        endTime: time.allDay ? null : time.endTime,
      });
    },
    [patchParams],
  );

  const timestamps = useMemo(
    () =>
      salesSummaryRangeToTimestamps({
        fromYmd: dateRange.from,
        toYmd: dateRange.to,
        allDay: timeFilter.allDay,
        startTime: timeFilter.startTime,
        endTime: timeFilter.endTime,
      }),
    [dateRange.from, dateRange.to, timeFilter],
  );

  const outletIdForQuery =
    outlet.selectedOutletId === POS_OUTLET_FILTER_ALL ? null : outlet.selectedOutletId || null;

  return {
    ...outlet,
    dateRange,
    setDateRange,
    timeFilter,
    setTimeFilter,
    setDateRangeAndTime,
    timestamps,
    outletIdForQuery,
  };
}
