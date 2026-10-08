import { ArrowLeft } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import { SOCIAL_MEDIA_PERFORMANCE_REPORT_PATH } from "@/6-0-social-media-performance/container/SocialMediaPerformanceHeaderAndTab";
import { SocialMediaPerformanceModuleShell } from "@/6-0-social-media-performance/layout/SocialMediaPerformanceModuleShell";
import { InsightTargetsSettingsForm } from "@/6-0-social-media-report/components/InsightTargetsSettingsForm";
import { SocialMediaInsightTargetsSettingsPageSkeleton } from "@/6-0-social-media-report/skeletons/SocialMediaInsightTargetsSettingsPageSkeleton";
import { SOCIAL_MEDIA_INSIGHT_TARGETS_PATH } from "@/6-0-social-media-performance-shared/socialMediaInsightPaths";
import type { InsightTargetPeriodKey } from "@/6-0-social-media-performance-shared/socialMediaInsightTargetTypes";
import { useOmnichannelSurveySettingsAdmin } from "@/features/customer-survey/hooks/useOmnichannelSurveySettingsAdmin";
import { useOrgBootstrapPending } from "@/shared/auth/hooks/useOrgBootstrapPending";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
import { Button } from "@/shared/components/ui/button";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

export default function SocialMediaInsightTargetsSettingsPage() {
  const { orgBootstrapPending } = useOrgBootstrapPending();
  if (orgBootstrapPending) return <SocialMediaInsightTargetsSettingsPageSkeleton />;
  return (
    <SocialMediaPerformanceModuleShell activeReportPath={SOCIAL_MEDIA_PERFORMANCE_REPORT_PATH}>
      <SocialMediaInsightTargetsSettingsPageGate />
    </SocialMediaPerformanceModuleShell>
  );
}

function SocialMediaInsightTargetsSettingsPageGate() {
  const { t } = useTranslation();
  const { canManage, gatePending } = useOmnichannelSurveySettingsAdmin();

  if (gatePending) return null;
  if (!canManage) {
    return (
      <div className="flex flex-1 items-center justify-center rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <Alert className="max-w-lg">
          <AlertTitle>
            {t("digitalMarketing.tiktokContent.accessDeniedTitle", "Access restricted")}
          </AlertTitle>
          <AlertDescription>
            {t(
              "digitalMarketing.tiktokContent.accessDeniedBody",
              "Only organization owners or omnichannel admins can view organic social content insights.",
            )}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return <SocialMediaInsightTargetsSettingsPageRoot />;
}

function SocialMediaInsightTargetsSettingsPageRoot() {
  const { t } = useAppTranslation();
  const [searchParams] = useSearchParams();

  const initialPeriod = useMemo((): Partial<InsightTargetPeriodKey> | undefined => {
    const periodType = searchParams.get("periodType");
    const year = searchParams.get("year");
    const month = searchParams.get("month");
    const quarter = searchParams.get("quarter");
    if (periodType !== "monthly" && periodType !== "quarterly") return undefined;
    const parsed: Partial<InsightTargetPeriodKey> = { periodType };
    if (year) parsed.year = Number(year);
    if (periodType === "monthly" && month) parsed.month = Number(month);
    if (periodType === "quarterly" && quarter) parsed.quarter = Number(quarter);
    return parsed;
  }, [searchParams]);

  return (
    <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2">
      <div className="col-span-12">
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <InsightTargetsSettingsForm
            initialPeriod={initialPeriod}
            headerEnd={
              <Button variant="outline" size="icon" className="h-9 w-9" asChild>
                <Link
                  to={SOCIAL_MEDIA_PERFORMANCE_REPORT_PATH}
                  aria-label={t(
                    "digitalMarketing.socialMediaInsightTargets.backToReport",
                    "Back to report",
                  )}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
            }
          />
        </div>
      </div>
    </div>
  );
}
