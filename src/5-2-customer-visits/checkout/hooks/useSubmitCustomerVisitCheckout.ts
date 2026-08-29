import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useOmnichannelIncomeBankAccount } from '@/shared/hooks/finance/useOmnichannelIncomeBankAccount';
import { supabase } from '@/shared/lib/supabaseClient';
import type { CatalogCheckoutTotals } from '@/8-2-1-default-prices/checkout/lib/computeCatalogCheckoutTotals';
import { applyStoreCheckoutOfflineSales } from '../lib/applyStoreCheckoutOfflineSales';
import {
  createStoreCheckoutSalesActivity,
  markLeadConvertedIfNeeded,
  rollbackStoreCheckoutSalesActivity,
} from '../lib/createStoreCheckoutSalesActivity';
import { recordStoreCheckoutIncome, storeCheckoutNeedsOmnichannelBank } from '../lib/recordStoreCheckoutIncome';
import { findInsufficientStoreCheckoutStock, trackedStoreCheckoutLines } from '../lib/storeCheckoutStock';
import { assertCheckoutIngredientStockOrThrow } from '@/stock-management/catalog-ledger/lib/assertCheckoutIngredientStockClient';
import { enqueuePosReceiptFeedbackShare } from '../lib/enqueuePosReceiptFeedbackShare';
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
  outletId: string;
  salesTypeId?: string | null;
  checkoutTotals: CatalogCheckoutTotals;
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
  queryClient.invalidateQueries({ queryKey: ['inventory-summary'] });
  queryClient.invalidateQueries({ queryKey: ['catalog-ingredients', organizationId] });
  queryClient.invalidateQueries({ queryKey: ['product-ids-with-base-recipe', organizationId] });
  queryClient.invalidateQueries({ queryKey: ['sales-activities', organizationId] });
  queryClient.invalidateQueries({ queryKey: ['leads', organizationId] });
  queryClient.invalidateQueries({ queryKey: ['income-transactions', organizationId] });
  queryClient.invalidateQueries({ queryKey: ['income-transactions'] });
  queryClient.invalidateQueries({ queryKey: ['income-transaction-summary', organizationId] });
  queryClient.invalidateQueries({ queryKey: ['income-metrics', organizationId] });
  queryClient.invalidateQueries({ queryKey: ['monthly-income-data', organizationId] });
  queryClient.invalidateQueries({ queryKey: ['bank-account-balances'] });
  queryClient.invalidateQueries({ queryKey: ['operations-customers-list', organizationId] });
}

async function assertStoreCheckoutStock(
  lines: CustomerVisitCartLine[],
  outletId: string,
): Promise<void> {
  const tracked = trackedStoreCheckoutLines(lines);
  if (tracked.length > 0) {
    const catalogInsufficient = findInsufficientStoreCheckoutStock(tracked);
    if (catalogInsufficient) throw new Error('store_checkout_insufficient_stock');

    const skuTracked = tracked.filter((line) => Boolean(line.inventorySkuId));
    if (skuTracked.length > 0) {
      const skuIds = [...new Set(skuTracked.map((line) => String(line.inventorySkuId)))];
      const { data, error } = await supabase
        .from('inventory_stock_levels')
        .select('sku_id, available_qty')
        .in('sku_id', skuIds);
      if (error) throw error;

      const qtyMap = new Map((data ?? []).map((row) => [String(row.sku_id), Number(row.available_qty)]));
      const insufficient = findInsufficientStoreCheckoutStock(
        skuTracked.map((line) => ({
          ...line,
          availableQty: qtyMap.get(String(line.inventorySkuId)) ?? 0,
        })),
      );
      if (insufficient) throw new Error('store_checkout_insufficient_stock');
    }
  }

  await assertCheckoutIngredientStockOrThrow({ outletId, lines });
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

      await assertStoreCheckoutStock(input.lines, input.outletId);

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
        outletId: input.outletId,
        salesTypeId: input.salesTypeId ?? null,
        servedByUserId: null,
        checkoutTotals: input.checkoutTotals,
        lines: input.lines,
      });

      try {
        await applyStoreCheckoutOfflineSales({
          organizationId,
          activityId,
          outletId: input.outletId,
          lines: input.lines,
        });
      } catch (err) {
        await rollbackStoreCheckoutSalesActivity(activityId);
        throw err;
      }

      try {
        await recordStoreCheckoutIncome({
          activityId,
          paymentMethod: input.paymentMethod,
        });
      } catch (err) {
        await rollbackStoreCheckoutSalesActivity(activityId);
        throw err;
      }

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

      void enqueuePosReceiptFeedbackShare({
        organizationId,
        salesActivityId: activityId,
        outletId: input.outletId,
        createdByUserId: user?.id ?? null,
        clientName: input.clientName,
        clientPhone: input.clientPhone,
        leadId: input.leadId,
      });

      return activityId;
    },
    onSuccess: () => {
      if (!organizationId) return;
      invalidateStoreCheckoutQueries(queryClient, organizationId);
    },
  });
}
