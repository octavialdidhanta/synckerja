import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { SidebarTrigger } from '@/mobile/components/ui/sidebar';
import { Button } from '@/features/ui/button';
import { Download, Loader2, Filter, BarChart3, LineChart, User2, RefreshCw } from 'lucide-react';
import { useLeads } from '@/hooks/organized/sales';
import { useAvailableEmployees } from '@/features/share/hooks/useAvailableEmployees';
import { useCurrentOrg } from '@/features/share/hooks/useCurrentOrg';
import { useLeadClientStatuses } from '@/features/5-3-dashboard/useLeadClientStatuses';
import { LeadsInsights } from '@/features/5-3-dashboard/LeadsInsights';
import { generateLeadsPDF } from '@/features/5-3-dashboard/LeadsPDFGenerator';
import { useAppTranslation } from '@/features/share/i18n/useAppTranslation';
import type { LeadsFilters } from '@/features/5-3-dashboard/LeadsFilters';
import { LeadsReportSummarySkeleton } from './LeadsReportSummarySkeleton';
import { useIsMobile } from '@/mobile/hooks/use-mobile';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/mobile/components/ui/sheet';
import { Separator } from '@/mobile/components/ui/separator';
import { useToast } from '@/features/ui/use-toast';

const PULL_THRESHOLD = 52;
const MAX_PULL = 72;
const INDICATOR_HEIGHT = 56;
const PULL_RESISTANCE = 0.55;

const defaultFilters: LeadsFilters = {
  dataCompleteness: 'all',
  services: 'all',
  category: 'all',
  assignee: 'all',
  fuPriority: 'all',
  status: 'all',
  source: 'all',
  dateRange: null,
  search: '',
};

