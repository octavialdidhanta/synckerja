import { HeaderAndTab } from "@/6-0-traffic/container/HeaderAndTab";
import { GoogleAdsDateRangePicker } from "@/6-0-google-ads/components/GoogleAdsDateRangePicker";
import { useDigitalMarketingPaidAdsFilters } from "@/6-0-digital-marketing-shared/DigitalMarketingPaidAdsFiltersContext";
import { useDigitalMarketingReportCosts } from "@/6-0-digital-marketing-shared/hooks/useDigitalMarketingReportCosts";
import { DigitalMarketingReportTable } from "@/6-0-report/components/DigitalMarketingReportTable";
import { DigitalMarketingReportMonthlySpendChart } from "@/6-0-report/components/DigitalMarketingReportMonthlySpendChart";
import { useGoogleAdsAccountDateBounds } from "@/google-ads/hooks/useGoogleAdsAccountDateBounds";
import { ModuleShellContentGate } from "@/shared/layouts/ModuleShellContentGate";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { cn } from "@/shared/lib/utils";
import { DigitalMarketingReportPageSkeleton } from "@/6-0-report/skeletons/DigitalMarketingReportPageSkeleton";
import type { ReportChannelCost } from "@/6-0-digital-marketing-shared/hooks/useDigitalMarketingReportCosts";

function channelHasNoMetrics(cost: ReportChannelCost): boolean {
  if (!cost.connected) return true;
  return (
    (cost.amount ?? 0) === 0 &&
    (cost.impressions ?? 0) === 0 &&
    (cost.clicks ?? 0) === 0
  );
}

export default function DigitalMarketingReportPage() {
  const { t } = useAppTranslation();
  const { organizationId } = useCurrentOrg();
  const { dateSelection, setDateSelection, filtersHydrated } =
    useDigitalMarketingPaidAdsFilters();
  const { googleCost, metaCost, pageLoading, effectiveGoogleCustomerId } =
    useDigitalMarketingReportCosts();

  const { data: accountDateBounds } = useGoogleAdsAccountDateBounds(
    organizationId,
    effectiveGoogleCustomerId,
    Boolean(organizationId && effectiveGoogleCustomerId),
  );

  if (pageLoading) {
    return <DigitalMarketingReportPageSkeleton />;
  }

  return (
    <div className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans">
      <ModuleShellContentGate pagePath="/digital-marketing/report">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col px-4 pb-2">
          <div className="flex h-full min-h-0 min-w-0 flex-col">
            <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex min-h-full min-w-0 flex-col">
                <div className="mb-1 min-w-0 shrink-0">
                  <HeaderAndTab />
                </div>

                <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch">
                  <div className="col-span-12 flex min-h-0 min-w-0 flex-col gap-2">
                    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h2 className="text-base font-semibold text-gray-900">
                            {t("digitalMarketing.report.title", "Report")}
                          </h2>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {t(
                              "digitalMarketing.report.subtitle",
                              "The table follows the date filter above. The chart shows monthly spend for the selected year within that date range.",
                            )}
                          </p>
                        </div>
                        {filtersHydrated ? (
                          <GoogleAdsDateRangePicker
                            value={dateSelection}
                            onChange={setDateSelection}
                            accountEarliestYmd={accountDateBounds?.earliest_date}
                          />
                        ) : (
                          <Skeleton className="h-9 w-40" />
                        )}
                      </div>
                    </div>

                    <DigitalMarketingReportTable
                      googleCost={googleCost}
                      metaCost={metaCost}
                    />

                    <DigitalMarketingReportMonthlySpendChart />

                    {!googleCost.loading &&
                    !metaCost.loading &&
                    (googleCost.connected || metaCost.connected) &&
                    channelHasNoMetrics(googleCost) &&
                    channelHasNoMetrics(metaCost) ? (
                      <p className="text-center text-sm text-muted-foreground">
                        {t("digitalMarketing.report.noSpendData", "No spend data for this period.")}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div
                  className={cn(
                    "h-2 flex-shrink-0 [@media(max-height:900px)]:h-3 [@media(max-height:760px)]:h-4",
                  )}
                  aria-hidden
                />
              </div>
            </div>
          </div>
        </div>
      </ModuleShellContentGate>
    </div>
  );
}
