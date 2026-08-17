import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useOmnichannelIncomeBankAccount } from '@/shared/hooks/finance/useOmnichannelIncomeBankAccount';
import { supabase } from '@/shared/lib/supabaseClient';
import { applyStoreCheckoutOfflineSales } from '../lib/applyStoreCheckoutOfflineSales';
import {
  createStoreCheckoutSalesActivity,
  markLeadConvertedIfNeeded,
  rollbackStoreCheckoutSalesActivity,
} from '../lib/createStoreCheckoutSalesActivity';
import { recordStoreCheckoutIncome, storeCheckoutNeedsOmnichannelBank } from '../lib/recordStoreCheckoutIncome';
import { findInsufficientStoreCheckoutStock, trackedStoreCheckoutLines } from '../lib/storeCheckoutStock';
import { normalizeTableNumber } from '../lib/normalizeTableNumber';
import type {
  CustomerVisitCartLine,
  CustomerVisitCheckoutPaymentMethod,
} from '../lib/customerVisitCheckout.types';

export type SubmitCustomerVisitCheckoutInput = {
  visitId: string;
  leadId: string;
  clientName: string;
  clientPhone: string | null;
  paymentMethod: CustomerVisitCheckoutPaymentMethod;
  paymentReference?: string | null;
  cashTendered?: number | null;
  tableNumber?: string | null;
  lines: CustomerVisitCartLine[];
};

function invalidateStoreCheckoutQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  organizationId: string,
) {
  queryClient.invalidateQueries({ queryKey: ['customer-visits', organizationId] });
  queryClient.invalidateQueries({ queryKey: ['customer-visit-catalog', organizationId] });
  queryClient.invalidateQueries({ queryKey: ['default-prices', organizationId] });
  queryClient.invalidateQueries({ queryKey: ['inventory-skus', organizationId] });
  queryClient.invalidateQueries({ queryKey: ['sales-activities', organizationId] });
  queryClient.invalidateQueries({ queryKey: ['leads', organizationId] });
  queryClient.invalidateQueries({ queryKey: ['income-transactions', organizationId] });
  queryClient.invalidateQueries({ queryKey: ['income-transactions'] });
  queryClient.invalidateQueries({ queryKey: ['income-transaction-summary', organizationId] });
  queryClient.invalidateQueries({ queryKey: ['income-metrics', organizationId] });
  queryClient.invalidateQueries({ queryKey: ['monthly-income-data', organizationId] });
  queryClient.invalidateQueries({ queryKey: ['bank-account-balances'] });
}

async function assertStoreCheckoutStock(lines: CustomerVisitCartLine[]): Promise<void> {
  const tracked = trackedStoreCheckoutLines(lines);
  if (tracked.length === 0) return;

  const skuIds = [...new Set(tracked.map((line) => String(line.inventorySkuId)))];
  const { data, error } = await supabase
    .from('inventory_stock_levels')
    .select('sku_id, available_qty')
    .in('sku_id', skuIds);
  if (error) throw error;

  const qtyMap = new Map((data ?? []).map((row) => [String(row.sku_id), Number(row.available_qty)]));
  const insufficient = findInsufficientStoreCheckoutStock(
    tracked.map((line) => ({
      ...line,
      availableQty: qtyMap.get(String(line.inventorySkuId)) ?? 0,
    })),
  );
  if (insufficient) throw new Error('store_checkout_insufficient_stock');
}

export function useSubmitCustomerVisitCheckout() {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();
  const { omnichannelBank } = useOmnichannelIncomeBankAccount();

  return useMutation({
    mutationFn: async (input: SubmitCustomerVisitCheckoutInput) => {
      if (!organizationId) throw new Error('Organization ID is required');
      if (storeCheckoutNeedsOmnichannelBank(input.paymentMethod) && !omnichannelBank?.id) {
        throw new Error('store_checkout_omnichannel_bank_missing');
      }

      await assertStoreCheckoutStock(input.lines);

      const tableNumber = normalizeTableNumber(input.tableNumber);
      const {
        data: visitRow,
        error: visitReadErr,
      } = await supabase
        .from('customer_visits')
        .select('id, lead_id, match_status, status')
        .eq('id', input.visitId)
        .eq('organization_id', organizationId)
        .maybeSingle();
      if (visitReadErr) throw visitReadErr;
      if (!visitRow?.id || visitRow.lead_id !== input.leadId || visitRow.match_status !== 'matched') {
        throw new Error('store_checkout_visit_not_found');
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      const activityId = await createStoreCheckoutSalesActivity({
        orgId: organizationId,
        leadId: input.leadId,
        clientName: input.clientName,
        clientPhone: input.clientPhone,
        createdBy: user?.id ?? null,
        paymentMethod: input.paymentMethod,
        paymentReference: input.paymentReference ?? null,
        cashTendered: input.cashTendered ?? null,
        customerVisitId: input.visitId,
        tableNumber,
        lines: input.lines,
      });

      try {
        await recordStoreCheckoutIncome({
          activityId,
          paymentMethod: input.paymentMethod,
        });
      } catch (err) {
        await rollbackStoreCheckoutSalesActivity(activityId);
        throw err;
      }

      await applyStoreCheckoutOfflineSales({
        organizationId,
        activityId,
        lines: input.lines,
      });

      const { data: linked, error: visitErr } = await supabase
        .from('customer_visits')
        .update({
          sales_activity_id: activityId,
          table_number: tableNumber,
        })
        .eq('id', input.visitId)
        .eq('organization_id', organizationId)
        .select('id')
        .maybeSingle();
      if (visitErr) throw visitErr;
      if (!linked?.id) {
        await rollbackStoreCheckoutSalesActivity(activityId);
        throw new Error('store_checkout_visit_not_found');
      }

      await markLeadConvertedIfNeeded({
        orgId: organizationId,
        leadId: input.leadId,
        changedBy: user?.id ?? null,
      });

      return activityId;
    },
    onSuccess: () => {
      if (!organizationId) return;
      invalidateStoreCheckoutQueries(queryClient, organizationId);
    },
  });
}
