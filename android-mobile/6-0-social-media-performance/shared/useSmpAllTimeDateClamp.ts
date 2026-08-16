import { useEffect } from "react";
import { endOfDay } from "date-fns";
import { parseYmdLocal, toYmdLocal } from "@/6-0-google-ads/lib/googleAdsDatePresets";
import type { GoogleAdsDateRangeSelection } from "@/6-0-google-ads/lib/googleAdsDatePresets";
import { tiktokAdsAllTimeDateRange } from "@/tiktok-ads/lib/clampTikTokAdsDateRange";

export function useSmpAllTimeDateClamp(
  dateSelection: GoogleAdsDateRangeSelection,
  setDateSelection: (
    updater: (prev: GoogleAdsDateRangeSelection) => GoogleAdsDateRangeSelection,
  ) => void,
) {
  useEffect(() => {
    if (dateSelection.preset !== "all_time") return;
    const { start, end } = tiktokAdsAllTimeDateRange();
    const from = parseYmdLocal(start);
    const to = parseYmdLocal(end);
    if (!from || !to) return;
    const nextTo = endOfDay(to);
    const curFrom = dateSelection.range.from ? toYmdLocal(dateSelection.range.from) : "";
    const curTo = dateSelection.range.to ? toYmdLocal(dateSelection.range.to) : "";
    if (curFrom === start && curTo === toYmdLocal(nextTo)) return;
    setDateSelection((prev) => ({
      ...prev,
      preset: "all_time",
      range: { from, to: nextTo },
    }));
  }, [dateSelection.preset, dateSelection.range.from, dateSelection.range.to, setDateSelection]);
}
