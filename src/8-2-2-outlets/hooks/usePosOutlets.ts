import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import type { PosOutlet, PosOutletSave } from "../types";

export const POS_OUTLETS_QUERY_KEY = "pos-outlets";

export function usePosOutlets() {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [POS_OUTLETS_QUERY_KEY, organizationId],
    queryFn: async (): Promise<PosOutlet[]> => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from("pos_outlets")
        .select("id, organization_id, name, address, city, province, phone, is_active, is_default, sort_order")
        .eq("organization_id", organizationId)
        .eq("is_deleted", false)
        .order("is_default", { ascending: false })
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as PosOutlet[];
    },
    enabled: !!organizationId,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [POS_OUTLETS_QUERY_KEY, organizationId] });
  };

  const save = useMutation({
    mutationFn: async (payload: PosOutletSave) => {
      if (!organizationId) throw new Error("Organization ID is required");
      const name = payload.name.trim();
      const phone = payload.phone?.trim() ?? "";
      if (!name) throw new Error("outlet_name_required");
      if (!phone) throw new Error("outlet_phone_required");
      const fields = {
        name,
        address: payload.address?.trim() || null,
        city: payload.city?.trim() || null,
        province: payload.province?.trim() || null,
        phone,
        is_active: Boolean(payload.is_active),
        is_deleted: false,
      };
      if (payload.id) {
        const { error } = await supabase.from("pos_outlets").update(fields).eq("id", payload.id);
        if (error) throw error;
        return payload.id;
      }
      const { data, error } = await supabase
        .from("pos_outlets")
        .insert({
          organization_id: organizationId,
          is_default: false,
          sort_order: (query.data?.length ?? 0) + 1,
          ...fields,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (row: PosOutlet) => {
      if (row.is_default) throw new Error("outlet_default_locked");
      const remaining = (query.data ?? []).filter((item) => item.id !== row.id);
      if (remaining.length === 0) throw new Error("outlet_last_locked");
      const { error } = await supabase.from("pos_outlets").update({ is_deleted: true }).eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return {
    rows: query.data ?? [],
    isLoading: query.isLoading,
    save: save.mutateAsync,
    remove: remove.mutateAsync,
    isSaving: save.isPending || remove.isPending,
  };
}
