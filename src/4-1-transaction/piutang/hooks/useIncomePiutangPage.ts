import { useCallback, useMemo, useState } from 'react';
import { useSalesActivities, useSalesActivityPayments, type SalesActivity } from '@/shared/hooks/organized/sales';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useCurrentUser } from '@/shared/hooks/useCurrentUser';
import { useDebouncedReady } from '@/shared/hooks/useDebouncedReady';
import type { PiutangFilterMode, PiutangVerificationFilterMode } from '../types/piutang.types';
import { usePiutangActivityRows } from './usePiutangActivityRows';
import { usePiutangPaymentVerificationByActivity } from './usePiutangPaymentVerificationByActivity';
import {
  hasActivePiutangFilters,
  PIUTANG_DEFAULT_STATUS,
  PIUTANG_DEFAULT_VERIFICATION,
} from '../shared/piutangFilterConfig';
import { matchesPiutangStatusFilter } from '../utils/piutangFilter';
import { computePiutangMetrics } from '../shared/piutangMetrics';

export function useIncomePiutangPage() {
  const { loading: orgLoading, organizationId } = useCurrentOrg();
  const { activities, loading: activitiesLoading } = useSalesActivities();
  const { getPaymentHistory, updatePaymentVerification } = useSalesActivityPayments();
  const { user } = useCurrentUser();

  const [status, setStatus] = useState<PiutangFilterMode>(PIUTANG_DEFAULT_STATUS);
  const [verificationFilter, setVerificationFilter] =
    useState<PiutangVerificationFilterMode>(PIUTANG_DEFAULT_VERIFICATION);
  const [search, setSearch] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerActivity, setDrawerActivity] = useState<SalesActivity | null>(null);
  const [mountDrawer, setMountDrawer] = useState(false);

  const { verificationAggregateByActivity, verificationFilterInfoByActivity, verificationLoading } =
    usePiutangPaymentVerificationByActivity(activities);

  const filteredRows = usePiutangActivityRows(
    activities,
    status,
    search,
    verificationFilter,
    verificationFilterInfoByActivity,
    verificationLoading,
  );

  const activitiesPendingLoad = Boolean(organizationId) && activitiesLoading;
  const rawPendingLoad = orgLoading || activitiesPendingLoad;
  const showContent = useDebouncedReady(!rawPendingLoad, 150);

  const openDrawer = useCallback((row: SalesActivity) => {
    setMountDrawer(true);
    setDrawerActivity(row);
    setDrawerOpen(true);
  }, []);

  const closeDrawer = useCallback((open: boolean) => {
    setDrawerOpen(open);
    if (!open) setDrawerActivity(null);
  }, []);

  const handleClearFilters = useCallback(() => {
    setSearch('');
    setStatus(PIUTANG_DEFAULT_STATUS);
    setVerificationFilter(PIUTANG_DEFAULT_VERIFICATION);
  }, []);

  const hasActiveFilters = hasActivePiutangFilters({
    search,
    status,
    verification: verificationFilter,
  });

  const totalPiutangActivities = useMemo(
    () => activities.filter((a) => matchesPiutangStatusFilter(a, 'all')).length,
    [activities],
  );

  const metrics = useMemo(() => computePiutangMetrics(filteredRows), [filteredRows]);

  return {
    showContent,
    search,
    status,
    verificationFilter,
    setSearch,
    setStatus,
    setVerificationFilter,
    handleClearFilters,
    hasActiveFilters,
    filteredRows,
    verificationAggregateByActivity,
    verificationLoading,
    totalPiutangActivities,
    metrics,
    openDrawer,
    drawerOpen,
    drawerActivity,
    mountDrawer,
    closeDrawer,
    getPaymentHistory,
    updatePaymentVerification,
    userId: user?.id,
  };
}
