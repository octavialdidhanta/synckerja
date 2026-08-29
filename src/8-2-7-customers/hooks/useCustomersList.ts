import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { supabase } from '@/shared/lib/supabaseClient';
import { isPaidSalesActivity } from '@/shared/lib/sales/isPaidSalesActivity';
import {
  aggregateCustomerSpend,
  resolveCustomerSince,
  type CustomerSpendActivity,
} from '../lib/aggregateCustomerSpend';
import { filterCustomers } from '../lib/filterCustomers';
import type { CustomerListRow } from '../types';

export const OPERATIONS_CUSTOMERS_LIST_QUERY_KEY = 'operations-customers-list';

type LeadRow = {
  id: string;
  client: string;
  email: string | null;
  phone_number: string | null;
  converted_at: string | null;
  created_at: string;
};

type SalesActivityRow = {
  lead_id: string | null;
  date: string | null;
  total_amount: number | null;
  total_paid_amount: number | null;
  payment_status: string | null;
  is_paid: boolean | null;
};

function buildCustomerRows(leads: LeadRow[], paidActivities: CustomerSpendActivity[]): CustomerListRow[] {
  const leadIdsWithPaid = new Set(paidActivities.map((row) => row.lead_id));
  const spendByLead = aggregateCustomerSpend(paidActivities);

  return leads
    .filter((lead) => Boolean(lead.converted_at) || leadIdsWithPaid.has(lead.id))
    .map((lead) => {
      const spend = spendByLead.get(lead.id) ?? {
        thisMonth: 0,
        thisYear: 0,
        lifetime: 0,
        firstPurchaseDate: null,
      };
      return {
        id: lead.id,
        name: lead.client?.trim() || '—',
        email: lead.email?.trim() || null,
        phone: lead.phone_number?.trim() || null,
        customerSince: resolveCustomerSince({
          convertedAt: lead.converted_at,
          createdAt: lead.created_at,
          firstPurchaseDate: spend.firstPurchaseDate,
        }),
        thisMonth: spend.thisMonth,
        thisYear: spend.thisYear,
        lifetime: spend.lifetime,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
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
          .select('id, client, email, phone_number, converted_at, created_at')
          .eq('organization_id', organizationId),
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

      return buildCustomerRows((leadsRes.data ?? []) as LeadRow[], paidActivities);
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
