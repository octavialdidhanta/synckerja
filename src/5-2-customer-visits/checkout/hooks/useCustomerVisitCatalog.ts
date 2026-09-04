import { signCatalogProductPhotos } from '@/8-2-1-default-prices/lib/catalogProductPhoto';
import {
  isCatalogPosStatus,
  normalizeCatalogPosStatus,
} from '@/8-2-1-default-prices/lib/catalogKind';
import { resolveStockCommitPolicy } from '@/stock-management/stock-commit/lib/resolveStockCommitPolicy';
import { useQuery } from '@tanstack/react-query';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { supabase } from '@/shared/lib/supabaseClient';
import type { CustomerVisitCatalogItem, CustomerVisitCatalogKind } from '../lib/customerVisitCheckout.types';

type DefaultPriceCatalogRow = {
  id: string;
  kind: string | null;
  service_id: string | null;
  sub_service_id: string | null;
  unit_price: number | null;
  name: string | null;
  photo_path: string | null;
  unit: string | null;
  track_stock: boolean | null;
  inventory_sku_id: string | null;
  product_category_id: string | null;
  pos_status: string | null;
  sku: string | null;
};

type ProductOutletRow = {
  product_id: string;
  outlet_id: string;
  in_stock: number | null;
  reserved_qty: number | null;
  unit_price: number | string | null;
  pos_status: string | null;
};

