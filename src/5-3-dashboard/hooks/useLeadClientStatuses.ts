import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/shared/lib/supabaseClient';
import type { NewLead } from '@/shared/types/leads';

export type ClientStatus = 'full' | 'partial' | 'empty';

export function useLeadClientStatuses(leads: NewLead[]) {
  const [clientStatuses, setClientStatuses] = useState<Record<string, ClientStatus>>({});
  const [clientProfiles, setClientProfiles] = useState<Record<string, any>>({});

  // Stabilize effect dependency: only run when the set of lead IDs changes, not when array reference changes
  const leadIdsKey = useMemo(
    () => leads.map((l) => l.id).sort().join(','),
    [leads]
  );

  useEffect(() => {
    const fetchStatuses = async () => {
      if (leads.length === 0) {
        setClientStatuses({});
        setClientProfiles({});
        return;
      }

      const statusMap: Record<string, ClientStatus> = {};
      const profileMap: Record<string, any> = {};

      for (const lead of leads) {
        try {
          const isWhatsApp = String(lead.id).startsWith('wa-');
          const isEmail = String(lead.id).startsWith('email-');
          const conversationId = isWhatsApp ? String(lead.id).replace(/^wa-/, '') : null;

          if (isEmail) {
            statusMap[lead.id] = 'empty';
            profileMap[lead.id] = null;
            continue;
          }

          const { data } =
            isWhatsApp && conversationId
              ? await supabase
                  .from('whatsapp_conversation_client_profiles')
                  .select('*')
                  .eq('conversation_id', conversationId)
                  .maybeSingle()
              : await supabase
                  .from('lead_client_profiles')
                  .select('*')
                  .eq('lead_id', lead.id)
                  .maybeSingle();

          if (!data) {
            statusMap[lead.id] = 'empty';
            profileMap[lead.id] = null;
          } else {
            profileMap[lead.id] = data;
            const fields = [
              data.name,
              (data as any).code,
              data.gender,
              data.age,
              data.occupation,
              data.location,
              (data as any).phone_number,
              (data as any).email,
            ];
            const filledFields = fields.filter(
              (field) => field !== null && field !== undefined && field !== ''
            ).length;

            if (filledFields === 0) {
              statusMap[lead.id] = 'empty';
            } else if (filledFields === fields.length) {
              statusMap[lead.id] = 'full';
            } else {
              statusMap[lead.id] = 'partial';
            }
          }
        } catch (error) {
          console.error('Failed to fetch client profile for lead', lead.id, error);
          statusMap[lead.id] = 'empty';
          profileMap[lead.id] = null;
        }
      }

      setClientStatuses(statusMap);
      setClientProfiles(profileMap);
    };

    fetchStatuses();
    // Intentionally depend only on leadIdsKey so we don't re-run when `leads` is a new array reference with same IDs (avoids infinite setState loop)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadIdsKey]);

  return { clientStatuses, clientProfiles };
}
