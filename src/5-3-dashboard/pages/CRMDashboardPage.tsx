import React from "react";
import { HeaderAndTab } from "@/5-3-dashboard/components/layout/HeaderAndTab";
import { CRMDashboardContent } from "@/5-3-dashboard/components/crm/CRMDashboardContent";
import { CrmConversationSummaryPanel } from "@/5-3-dashboard/components/crm/CrmConversationSummaryPanel";
import { CrmPerformancePerTimeSection } from "@/5-3-dashboard/components/crm/CrmPerformancePerTimeSection";
import { CrmFirstResponsePerRoomSection } from "@/5-3-dashboard/components/crm/CrmFirstResponsePerRoomSection";
import { CrmResolutionPerRoomSection } from "@/5-3-dashboard/components/crm/CrmResolutionPerRoomSection";
import { CrmCustomerSurveySection } from "@/5-3-dashboard/components/crm/CrmCustomerSurveySection";
import { ConsultantCrmDashboardPageSkeleton } from "@/5-3-dashboard/skeletons/ConsultantCrmDashboardPageSkeleton";
import { useOrgBootstrapPending } from "@/shared/auth/hooks/useOrgBootstrapPending";
import { useModulePageOverlaySkeleton } from "@/shared/auth/page-access/useModulePageOverlaySkeleton";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useLeads } from "@/shared/hooks/organized/sales";
import { useCrmFirstResponsePerRoom } from "@/5-3-dashboard/hooks/useCrmFirstResponsePerRoom";
import { useDebouncedReady } from "@/shared/hooks/useDebouncedReady";
import { cn } from "@/shared/lib/utils";
import { useLocation } from "react-router-dom";
import { ModuleShellContentGate } from "@/shared/layouts/ModuleShellContentGate";

const CRM_PAGE_PATH = "/omnichannel/crm";

/**
 * `/omnichannel/crm` — Seamless Page Scroll Layout (see `.cursor/rules/Seamless Page Scroll Layout.mdc`).
 * Parent `AppShellLayout` already scrolls: root uses `h-full min-h-0 flex-1 overflow-hidden` (not `h-screen`).
 * HeaderAndTab lives inside the main scroll container so it scrolls with content; `scrollbar-hide` + hard-hide fallbacks on that container.
 *
 * Single layout-matched skeleton overlay (Loading Skeleton rule): covers header, tabs, and content until org + leads + CRM SLA RPC are ready.
 *
 * Leads: one `useLeads({ scope: 'all' })` at page level — dashboard + ringkasan share data and a single realtime subscription.
 */
