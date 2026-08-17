import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import type { DefaultPriceRow, DefaultPriceCreate, DefaultPriceUpdate } from "../types/defaultPrices";
import { signCatalogProductPhotos } from "../lib/catalogProductPhoto";
import type { CatalogKind } from "../lib/catalogKind";

export function useDefaultPrices() {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["default-prices", organizationId],
    queryFn: async (): Promise<DefaultPriceRow[]> => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from("default_prices")
        .select("*")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const prices = (data ?? []) as DefaultPriceRow[];

      const serviceIds = [...new Set(prices.map((p) => p.service_id).filter(Boolean))] as string[];
      const subIds = [...new Set(prices.map((p) => p.sub_service_id).filter(Boolean))] as string[];
      const skuIds = [...new Set(prices.map((p) => p.inventory_sku_id).filter(Boolean))] as string[];
      const categoryIds = [...new Set(prices.map((p) => p.product_category_id).filter(Boolean))] as string[];

      const [servicesRes, subRes, skuRes, levelRes, categoryRes, photoMap] = await Promise.all([
        serviceIds.length
          ? supabase.from("services").select("id, name").in("id", serviceIds)
          : { data: [] as Array<{ id: string; name: string }> },
        subIds.length
          ? supabase.from("sub_services").select("id, name").in("id", subIds)
          : { data: [] as Array<{ id: string; name: string }> },
        skuIds.length
          ? supabase.from("inventory_skus").select("id, internal_sku").in("id", skuIds)
          : { data: [] as Array<{ id: string; internal_sku: string }> },
        skuIds.length
          ? supabase.from("inventory_stock_levels").select("sku_id, available_qty").in("sku_id", skuIds)
          : { data: [] as Array<{ sku_id: string; available_qty: number }> },
        categoryIds.length
          ? supabase.from("catalog_product_categories").select("id, name").in("id", categoryIds)
          : { data: [] as Array<{ id: string; name: string }> },
        signCatalogProductPhotos(prices.map((p) => p.photo_path ?? "")),
      ]);

      const serviceMap = new Map((servicesRes.data ?? []).map((s) => [s.id, s.name]));
      const subMap = new Map((subRes.data ?? []).map((s) => [s.id, s.name]));
      const skuCodeMap = new Map((skuRes.data ?? []).map((s) => [s.id, s.internal_sku]));
      const qtyMap = new Map((levelRes.data ?? []).map((s) => [s.sku_id, Number(s.available_qty)]));
      const categoryMap = new Map((categoryRes.data ?? []).map((s) => [s.id, s.name]));

      return prices.map((p) => {
        const skuCode = p.inventory_sku_id ? skuCodeMap.get(p.inventory_sku_id) : undefined;
        const qty = p.inventory_sku_id ? qtyMap.get(p.inventory_sku_id) : undefined;
        const kind = (p.kind === "product" ? "product" : "service") as CatalogKind;
        return {
          ...p,
          kind,
          service_name: p.service_id ? (serviceMap.get(p.service_id) ?? "") : (p.name ?? ""),
          sub_service_name: p.sub_service_id ? (subMap.get(p.sub_service_id) ?? "") : "",
          photo_url: p.photo_path ? (photoMap.get(p.photo_path) ?? null) : null,
          sku_code: skuCode ?? null,
          available_qty: qty ?? null,
          product_category_name: p.product_category_id ? (categoryMap.get(p.product_category_id) ?? "") : "",
          pos_status: p.pos_status === "sold_out" || p.pos_status === "hidden" ? p.pos_status : "available",
        };
      });
    },
    enabled: !!organizationId,
  });

  const createMutation = useMutation({
    mutationFn: async (payload: DefaultPriceCreate) => {
      const { data, error } = await supabase
        .from("default_prices")
        .insert({
          ...payload,
          updated_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["default-prices", organizationId] });
      queryClient.invalidateQueries({ queryKey: ["customer-visit-catalog", organizationId] });
      queryClient.invalidateQueries({ queryKey: ["inventory-skus", organizationId] });
      queryClient.invalidateQueries({ queryKey: ["catalog-product-categories", organizationId] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: DefaultPriceUpdate }) => {
      const { error } = await supabase
        .from("default_prices")
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["default-prices", organizationId] });
      queryClient.invalidateQueries({ queryKey: ["customer-visit-catalog", organizationId] });
      queryClient.invalidateQueries({ queryKey: ["inventory-skus", organizationId] });
      queryClient.invalidateQueries({ queryKey: ["catalog-product-categories", organizationId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("default_prices").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["default-prices", organizationId] });
      queryClient.invalidateQueries({ queryKey: ["customer-visit-catalog", organizationId] });
      queryClient.invalidateQueries({ queryKey: ["inventory-skus", organizationId] });
      queryClient.invalidateQueries({ queryKey: ["catalog-product-categories", organizationId] });
    },
  });

  return {
    rows,
    isLoading,
    create: createMutation.mutateAsync,
    update: updateMutation.mutateAsync,
    delete: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
