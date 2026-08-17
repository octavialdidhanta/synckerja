import { useMemo } from 'react';
import { matchCustomerVisitParty } from '../lib/matchCustomerVisitParty';
import { normalizeCustomerVisitIgHandle } from '../lib/normalizeCustomerVisitIgHandle';
import { normalizeCustomerVisitPhone } from '../lib/normalizeCustomerVisitPhone';
import type { CustomerVisitLookupKind } from '../lib/customerVisit.types';
import { useCustomerVisitDirectory } from './useCustomerVisitDirectory';

export function useCustomerVisitLookup(
  kind: CustomerVisitLookupKind,
  rawQuery: string,
  enabled: boolean,
) {
  const directory = useCustomerVisitDirectory();
  const trimmed = rawQuery.trim();

  const normalized =
    kind === 'phone' ? normalizeCustomerVisitPhone(trimmed) : normalizeCustomerVisitIgHandle(trimmed);

  const result = useMemo(() => {
    if (!enabled || !normalized) return null;
    return matchCustomerVisitParty({
      kind,
      normalized,
      leads: directory.data?.leads ?? [],
      enrollments: directory.data?.enrollments ?? [],
    });
  }, [directory.data, enabled, kind, normalized]);

  return {
    normalized,
    result,
    isLoading: enabled && directory.isLoading,
    isError: directory.isError,
    error: directory.error,
  };
}
