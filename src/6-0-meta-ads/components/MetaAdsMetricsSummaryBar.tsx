import { useTranslation } from "react-i18next";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { GoogleAdsSummaryFixedMetricCard } from "@/6-0-google-ads/components/GoogleAdsSummaryFixedMetricCard";
import {
  computeSummaryCtr,
  formatMetaCtr,
  formatMetaMetricValue,
} from "@/meta-ads/metrics/formatMetaMetricValue";

type Summary = {
  spend: number;
  impressions: number;
  clicks: number;
  currency: string;
};

type Props = {
  summary: Summary | null | undefined;
  isLoading?: boolean;
};

export function MetaAdsMetricsSummaryBar({ summary, isLoading }: Props) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div
        className="grid grid-cols-2 gap-2 sm:grid-cols-4"
        aria-busy="true"
        aria-label={t("digitalMarketing.metaAds.summaryLoading", "Loading summary metrics")}
      >
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="rounded-md border border-gray-200 bg-white px-3 py-2">
            <Skeleton className="mb-1.5 h-3 w-16" />
            <Skeleton className="h-5 w-24" />
          </div>
        ))}
      </div>
    );
  }

  const currency = summary?.currency ?? "USD";
  const ctr = summary
    ? computeSummaryCtr(summary.clicks, summary.impressions)
    : null;

  return (
    <div className="space-y-1">
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <GoogleAdsSummaryFixedMetricCard
        label={t("digitalMarketing.metaAds.summaryCost", "Cost")}
        value={formatMetaMetricValue("spend", summary?.spend, currency)}
      />
      <GoogleAdsSummaryFixedMetricCard
        label={t("digitalMarketing.metaAds.impressions", "Impressions")}
        value={formatMetaMetricValue("impressions", summary?.impressions, currency)}
      />
      <GoogleAdsSummaryFixedMetricCard
        label={t("digitalMarketing.metaAds.clicks", "Clicks")}
        value={formatMetaMetricValue("clicks", summary?.clicks, currency)}
      />
      <GoogleAdsSummaryFixedMetricCard
        label={t("digitalMarketing.metaAds.ctr", "CTR")}
        value={formatMetaCtr(ctr, "computed")}
      />
    </div>
    <p className="text-[11px] text-muted-foreground">
      {t(
        "digitalMarketing.metaAds.summaryAccountLevelHint",
        "Summary totals sum active ad insights (same basis as Meta Ads Manager Ads tab footer).",
      )}
    </p>
    </div>
  );
}
