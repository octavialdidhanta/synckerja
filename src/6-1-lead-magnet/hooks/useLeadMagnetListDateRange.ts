import { useCallback, useEffect, useMemo, useState } from 'react';
import type { GoogleAdsDateRangeSelection } from '@/6-0-google-ads/lib/googleAdsDatePresets';
import { toTikTokAdsMetricsDateRangePayload } from '@/tiktok-ads/lib/toTikTokAdsMetricsDateRangePayload';
import {
  readLeadMagnetListDateSelection,
  writeLeadMagnetListDateSelection,
} from '../lib/leadMagnetListDateRangeStorage';

export function useLeadMagnetListDateRange(organizationId: string | null | undefined) {
  const [selection, setSelectionState] = useState<GoogleAdsDateRangeSelection>(() =>
    readLeadMagnetListDateSelection(organizationId),
  );

  useEffect(() => {
    setSelectionState(readLeadMagnetListDateSelection(organizationId));
  }, [organizationId]);

  const setSelection = useCallback(
    (next: GoogleAdsDateRangeSelection) => {
      setSelectionState(next);
      writeLeadMagnetListDateSelection(organizationId, next);
    },
    [organizationId],
  );

  const { start: dateStart, end: dateEnd } = useMemo(
    () => toTikTokAdsMetricsDateRangePayload(selection),
    [selection],
  );

  return { selection, setSelection, dateStart, dateEnd };
}
