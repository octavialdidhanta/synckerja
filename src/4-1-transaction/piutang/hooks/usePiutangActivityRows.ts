import { useMemo } from 'react';
import type { SalesActivity } from '@/shared/hooks/organized/sales';
import type { PiutangFilterMode, PiutangVerificationFilterMode } from '../types/piutang.types';
import {
  activityMatchesPiutangVerificationFilter,
  matchesPiutangStatusFilter,
  type PiutangVerificationFilterInfo,
} from '../utils/piutangFilter';

export function usePiutangActivityRows(
  activities: SalesActivity[],
  mode: PiutangFilterMode,
  search: string,
  verificationFilter: PiutangVerificationFilterMode,
  verificationFilterInfoByActivity: ReadonlyMap<string, PiutangVerificationFilterInfo>,
  verificationLoading: boolean,
): SalesActivity[] {
  return useMemo(() => {
    const q = search.trim().toLowerCase();
    const vf: PiutangVerificationFilterMode = verificationLoading ? 'all' : verificationFilter;
    return activities.filter((a) => {
      const verificationInfo = verificationLoading
        ? undefined
        : verificationFilterInfoByActivity.get(a.id);
      if (!matchesPiutangStatusFilter(a, mode, verificationInfo)) return false;
      const info = verificationFilterInfoByActivity.get(a.id);
      if (!activityMatchesPiutangVerificationFilter(info, vf)) return false;
      if (!q) return true;
      const name = String(a.client_name ?? '').toLowerCase();
      const services = a.services as { name?: string } | null | undefined;
      const sub = a.sub_services as { name?: string } | null | undefined;
      const serviceLabel = `${services?.name ?? ''} ${sub?.name ?? ''}`.toLowerCase();
      return name.includes(q) || serviceLabel.includes(q);
    });
  }, [activities, mode, search, verificationFilter, verificationFilterInfoByActivity, verificationLoading]);
}
