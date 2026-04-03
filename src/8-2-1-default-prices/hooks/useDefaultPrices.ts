import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import type { DefaultPriceRow, DefaultPriceCreate, DefaultPriceUpdate } from "../types/defaultPrices";

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

      const serviceIds = [...new Set(prices.map((p) => p.service_id))];
      const subIds = [...new Set(prices.map((p) => p.sub_service_id).filter(Boolean))] as string[];

      const [servicesRes, subRes] = await Promise.all([
        serviceIds.length
          ? supabase.from("services").select("id, name").in("id", serviceIds)
          : { data: [] },
        subIds.length ? supabase.from("sub_services").select("id, name").in("id", subIds) : { data: [] },
      ]);

      const serviceMap = new Map(
        (servicesRes.data ?? []).map((s: { id: string; name: string }) => [s.id, s.name]),
      );
      const subMap = new Map(
        (subRes.data ?? []).map((s: { id: string; name: string }) => [s.id, s.name]),
      );

      return prices.map((p) => ({
        ...p,
        service_name: serviceMap.get(p.service_id) ?? "",
        sub_service_name: p.sub_service_id ? (subMap.get(p.sub_service_id) ?? "") : "",
      }));
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
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("default_prices").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["default-prices", organizationId] });
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
