import { useQuery } from '@tanstack/react-query';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { supabase } from '@/shared/lib/supabaseClient';
import {
  customerVisitLead,
  type CustomerVisitLeadEmbed,
  type CustomerVisitLeadEnrollmentEmbed,
  type CustomerVisitRow,
  type CustomerVisitSaleEmbed,
} from '../lib/customerVisit.types';

const CUSTOMER_VISITS_SELECT =
  'id, organization_id, visit_date, status, lead_id, lookup_kind, lookup_raw, lookup_normalized, match_status, notes, table_number, sales_activity_id, created_at, leads(id, client, ticket_id, source, phone_number, attribution, attribution_label), sales_activities!sales_activity_id(id, total_amount, payment_method, payment_reference, cash_tendered, table_number, date, created_at, pos_outlet_id, catalog_sales_type_id, checkout_subtotal, checkout_tax_amount, checkout_gratuity_amount)';

const STORE_TICKETS_SELECT =
  'id, customer_visit_id, total_amount, payment_method, payment_reference, cash_tendered, table_number, date, created_at, pos_outlet_id, catalog_sales_type_id, checkout_subtotal, checkout_tax_amount, checkout_gratuity_amount';

const ENROLLMENT_CONTENT_SELECT =
  'lead_id, created_at, media_id, platform, lead_magnet_campaigns(name, lead_magnet_campaign_posts(media_id, media_caption, media_permalink, platform))';

function attachEnrollments(
  visits: CustomerVisitRow[],
  enrollments: Array<CustomerVisitLeadEnrollmentEmbed & { lead_id?: string | null }>,
): CustomerVisitRow[] {
  const byLead = new Map<string, CustomerVisitLeadEnrollmentEmbed[]>();
  for (const row of enrollments) {
    const leadId = row.lead_id?.trim();
    if (!leadId) continue;
    const list = byLead.get(leadId) ?? [];
    list.push(row);
    byLead.set(leadId, list);
  }

  return visits.map((visit) => {
    const lead = customerVisitLead(visit);
    if (!lead) return visit;
    const attached: CustomerVisitLeadEmbed = {
      ...lead,
      lead_magnet_enrollments: byLead.get(lead.id) ?? lead.lead_magnet_enrollments ?? [],
    };
    return { ...visit, leads: attached };
  });
}

async function attachStoreTickets(
  organizationId: string,
  visits: CustomerVisitRow[],
): Promise<CustomerVisitRow[]> {
  const visitIds = visits.map((visit) => visit.id);
  if (visitIds.length === 0) return visits;
  const { data, error } = await supabase
    .from('sales_activities')
    .select(STORE_TICKETS_SELECT)
    .eq('organization_id', organizationId)
    .eq('activity_type', 'Store Checkout')
    .in('customer_visit_id', visitIds)
    .order('created_at', { ascending: true });
  if (error) throw error;
  const byVisit = new Map<string, CustomerVisitSaleEmbed[]>();
  for (const row of data ?? []) {
    const visitId = String((row as { customer_visit_id?: string | null }).customer_visit_id ?? '');
    if (!visitId) continue;
    const list = byVisit.get(visitId) ?? [];
    list.push(row as CustomerVisitSaleEmbed);
    byVisit.set(visitId, list);
  }
  return visits.map((visit) => ({
    ...visit,
    store_tickets: byVisit.get(visit.id) ?? [],
  }));
}

export function useCustomerVisits() {
  const { organizationId } = useCurrentOrg();

  const query = useQuery({
    queryKey: ['customer-visits', organizationId],
    queryFn: async (): Promise<CustomerVisitRow[]> => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from('customer_visits')
        .select(CUSTOMER_VISITS_SELECT)
        .eq('organization_id', organizationId)
        .order('visit_date', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      const visits = await attachStoreTickets(organizationId, (data ?? []) as CustomerVisitRow[]);
      const leadIds = [...new Set(visits.map((visit) => visit.lead_id).filter(Boolean))] as string[];
      if (leadIds.length === 0) return visits;

      const { data: enrollmentRows, error: enrollmentErr } = await supabase
        .from('lead_magnet_enrollments')
        .select(ENROLLMENT_CONTENT_SELECT)
        .eq('organization_id', organizationId)
        .in('lead_id', leadIds);
      if (enrollmentErr) throw enrollmentErr;

      return attachEnrollments(
        visits,
        (enrollmentRows ?? []) as Array<CustomerVisitLeadEnrollmentEmbed & { lead_id?: string | null }>,
      );
    },
    enabled: !!organizationId,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  return {
    visits: query.data ?? [],
    loading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
