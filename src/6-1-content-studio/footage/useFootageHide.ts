import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/shared/lib/supabaseClient";
import { useOrgBootstrapPending } from "@/shared/auth/hooks/useOrgBootstrapPending";
import { footageQueryKey, type FootageQueryResult } from "./useFootageData";

type RpcClient = {
  rpc(
    fn: "catalog_hide_footage" | "catalog_restore_footage" | "catalog_list_hidden_footage",
    args: Record<string, unknown>,
  ): Promise<{ data: unknown; error: { message: string } | null }>;
};

export interface HiddenClip {
  asset_id: string;
  file_key: string;
  summary: string | null;
  deleted_at: string;
  purge_after: string;
  scene_count: number;
}

export type HideResult =
  | { saved: true }
  | { needsAck: true; usageCount: number }
  | { error: string };

function client(): RpcClient {
  return supabase as unknown as RpcClient;
}

function message(error: { message: string }, fallback: string): string {
  if (error.message.includes("restore_expired")) return "Waktu 30 hari sudah lewat. Klip ini tidak bisa dikembalikan.";
  if (error.message.includes("not_found")) return "Klip tidak ditemukan.";
  if (error.message.includes("not_a_member")) return "Anda bukan anggota organisasi ini.";
  return fallback;
}

function dropAsset(prev: FootageQueryResult | undefined, assetId: string): FootageQueryResult | undefined {
  if (!prev) return prev;
  return { ...prev, rows: prev.rows.filter((row) => row.assetId !== assetId) };
}

/** Hide a whole clip, and put it back within 30 days. The Agent moves the laptop file. */
export function useFootageHide() {
  const { organizationId } = useOrgBootstrapPending();
  const qc = useQueryClient();
  const key = footageQueryKey(organizationId);

  const hide = useCallback(
    async (assetId: string, acknowledge: boolean): Promise<HideResult> => {
      if (!organizationId) return { error: "Organisasi belum siap." };
      const { data, error } = await client().rpc("catalog_hide_footage", {
        p_organization_id: organizationId,
        p_asset_id: assetId,
        p_acknowledge: acknowledge,
      });
      if (error) return { error: message(error, "Gagal menghapus klip.") };
      const row = data as { saved?: boolean; needs_ack?: boolean; usage_count?: number } | null;
      if (row?.needs_ack) return { needsAck: true, usageCount: row.usage_count ?? 0 };
      if (!row?.saved) return { error: "Gagal menghapus klip." };
      qc.setQueryData<FootageQueryResult>(key, (prev) => dropAsset(prev, assetId));
      return { saved: true };
    },
    [organizationId, qc, key],
  );

  const restore = useCallback(
    async (assetId: string) => {
      if (!organizationId) {
        toast.error("Organisasi belum siap.");
        return false;
      }
      const { error } = await client().rpc("catalog_restore_footage", {
        p_organization_id: organizationId,
        p_asset_id: assetId,
      });
      if (error) {
        toast.error(message(error, "Gagal mengembalikan klip."));
        return false;
      }
      await qc.invalidateQueries({ queryKey: key });
      return true;
    },
    [organizationId, qc, key],
  );

  const listHidden = useCallback(async (): Promise<HiddenClip[]> => {
    if (!organizationId) return [];
    const { data, error } = await client().rpc("catalog_list_hidden_footage", {
      p_organization_id: organizationId,
    });
    if (error) {
      toast.error(message(error, "Gagal memuat klip yang dihapus."));
      return [];
    }
    const row = data as { clips?: HiddenClip[] } | null;
    return row?.clips ?? [];
  }, [organizationId]);

  return { hide, restore, listHidden };
}
