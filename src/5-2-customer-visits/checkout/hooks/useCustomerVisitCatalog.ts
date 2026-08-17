import { signCatalogProductPhotos } from '@/8-2-1-default-prices/lib/catalogProductPhoto';
import { normalizeCatalogPosStatus } from '@/8-2-1-default-prices/lib/catalogKind';
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
};

export function useCustomerVisitCatalog() {
  const { organizationId } = useCurrentOrg();

  return useQuery({
    queryKey: ['customer-visit-catalog', organizationId],
    queryFn: async (): Promise<CustomerVisitCatalogItem[]> => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from('default_prices')
        .select(
          'id, kind, service_id, sub_service_id, unit_price, name, photo_path, unit, track_stock, inventory_sku_id, product_category_id, pos_status',
        )
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });
      if (error) throw error;

      const prices = (data ?? []) as DefaultPriceCatalogRow[];
      const serviceIds = [...new Set(prices.map((p) => p.service_id).filter(Boolean))] as string[];
      const subIds = [...new Set(prices.map((p) => p.sub_service_id).filter(Boolean))] as string[];
      const skuIds = [...new Set(prices.map((p) => p.inventory_sku_id).filter(Boolean))] as string[];
      const categoryIds = [...new Set(prices.map((p) => p.product_category_id).filter(Boolean))] as string[];

      const [servicesRes, subRes, levelRes, categoryRes, photoMap] = await Promise.all([
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
      ]);

      const serviceMap = new Map((servicesRes.data ?? []).map((s) => [s.id, s.name]));
      const subMap = new Map((subRes.data ?? []).map((s) => [s.id, s.name]));
      const qtyMap = new Map((levelRes.data ?? []).map((s) => [s.sku_id, Number(s.available_qty)]));
      const categoryMap = new Map((categoryRes.data ?? []).map((s) => [s.id, s.name]));

      return prices.map((row) => {
        const kind: CustomerVisitCatalogKind = row.kind === 'product' ? 'product' : 'service';
        const isProduct = kind === 'product';
        const skuId = row.inventory_sku_id ?? null;
        const categoryId = row.product_category_id ?? null;
        return {
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
          unitPrice: Number(row.unit_price) || 0,
          photoUrl: row.photo_path ? (photoMap.get(row.photo_path) ?? null) : null,
          unit: row.unit ?? (isProduct ? 'pcs' : null),
          trackStock: Boolean(row.track_stock),
          inventorySkuId: skuId,
          availableQty: skuId ? (qtyMap.get(skuId) ?? 0) : null,
          productCategoryId: isProduct ? categoryId : null,
          productCategoryName: isProduct && categoryId ? (categoryMap.get(categoryId) ?? null) : null,
          posStatus: isProduct ? normalizeCatalogPosStatus(row.pos_status) : 'available',
        };
      });
    },
    enabled: !!organizationId,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}
