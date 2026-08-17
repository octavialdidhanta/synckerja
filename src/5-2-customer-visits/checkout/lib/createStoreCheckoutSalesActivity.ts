import { getLocalDateYmd } from '@/shared/lib/date/getLocalDateYmd';
import { supabase } from '@/shared/lib/supabaseClient';
import type { CustomerVisitCartLine, CustomerVisitCheckoutPaymentMethod } from './customerVisitCheckout.types';
import { lineTotal, sumCustomerVisitCart } from './sumCustomerVisitCart';

export type CreateStoreCheckoutArgs = {
  orgId: string;
  leadId: string;
  clientName: string;
  clientPhone: string | null;
  createdBy: string | null;
  paymentMethod: CustomerVisitCheckoutPaymentMethod;
  paymentReference?: string | null;
  cashTendered?: number | null;
  customerVisitId?: string | null;
  tableNumber?: string | null;
  lines: CustomerVisitCartLine[];
};

export async function rollbackStoreCheckoutSalesActivity(activityId: string): Promise<void> {
  const { error } = await supabase.from('sales_activities').delete().eq('id', activityId);
  if (error) console.error('createStoreCheckoutSalesActivity: rollback failed', error);
}

/** Insert a paid store checkout activity + items. Income is recorded by RPC after this. */
export async function createStoreCheckoutSalesActivity(args: CreateStoreCheckoutArgs): Promise<string> {
  const totals = sumCustomerVisitCart(args.lines);
  if (totals.lineCount === 0 || totals.total <= 0) {
    throw new Error('store_checkout_empty_cart');
  }

  const first = args.lines.find((line) => lineTotal(line) > 0);
  const clientName = args.clientName.trim() || 'Walk-in';

  const { data: activity, error: insertErr } = await supabase
    .from('sales_activities')
    .insert({
      organization_id: args.orgId,
      lead_id: args.leadId,
      client_name: clientName,
      client_phone: args.clientPhone?.trim() || null,
      client_email: null,
      activity_type: 'Store Checkout',
      status: 'Converted',
      date: getLocalDateYmd(),
      created_by: args.createdBy,
      service_id: first?.serviceId ?? null,
      sub_service_id: first?.subServiceId ?? null,
      total_amount: totals.total,
      total_paid_amount: totals.total,
      remaining_amount: 0,
      is_down_payment: false,
      payment_method: args.paymentMethod,
      payment_reference: args.paymentReference?.trim() || null,
      cash_tendered:
        args.paymentMethod === 'cash' && args.cashTendered != null && Number.isFinite(args.cashTendered)
          ? args.cashTendered
          : null,
      customer_visit_id: args.customerVisitId ?? null,
      table_number: args.tableNumber ?? null,
      description: 'Store checkout',
    })
    .select('id')
    .single();

  if (insertErr) throw insertErr;
  const activityId = activity?.id as string | undefined;
  if (!activityId) throw new Error('store_checkout_insert_no_id');

  const itemRows = args.lines
    .filter((line) => lineTotal(line) > 0)
    .map((line) => ({
      sales_activity_id: activityId,
      organization_id: args.orgId,
      service_id: line.serviceId,
      sub_service_id: line.subServiceId,
      service_name: line.serviceName,
      sub_service_name: line.subServiceName,
      quantity: line.quantity,
      unit_price: line.unitPrice,
      total_price: lineTotal(line),
      notes: null,
      item_kind: line.kind === 'product' ? 'product' : 'service',
      inventory_sku_id: line.inventorySkuId,
      track_stock: Boolean(line.trackStock),
    }));

  const { error: itemErr } = await supabase.from('sales_activity_items').insert(itemRows);
  if (itemErr) {
    await rollbackStoreCheckoutSalesActivity(activityId);
    throw itemErr;
  }

  return activityId;
}

export async function markLeadConvertedIfNeeded(args: {
  orgId: string;
  leadId: string;
  changedBy: string | null;
}): Promise<void> {
  const { data: lead, error: leadErr } = await supabase
    .from('leads')
    .select('id, status_id, converted_at')
    .eq('id', args.leadId)
    .eq('organization_id', args.orgId)
    .maybeSingle();
  if (leadErr) {
    console.error('markLeadConvertedIfNeeded: load lead', leadErr);
    return;
  }
  if (!lead) return;

  let statusName: string | null = null;
  if (lead.status_id) {
    const { data: currentStatus } = await supabase
      .from('lead_statuses')
      .select('name')
      .eq('id', lead.status_id)
      .maybeSingle();
    statusName = (currentStatus?.name as string | null) ?? null;
  }
  if ((statusName ?? '').trim().toLowerCase() === 'converted') return;

  const { data: statuses, error: statusErr } = await supabase
    .from('lead_statuses')
    .select('id, name, organization_id')
    .or(`organization_id.eq.${args.orgId},organization_id.is.null`);
  if (statusErr) {
    console.error('markLeadConvertedIfNeeded: load statuses', statusErr);
    return;
  }

  const convertedRows = (statuses ?? []).filter(
    (row) => String(row.name ?? '').trim().toLowerCase() === 'converted',
  );
  const converted =
    convertedRows.find((row) => row.organization_id === args.orgId) ?? convertedRows[0] ?? null;
  if (!converted?.id) return;

  const nowIso = new Date().toISOString();
  const { error: updateErr } = await supabase
    .from('leads')
    .update({
      status_id: converted.id,
      converted_at: lead.converted_at ?? nowIso,
    })
    .eq('id', args.leadId)
    .eq('organization_id', args.orgId);
  if (updateErr) {
    console.error('markLeadConvertedIfNeeded: update lead', updateErr);
    return;
  }

  const { data: userData } = await supabase.auth.getUser();
  const userName =
    (userData?.user?.user_metadata?.full_name as string) || userData?.user?.email || null;
  const { error: historyErr } = await supabase.from('lead_status_history').insert({
    lead_id: args.leadId,
    old_status: statusName ?? null,
    new_status: 'Converted',
    changed_at: nowIso,
    changed_by: args.changedBy ?? userData?.user?.id ?? null,
    changed_by_name: userName,
    organization_id: args.orgId,
  });
  if (historyErr) console.error('markLeadConvertedIfNeeded: history', historyErr);
}
