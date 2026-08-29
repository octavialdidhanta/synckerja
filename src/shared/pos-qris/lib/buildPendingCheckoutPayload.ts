import { getLocalDateYmd } from "@/shared/lib/date/getLocalDateYmd";
import type { CatalogCheckoutTotals } from "@/8-2-1-default-prices/checkout/lib/computeCatalogCheckoutTotals";
import type { CustomerVisitCartLine } from "@/5-2-customer-visits/checkout/lib/customerVisitCheckout.types";
import {
  sumCartLineDiscounts,
  type CreateStoreCheckoutArgs,
} from "@/5-2-customer-visits/checkout/lib/createStoreCheckoutSalesActivity";
import { loadCheckoutCogsContext } from "@/5-2-customer-visits/checkout/lib/loadCheckoutCogsContext";
import { resolveCheckoutLineUnitCogs } from "@/5-2-customer-visits/checkout/lib/resolveCheckoutLineUnitCogs";
import { resolveCheckoutLineSalesTypeId } from "@/5-2-customer-visits/checkout/lib/resolveCheckoutLineSalesTypeId";
import { lineTotal, sumCustomerVisitCart } from "@/5-2-customer-visits/checkout/lib/sumCustomerVisitCart";
import {
  buildDiscountValueLabel,
  loadCatalogDiscountMeta,
} from "@/5-2-customer-visits/checkout/lib/loadCatalogDiscountMeta";
import {
  computeModifierLineDiscount,
  loadModifierOptionMeta,
} from "@/5-2-customer-visits/checkout/lib/loadModifierOptionMeta";
import {
  catalogCheckoutSaleLines,
  type StoreCheckoutStockLine,
} from "@/5-2-customer-visits/checkout/lib/storeCheckoutStock";

export type BuildPendingCheckoutPayloadArgs = CreateStoreCheckoutArgs & {
  leadId: string;
  posShiftId?: string | null;
  sessionId?: string | null;
  keepSessionOpen?: boolean;
  remainderCartLines?: CustomerVisitCartLine[] | null;
};

