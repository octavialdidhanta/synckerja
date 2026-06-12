import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Filter, RefreshCw, Loader2 } from 'lucide-react';
import { SidebarTrigger } from '@/mobile-app/components/ui/sidebar';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/mobile-app/components/ui/drawer';
import { Button } from '@/shared/components/ui/button';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { SubscriptionExpiryBannerSlot } from '@/10-subscription/shared/SubscriptionExpiryBannerSlot';
import { useLeads } from '@/shared/hooks/organized/sales';
import { LeadsFilters } from '@/5-3-dashboard/components/leads/filters/LeadsFilters';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { useToast } from '@/shared/components/ui/use-toast';
import { cn } from '@/shared/lib/utils';
import { MobileConsultantLeadsFullViewportOverlay } from '../pages/MobileConsultantLeadsManagementViewportSkeleton';
import { MobileLeadsFilterDrawer } from './MobileLeadsFilterDrawer';
import { LeadsCardList } from './LeadsCardList';
import { ViewLeadDialogMobile } from './components/ViewLeadDialogMobile';
import { NewLead } from '@/types/leads';

const PULL_THRESHOLD = 52;
const MAX_PULL = 72;
const INDICATOR_HEIGHT = 56;
const PULL_RESISTANCE = 0.55;
const SKELETON_MIN_MS = 280;

const defaultFilters: LeadsFilters = {
  dataCompleteness: 'all',
  services: 'all',
  category: 'all',
  createdBy: 'all',
  assignee: 'all',
  fuPriority: 'all',
  status: 'all',
  source: 'all',
  dateRange: null,
  search: '',
  utmSource: 'all',
  utmMedium: 'all',
  utmCampaign: 'all',
  utmContent: 'all',
  utmTerm: 'all',
  attributionLabel: 'all',
  landingUrlContains: '',
};

function hasActiveFilters(f: LeadsFilters): boolean {
  return (
    f.source !== 'all' ||
    f.createdBy !== 'all' ||
    f.services !== 'all' ||
    f.assignee !== 'all' ||
    f.status !== 'all' ||
    f.utmSource !== 'all' ||
    f.utmMedium !== 'all' ||
    f.utmCampaign !== 'all' ||
    f.utmContent !== 'all' ||
    f.utmTerm !== 'all' ||
    f.attributionLabel !== 'all' ||
    (f.landingUrlContains ?? '').trim() !== '' ||
    (f.dateRange != null && (f.dateRange.from != null || f.dateRange.to != null))
  );
}

