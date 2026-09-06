import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { supabase } from '@/shared/lib/supabaseClient';
import { isPaidSalesActivity } from '@/shared/lib/sales/isPaidSalesActivity';
import {
  aggregateCustomerSpend,
  type CustomerSpendActivity,
} from '../lib/aggregateCustomerSpend';
import { groupCustomerClv, type CustomerClvLeadInput } from '../lib/groupCustomerClv';
import { filterCustomers } from '../lib/filterCustomers';
import type { CustomerListRow } from '../types';

export const OPERATIONS_CUSTOMERS_LIST_QUERY_KEY = 'operations-customers-list';

type SalesActivityRow = {
  lead_id: string | null;
  date: string | null;
  total_amount: number | null;
  total_paid_amount: number | null;
  payment_status: string | null;
  is_paid: boolean | null;
};

function buildCustomerRows(
  leads: CustomerClvLeadInput[],
  paidActivities: CustomerSpendActivity[],
): CustomerListRow[] {
  const leadIdsWithPaid = new Set(paidActivities.map((row) => row.lead_id));
  const spendByLead = aggregateCustomerSpend(paidActivities);
  return groupCustomerClv(leads, spendByLead, leadIdsWithPaid);
}

export function useCustomersList(search: string) {
  const { organizationId } = useCurrentOrg();

  const query = useQuery({
    queryKey: [OPERATIONS_CUSTOMERS_LIST_QUERY_KEY, organizationId],
    enabled: Boolean(organizationId),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<CustomerListRow[]> => {
      if (!organizationId) return [];

      const [leadsRes, salesRes] = await Promise.all([
        supabase
          .from('leads')
          .select('id, client, email, phone_number, converted_at, created_at, updated_at')
          .eq('organization_id', organizationId)
          .is('merged_into_lead_id', null),
        supabase
          .from('sales_activities')
          .select('lead_id, date, total_amount, total_paid_amount, payment_status, is_paid')
          .eq('organization_id', organizationId)
          .not('lead_id', 'is', null),
      ]);

      if (leadsRes.error) throw leadsRes.error;
      if (salesRes.error) throw salesRes.error;

      const paidActivities: CustomerSpendActivity[] = (salesRes.data ?? [])
        .filter((row) => isPaidSalesActivity(row as SalesActivityRow))
        .map((row) => ({
          lead_id: String((row as SalesActivityRow).lead_id),
          date: (row as SalesActivityRow).date,
          total_amount: Number((row as SalesActivityRow).total_amount),
        }));

      const leads: CustomerClvLeadInput[] = (leadsRes.data ?? []).map((row) => {
        const r = row as Record<string, unknown>;
        return {
          id: String(r.id),
          client: String(r.client ?? ''),
          email: r.email == null ? null : String(r.email),
          phone_number: r.phone_number == null ? null : String(r.phone_number),
          converted_at: r.converted_at == null ? null : String(r.converted_at),
          created_at: String(r.created_at ?? ''),
          updated_at: r.updated_at == null ? null : String(r.updated_at),
        };
      });

      return buildCustomerRows(leads, paidActivities);
    },
  });

  const allRows = query.data ?? [];
  const rows = useMemo(() => filterCustomers(allRows, search), [allRows, search]);

  return {
    rows,
    allRows,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