export async function buildPendingCheckoutPayload(
  args: BuildPendingCheckoutPayloadArgs,
): Promise<Record<string, unknown>> {
  const cartTotals = sumCustomerVisitCart(args.lines);
  if (cartTotals.lineCount === 0 || cartTotals.total <= 0) {
    throw new Error("store_checkout_empty_cart");
  }
  if (args.checkoutTotals.grandTotal <= 0) {
    throw new Error("store_checkout_empty_cart");
  }

  const first = args.lines.find((line) => lineTotal(line) > 0);
  const clientName = args.clientName.trim() || "Walk-in";

  const activity = {
    lead_id: args.leadId,
    client_name: clientName,
    client_phone: args.clientPhone?.trim() || null,
    client_email: null,
    date: getLocalDateYmd(),
    created_by: args.createdBy,
    service_id: first?.serviceId ?? null,
    sub_service_id: first?.subServiceId ?? null,
    total_amount: args.checkoutTotals.grandTotal,
    payment_reference: args.paymentReference?.trim() || null,
    payment_channel_id: args.paymentChannelId ?? null,
    customer_visit_id: args.customerVisitId ?? null,
    table_number: args.tableNumber ?? null,
    pos_table_id: args.posTableId ?? null,
    table_duration_minutes:
      args.tableDurationMinutes != null && Number.isFinite(args.tableDurationMinutes)
        ? Math.max(0, Math.floor(args.tableDurationMinutes))
        : null,
    catalog_sales_type_id: args.salesTypeId ?? null,
    served_by_user_id: args.servedByUserId ?? null,
    checkout_subtotal: args.checkoutTotals.subtotal,
    checkout_tax_amount: args.checkoutTotals.taxTotal,
    checkout_gratuity_amount: args.checkoutTotals.gratuityTotal,
    checkout_application_method: args.checkoutTotals.applicationMethod,
    checkout_discount_amount: sumCartLineDiscounts(args.lines),
    description: "Store checkout",
  };

  const productLines = args.lines.filter(
    (line) => line.kind === "product" && lineTotal(line) > 0 && Boolean(line.catalogId),
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
  const items = payableLines.map((line) => {
    const isProduct = line.kind === "product" && Boolean(line.catalogId);
    const isBundle = line.kind === "bundle" && Boolean(line.catalogId);
    const cogs = isProduct
      ? resolveCheckoutLineUnitCogs({
          productId: line.catalogId,
          variantId: line.variantId,
          modifierOptionIds: (line.modifiers ?? []).map((m) => m.optionId),
          ctx: cogsCtx,
        })
      : { unitCogs: null, cogsSource: "none" as const };
    return {
      service_id: line.serviceId,
      sub_service_id: line.subServiceId,
      service_name: line.serviceName,
      sub_service_name: line.subServiceName,
      quantity: line.quantity,
      unit_price: line.unitPrice,
      total_price: lineTotal(line),
      notes: null,
      item_kind: line.kind === "service" ? "service" : "product",
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

  const modifierOptionIds = payableLines.flatMap((line) =>
    line.kind === "product" && !line.isCustomAmount
      ? (line.modifiers ?? []).map((m) => m.optionId).filter(Boolean)
      : [],
  );
  const modifierMeta =
    modifierOptionIds.length > 0 ? await loadModifierOptionMeta(modifierOptionIds) : new Map();

  const modifiers: Array<Record<string, unknown>> = [];
  payableLines.forEach((line, index) => {
    if (line.kind !== "product" || line.isCustomAmount) return;
    const lineMods = line.modifiers ?? [];
    if (lineMods.length === 0) return;
    const lineGross = lineTotal(line);
    const lineDiscountTotal = Math.max(0, Math.round(Number(line.lineDiscount?.amountRp) || 0));
    for (const mod of lineMods) {
      if (!mod.optionId) continue;
      const meta = modifierMeta.get(mod.optionId);
      const extraPrice = Math.max(0, Math.round(Number(mod.extraPrice) || 0));
      const modifierGross = extraPrice * line.quantity;
      modifiers.push({
        item_index: index,
        modifier_group_id: meta?.groupId ?? null,
        modifier_option_id: mod.optionId,
        group_name: meta?.groupName ?? "Unknown",
        option_name: mod.name?.trim() || meta?.optionName || "Unknown",
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

  const discountIds = payableLines
    .map((line) => line.lineDiscount?.id)
    .filter((id): id is string => Boolean(id));
  const discountMeta =
    discountIds.length > 0 ? await loadCatalogDiscountMeta(discountIds) : new Map();

  const discounts: Array<Record<string, unknown>> = [];
  payableLines.forEach((line, index) => {
    const discount = line.lineDiscount;
    if (!discount?.id && !discount?.name) return;
    const amountRp = Math.max(0, Math.round(Number(discount.amountRp) || 0));
    if (amountRp <= 0) return;
    const meta = discount.id ? discountMeta.get(discount.id) : undefined;
    discounts.push({
      item_index: index,
      catalog_discount_id: discount.id || null,
      discount_name: discount.name?.trim() || meta?.name || "Unknown",
      amount_rp: amountRp,
      line_quantity: line.quantity,
      input_configuration: meta?.inputConfiguration ?? null,
      amount_unit: meta?.amountUnit ?? null,
      amount_value: meta?.amountValue ?? null,
      value_label: buildDiscountValueLabel({ meta: meta ?? null, amountRp }),
    });
  });

  const stockLines = catalogCheckoutSaleLines(
    args.lines as Array<StoreCheckoutStockLine & { stockScope?: "full" | "recipe_only" | "finished_goods_only"; lineKey?: string }>,
  ).map((line, index) => ({
    product_id: line.productId,
    qty: line.qty,
    variant_id: line.variantId ?? null,
    modifier_option_ids: line.modifierOptionIds ?? [],
    line_key: line.lineKey ?? `L${index + 1}`,
    stock_scope: line.stockScope ?? "full",
  }));

  return {
    activity,
    items,
    modifiers,
    discounts,
    catalogStockLines: stockLines,
    checkoutTotals: args.checkoutTotals as CatalogCheckoutTotals,
    leadId: args.leadId,
    posShiftId: args.posShiftId ?? null,
    sessionId: args.sessionId ?? null,
    keepSessionOpen: args.keepSessionOpen ?? false,
    remainderCartLines: args.remainderCartLines ?? null,
  };
}
