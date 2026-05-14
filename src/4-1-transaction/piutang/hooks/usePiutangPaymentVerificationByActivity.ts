import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import type { SalesActivity } from '@/shared/hooks/organized/sales';
import type { PiutangVerificationAggregate } from '../types/piutang.types';
import {
  aggregateActivityVerification,
  buildVerificationFilterInfo,
  type PiutangVerificationFilterInfo,
} from '../utils/piutangFilter';

/** Invalidate with `queryKey: ['piutang-payment-verifications']` after payment / verification changes. */
export const PIUTANG_PAYMENT_VERIFICATION_QUERY_ROOT = 'piutang-payment-verifications' as const;

const EMPTY_AGG: ReadonlyMap<string, PiutangVerificationAggregate> = new Map();
const EMPTY_FILTER_INFO: ReadonlyMap<string, PiutangVerificationFilterInfo> = new Map();

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

type VerificationMaps = {
  aggregateByActivity: Map<string, PiutangVerificationAggregate>;
  filterInfoByActivity: Map<string, PiutangVerificationFilterInfo>;
};

/**
 * Loads verification status per payment; exposes aggregate (kolom tabel) + info per baris (filter).
 */
export function usePiutangPaymentVerificationByActivity(activities: SalesActivity[]) {
  const { organizationId } = useCurrentOrg();

  const activityIds = useMemo(
    () =>
      [...new Set(activities.map((a) => a.id).filter((id): id is string => Boolean(id)))].sort(),
    [activities],
  );

  const activityIdsKey = activityIds.join(',');

  const { data, isLoading, isFetching } = useQuery({
    queryKey: [PIUTANG_PAYMENT_VERIFICATION_QUERY_ROOT, organizationId, activityIdsKey],
    queryFn: async (): Promise<VerificationMaps> => {
      if (!organizationId || activityIds.length === 0) {
        return { aggregateByActivity: new Map(), filterInfoByActivity: new Map() };
      }

      const byActivity = new Map<string, { transfer_verification_status?: string | null }[]>();
      const batches = chunk(activityIds, 120);

      for (const batch of batches) {
        const { data: rows, error } = await supabase
          .from('sales_activity_payments')
          .select('sales_activity_id, transfer_verification_status')
          .eq('organization_id', organizationId)
          .in('sales_activity_id', batch);

        if (error) throw error;
        for (const row of rows || []) {
          const aid = row.sales_activity_id as string;
          if (!aid) continue;
          const list = byActivity.get(aid) ?? [];
          list.push(row);
          byActivity.set(aid, list);
        }
      }

      const aggregateByActivity = new Map<string, PiutangVerificationAggregate>();
      const filterInfoByActivity = new Map<string, PiutangVerificationFilterInfo>();
      for (const id of activityIds) {
        const list = byActivity.get(id) ?? [];
        aggregateByActivity.set(id, aggregateActivityVerification(list));
        filterInfoByActivity.set(id, buildVerificationFilterInfo(list));
      }
      return { aggregateByActivity, filterInfoByActivity };
    },
    enabled: Boolean(organizationId) && activityIds.length > 0,
    staleTime: 15_000,
  });

  const verificationAggregateByActivity = data?.aggregateByActivity ?? EMPTY_AGG;
  const verificationFilterInfoByActivity = data?.filterInfoByActivity ?? EMPTY_FILTER_INFO;

  return {
    /** Agregat untuk badge kolom "Verifikasi" */
    verificationAggregateByActivity,
    /** Perhitungan hasUnchecked / hasRejected untuk filter dropdown */
    verificationFilterInfoByActivity,
    verificationLoading: isLoading || isFetching,
  };
}
