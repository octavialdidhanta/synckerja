import { useTranslation } from "react-i18next";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { GoogleAdsSummaryPrimaryMetricPicker } from "@/6-0-google-ads/components/GoogleAdsSummaryPrimaryMetricPicker";
import { GoogleAdsSummaryFixedMetricCard } from "@/6-0-google-ads/components/GoogleAdsSummaryFixedMetricCard";
import { SUMMARY_SLOT_COUNT } from "@/google-ads/metrics/googleAdsSummaryMetricOptions";
import { formatMetricValue } from "@/google-ads/metrics/formatMetricValue";
import type {
  GoogleAdsMetricsSummaryTotals,
  GoogleAdsSummaryMetricOption,
} from "@/google-ads/metrics/types";

type Props = {
  totals: GoogleAdsMetricsSummaryTotals | null | undefined;
  currencyCode: string | null;
  isLoading?: boolean;
  metricKeys: string[];
  onMetricKeyChange: (slotIndex: number, key: string) => void;
  summaryMetricOptions: GoogleAdsSummaryMetricOption[];
};

function costValue(
  totals: GoogleAdsMetricsSummaryTotals | null | undefined,
  currencyCode: string | null,
): string {
  if (!totals) return "—";
  const spent =
    totals.by_key && "spent" in totals.by_key
      ? totals.by_key.spent
      : totals.spent;
  return formatMetricValue("spent", spent ?? null, currencyCode, "micros");
}

export function GoogleAdsMetricsSummaryBar({
  totals,
  currencyCode,
  isLoading,
  metricKeys,
  onMetricKeyChange,
  summaryMetricOptions,
}: Props) {
  const { t } = useTranslation();
  const slots = metricKeys.slice(0, SUMMARY_SLOT_COUNT);

  if (isLoading) {
    return (
      <div
        className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6"
        aria-busy="true"
        aria-label={t("digitalMarketing.googleAds.summaryLoading", "Loading summary metrics")}
      >
        {Array.from({ length: 1 + SUMMARY_SLOT_COUNT }, (_, i) => (
          <div
            key={i}
            className="rounded-md border border-gray-200 bg-white px-3 py-2"
          >
            <Skeleton className="mb-1.5 h-3 w-16" />
            <Skeleton className="h-5 w-24" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      <GoogleAdsSummaryFixedMetricCard
        label={t("digitalMarketing.googleAds.summaryCostFixed", "Cost")}
        value={costValue(totals, currencyCode)}
      />
      {slots.map((key, index) => (
        <GoogleAdsSummaryPrimaryMetricPicker
          key={index}
          selectedKey={key}
          onSelectKey={(nextKey) => onMetricKeyChange(index, nextKey)}
          options={summaryMetricOptions}
          totals={totals}
          currencyCode={currencyCode}
          isLoading={isLoading}
        />
      ))}
    </div>
  );
}
