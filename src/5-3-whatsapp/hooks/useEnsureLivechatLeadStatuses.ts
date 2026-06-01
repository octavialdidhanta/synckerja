import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';

/**
 * Ensures org has full livechat lead_statuses (In Progress, Converted, Closed, …) — parity with WhatsApp.
 * Safe to call repeatedly (DB function is idempotent).
 */
export function useEnsureLivechatLeadStatuses(
  organizationId: string | null | undefined,
  enabled: boolean,
) {
  const queryClient = useQueryClient();
  const ensuredForOrgRef = useRef<string | null>(null);

  useEffect(() => {
    const orgId = organizationId?.trim() ?? '';
    if (!enabled || !orgId) return;
    if (ensuredForOrgRef.current === orgId) return;

    let cancelled = false;
    void (async () => {
      const { error } = await supabase.rpc('ensure_livechat_lead_statuses_for_org', {
        p_organization_id: orgId,
      });
      if (cancelled) return;
      if (error) {
        console.warn('[useEnsureLivechatLeadStatuses]', error.message);
        return;
      }
      ensuredForOrgRef.current = orgId;
      await queryClient.invalidateQueries({ queryKey: ['lead-statuses', orgId] });
      await queryClient.invalidateQueries({ queryKey: ['lead-statuses'] });
    })();

    return () => {
      cancelled = true;
    };
  }, [organizationId, enabled, queryClient]);
}
