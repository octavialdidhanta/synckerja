import type { MonthlyChartChannelFilter } from "@/6-0-digital-marketing-shared/dmPaidAdsFiltersStorage";
import type { MonthlySpendChannelSeries } from "@/6-0-digital-marketing-shared/hooks/useDigitalMarketingReportMonthlySpend";

export function isMetaSeriesChartSkipped(meta: MonthlySpendChannelSeries): boolean {
  return Boolean(meta.unavailableReason);
}

export function isTikTokSeriesChartSkipped(tiktok: MonthlySpendChannelSeries): boolean {
  return Boolean(tiktok.unavailableReason);
}

export function isGoogleSeriesChartActive(
  google: MonthlySpendChannelSeries,
  channelFilter: MonthlyChartChannelFilter,
): boolean {
  return (
    google.connected &&
    !google.error &&
    channelFilter !== "meta" &&
    channelFilter !== "tiktok"
  );
}

export function isMetaSeriesChartActive(
  meta: MonthlySpendChannelSeries,
  channelFilter: MonthlyChartChannelFilter,
): boolean {
  return (
    meta.connected &&
    !meta.error &&
    !isMetaSeriesChartSkipped(meta) &&
    channelFilter !== "google" &&
    channelFilter !== "tiktok"
  );
}

export function isTikTokSeriesChartActive(
  tiktok: MonthlySpendChannelSeries,
  channelFilter: MonthlyChartChannelFilter,
): boolean {
  return (
    tiktok.connected &&
    !tiktok.error &&
    !isTikTokSeriesChartSkipped(tiktok) &&
    channelFilter !== "google" &&
    channelFilter !== "meta"
  );
}

/** Error that blocks the whole chart (only when the selected channel cannot render). */
export function getMonthlyChartBlockingError(
  channelFilter: MonthlyChartChannelFilter,
  google: MonthlySpendChannelSeries,
  meta: MonthlySpendChannelSeries,
  tiktok: MonthlySpendChannelSeries,
): string | null {
  if (channelFilter === "google") {
    if (!google.connected) return null;
    return google.error;
  }
  if (channelFilter === "meta") {
    if (!meta.connected) return null;
    if (meta.error) return meta.error;
    return meta.unavailableReason ?? null;
  }
  if (channelFilter === "tiktok") {
    if (!tiktok.connected) return null;
    if (tiktok.error) return tiktok.error;
    return tiktok.unavailableReason ?? null;
  }
  if (isGoogleSeriesChartActive(google, channelFilter) && google.error) {
    return google.error;
  }
  if (isMetaSeriesChartActive(meta, channelFilter) && meta.error) {
    return meta.error;
  }
  if (isTikTokSeriesChartActive(tiktok, channelFilter) && tiktok.error) {
    return tiktok.error;
  }
  return null;
}

export function hasMonthlyChartDisplayableChannel(
  channelFilter: MonthlyChartChannelFilter,
  google: MonthlySpendChannelSeries,
  meta: MonthlySpendChannelSeries,
  tiktok: MonthlySpendChannelSeries,
): boolean {
  return (
    isGoogleSeriesChartActive(google, channelFilter) ||
    isMetaSeriesChartActive(meta, channelFilter) ||
    isTikTokSeriesChartActive(tiktok, channelFilter)
  );
}