export function useCustomerVisitCatalog(outletId: string | null) {
  const { organizationId } = useCurrentOrg();

  return useQuery({
    queryKey: ['customer-visit-catalog', organizationId, outletId],
    queryFn: async (): Promise<CustomerVisitCatalogItem[]> => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from('default_prices')
        .select(
          'id, kind, service_id, sub_service_id, unit_price, name, photo_path, unit, track_stock, inventory_sku_id, product_category_id, pos_status, use_sales_type_prices, sku',
        )
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });
      if (error) throw error;

      const prices = (data ?? []) as Array<
        DefaultPriceCatalogRow & { use_sales_type_prices?: boolean | null }
      >;
      const serviceIds = [...new Set(prices.map((p) => p.service_id).filter(Boolean))] as string[];
      const subIds = [...new Set(prices.map((p) => p.sub_service_id).filter(Boolean))] as string[];
      const skuIds = [...new Set(prices.map((p) => p.inventory_sku_id).filter(Boolean))] as string[];
      const categoryIds = [...new Set(prices.map((p) => p.product_category_id).filter(Boolean))] as string[];
      const productIds = prices.filter((p) => p.kind === 'product').map((p) => p.id);

      const [servicesRes, subRes, levelRes, categoryRes, photoMap, outletRes, variantRes, modifierLinkRes, stpRes] =
        await Promise.all([
        serviceIds.length
          ? supabase.from('services').select('id, name').in('id', serviceIds)
          : { data: [] as Array<{ id: string; name: string }> },
        subIds.length
          ? supabase.from('sub_services').select('id, name').in('id', subIds)
          : { data: [] as Array<{ id: string; name: string }> },
        skuIds.length
          ? supabase.from('inventory_stock_levels').select('sku_id, available_qty').in('sku_id', skuIds)
          : { data: [] as Array<{ sku_id: string; available_qty: number }> },
        categoryIds.length
          ? supabase.from('catalog_product_categories').select('id, name').in('id', categoryIds)
          : { data: [] as Array<{ id: string; name: string }> },
        signCatalogProductPhotos(prices.map((p) => p.photo_path ?? '')),
        productIds.length
          ? supabase
              .from('catalog_product_outlets')
              .select('product_id, outlet_id, in_stock, reserved_qty, unit_price, pos_status')
              .in('product_id', productIds)
          : { data: [] as ProductOutletRow[] },
        productIds.length
          ? supabase
              .from('catalog_product_variants')
              .select('id, product_id, sort_order')
              .in('product_id', productIds)
              .order('sort_order', { ascending: true })
          : { data: [] as Array<{ id: string; product_id: string; sort_order: number }> },
        productIds.length
          ? supabase
              .from('catalog_product_modifiers')
              .select('product_id, group_id')
              .in('product_id', productIds)
          : { data: [] as Array<{ product_id: string; group_id: string }> },
        productIds.length
          ? supabase
              .from('catalog_product_sales_type_prices')
              .select('product_id, sales_type_id, price')
              .in('product_id', productIds)
          : { data: [] as Array<{ product_id: string; sales_type_id: string; price: number }> },
      ]);

      const modifierGroupIds = [
        ...new Set((modifierLinkRes.data ?? []).map((r) => r.group_id).filter(Boolean)),
      ];
      const modifierOutletRes = modifierGroupIds.length
        ? await supabase
            .from('catalog_modifier_outlets')
            .select('group_id, outlet_id')
            .in('group_id', modifierGroupIds)
        : { data: [] as Array<{ group_id: string; outlet_id: string }> };
      const activeGroupRes = modifierGroupIds.length
        ? await supabase
            .from('catalog_modifier_groups')
            .select('id')
            .in('id', modifierGroupIds)
            .eq('is_active', true)
        : { data: [] as Array<{ id: string }> };

      const variantIds = (variantRes.data ?? []).map((row) => row.id);
      const variantStockQuery = variantIds.length
        ? await supabase
            .from('catalog_product_variant_outlets')
            .select('variant_id, outlet_id, in_stock, reserved_qty')
            .in('variant_id', variantIds)
        : { data: [] as Array<{ variant_id: string; outlet_id: string; in_stock: number; reserved_qty: number }> };

      const { data: defaultOutlet } = outletId
        ? { data: { id: outletId } }
        : await supabase
            .from('pos_outlets')
            .select('id')
            .eq('organization_id', organizationId)
            .order('is_default', { ascending: false })
            .limit(1)
            .maybeSingle();
      const resolvedOutletId = outletId ?? defaultOutlet?.id ?? null;

      const stockCommitPoint =
        organizationId && resolvedOutletId
          ? await resolveStockCommitPolicy({
              organizationId,
              outletId: resolvedOutletId,
            })
          : 'pay';
      const useAtp = stockCommitPoint === 'fulfillment';

      const serviceMap = new Map((servicesRes.data ?? []).map((s) => [s.id, s.name]));
      const subMap = new Map((subRes.data ?? []).map((s) => [s.id, s.name]));
      const qtyMap = new Map((levelRes.data ?? []).map((s) => [s.sku_id, Number(s.available_qty)]));
      const categoryMap = new Map((categoryRes.data ?? []).map((s) => [s.id, s.name]));
      const firstVariantByProduct = new Map<string, string>();
      const variantCountByProduct = new Map<string, number>();
      for (const row of variantRes.data ?? []) {
        if (!firstVariantByProduct.has(row.product_id)) firstVariantByProduct.set(row.product_id, row.id);
        variantCountByProduct.set(
          row.product_id,
          (variantCountByProduct.get(row.product_id) ?? 0) + 1,
        );
      }
      const variantQty = new Map(
        (variantStockQuery.data ?? [])
          .filter((row) => !resolvedOutletId || row.outlet_id === resolvedOutletId)
          .map((row) => {
            const inStock = Number(row.in_stock) || 0;
            const reserved = useAtp ? Number(row.reserved_qty) || 0 : 0;
            return [row.variant_id, Math.max(0, inStock - reserved)] as const;
          }),
      );

      const activeGroupIds = new Set((activeGroupRes.data ?? []).map((g) => g.id));
      const groupOutlets = new Map<string, Set<string>>();
      for (const row of modifierOutletRes.data ?? []) {
        if (!activeGroupIds.has(row.group_id)) continue;
        const set = groupOutlets.get(row.group_id) ?? new Set<string>();
        set.add(row.outlet_id);
        groupOutlets.set(row.group_id, set);
      }
      const productsWithModifiers = new Set<string>();
      for (const link of modifierLinkRes.data ?? []) {
        if (!activeGroupIds.has(link.group_id)) continue;
        const outlets = groupOutlets.get(link.group_id);
        if (!outlets || outlets.size === 0) continue;
        if (resolvedOutletId && !outlets.has(resolvedOutletId)) continue;
        productsWithModifiers.add(link.product_id);
      }

      const productsWithStp = new Set<string>();
      for (const row of stpRes.data ?? []) {
        if (Number(row.price) > 0) productsWithStp.add(row.product_id);
      }

      const outletLinksByProduct = new Map<string, ProductOutletRow>();
      for (const row of (outletRes.data ?? []) as ProductOutletRow[]) {
        if (resolvedOutletId && row.outlet_id !== resolvedOutletId) continue;
        if (!outletLinksByProduct.has(row.product_id)) {
          outletLinksByProduct.set(row.product_id, row);
        }
      }

      const items: CustomerVisitCatalogItem[] = [];
      for (const row of prices) {
        const kind: CustomerVisitCatalogKind = row.kind === 'product' ? 'product' : 'service';
        const isProduct = kind === 'product';
        const outletLink = isProduct ? outletLinksByProduct.get(row.id) : undefined;

        // Products must be assigned to the active outlet (BO product-list parity).
        if (isProduct && resolvedOutletId && !outletLink) continue;

        const skuId = row.inventory_sku_id ?? null;
        const categoryId = row.product_category_id ?? null;
        const firstVariantId = firstVariantByProduct.get(row.id);
        const rawCatalogQty = firstVariantId
          ? (variantQty.get(firstVariantId) ?? 0)
          : Number(outletLink?.in_stock ?? 0);
        const productReserved = useAtp ? Number(outletLink?.reserved_qty ?? 0) : 0;
        const catalogQty = firstVariantId
          ? rawCatalogQty
          : Math.max(0, rawCatalogQty - productReserved);
        const availableQty = Boolean(row.track_stock)
          ? catalogQty
          : skuId
            ? (qtyMap.get(skuId) ?? 0)
            : null;

        const overridePrice =
          outletLink?.unit_price == null ? null : Number(outletLink.unit_price);
        const unitPrice =
          overridePrice != null && Number.isFinite(overridePrice)
            ? overridePrice
            : Number(row.unit_price) || 0;

        const overrideStatus =
          outletLink?.pos_status && isCatalogPosStatus(outletLink.pos_status)
            ? outletLink.pos_status
            : null;
        const posStatus = isProduct
          ? (overrideStatus ?? normalizeCatalogPosStatus(row.pos_status))
          : 'available';

        const useSalesTypePrices = Boolean(row.use_sales_type_prices);

        items.push({
          id: String(row.id),
          kind,
          serviceId: row.service_id ?? null,
          subServiceId: row.sub_service_id ?? null,
          serviceName: isProduct
            ? (row.name ?? '').trim()
            : serviceMap.get(String(row.service_id ?? '')) ?? '',
          subServiceName: isProduct
            ? (row.unit ?? 'pcs')
            : row.sub_service_id
              ? (subMap.get(String(row.sub_service_id)) ?? null)
              : null,
          unitPrice,
          photoUrl: row.photo_path ? (photoMap.get(row.photo_path) ?? null) : null,
          unit: row.unit ?? (isProduct ? 'pcs' : null),
          trackStock: Boolean(row.track_stock),
          inventorySkuId: skuId,
          catalogSku: isProduct ? (row.sku?.trim() || null) : null,
          availableQty,
          productCategoryId: isProduct ? categoryId : null,
          productCategoryName: isProduct && categoryId ? (categoryMap.get(categoryId) ?? null) : null,
          posStatus,
          variantCount: isProduct ? (variantCountByProduct.get(row.id) ?? 0) : 0,
          hasModifiers: isProduct ? productsWithModifiers.has(row.id) : false,
          useSalesTypePrices: isProduct ? useSalesTypePrices : false,
          hasSalesTypePrices: isProduct ? useSalesTypePrices && productsWithStp.has(row.id) : false,
        });
      }
      return items;
    },
    enabled: !!organizationId,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });
}
