import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { supabase } from "@/shared/lib/supabaseClient";
import type { PosTableGroup, PosTableGroupSavePayload } from "../lib/posTableGroupTypes";

export const POS_TABLE_GROUPS_QUERY_KEY = "pos-table-groups";

type DbRow = {
  id: string;
  organization_id: string;
  outlet_id: string;
  name: string;
  is_active: boolean;
  is_deleted: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

function mapRow(row: DbRow): PosTableGroup {
  return {
    ...row,
    table_count: 0,
  };
}

function nextCopyName(baseName: string, existingNames: Set<string>): string {
  const root = baseName.trim();
  let candidate = `${root} (Copy)`;
  if (!existingNames.has(candidate.toLowerCase())) return candidate;
  let n = 2;
  while (existingNames.has(`${root} (Copy ${n})`.toLowerCase())) {
    n += 1;
  }
  return `${root} (Copy ${n})`;
}

export function usePosTableGroups(outletId: string | null | undefined) {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();
  const enabled = Boolean(organizationId && outletId);

  const query = useQuery({
    queryKey: [POS_TABLE_GROUPS_QUERY_KEY, organizationId, outletId],
    enabled,
    queryFn: async (): Promise<PosTableGroup[]> => {
      if (!organizationId || !outletId) return [];
      const { data, error } = await supabase
        .from("pos_table_groups")
        .select(
          "id, organization_id, outlet_id, name, is_active, is_deleted, deleted_at, created_at, updated_at",
        )
        .eq("organization_id", organizationId)
        .eq("outlet_id", outletId)
        .eq("is_deleted", false)
        .order("name", { ascending: true });
      if (error) throw error;
      const rows = (data ?? []) as DbRow[];
      if (rows.length === 0) return [];

      const groupIds = rows.map((r) => r.id);
      const { data: tableRows, error: countError } = await supabase
        .from("pos_tables")
        .select("group_id")
        .eq("organization_id", organizationId)
        .eq("is_deleted", false)
        .in("group_id", groupIds);
      if (countError) throw countError;

      const counts = new Map<string, number>();
      for (const t of tableRows ?? []) {
        const gid = (t as { group_id: string }).group_id;
        counts.set(gid, (counts.get(gid) ?? 0) + 1);
      }

      return rows.map((row) => ({
        ...row,
        table_count: counts.get(row.id) ?? 0,
      }));
    },
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({
      queryKey: [POS_TABLE_GROUPS_QUERY_KEY, organizationId, outletId],
    });
  };

  const create = useMutation({
    mutationFn: async (payload: PosTableGroupSavePayload) => {
      if (!organizationId || !outletId) throw new Error("Organization and outlet are required");
      const name = payload.name.trim();
      if (!name) throw new Error("name_required");
      const { data, error } = await supabase
        .from("pos_table_groups")
        .insert({
          organization_id: organizationId,
          outlet_id: outletId,
          name,
          is_active: payload.is_active,
          is_deleted: false,
        })
        .select(
          "id, organization_id, outlet_id, name, is_active, is_deleted, deleted_at, created_at, updated_at",
        )
        .single();
      if (error) throw error;
      return mapRow(data as DbRow);
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({
      id,
      ...payload
    }: PosTableGroupSavePayload & { id: string }) => {
      if (!organizationId) throw new Error("Organization ID is required");
      const name = payload.name.trim();
      if (!name) throw new Error("name_required");
      const { data, error } = await supabase
        .from("pos_table_groups")
        .update({ name, is_active: payload.is_active })
        .eq("id", id)
        .eq("organization_id", organizationId)
        .eq("is_deleted", false)
        .select(
          "id, organization_id, outlet_id, name, is_active, is_deleted, deleted_at, created_at, updated_at",
        )
        .single();
      if (error) throw error;
      return mapRow(data as DbRow);
    },
    onSuccess: invalidate,
  });

  const softDelete = useMutation({
    mutationFn: async (id: string) => {
      if (!organizationId) throw new Error("Organization ID is required");
      const { error } = await supabase
        .from("pos_table_groups")
        .update({ is_deleted: true, deleted_at: new Date().toISOString() })
        .eq("id", id)
        .eq("organization_id", organizationId);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const duplicate = useMutation({
    mutationFn: async (source: PosTableGroup) => {
      if (!organizationId || !outletId) throw new Error("Organization and outlet are required");
      const existing = new Set((query.data ?? []).map((g) => g.name.toLowerCase()));
      const name = nextCopyName(source.name, existing);
      const { data, error } = await supabase
        .from("pos_table_groups")
        .insert({
          organization_id: organizationId,
          outlet_id: outletId,
          name,
          is_active: source.is_active,
          is_deleted: false,
        })
        .select(
          "id, organization_id, outlet_id, name, is_active, is_deleted, deleted_at, created_at, updated_at",
        )
        .single();
      if (error) throw error;
      return mapRow(data as DbRow);
    },
    onSuccess: invalidate,
  });

  return {
    groups: query.data ?? [],
    isLoading: enabled ? query.isLoading : false,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    create,
    update,
    softDelete,
    duplicate,
  };
}
