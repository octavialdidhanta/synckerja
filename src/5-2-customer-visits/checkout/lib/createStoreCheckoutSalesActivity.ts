import { getLocalDateYmd } from '@/shared/lib/date/getLocalDateYmd';
import { supabase } from '@/shared/lib/supabaseClient';
import type { CatalogCheckoutTotals } from '@/8-2-1-default-prices/checkout/lib/computeCatalogCheckoutTotals';
import type { CustomerVisitCartLine, CustomerVisitCheckoutPaymentMethod } from './customerVisitCheckout.types';
import { loadCheckoutCogsContext } from './loadCheckoutCogsContext';
import { resolveCheckoutLineUnitCogs } from './resolveCheckoutLineUnitCogs';
import { resolveCheckoutLineSalesTypeId } from './resolveCheckoutLineSalesTypeId';
import { lineTotal, sumCustomerVisitCart } from './sumCustomerVisitCart';
import {
  buildDiscountValueLabel,
  loadCatalogDiscountMeta,
} from './loadCatalogDiscountMeta';
import {
  buildTaxRateLabel,
  loadCatalogTaxMetaForOutlet,
  resolveCatalogTaxMeta,
} from './loadCatalogTaxMeta';
import {
  buildGratuityRateLabel,
  loadCatalogGratuityMetaForOutlet,
  resolveCatalogGratuityMeta,
} from './loadCatalogGratuityMeta';
import {
  computeModifierLineDiscount,
  loadModifierOptionMeta,
} from './loadModifierOptionMeta';

export type CreateStoreCheckoutArgs = {
  orgId: string;
  leadId: string;
  clientName: string;
  clientPhone: string | null;
  createdBy: string | null;
  paymentMethod: CustomerVisitCheckoutPaymentMethod;
  paymentReference?: string | null;
  paymentChannelId?: string | null;
  cashTendered?: number | null;
  customerVisitId?: string | null;
  tableNumber?: string | null;
  posTableId?: string | null;
  tableDurationMinutes?: number | null;
  outletId: string;
  salesTypeId?: string | null;
  /** Optional channel-mapped sales type for all lines (e.g. GoFood / Online Order). */
  channelSalesTypeId?: string | null;
  /** POS cashier shift that owns this checkout (cash drawer session). */
  posShiftId?: string | null;
  /** Waiter / order taker (distinct from created_by / Collected By). */
  servedByUserId?: string | null;
  checkoutTotals: CatalogCheckoutTotals;
  lines: CustomerVisitCartLine[];
};

/** Sum of line-level discounts (Rp) for the cart — persisted as checkout_discount_amount. */
export function sumCartLineDiscounts(lines: CustomerVisitCartLine[]): number {
  return lines.reduce((sum, line) => {
    const amount = Math.max(0, Math.round(Number(line.lineDiscount?.amountRp) || 0));
    return sum + amount;
  }, 0);
}

export async function rollbackStoreCheckoutSalesActivity(activityId: string): Promise<void> {
  const { error: rpcError } = await supabase.rpc('rollback_store_checkout_sales_activity', {
    p_activity_id: activityId,
  });
  if (!rpcError) return;

  const { data: pays, error: payErr } = await supabase
    .from('sales_activity_payments')
    .select('id')
    .eq('sales_activity_id', activityId);
  if (payErr) {
    console.error('createStoreCheckoutSalesActivity: rollback payment lookup failed', payErr);
  }
  const payIds = (pays ?? []).map((row) => String(row.id)).filter(Boolean);
  if (payIds.length > 0) {
    const { error: incomeErr } = await supabase
      .from('income_transactions')
      .delete()
      .in('sales_activity_payment_id', payIds);
    if (incomeErr) {
      console.error('createStoreCheckoutSalesActivity: rollback income failed', incomeErr);
    }
  }

  const { error } = await supabase.from('sales_activities').delete().eq('id', activityId);
  if (error) {
    console.error('createStoreCheckoutSalesActivity: rollback failed', rpcError, error);
  } else {
    console.error('createStoreCheckoutSalesActivity: rollback used client fallback', rpcError);
  }
}

