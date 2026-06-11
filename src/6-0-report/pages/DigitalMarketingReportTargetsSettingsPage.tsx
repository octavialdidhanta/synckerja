import { ArrowLeft } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import { HeaderAndTab } from "@/6-0-traffic/container/HeaderAndTab";
import { DmReportTargetsSettingsForm } from "@/6-0-report/components/DmReportTargetsSettingsForm";
import { DigitalMarketingReportTargetsSettingsPageSkeleton } from "@/6-0-report/skeletons/DigitalMarketingReportTargetsSettingsPageSkeleton";
import {
  DIGITAL_MARKETING_REPORT_PATH,
  DM_REPORT_TARGETS_PATH,
} from "@/6-0-digital-marketing-shared/dmReportTargetPaths";
import type { DmReportTargetPeriodKey } from "@/6-0-digital-marketing-shared/dmReportTargetTypes";
import { useOmnichannelSurveySettingsAdmin } from "@/features/customer-survey/hooks/useOmnichannelSurveySettingsAdmin";
import { useOrgBootstrapPending } from "@/shared/auth/hooks/useOrgBootstrapPending";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
import { Button } from "@/shared/components/ui/button";
import { ModuleShellContentGate } from "@/shared/layouts/ModuleShellContentGate";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

export default function DigitalMarketingReportTargetsSettingsPage() {
  const { orgBootstrapPending } = useOrgBootstrapPending();
  if (orgBootstrapPending) return <DigitalMarketingReportTargetsSettingsPageSkeleton />;
  return (
    <ModuleShellContentGate pagePath={DIGITAL_MARKETING_REPORT_PATH}>
      <DigitalMarketingReportTargetsSettingsPageGate />
    </ModuleShellContentGate>
  );
}

function DigitalMarketingReportTargetsSettingsPageGate() {
  const { t } = useTranslation();
  const { canManage, gatePending } = useOmnichannelSurveySettingsAdmin();

  if (gatePending) return <DigitalMarketingReportTargetsSettingsPageSkeleton />;
  if (!canManage) {
    return (
      <div className="flex h-full min-h-0 flex-1 flex-col bg-gray-100 p-4">
        <HeaderAndTab />
        <Alert className="mt-4 max-w-lg">
          <AlertTitle>
            {t("digitalMarketing.report.accessDeniedTitle", "Access restricted")}
          </AlertTitle>
          <AlertDescription>
            {t(
              "digitalMarketing.report.accessDeniedBody",
              "Only organization owners or omnichannel admins can manage paid ads KPI targets.",
            )}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return <DigitalMarketingReportTargetsSettingsPageRoot />;
}

function DigitalMarketingReportTargetsSettingsPageRoot() {
  const { t } = useAppTranslation();
  const [searchParams] = useSearchParams();

  const initialPeriod = useMemo((): Partial<DmReportTargetPeriodKey> | undefined => {
    const periodType = searchParams.get("periodType");
    const year = searchParams.get("year");
    const month = searchParams.get("month");
    const quarter = searchParams.get("quarter");
    if (periodType !== "monthly" && periodType !== "quarterly") return undefined;
    const parsed: Partial<DmReportTargetPeriodKey> = { periodType };
    if (year) parsed.year = Number(year);
    if (periodType === "monthly" && month) parsed.month = Number(month);
    if (periodType === "quarterly" && quarter) parsed.quarter = Number(quarter);
    return parsed;
  }, [searchParams]);

  return (
    <div className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col px-4 pb-2">
        <div className="flex h-full min-h-0 min-w-0 flex-col">
          <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex min-h-full min-w-0 flex-col">
              <div className="mb-1 min-w-0 shrink-0">
                <HeaderAndTab />
              </div>

              <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2">
                <div className="col-span-12">
                  <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h2 className="text-base font-semibold text-gray-900">
                          {t(
                            "digitalMarketing.dmReportTargets.title",
                            "Digital Marketing KPI targets",
                          )}
                        </h2>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {t(
                            "digitalMarketing.dmReportTargets.subtitle",
                            "Set monthly or quarterly targets per paid ads account (Google, Meta, TikTok) for the Digital Marketing Report.",
                          )}
                        </p>
                      </div>
                      <Button variant="outline" size="sm" asChild>
                        <Link to={DIGITAL_MARKETING_REPORT_PATH}>
                          <ArrowLeft className="mr-2 h-4 w-4" />
                          {t("digitalMarketing.dmReportTargets.backToReport", "Back to report")}
                        </Link>
                      </Button>
                    </div>
                    <DmReportTargetsSettingsForm initialPeriod={initialPeriod} />
                  </div>
                </div>
              </div>

              <div
                className="h-2 flex-shrink-0 [@media(max-height:900px)]:h-3 [@media(max-height:760px)]:h-4"
                aria-hidden
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export { DM_REPORT_TARGETS_PATH };
