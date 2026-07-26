import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/shared/lib/supabaseClient';
import type { NewLead } from '@/shared/types/leads';
import {
  clientCompletenessFromSubmission,
  fetchLeadSubmissionsForLeads,
  type ClientProfileCompleteness,
  type LeadSubmissionProfileRow,
} from '@/shared/lib/leadSubmissionProfile';

export type ClientStatus = ClientProfileCompleteness;

export function useLeadClientStatuses(leads: NewLead[]) {
  const [clientStatuses, setClientStatuses] = useState<Record<string, ClientStatus>>({});
  const [clientProfiles, setClientProfiles] = useState<Record<string, LeadSubmissionProfileRow | null>>({});

  // Include contact fields so backend auto-fill (e.g. email detected in livechat)
  // silently re-derives statuses when the realtime `leads` refetch lands.
  const leadIdsKey = useMemo(
    () =>
      leads
        .map((l) => {
          const withContact = l as NewLead & {
            email?: string | null;
            phone_number?: string | null;
            _customerWaId?: string | null;
          };
          return [
            l.id,
            String(withContact.email ?? ''),
            String(withContact.phone_number ?? withContact._customerWaId ?? ''),
            String(l.client ?? ''),
          ].join('|');
        })
        .sort()
        .join(','),
    [leads],
  );

  useEffect(() => {
    const fetchStatuses = async () => {
      if (leads.length === 0) {
        setClientStatuses({});
        setClientProfiles({});
        return;
      }

      const statusMap: Record<string, ClientStatus> = {};
      const profileMap: Record<string, LeadSubmissionProfileRow | null> = {};

      const uuidLeads = leads.filter(
        (l) => !String(l.id).startsWith('wa-') && !String(l.id).startsWith('email-'),
      );
      const orgId = uuidLeads[0]?.organization_id;
      const submissionByLead =
        orgId && uuidLeads.length > 0
          ? await fetchLeadSubmissionsForLeads(
              uuidLeads.map((l) => l.id),
              orgId,
            )
          : new Map<string, LeadSubmissionProfileRow>();

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

          if (isWhatsApp && conversationId) {
            const { data } = await supabase
              .from('whatsapp_conversation_client_profiles')
              .select('*')
              .eq('conversation_id', conversationId)
              .eq('organization_id', lead.organization_id)
              .maybeSingle();

            if (!data) {
              statusMap[lead.id] = 'empty';
              profileMap[lead.id] = null;
            } else {
              profileMap[lead.id] = null;
              const fields = [
                data.name,
                (data as { code?: string }).code,
                data.gender,
                data.age,
                data.occupation,
                data.location,
                (data as { phone_number?: string }).phone_number,
                (data as { email?: string }).email,
              ];
              const filledFields = fields.filter(
                (field) => field !== null && field !== undefined && field !== '',
              ).length;
              if (filledFields === 0) statusMap[lead.id] = 'empty';
              else if (filledFields === fields.length) statusMap[lead.id] = 'full';
              else statusMap[lead.id] = 'partial';
            }
            continue;
          }

          const submission = submissionByLead.get(lead.id) ?? null;
          profileMap[lead.id] = submission;
          statusMap[lead.id] = clientCompletenessFromSubmission(submission, {
            client: lead.client,
            phone_number:
              (lead as NewLead & { phone_number?: string | null }).phone_number ??
              (lead as NewLead & { _customerWaId?: string })._customerWaId ??
              null,
            email: (lead as NewLead & { email?: string | null }).email ?? null,
          });
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadIdsKey]);

  return { clientStatuses, clientProfiles };
}
