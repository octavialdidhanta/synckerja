import { useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useSocialMediaInsightReportDataContext } from "@/6-0-social-media-performance-shared/SocialMediaInsightReportDataContext";
import { SocialMediaInsightReportChartsSkeleton } from "@/6-0-social-media-report/skeletons/SocialMediaInsightReportChartsSkeleton";
import { SocialMediaInsightReportPlatformBarChart } from "@/6-0-social-media-report/components/SocialMediaInsightReportPlatformBarChart";
import { SocialMediaInsightReportStackedBarChart } from "@/6-0-social-media-report/components/SocialMediaInsightReportStackedBarChart";

type ChartTab = "views" | "content" | "engagement" | "views_by_platform";

type Props = {
  bootstrapLoading?: boolean;
  chartPhaseLoading?: boolean;
};

export function SocialMediaInsightReportMonthlyChartsSection({
  bootstrapLoading,
  chartPhaseLoading = false,
}: Props) {
  const { t } = useAppTranslation();
  const [chartTab, setChartTab] = useState<ChartTab>("views");
  const { monthlyViews, monthlyContent, monthlyEngagement, viewsByPlatform } =
    useSocialMediaInsightReportDataContext();

  const showSkeleton = bootstrapLoading || chartPhaseLoading;

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-900">
          {t("digitalMarketing.socialMediaInsightReport.chartsTitle", "Monthly trends")}
        </h3>
        <Tabs value={chartTab} onValueChange={(v) => setChartTab(v as ChartTab)}>
          <TabsList className="h-9 flex-wrap">
            <TabsTrigger value="views" className="text-xs">
              {t("digitalMarketing.socialMediaInsightReport.chartTabViews", "Views")}
            </TabsTrigger>
            <TabsTrigger value="content" className="text-xs">
              {t("digitalMarketing.socialMediaInsightReport.chartTabContent", "Content")}
            </TabsTrigger>
            <TabsTrigger value="engagement" className="text-xs">
              {t("digitalMarketing.socialMediaInsightReport.chartTabEngagement", "Engagement")}
            </TabsTrigger>
            <TabsTrigger value="views_by_platform" className="text-xs">
              {t("digitalMarketing.socialMediaInsightReport.chartTabViewsByPlatform", "Views by platform")}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {showSkeleton ? (
        <SocialMediaInsightReportChartsSkeleton />
      ) : chartTab === "views" ? (
        <SocialMediaInsightReportStackedBarChart data={monthlyViews} />
      ) : chartTab === "content" ? (
        <SocialMediaInsightReportStackedBarChart data={monthlyContent} />
      ) : chartTab === "engagement" ? (
        <SocialMediaInsightReportStackedBarChart
          data={monthlyEngagement}
          valueSuffix="%"
          formatValue={(n) => n.toFixed(2)}
        />
      ) : (
        <SocialMediaInsightReportPlatformBarChart data={viewsByPlatform} />
      )}
    </div>
  );
}
