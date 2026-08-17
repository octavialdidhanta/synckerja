import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { supabase } from '@/shared/lib/supabaseClient';
import { encodeVisitPartyKey, parseVisitPartyKey } from '@/shared/lib/sales/visitParty';

export type VisitPartyOption = {
  key: string;
  kind: 'lead' | 'client';
  id: string;
  label: string;
  phone: string | null;
  contactPerson: string | null;
  leadId: string | null;
};

type LeadRow = {
  id: string;
  client: string | null;
  phone_number: string | null;
};

type ClientRow = {
  id: string;
  company_name: string | null;
  contact_person: string | null;
  contact_phone: string | null;
  lead_id: string | null;
};

export function useVisitPartyOptions() {
  const { organizationId } = useCurrentOrg();

  const query = useQuery({
    queryKey: ['visit-party-options', organizationId],
    queryFn: async (): Promise<{ leads: LeadRow[]; clients: ClientRow[] }> => {
      if (!organizationId) return { leads: [], clients: [] };

      const [leadsRes, clientsRes] = await Promise.all([
        supabase
          .from('leads')
          .select('id, client, phone_number')
          .eq('organization_id', organizationId)
          .order('created_at', { ascending: false })
          .limit(500),
        supabase
          .from('clients')
          .select('id, company_name, contact_person, contact_phone, lead_id')
          .eq('organization_id', organizationId)
          .order('company_name'),
      ]);

      if (leadsRes.error) throw leadsRes.error;
      if (clientsRes.error) throw clientsRes.error;

      return {
        leads: (leadsRes.data ?? []) as LeadRow[],
        clients: (clientsRes.data ?? []) as ClientRow[],
      };
    },
    enabled: !!organizationId,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const parties = useMemo<VisitPartyOption[]>(() => {
    const leads = query.data?.leads ?? [];
    const clients = query.data?.clients ?? [];
    const leadOptions: VisitPartyOption[] = leads.map((lead) => {
      const label = String(lead.client ?? '').trim() || 'Lead';
      return {
        key: encodeVisitPartyKey('lead', lead.id),
        kind: 'lead',
        id: lead.id,
        label,
        phone: lead.phone_number?.trim() || null,
        contactPerson: label,
        leadId: lead.id,
      };
    });
    const clientOptions: VisitPartyOption[] = clients
      .filter((client) => !client.lead_id)
      .map((client) => ({
        key: encodeVisitPartyKey('client', client.id),
        kind: 'client',
        id: client.id,
        label: String(client.company_name ?? '').trim() || 'Klien',
        phone: client.contact_phone?.trim() || null,
        contactPerson: client.contact_person?.trim() || null,
        leadId: client.lead_id,
      }));
    return [...leadOptions, ...clientOptions];
  }, [query.data]);

  const findByKey = (key: string | null | undefined): VisitPartyOption | undefined => {
    const parsed = parseVisitPartyKey(key);
    if (!parsed) return undefined;
    return parties.find((party) => party.kind === parsed.kind && party.id === parsed.id);
  };

  return {
    parties,
    leadParties: parties.filter((party) => party.kind === 'lead'),
    clientParties: parties.filter((party) => party.kind === 'client'),
    findByKey,
    isLoading: query.isLoading,
  };
}
