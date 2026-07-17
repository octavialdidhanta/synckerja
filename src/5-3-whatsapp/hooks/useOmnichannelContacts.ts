import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { normalizeWaPhoneKey } from '@/5-3-whatsapp-template/utils/normalizeWaPhoneKey';

export type OmnichannelContactRow = {
  id: string;
  name: string | null;
  phone_number: string;
  phone_key: string;
  campaign_name: string | null;
  target_market: string;
  captured_at: string;
  source: 'Lead Magnet';
};

export type OmnichannelContactFilters = {
  campaignName: string;
  targetMarket: string;
  dateFrom: string | null;
  dateTo: string | null;
};

const CONTACT_SELECT =
  'id, name, phone_number, lead_magnet_campaign_id, lead_magnet_campaign_name, lead_magnet_target_market, updated_at, submitted_at';

type RawSubmissionRow = {
  id: string;
  name: string | null;
  phone_number: string | null;
  lead_magnet_campaign_id: string | null;
  lead_magnet_campaign_name: string | null;
  lead_magnet_target_market: string | null;
  updated_at: string;
  submitted_at: string | null;
};

function captureTimestamp(row: RawSubmissionRow): string {
  return row.submitted_at ?? row.updated_at;
}

function dedupeLatestByPhone(rows: RawSubmissionRow[]): OmnichannelContactRow[] {
  const byPhone = new Map<string, { row: RawSubmissionRow; capturedAt: string }>();

  for (const row of rows) {
    const phoneKey = normalizeWaPhoneKey(row.phone_number);
    if (!phoneKey) continue;

    const capturedAt = captureTimestamp(row);
    const existing = byPhone.get(phoneKey);
    if (!existing || capturedAt.localeCompare(existing.capturedAt) > 0) {
      byPhone.set(phoneKey, { row, capturedAt });
    }
  }

  return [...byPhone.values()]
    .map(({ row, capturedAt }) => ({
      id: row.id,
      name: row.name?.trim() || null,
      phone_number: row.phone_number!.trim(),
      phone_key: normalizeWaPhoneKey(row.phone_number)!,
      campaign_name: row.lead_magnet_campaign_name?.trim() || null,
      target_market: row.lead_magnet_target_market!.trim(),
      captured_at: capturedAt,
      source: 'Lead Magnet' as const,
    }))
    .sort((a, b) => b.captured_at.localeCompare(a.captured_at));
}

async function fetchOmnichannelContacts(organizationId: string): Promise<OmnichannelContactRow[]> {
  const { data, error } = await supabase
    .from('lead_submissions')
    .select(CONTACT_SELECT)
    .eq('organization_id', organizationId)
    .not('phone_number', 'is', null)
    .not('lead_magnet_campaign_id', 'is', null)
    .not('lead_magnet_target_market', 'is', null)
    .eq('is_active', true);

  if (error) throw error;
  return dedupeLatestByPhone((data ?? []) as RawSubmissionRow[]);
}

export function useOmnichannelContacts(organizationId: string | null | undefined) {
  const query = useQuery({
    queryKey: ['omnichannel-contacts', organizationId],
    queryFn: () => fetchOmnichannelContacts(organizationId!),
    enabled: Boolean(organizationId),
    staleTime: 30_000,
  });

  return query;
}

export function useOmnichannelContactFilterOptions(rows: OmnichannelContactRow[]) {
  return useMemo(() => {
    const campaigns = new Set<string>();
    const markets = new Set<string>();
    for (const row of rows) {
      if (row.campaign_name) campaigns.add(row.campaign_name);
      if (row.target_market) markets.add(row.target_market);
    }
    return {
      campaigns: [...campaigns].sort((a, b) => a.localeCompare(b)),
      targetMarkets: [...markets].sort((a, b) => a.localeCompare(b)),
    };
  }, [rows]);
}

export function filterOmnichannelContacts(
  rows: OmnichannelContactRow[],
  filters: OmnichannelContactFilters,
): OmnichannelContactRow[] {
  const campaignQ = filters.campaignName.trim().toLowerCase();
  const marketQ = filters.targetMarket.trim().toLowerCase();
  const fromMs = filters.dateFrom ? new Date(`${filters.dateFrom}T00:00:00`).getTime() : null;
  const toMs = filters.dateTo ? new Date(`${filters.dateTo}T23:59:59.999`).getTime() : null;

  return rows.filter((row) => {
    if (campaignQ && !(row.campaign_name ?? '').toLowerCase().includes(campaignQ)) return false;
    if (marketQ && !row.target_market.toLowerCase().includes(marketQ)) return false;
    if (fromMs != null || toMs != null) {
      const ts = new Date(row.captured_at).getTime();
      if (fromMs != null && ts < fromMs) return false;
      if (toMs != null && ts > toMs) return false;
    }
    return true;
  });
}
