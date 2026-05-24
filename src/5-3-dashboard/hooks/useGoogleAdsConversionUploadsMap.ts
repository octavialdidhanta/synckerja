import { useCallback, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import type { NewLead } from '@/shared/types/leads';

export type GoogleAdsSyncUploadRecord = {
  status: 'success' | 'failed' | 'skipped';
  skip_reason: string | null;
  error_message: string | null;
};

type Invalidator = ((organizationId: string) => void) | null;

let googleAdsUploadsInvalidator: Invalidator = null;

export function registerGoogleAdsUploadsInvalidator(fn: Invalidator): void {
  googleAdsUploadsInvalidator = fn;
}

export function invalidateGoogleAdsConversionUploads(organizationId: string): void {
  googleAdsUploadsInvalidator?.(organizationId);
}

const UUID_RE = /^[0-9a-f-]{36}$/i;

function resolveCrmLeadId(lead: NewLead, ticketToLeadId: ReadonlyMap<string, string>): string | null {
  const id = String(lead.id ?? '').trim();
  if (UUID_RE.test(id)) return id;
  const tid = (lead.ticket_id ?? '').trim().toUpperCase();
  if (!tid) return null;
  return ticketToLeadId.get(tid) ?? null;
}

export function useGoogleAdsConversionUploadsMap(
  organizationId: string | null | undefined,
  leads: NewLead[],
) {
  const queryClient = useQueryClient();

  useEffect(() => {
    registerGoogleAdsUploadsInvalidator((orgId) => {
      void queryClient.invalidateQueries({ queryKey: ['google-ads-conversion-uploads', orgId] });
    });
    return () => registerGoogleAdsUploadsInvalidator(null);
  }, [queryClient]);

  const ticketToLeadId = useMemo(() => {
    const m = new Map<string, string>();
    for (const l of leads) {
      const id = String(l.id ?? '').trim();
      if (!UUID_RE.test(id)) continue;
      const tid = (l.ticket_id ?? '').trim().toUpperCase();
      if (tid) m.set(tid, id);
    }
    return m;
  }, [leads]);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['google-ads-conversion-uploads', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from('google_ads_conversion_uploads')
        .select('lead_id, status, skip_reason, error_message')
        .eq('organization_id', organizationId);
      if (error) throw error;
      return (data ?? []) as Array<{
        lead_id: string;
        status: string;
        skip_reason: string | null;
        error_message: string | null;
      }>;
    },
    enabled: Boolean(organizationId),
    staleTime: 30_000,
  });

  const byLeadId = useMemo(() => {
    const m = new Map<string, GoogleAdsSyncUploadRecord>();
    for (const r of rows) {
      const status = r.status;
      if (status !== 'success' && status !== 'failed' && status !== 'skipped') continue;
      m.set(String(r.lead_id), {
        status,
        skip_reason: r.skip_reason,
        error_message: r.error_message,
      });
    }
    return m;
  }, [rows]);

  const getSyncForLead = useCallback(
    (lead: NewLead): GoogleAdsSyncUploadRecord | null => {
      const leadId = resolveCrmLeadId(lead, ticketToLeadId);
      if (!leadId) return null;
      return byLeadId.get(leadId) ?? null;
    },
    [byLeadId, ticketToLeadId],
  );

  return { getSyncForLead, isLoading };
}