/** Insert a paid store checkout activity + items. Income is recorded by RPC after this. */
export async function createStoreCheckoutSalesActivity(args: CreateStoreCheckoutArgs): Promise<string> {
  const cartTotals = sumCustomerVisitCart(args.lines);
  if (cartTotals.lineCount === 0 || cartTotals.total <= 0) {
    throw new Error('store_checkout_empty_cart');
  }
  const { checkoutTotals } = args;
  if (checkoutTotals.grandTotal <= 0) {
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
      total_amount: checkoutTotals.grandTotal,
      total_paid_amount: checkoutTotals.grandTotal,
      remaining_amount: 0,
      is_down_payment: false,
      payment_method: args.paymentMethod,
      payment_reference: args.paymentReference?.trim() || null,
      payment_channel_id: args.paymentChannelId ?? null,
      cash_tendered:
        args.paymentMethod === 'cash' && args.cashTendered != null && Number.isFinite(args.cashTendered)
          ? args.cashTendered
          : null,
      customer_visit_id: args.customerVisitId ?? null,
      table_number: args.tableNumber ?? null,
      pos_table_id: args.posTableId ?? null,
      table_duration_minutes:
        args.tableDurationMinutes != null && Number.isFinite(args.tableDurationMinutes)
          ? Math.max(0, Math.floor(args.tableDurationMinutes))
          : null,
      pos_outlet_id: args.outletId,
      catalog_sales_type_id: args.salesTypeId ?? null,
      pos_shift_id: args.posShiftId ?? null,
      served_by_user_id: args.servedByUserId ?? null,
      checkout_subtotal: checkoutTotals.subtotal,
      checkout_tax_amount: checkoutTotals.taxTotal,
      checkout_gratuity_amount: checkoutTotals.gratuityTotal,
      checkout_application_method: checkoutTotals.applicationMethod,
      checkout_discount_amount: sumCartLineDiscounts(args.lines),
      description: 'Store checkout',
    })
    .select('id')
    .single();

  if (insertErr) throw insertErr;
  const activityId = activity?.id as string | undefined;
  if (!activityId) throw new Error('store_checkout_insert_no_id');

  try {
    const productLines = args.lines.filter(
      (line) => line.kind === 'product' && lineTotal(line) > 0 && Boolean(line.catalogId),
    );
    const cogsCtx = await loadCheckoutCogsContext({
      organizationId: args.orgId,
      outletId: args.outletId,
      productIds: productLines.map((l) => l.catalogId),
      variantIds: productLines.map((l) => l.variantId).filter((id): id is string => Boolean(id)),
      modifierOptionIds: productLines.flatMap((l) =>
        (l.modifiers ?? []).map((m) => m.optionId).filter(Boolean),
      ),
    });

    const payableLines = args.lines.filter((line) => lineTotal(line) > 0);
    const itemRows = payableLines.map((line) => {
        const isProduct = line.kind === 'product' && Boolean(line.catalogId);
        const isBundle = line.kind === 'bundle' && Boolean(line.catalogId);
        const cogs = isProduct
          ? resolveCheckoutLineUnitCogs({
              productId: line.catalogId,
              variantId: line.variantId,
              modifierOptionIds: (line.modifiers ?? []).map((m) => m.optionId),
              ctx: cogsCtx,
            })
          : { unitCogs: null, cogsSource: 'none' as const };
        return {
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
          item_kind: line.kind === 'service' ? 'service' : 'product',
          inventory_sku_id: line.inventorySkuId,
          track_stock: Boolean(line.trackStock),
          catalog_product_id: isProduct ? line.catalogId : null,
          catalog_variant_id: isProduct ? (line.variantId ?? null) : null,
          catalog_bundle_id: isBundle ? line.catalogId : null,
          catalog_sales_type_id: resolveCheckoutLineSalesTypeId({
            line,
            billSalesTypeId: args.salesTypeId ?? null,
            channelSalesTypeId: args.channelSalesTypeId ?? null,
          }),
          unit_cogs: cogs.unitCogs,
          cogs_source: cogs.cogsSource,
        };
      });

    const { data: insertedItems, error: itemErr } = await supabase
      .from('sales_activity_items')
      .insert(itemRows)
      .select('id');
    if (itemErr) {
      await rollbackStoreCheckoutSalesActivity(activityId);
      throw itemErr;
    }

    const modifierOptionIds = payableLines.flatMap((line) =>
      line.kind === 'product' && !line.isCustomAmount
        ? (line.modifiers ?? []).map((m) => m.optionId).filter(Boolean)
        : [],
    );
    const modifierMeta =
      modifierOptionIds.length > 0 ? await loadModifierOptionMeta(modifierOptionIds) : new Map();

    const modifierRows: Array<Record<string, unknown>> = [];
    payableLines.forEach((line, index) => {
      if (line.kind !== 'product' || line.isCustomAmount) return;
      const modifiers = line.modifiers ?? [];
      if (modifiers.length === 0) return;

      const itemId = insertedItems?.[index]?.id as string | undefined;
      const lineGross = lineTotal(line);
      const lineDiscountTotal = Math.max(0, Math.round(Number(line.lineDiscount?.amountRp) || 0));

      for (const mod of modifiers) {
        if (!mod.optionId) continue;
        const meta = modifierMeta.get(mod.optionId);
        const extraPrice = Math.max(0, Math.round(Number(mod.extraPrice) || 0));
        const modifierGross = extraPrice * line.quantity;
        modifierRows.push({
          organization_id: args.orgId,
          sales_activity_id: activityId,
          sales_activity_item_id: itemId ?? null,
          modifier_group_id: meta?.groupId ?? null,
          modifier_option_id: mod.optionId,
          group_name: meta?.groupName ?? 'Unknown',
          option_name: mod.name?.trim() || meta?.optionName || 'Unknown',
          extra_price: extraPrice,
          quantity: line.quantity,
          line_quantity: line.quantity,
          gross_sales: modifierGross,
          discount_amount: computeModifierLineDiscount({
            modifierGross,
            lineGross,
            lineDiscountTotal,
          }),
        });
      }
    });

    if (modifierRows.length > 0) {
      const { error: modErr } = await supabase.from('sales_activity_item_modifiers').insert(modifierRows);
      if (modErr) {
        await rollbackStoreCheckoutSalesActivity(activityId);
        throw modErr;
      }
    }

    const discountIds = payableLines
      .map((line) => line.lineDiscount?.id)
      .filter((id): id is string => Boolean(id));
    const discountMeta =
      discountIds.length > 0 ? await loadCatalogDiscountMeta(discountIds) : new Map();

    const discountRows: Array<Record<string, unknown>> = [];
    payableLines.forEach((line, index) => {
      const discount = line.lineDiscount;
      if (!discount?.id && !discount?.name) return;
      const amountRp = Math.max(0, Math.round(Number(discount.amountRp) || 0));
      if (amountRp <= 0) return;

      const itemId = insertedItems?.[index]?.id as string | undefined;
      const meta = discount.id ? discountMeta.get(discount.id) : undefined;
      const discountName =
        discount.name?.trim() || meta?.name || 'Unknown';

      discountRows.push({
        organization_id: args.orgId,
        sales_activity_id: activityId,
        sales_activity_item_id: itemId ?? null,
        catalog_discount_id: discount.id || null,
        discount_name: discountName,
        amount_rp: amountRp,
        line_quantity: line.quantity,
        input_configuration: meta?.inputConfiguration ?? null,
        amount_unit: meta?.amountUnit ?? null,
        amount_value: meta?.amountValue ?? null,
        value_label: buildDiscountValueLabel({ meta: meta ?? null, amountRp }),
      });
    });

    if (discountRows.length > 0) {
      const { error: discErr } = await supabase
        .from('sales_activity_line_discounts')
        .insert(discountRows);
      if (discErr) {
        await rollbackStoreCheckoutSalesActivity(activityId);
        throw discErr;
      }
    }

    const taxMeta = await loadCatalogTaxMetaForOutlet({
      orgId: args.orgId,
      outletId: args.outletId,
    });

    const taxRows: Array<Record<string, unknown>> = [];
    for (const taxLine of checkoutTotals.taxLines) {
      const amountRp = Math.max(0, Math.round(Number(taxLine.amount) || 0));
      if (amountRp <= 0) continue;

      const meta = resolveCatalogTaxMeta({
        taxMeta,
        name: taxLine.name,
        amountPercent: taxLine.amount_percent,
      });
      const taxName = taxLine.name?.trim() || meta?.name || 'Unknown';

      taxRows.push({
        organization_id: args.orgId,
        sales_activity_id: activityId,
        catalog_tax_id: meta?.taxId ?? null,
        tax_name: taxName,
        amount_percent: taxLine.amount_percent,
        amount_rp: amountRp,
        taxable_base_rp: Math.max(0, Math.round(Number(checkoutTotals.taxBase) || 0)),
        is_backfill_estimate: false,
        rate_label: buildTaxRateLabel(taxLine.amount_percent),
        application_method: checkoutTotals.applicationMethod,
      });
    }

    if (taxRows.length > 0) {
      const { error: taxErr } = await supabase.from('sales_activity_checkout_taxes').insert(taxRows);
      if (taxErr) {
        await rollbackStoreCheckoutSalesActivity(activityId);
        throw taxErr;
      }
    }

    const gratuityMeta = await loadCatalogGratuityMetaForOutlet({
      orgId: args.orgId,
      outletId: args.outletId,
    });

    const gratuityRows: Array<Record<string, unknown>> = [];
    for (const gratuityLine of checkoutTotals.gratuityLines) {
      const amountRp = Math.max(0, Math.round(Number(gratuityLine.amount) || 0));
      if (amountRp <= 0) continue;

      const meta = resolveCatalogGratuityMeta({
        gratuityMeta,
        name: gratuityLine.name,
        amountPercent: gratuityLine.amount_percent,
      });
      const gratuityName = gratuityLine.name?.trim() || meta?.name || 'Unknown';

      gratuityRows.push({
        organization_id: args.orgId,
        sales_activity_id: activityId,
        catalog_gratuity_id: meta?.gratuityId ?? null,
        gratuity_name: gratuityName,
        amount_percent: gratuityLine.amount_percent,
        amount_rp: amountRp,
        rate_label: buildGratuityRateLabel(gratuityLine.amount_percent),
        application_method: checkoutTotals.applicationMethod,
        is_backfill_estimate: false,
      });
    }

    if (gratuityRows.length > 0) {
      const { error: gratuityErr } = await supabase
        .from('sales_activity_checkout_gratuities')
        .insert(gratuityRows);
      if (gratuityErr) {
        await rollbackStoreCheckoutSalesActivity(activityId);
        throw gratuityErr;
      }
    }
  } catch (err) {
    await rollbackStoreCheckoutSalesActivity(activityId);
    throw err;
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
