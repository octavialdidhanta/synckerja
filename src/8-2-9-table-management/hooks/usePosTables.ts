import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { supabase } from "@/shared/lib/supabaseClient";
import type { PosTable, PosTableRotation, PosTableShape } from "../lib/posTableTypes";
import { normalizeTableLayoutForRotation } from "../lib/tableRotation";
import { normalizePaxForShape } from "../lib/tableShapeLayout";
import { POS_TABLE_GROUPS_QUERY_KEY } from "./usePosTableGroups";

export const POS_TABLES_QUERY_KEY = "pos-tables";

type DbRow = {
  id: string;
  organization_id: string;
  outlet_id: string;
  group_id: string;
  name: string;
  shape: PosTableShape;
  pax: number;
  grid_x: number;
  grid_y: number;
  grid_w: number;
  grid_h: number;
  rotation: number;
  is_deleted: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

function mapRow(row: DbRow): PosTable {
  const mapped: PosTable = {
    ...row,
    rotation: (row.rotation === 90 || row.rotation === 180 || row.rotation === 270
      ? row.rotation
      : 0) as PosTableRotation,
    isNew: false,
  };
  return normalizeTableLayoutForRotation(mapped);
}

export type PosTableSaveBatchPayload = {
  outletId: string;
  groupId: string;
  tables: PosTable[];
  deletedIds: string[];
};

export function usePosTables(groupId: string | null | undefined) {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();
  const enabled = Boolean(organizationId && groupId);

  const query = useQuery({
    queryKey: [POS_TABLES_QUERY_KEY, organizationId, groupId],
    enabled,
    queryFn: async (): Promise<PosTable[]> => {
      if (!organizationId || !groupId) return [];
      const { data, error } = await supabase
        .from("pos_tables")
        .select(
          "id, organization_id, outlet_id, group_id, name, shape, pax, grid_x, grid_y, grid_w, grid_h, rotation, is_deleted, deleted_at, created_at, updated_at",
        )
        .eq("organization_id", organizationId)
        .eq("group_id", groupId)
        .eq("is_deleted", false)
        .order("name", { ascending: true });
      if (error) throw error;
      return ((data ?? []) as DbRow[]).map(mapRow);
    },
  });

  const saveBatch = useMutation({
    mutationFn: async (payload: PosTableSaveBatchPayload) => {
      if (!organizationId) throw new Error("Organization ID is required");
      const now = new Date().toISOString();

      for (const id of payload.deletedIds) {
        const { error } = await supabase
          .from("pos_tables")
          .update({ is_deleted: true, deleted_at: now })
          .eq("id", id)
          .eq("organization_id", organizationId)
          .eq("is_deleted", false);
        if (error) throw error;
      }

      for (const table of payload.tables) {
        const pax = normalizePaxForShape(table.shape, table.pax);
        const row = {
          name: table.name.trim(),
          shape: table.shape,
          pax,
          grid_x: table.grid_x,
          grid_y: table.grid_y,
          // Persist axis-aligned footprint (already swapped when rotated).
          grid_w: Math.max(1, table.grid_w),
          grid_h: Math.max(1, table.grid_h),
          rotation: table.rotation ?? 0,
          is_deleted: false,
          deleted_at: null as string | null,
        };
        if (!row.name) throw new Error("name_required");

        if (table.isNew) {
          const { error } = await supabase.from("pos_tables").insert({
            ...row,
            id: table.id,
            organization_id: organizationId,
            outlet_id: payload.outletId,
            group_id: payload.groupId,
          });
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("pos_tables")
            .update(row)
            .eq("id", table.id)
            .eq("organization_id", organizationId);
          if (error) throw error;
        }
      }
    },
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({
        queryKey: [POS_TABLES_QUERY_KEY, organizationId, vars.groupId],
      });
      void queryClient.invalidateQueries({
        queryKey: [POS_TABLE_GROUPS_QUERY_KEY, organizationId, vars.outletId],
      });
    },
  });

  return {
    tables: query.data ?? [],
    isLoading: enabled ? query.isLoading : false,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    saveBatch,
  };
}
