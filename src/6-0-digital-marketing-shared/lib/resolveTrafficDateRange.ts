import type { GoogleAdsDateRangeSelection } from "@/6-0-google-ads/lib/googleAdsDatePresets";
import { resolveReportGoogleDateRangePayload } from "@/6-0-digital-marketing-shared/lib/resolveReportDateRanges";

export type TrafficDateRangeParams = {
  fromDate: string | null;
  toDate: string | null;
  rangeIsMaximum: boolean;
};

/** Aligns traffic RPC bounds with the Report / shared date picker table window. */
export function resolveTrafficDateRangeFromSelection(
  dateSelection: GoogleAdsDateRangeSelection,
  reportChartYear: number,
  accountEarliestYmd?: string | null,
): TrafficDateRangeParams {
  const { start, end } = resolveReportGoogleDateRangePayload(
    dateSelection,
    reportChartYear,
    accountEarliestYmd,
  );
  return {
    fromDate: start,
    toDate: end,
    rangeIsMaximum: false,
  };
}