export function LeadsReportSummaryView() {
  const { t } = useAppTranslation();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { leads, loading, refetch } = useLeads({ scope: 'all' });
  const { data: employees = [] } = useAvailableEmployees();
  const { organizationId } = useCurrentOrg();
  const { clientStatuses, clientProfiles } = useLeadClientStatuses(leads);
  const [filters, setFilters] = useState<LeadsFilters>(defaultFilters);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('overview');

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const touchStartY = useRef(0);
  const pullDistanceRef = useRef(0);
  const listScrollRef = useRef<HTMLDivElement>(null);
  const didRecoveryRefetch = useRef(false);

  useEffect(() => {
    pullDistanceRef.current = pullDistance;
  }, [pullDistance]);

  // Recovery: if list still empty after load, refetch once
  useEffect(() => {
    if (didRecoveryRefetch.current || loading || leads.length > 0) return;
    didRecoveryRefetch.current = true;
    refetch().catch(() => {});
  }, [loading, leads.length, refetch]);

  const filteredLeads = useMemo(() => {
    let filtered = leads;
    if (filters.search && filters.search.trim()) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(
        (lead) =>
          (lead.client ?? '').toLowerCase().includes(searchLower) ||
          (lead.title ?? '').toLowerCase().includes(searchLower) ||
          lead.ticket_id?.toLowerCase().includes(searchLower)
      );
    }
    if (filters.dataCompleteness !== 'all') {
      filtered = filtered.filter((lead) => {
        const clientStatus = clientStatuses[lead.id] || 'empty';
        return clientStatus === filters.dataCompleteness;
      });
    }
    if (filters.services !== 'all' && filters.services) {
      filtered = filtered.filter((lead) => lead.services === filters.services);
    }
    if (filters.category !== 'all' && filters.category) {
      filtered = filtered.filter((lead) => lead.category === filters.category);
    }
    if (filters.assignee !== 'all' && filters.assignee) {
      filtered = filtered.filter((lead) => lead.assignee === filters.assignee);
    }
    if (filters.fuPriority !== 'all') {
      if (filters.fuPriority === 'Please Follow Up') {
        filtered = filtered.filter((lead) => lead.followup === 0);
      } else if (filters.fuPriority) {
        filtered = filtered.filter((lead) => lead.fu_priority === filters.fuPriority);
      }
    }
    if (filters.status !== 'all' && filters.status) {
      const statusNorm = (filters.status as string).trim().toLowerCase();
      filtered = filtered.filter(
        (lead) => (lead.lead_status?.name?.trim().toLowerCase() ?? '') === statusNorm
      );
    }
    if (filters.source !== 'all' && filters.source) {
      filtered = filtered.filter((lead) => lead.source === filters.source);
    }
    if (filters.dateRange?.from && filters.dateRange?.to) {
      const fromDate = new Date(filters.dateRange.from);
      const toDate = new Date(filters.dateRange.to);
      fromDate.setHours(0, 0, 0, 0);
      toDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter((lead) => {
        const leadDate = new Date(lead.created_at);
        return leadDate >= fromDate && leadDate <= toDate;
      });
    }
    return filtered;
  }, [leads, filters, clientStatuses]);

  const generatePDFReport = async () => {
    try {
      setIsGeneratingPDF(true);
      if (!filteredLeads.length) {
        return;
      }
      await generateLeadsPDF({
        leads: filteredLeads,
        filters,
        clientStatuses,
        clientProfiles,
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handlePullRefresh = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setPullDistance(0);
    try {
      await refetch();
    } catch {
      toast({
        title: t('leadsManagement.reportSummary.title', 'Report Summary'),
        description: t('common.pullToRefresh.failed', 'Gagal memuat ulang'),
        variant: 'destructive',
      });
    } finally {
      setIsRefreshing(false);
    }
  }, [refetch, isRefreshing, toast, t]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    const el = listScrollRef.current;
    if (el?.scrollTop <= 2) setIsPulling(true);
  }, []);

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      const el = listScrollRef.current;
      if (!el || isRefreshing) return;
      if (el.scrollTop > 2) {
        setIsPulling(false);
        setPullDistance(0);
        pullDistanceRef.current = 0;
        return;
      }
      const delta = e.touches[0].clientY - touchStartY.current;
      if (delta > 0) {
        const d = Math.min(delta * PULL_RESISTANCE, MAX_PULL);
        setPullDistance(d);
        pullDistanceRef.current = d;
      } else {
        setPullDistance(0);
        pullDistanceRef.current = 0;
      }
    },
    [isRefreshing]
  );

  const onTouchEnd = useCallback(() => {
    setIsPulling(false);
    const d = pullDistanceRef.current;
    setPullDistance(0);
    pullDistanceRef.current = 0;
    if (d >= PULL_THRESHOLD) handlePullRefresh();
  }, [handlePullRefresh]);

  if (loading && !isRefreshing) {
    return <LeadsReportSummarySkeleton />;
  }

  return (
    <>
      <header className="flex-shrink-0 sticky top-0 z-30 flex items-center justify-between p-3 bg-card border-b border-border safe-area-top">
        <div className="flex items-center gap-2 min-w-0">
          <SidebarTrigger className="md:hidden shrink-0" />
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-foreground truncate">
              {t('leadsManagement.reportSummary.title', 'Report Summary')}
            </h1>
            <p className="text-xs text-muted-foreground truncate">
              {t('leadsManagement.reportSummary.subtitle', 'Data summary based on filters')}
            </p>
          </div>
        </div>
        {isMobile ? (
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 h-9 w-9"
            onClick={() => setFilterDrawerOpen(true)}
            aria-label={t('leadsManagement.reportSummary.filter', 'Filter')}
          >
            <Filter className="h-5 w-5 text-foreground" aria-hidden />
          </Button>
        ) : (
          <Button
            onClick={generatePDFReport}
            disabled={isGeneratingPDF || !filteredLeads.length}
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 text-white shrink-0 disabled:opacity-50 text-xs gap-1.5"
          >
            {isGeneratingPDF ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
            ) : (
              <Download className="h-4 w-4 shrink-0" aria-hidden />
            )}
            <span>
              {isGeneratingPDF
                ? t('leadsManagement.reportSummary.generating', 'Generating...')
                : t('leadsManagement.reportSummary.downloadPdf', 'Download PDF')}
            </span>
          </Button>
        )}
      </header>

      {isMobile && (
        <Sheet open={filterDrawerOpen} onOpenChange={setFilterDrawerOpen}>
          <SheetContent
            side="bottom"
            className="max-h-[85vh] p-0 gap-0 flex flex-col rounded-t-2xl [&>button]:hidden"
            underSafeArea
          >
            {/* Handle bar untuk bottom sheet */}
            <div className="flex justify-center pt-2 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" aria-hidden />
            </div>
            <SheetHeader className="flex flex-col gap-0 bg-primary text-primary-foreground px-4 py-3 shrink-0">
              <SheetTitle className="text-base font-semibold text-center text-primary-foreground">
                {t('leadsManagement.reportSummary.title', 'Report Summary')}
              </SheetTitle>
            </SheetHeader>
            <Separator className="bg-primary/20 shrink-0" />
            <div className="overflow-y-auto flex flex-col bg-background min-h-0 safe-area-bottom">
              <div className="px-3 py-3 space-y-0.5">
                {[
                  { id: 'overview', label: 'Overview', icon: BarChart3 },
                  { id: 'source-performance', label: 'Source Performance', icon: LineChart },
                  { id: 'consultant-performance', label: 'Consultant Performance', icon: User2 },
                ].map((item) => {
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setActiveTab(item.id);
                      }}
                      className={[
                        'flex items-center gap-3 px-3 py-2.5 rounded-lg w-full min-w-0 transition-colors text-left',
                        isActive ? 'text-primary font-medium bg-primary/10' : 'text-foreground hover:bg-primary/10',
                      ].join(' ')}
                    >
                      <item.icon className="h-4 w-4 flex-shrink-0" />
                      <span className="font-medium truncate min-w-0 flex-1">{item.label}</span>
                      <span
                        className={`flex-shrink-0 flex items-center justify-center rounded-full p-1 transition-colors ${
                          isActive ? 'bg-primary/10 ring-1 ring-primary/20' : 'bg-muted/40 ring-1 ring-border/50'
                        }`}
                        aria-hidden
                      >
                        <span
                          className={`w-2.5 h-2.5 rounded-full border-2 transition-colors ${
                            isActive ? 'bg-primary border-primary shadow-sm' : 'bg-transparent border-muted-foreground/30'
                          }`}
                        />
                      </span>
                    </button>
                  );
                })}
              </div>
              <Separator className="bg-border" />
              <div className="p-3">
                <Button
                  onClick={() => {
                    generatePDFReport();
                    setFilterDrawerOpen(false);
                  }}
                  disabled={isGeneratingPDF || !filteredLeads.length}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white gap-2"
                >
                  {isGeneratingPDF ? (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                  ) : (
                    <Download className="h-4 w-4 shrink-0" aria-hidden />
                  )}
                  <span>
                    {isGeneratingPDF
                      ? t('leadsManagement.reportSummary.generating', 'Generating...')
                      : t('leadsManagement.reportSummary.downloadPdf', 'Download PDF')}
                  </span>
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      )}

      <div className="flex-1 min-h-0 overflow-hidden flex flex-col min-w-0">
        <div
          ref={listScrollRef}
          className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 flex flex-col overscroll-contain seamless-scroll nested-scroll-touch-chain touch-pan-y"
          style={{ overscrollBehavior: 'contain' }}
          {...(isMobile ? { onTouchStart: onTouchStart, onTouchMove: onTouchMove, onTouchEnd: onTouchEnd } : {})}
        >
          {isMobile && (
            <div
              className="shrink-0 overflow-hidden flex items-center justify-center text-muted-foreground text-sm bg-background"
              style={{
                height: pullDistance > 0 ? Math.min(pullDistance, MAX_PULL) : isRefreshing ? INDICATOR_HEIGHT : 0,
                minHeight: 0,
                transition: isPulling ? 'none' : 'height 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
              }}
            >
              {isRefreshing ? (
                <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden />
              ) : pullDistance >= PULL_THRESHOLD ? (
                <span className="text-primary text-xs font-medium">
                  {t('common.pullToRefresh.release', 'Lepas untuk refresh')}
                </span>
              ) : (
                <RefreshCw
                  className="h-5 w-5 transition-transform duration-200"
                  style={{
                    transform: `rotate(${Math.min((pullDistance / PULL_THRESHOLD) * 180, 180)}deg)`,
                    transition: isPulling ? 'none' : 'transform 0.2s ease-out',
                  }}
                  aria-hidden
                />
              )}
            </div>
          )}
          <div className="mx-auto w-full max-w-md px-2 pt-1 content-padding-above-nav-leads-management space-y-1 min-w-0 flex-1">
            <LeadsInsights
              leads={filteredLeads}
              filters={filters}
              clientStatuses={clientStatuses}
              clientProfiles={clientProfiles}
              allEmployees={employees}
              organizationId={organizationId ?? undefined}
              denserSections={true}
              {...(isMobile ? { activeTab, onActiveTabChange: setActiveTab, hideTabDropdown: true } : {})}
            />
          </div>
        </div>
      </div>
    </>
  );
}