export function LeadsManagementLayout() {
  const { t } = useAppTranslation();
  const { toast } = useToast();
  const { loading: orgLoading } = useCurrentOrg();
  const { leads, initialLoadPending, refetch, updateLead, deleteLead } = useLeads({ scope: 'all' });
  const dataPending = orgLoading || initialLoadPending;
  const [filters, setFilters] = useState<LeadsFilters>(defaultFilters);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const [selectedLead, setSelectedLead] = useState<NewLead | null>(null);
  const touchStartY = useRef(0);
  const pullDistanceRef = useRef(0);
  const didRecoveryRefetch = useRef(false);
  const listScrollRef = useRef<HTMLDivElement>(null);
  const [minSettleDone, setMinSettleDone] = useState(true);
  const skeletonShownAtRef = useRef<number | null>(null);
  const prevLoading = useRef(false);

  useEffect(() => {
    pullDistanceRef.current = pullDistance;
  }, [pullDistance]);

  useEffect(() => {
    const pending = dataPending;
    const wasPending = prevLoading.current;
    prevLoading.current = pending;

    if (pending) {
      if (skeletonShownAtRef.current == null) skeletonShownAtRef.current = Date.now();
      setMinSettleDone(false);
      return;
    }

    if (wasPending && skeletonShownAtRef.current != null) {
      const elapsed = Date.now() - skeletonShownAtRef.current;
      const remaining = Math.max(0, SKELETON_MIN_MS - elapsed);
      const tId = window.setTimeout(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              setMinSettleDone(true);
              skeletonShownAtRef.current = null;
            });
          });
        });
      }, remaining);
      return () => window.clearTimeout(tId);
    }

    skeletonShownAtRef.current = null;
    setMinSettleDone(true);
  }, [dataPending]);

  const showPageSkeleton = (dataPending || !minSettleDone) && !isRefreshing;

  const filteredLeads = useMemo(() => {
    let filtered = leads;
    if (filters.services !== 'all' && filters.services) {
      filtered = filtered.filter((lead) => lead.services === filters.services);
    }
    if (filters.assignee !== 'all' && filters.assignee) {
      filtered = filtered.filter((lead) => lead.assignee === filters.assignee);
    }
    if (filters.createdBy !== 'all' && filters.createdBy) {
      filtered = filtered.filter(
        (lead) => (lead.created_by_name ?? '').trim() === filters.createdBy,
      );
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
    if (filters.utmSource !== 'all' && filters.utmSource) {
      filtered = filtered.filter((lead) => (lead.utm_source ?? '') === filters.utmSource);
    }
    if (filters.utmMedium !== 'all' && filters.utmMedium) {
      filtered = filtered.filter((lead) => (lead.utm_medium ?? '') === filters.utmMedium);
    }
    if (filters.utmCampaign !== 'all' && filters.utmCampaign) {
      filtered = filtered.filter((lead) => (lead.utm_campaign ?? '') === filters.utmCampaign);
    }
    if (filters.utmContent !== 'all' && filters.utmContent) {
      filtered = filtered.filter((lead) => (lead.utm_content ?? '') === filters.utmContent);
    }
    if (filters.utmTerm !== 'all' && filters.utmTerm) {
      filtered = filtered.filter((lead) => (lead.utm_term ?? '') === filters.utmTerm);
    }
    if (filters.attributionLabel !== 'all' && filters.attributionLabel) {
      filtered = filtered.filter((lead) => (lead.attribution_label ?? '') === filters.attributionLabel);
    }
    const landingQ = (filters.landingUrlContains ?? '').trim().toLowerCase();
    if (landingQ) {
      filtered = filtered.filter((lead) => (lead.landing_url ?? '').toLowerCase().includes(landingQ));
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
  }, [leads, filters]);

  const activeFilters = hasActiveFilters(filters);

  useEffect(() => {
    if (didRecoveryRefetch.current || dataPending || leads.length > 0) return;
    didRecoveryRefetch.current = true;
    refetch().catch(() => {});
  }, [dataPending, leads.length, refetch]);

  useEffect(() => {
    if (listScrollRef.current) {
      listScrollRef.current.scrollTop = 0;
    }
  }, [
    filters.dateRange,
    filters.source,
    filters.createdBy,
    filters.services,
    filters.assignee,
    filters.status,
    filters.utmSource,
    filters.utmMedium,
    filters.utmCampaign,
    filters.utmContent,
    filters.utmTerm,
    filters.attributionLabel,
    filters.landingUrlContains,
  ]);

  const handleRefresh = useCallback(async () => {
    setFilters(defaultFilters);
    try {
      await refetch();
    } catch {
      toast({
        title: t('leadsManagement.refreshError', 'Refresh failed'),
        description: t('leadsManagement.refreshErrorDesc', 'Failed to refresh leads'),
        variant: 'destructive',
      });
    }
  }, [refetch, toast, t]);

  const handlePullRefresh = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setPullDistance(0);
    try {
      await refetch();
    } catch {
      toast({
        title: t('leadsManagement.refreshError', 'Refresh failed'),
        description: t('leadsManagement.refreshErrorDesc', 'Failed to refresh leads'),
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
      const y = e.touches[0].clientY;
      const delta = y - touchStartY.current;
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
    if (d >= PULL_THRESHOLD) {
      handlePullRefresh();
    }
  }, [handlePullRefresh]);

  return (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
      <div
        className={cn(
          'flex min-h-0 min-w-0 flex-1 flex-col',
          showPageSkeleton && 'pointer-events-none invisible select-none',
        )}
        aria-hidden={showPageSkeleton}
      >
      <header className="flex-shrink-0 sticky top-0 z-30 flex items-center justify-between p-3 bg-card border-b border-border safe-area-top">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="md:hidden" />
          <div>
            <h1 className="text-base font-semibold text-foreground">
              {t('leadsManagement.page.title', 'Leads')}
            </h1>
            <p className="text-xs text-muted-foreground">
              {t('leadsManagement.page.subtitle', 'Manage leads and consultant activities')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {activeFilters && (
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={handleRefresh}
              title={t('leadsManagement.clearFilters', 'Clear filters')}
              aria-label={t('dailyTask.filters.refresh', 'Refresh')}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          )}
          <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
            <DrawerTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 relative"
                aria-label={t('dailyTask.filters.filter', 'Filter')}
              >
                <Filter className="h-4 w-4" />
                {activeFilters && (
                  <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-primary" aria-hidden />
                )}
              </Button>
            </DrawerTrigger>
            <DrawerContent className="max-h-[85dvh] flex flex-col">
              <DrawerHeader className="text-left pb-2 safe-area-top">
                <DrawerTitle>{t('dailyTask.filters.filter', 'Filter')}</DrawerTitle>
              </DrawerHeader>
              <div className="overflow-y-auto overflow-x-hidden flex-1 min-h-0 px-0">
                <MobileLeadsFilterDrawer
                  filters={filters}
                  onFiltersChange={setFilters}
                  onAfterDateSelect={() => setDrawerOpen(false)}
                  leadsForAttributionOptions={leads}
                />
              </div>
            </DrawerContent>
          </Drawer>
        </div>
      </header>

      <SubscriptionExpiryBannerSlot />

      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        <div
          ref={listScrollRef}
          className="flex-1 overflow-y-auto overflow-x-hidden seamless-scroll min-h-0 flex flex-col"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <div
            className="shrink-0 overflow-hidden flex items-center justify-center text-muted-foreground text-sm"
            style={{
              height:
                pullDistance > 0 ? Math.min(pullDistance, MAX_PULL) : isRefreshing ? INDICATOR_HEIGHT : 0,
              minHeight: 0,
              transition: isPulling
                ? 'none'
                : 'height 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94), min-height 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
            }}
          >
            {isRefreshing ? (
              <Loader2 className="h-5 w-5 animate-spin text-primary shrink-0" aria-hidden />
            ) : pullDistance >= PULL_THRESHOLD ? (
              <span className="text-xs font-medium text-primary whitespace-nowrap">
                {t('common.pullToRefresh.release', 'Lepas untuk refresh')}
              </span>
            ) : (
              <RefreshCw
                className="h-5 w-5 opacity-80 shrink-0"
                style={{
                  transform: `rotate(${Math.min((pullDistance / PULL_THRESHOLD) * 180, 180)}deg)`,
                  transition: isPulling ? 'none' : 'transform 0.2s ease-out',
                }}
                aria-hidden
              />
            )}
          </div>
          <div className="mx-auto w-full max-w-md px-2 pt-2 content-padding-above-nav-leads-management space-y-1">
            <LeadsCardList
              leads={filteredLeads}
              onLeadPress={setSelectedLead}
              onUpdateLead={updateLead}
              onDeleteLead={deleteLead}
            />
          </div>
        </div>
      </div>

      <ViewLeadDialogMobile
        open={selectedLead != null}
        onClose={() => setSelectedLead(null)}
        lead={selectedLead}
        onUpdateLead={async (updated) => {
          try {
            await updateLead(updated);
            setSelectedLead(updated);
          } catch {
            toast({
              title: t('leadsManagement.refreshError', 'Refresh failed'),
              description: t('leadsManagement.assignError', 'Gagal mengubah PIC'),
              variant: 'destructive',
            });
          }
        }}
      />
      </div>
      {showPageSkeleton &&
        typeof document !== 'undefined' &&
        createPortal(<MobileConsultantLeadsFullViewportOverlay />, document.body)}
    </div>
  );
}
