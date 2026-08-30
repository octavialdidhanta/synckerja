import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { supabase } from "@/shared/lib/supabaseClient";
import { normalizeRotation } from "../../lib/tableRotation";
import { POS_TABLE_GROUPS_QUERY_KEY } from "../../hooks/usePosTableGroups";
import type {
  PosFloorFixture,
  PosFloorFixtureType,
} from "../lib/posFloorFixtureTypes";
import type { PosTableRotation } from "../../lib/posTableTypes";

export const POS_FLOOR_FIXTURES_QUERY_KEY = "pos-floor-fixtures";

type DbRow = {
  id: string;
  organization_id: string;
  outlet_id: string;
  group_id: string;
  fixture_type: PosFloorFixtureType;
  name: string;
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

function mapRow(row: DbRow): PosFloorFixture {
  return {
    ...row,
    rotation: normalizeRotation(row.rotation) as PosTableRotation,
    isNew: false,
  };
}

export type PosFloorFixtureSaveBatchPayload = {
  outletId: string;
  groupId: string;
  fixtures: PosFloorFixture[];
  deletedIds: string[];
};

export function usePosFloorFixtures(groupId: string | null | undefined) {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();
  const enabled = Boolean(organizationId && groupId);

  const query = useQuery({
    queryKey: [POS_FLOOR_FIXTURES_QUERY_KEY, organizationId, groupId],
    enabled,
    queryFn: async (): Promise<PosFloorFixture[]> => {
      if (!organizationId || !groupId) return [];
      const { data, error } = await supabase
        .from("pos_floor_fixtures")
        .select(
          "id, organization_id, outlet_id, group_id, fixture_type, name, grid_x, grid_y, grid_w, grid_h, rotation, is_deleted, deleted_at, created_at, updated_at",
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
    mutationFn: async (payload: PosFloorFixtureSaveBatchPayload) => {
      if (!organizationId) throw new Error("Organization ID is required");
      const now = new Date().toISOString();

      for (const id of payload.deletedIds) {
        const { error } = await supabase
          .from("pos_floor_fixtures")
          .update({ is_deleted: true, deleted_at: now })
          .eq("id", id)
          .eq("organization_id", organizationId)
          .eq("is_deleted", false);
        if (error) throw error;
      }

      for (const fixture of payload.fixtures) {
        const row = {
          fixture_type: fixture.fixture_type,
          name: fixture.name.trim(),
          grid_x: fixture.grid_x,
          grid_y: fixture.grid_y,
          grid_w: Math.max(1, fixture.grid_w),
          grid_h: Math.max(1, fixture.grid_h),
          rotation: fixture.rotation ?? 0,
          is_deleted: false,
          deleted_at: null as string | null,
        };
        if (!row.name) throw new Error("name_required");

        if (fixture.isNew) {
          const { error } = await supabase.from("pos_floor_fixtures").insert({
            ...row,
            id: fixture.id,
            organization_id: organizationId,
            outlet_id: payload.outletId,
            group_id: payload.groupId,
          });
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("pos_floor_fixtures")
            .update(row)
            .eq("id", fixture.id)
            .eq("organization_id", organizationId);
          if (error) throw error;
        }
      }
    },
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({
        queryKey: [POS_FLOOR_FIXTURES_QUERY_KEY, organizationId, vars.groupId],
      });
      void queryClient.invalidateQueries({
        queryKey: [POS_TABLE_GROUPS_QUERY_KEY, organizationId, vars.outletId],
      });
    },
  });

  return {
    fixtures: query.data ?? [],
    isLoading: enabled ? query.isLoading : false,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    saveBatch,
  };
}