export const CRMDashboardPage = () => {
  const location = useLocation();
  const { t } = useAppTranslation();
  const { orgBootstrapPending, organizationId } = useOrgBootstrapPending();
  const { leads, initialLoadPending: leadsPending } = useLeads({ scope: "all" });
  const {
    isPending: crmRpcPending,
    isFetching: crmFetching,
    dataUpdatedAt: crmDataUpdatedAt,
  } = useCrmFirstResponsePerRoom(organizationId);

  const crmInitialPending =
    !!organizationId && (crmRpcPending || (crmFetching && crmDataUpdatedAt === 0));

  const dataPending =
    orgBootstrapPending || (!!organizationId && (leadsPending || crmInitialPending));

  const { showFullPageSkeleton, accessReady } = useModulePageOverlaySkeleton(
    dataPending,
    CRM_PAGE_PATH,
  );
  const showContent = useDebouncedReady(accessReady && !showFullPageSkeleton, 200);

  return (
    <div className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-surface-muted font-sans">
      <div
        className={cn(
          "flex min-h-0 min-w-0 flex-1 flex-col pl-2 pr-4 pb-1 sm:pl-3",
          !showContent && "invisible pointer-events-none",
        )}
        aria-hidden={!showContent}
      >
        <div className="flex h-full min-h-0 min-w-0 w-full flex-col">
          <div className="scrollbar-hide nested-scroll-touch-chain flex h-full min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex min-h-full min-h-0 min-w-0 flex-1 flex-col">
              <div className="mb-1 min-w-0 shrink-0">
                <HeaderAndTab />
              </div>

              <ModuleShellContentGate pagePath={location.pathname}>
              <div className="grid min-h-0 min-w-0 w-full flex-1 grid-cols-1 gap-2 xl:grid-cols-2">
                <div
                  className={cn(
                    'box-border flex min-h-0 w-full max-h-[calc(100dvh-11rem)] flex-col overflow-hidden rounded-lg border border-surface-border bg-card shadow-sm',
                    'xl:h-full xl:max-h-none',
                    'xl:max-w-none',
                  )}
                >
                  <div
                    className={cn(
                      'scrollbar-hide nested-scroll-touch-chain min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-4',
                      '[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
                    )}
                  >
                    <CRMDashboardContent leads={leads} />
                  </div>
                  <footer
                    className="shrink-0 border-t border-border bg-muted/30 px-4 py-2.5 text-center text-[11px] leading-snug text-muted-foreground sm:text-xs"
                    aria-label={t('crm.dashboard.leftPanelFooterAria', 'Lead metrics panel footer')}
                  >
                    <p className="font-medium text-foreground/80">
                      {t('crm.dashboard.leftPanelFooterTitle', 'Ringkasan lead')}
                    </p>
                    <p className="mt-0.5">
                      {t(
                        'crm.dashboard.leftPanelFooterBody',
                        'Mencakup seluruh lead aktif organisasi. Gulir ke atas untuk kartu dan wawasan.',
                      )}
                    </p>
                  </footer>
                </div>
                <div
                  className={cn(
                    'box-border flex min-h-0 w-full max-h-[calc(100dvh-11rem)] flex-col overflow-hidden rounded-lg border border-surface-border bg-card shadow-sm',
                    'xl:h-full xl:max-h-none',
                    'xl:max-w-none',
                  )}
                >
                  <div
                    className={cn(
                      'scrollbar-hide nested-scroll-touch-chain min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-4',
                      '[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
                    )}
                  >
                    <div className="flex min-h-0 w-full flex-col gap-2">
                      <div className="w-full min-w-0 shrink-0">
                        <div className="w-full min-h-0 min-w-0 xl:sticky xl:top-2">
                          <CrmConversationSummaryPanel leads={leads} />
                        </div>
                      </div>
                      <div className="min-h-0 min-w-0 w-full flex-1">
                        <div className="w-full min-h-0 min-w-0">
                          <CrmPerformancePerTimeSection />
                        </div>
                      </div>
                      <div className="min-h-0 min-w-0 w-full flex-1">
                        <CrmFirstResponsePerRoomSection />
                      </div>
                      <div className="min-h-0 min-w-0 w-full flex-1">
                        <CrmResolutionPerRoomSection />
                      </div>
                      <div className="min-h-0 min-w-0 w-full flex-1">
                        <CrmCustomerSurveySection />
                      </div>
                    </div>
                  </div>
                  <footer
                    className="shrink-0 border-t border-border bg-muted/30 px-4 py-2.5 text-center text-[11px] leading-snug text-muted-foreground sm:text-xs"
                    aria-label={t(
                      'crm.dashboard.rightPanelFooterAria',
                      'Conversation and SLA metrics panel footer',
                    )}
                  >
                    <p className="font-medium text-foreground/80">
                      {t('crm.dashboard.rightPanelFooterTitle', 'Percakapan & SLA')}
                    </p>
                    <p className="mt-0.5">
                      {t(
                        'crm.dashboard.rightPanelFooterBody',
                        'Ringkasan channel, metrik waktu respons, dan tabel per Room ID. Data dapat berubah real-time.',
                      )}
                    </p>
                  </footer>
                </div>
              </div>
              </ModuleShellContentGate>
            </div>
          </div>
        </div>
      </div>

      {!showContent ? (
        <div className="absolute inset-0 z-10 min-h-0 min-w-0 overflow-hidden bg-surface-muted">
          <ConsultantCrmDashboardPageSkeleton />
        </div>
      ) : null}
    </div>
  );
};
