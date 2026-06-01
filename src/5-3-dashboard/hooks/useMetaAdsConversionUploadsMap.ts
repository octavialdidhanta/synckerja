import { useCallback, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import type { NewLead } from '@/shared/types/leads';

export type MetaAdsSyncUploadRecord = {
  status: 'success' | 'failed' | 'skipped';
  skip_reason: string | null;
  error_message: string | null;
};

type Invalidator = ((organizationId: string) => void) | null;

let metaAdsUploadsInvalidator: Invalidator = null;

export function registerMetaAdsUploadsInvalidator(fn: Invalidator): void {
  metaAdsUploadsInvalidator = fn;
}

export function invalidateMetaAdsConversionUploads(organizationId: string): void {
  metaAdsUploadsInvalidator?.(organizationId);
}

const UUID_RE = /^[0-9a-f-]{36}$/i;

function resolveCrmLeadId(lead: NewLead, ticketToLeadId: ReadonlyMap<string, string>): string | null {
  const id = String(lead.id ?? '').trim();
  if (UUID_RE.test(id)) return id;
  const tid = (lead.ticket_id ?? '').trim().toUpperCase();
  if (!tid) return null;
  return ticketToLeadId.get(tid) ?? null;
}

export function useMetaAdsConversionUploadsMap(
  organizationId: string | null | undefined,
  leads: NewLead[],
) {
  const queryClient = useQueryClient();

  useEffect(() => {
    registerMetaAdsUploadsInvalidator((orgId) => {
      void queryClient.invalidateQueries({ queryKey: ['meta-ads-conversion-uploads', orgId] });
    });
    return () => registerMetaAdsUploadsInvalidator(null);
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
    queryKey: ['meta-ads-conversion-uploads', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from('meta_ads_conversion_uploads')
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
    const m = new Map<string, MetaAdsSyncUploadRecord>();
    for (const r of rows) {
      if (r.status === 'success' || r.status === 'failed' || r.status === 'skipped') {
        m.set(r.lead_id, {
          status: r.status,
          skip_reason: r.skip_reason,
          error_message: r.error_message,
        });
      }
    }
    return m;
  }, [rows]);

  const getSyncForLead = useCallback(
    (lead: NewLead): MetaAdsSyncUploadRecord | null => {
      const id = resolveCrmLeadId(lead, ticketToLeadId);
      if (!id) return null;
      return byLeadId.get(id) ?? null;
    },
    [byLeadId, ticketToLeadId],
  );

  return { getSyncForLead, isLoading };
}
