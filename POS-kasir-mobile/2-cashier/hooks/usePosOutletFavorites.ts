import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { supabase } from "@/shared/lib/supabaseClient";
import {
  POS_FAVORITES_MAX,
  type PosOutletFavorite,
} from "../lib/posFavoritesStorage";

export const POS_OUTLET_FAVORITES_QUERY_KEY = "pos-outlet-favorites";

type DbRow = PosOutletFavorite;

const SELECT_COLS =
  "id, organization_id, outlet_id, catalog_item_id, sort_order, created_at, updated_at";

export function usePosOutletFavorites(outletId: string | null | undefined) {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();
  const enabled = Boolean(organizationId && outletId);

  const query = useQuery({
    queryKey: [POS_OUTLET_FAVORITES_QUERY_KEY, organizationId, outletId],
    enabled,
    queryFn: async (): Promise<PosOutletFavorite[]> => {
      if (!organizationId || !outletId) return [];
      const { data, error } = await supabase
        .from("pos_outlet_favorites")
        .select(SELECT_COLS)
        .eq("organization_id", organizationId)
        .eq("outlet_id", outletId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as DbRow[];
    },
  });

  const invalidate = () => {
    if (!organizationId || !outletId) return;
    void queryClient.invalidateQueries({
      queryKey: [POS_OUTLET_FAVORITES_QUERY_KEY, organizationId, outletId],
    });
  };

  const addFavorite = useMutation({
    mutationFn: async (catalogItemId: string): Promise<PosOutletFavorite> => {
      if (!organizationId || !outletId) throw new Error("Organization/outlet required");
      const current = query.data ?? [];
      if (current.length >= POS_FAVORITES_MAX) {
        throw new Error("pos_favorites_max_reached");
      }
      if (current.some((r) => r.catalog_item_id === catalogItemId)) {
        throw new Error("pos_favorites_already_added");
      }
      const nextOrder =
        current.length === 0
          ? 0
          : Math.max(...current.map((r) => r.sort_order)) + 1;
      const { data, error } = await supabase
        .from("pos_outlet_favorites")
        .insert({
          organization_id: organizationId,
          outlet_id: outletId,
          catalog_item_id: catalogItemId,
          sort_order: nextOrder,
        })
        .select(SELECT_COLS)
        .single();
      if (error) throw error;
      return data as DbRow;
    },
    onSuccess: invalidate,
  });

  const removeFavorite = useMutation({
    mutationFn: async (catalogItemId: string): Promise<void> => {
      if (!organizationId || !outletId) throw new Error("Organization/outlet required");
      const { error } = await supabase
        .from("pos_outlet_favorites")
        .delete()
        .eq("organization_id", organizationId)
        .eq("outlet_id", outletId)
        .eq("catalog_item_id", catalogItemId);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const reorderFavorites = useMutation({
    mutationFn: async (orderedCatalogIds: string[]): Promise<void> => {
      if (!organizationId || !outletId) throw new Error("Organization/outlet required");
      const current = query.data ?? [];
      const byCatalog = new Map(current.map((r) => [r.catalog_item_id, r]));
      const updates = orderedCatalogIds
        .map((catalogId, index) => {
          const row = byCatalog.get(catalogId);
          if (!row || row.sort_order === index) return null;
          return { id: row.id, sort_order: index };
        })
        .filter(Boolean) as { id: string; sort_order: number }[];

      for (const u of updates) {
        const { error } = await supabase
          .from("pos_outlet_favorites")
          .update({ sort_order: u.sort_order })
          .eq("id", u.id)
          .eq("organization_id", organizationId);
        if (error) throw error;
      }
    },
    onSuccess: invalidate,
  });

  const orderedIds = (query.data ?? []).map((r) => r.catalog_item_id);

  return {
    favorites: query.data ?? [],
    orderedIds,
    isLoading: enabled ? query.isLoading : false,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    addFavorite,
    removeFavorite,
    reorderFavorites,
    maxReached: orderedIds.length >= POS_FAVORITES_MAX,
  };
}
