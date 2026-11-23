import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/shared/lib/supabaseClient";
import { useOrgBootstrapPending } from "@/shared/auth/hooks/useOrgBootstrapPending";
import { footageQueryKey, type FootageQueryResult } from "./useFootageData";

const DEFAULT_REASON = "tidak sesuai";

function patchBan(prev: FootageQueryResult | undefined, sceneId: string, reason: string | null): FootageQueryResult | undefined {
  if (!prev) return prev;
  return {
    ...prev,
    rows: prev.rows.map((r) => (r.id === sceneId ? { ...r, ban: reason } : r)),
  };
}

/** Ban or clear a footage scene, same idea as katalog.html setBan(). */
export function useFootageBan() {
  const { organizationId } = useOrgBootstrapPending();
  const qc = useQueryClient();
  const key = footageQueryKey(organizationId);

  const setBan = useCallback(
    async (sceneId: string, reason: string | null) => {
      if (!organizationId) {
        toast.error("Organisasi belum siap.");
        return false;
      }
      // null clears the ban; any string (including blank) marks it, blank → "tidak sesuai" like katalog.html.
      const nextReason = reason === null ? null : reason.trim() || DEFAULT_REASON;

      const previous = qc.getQueryData<FootageQueryResult>(key);
      qc.setQueryData<FootageQueryResult>(key, (prev) => patchBan(prev, sceneId, nextReason));

      try {
        if (nextReason === null) {
          const { error } = await supabase
            .from("footage_bans")
            .delete()
            .eq("organization_id", organizationId)
            .eq("scene_id", sceneId);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("footage_bans").upsert(
            {
              organization_id: organizationId,
              scene_id: sceneId,
              reason: nextReason,
            },
            { onConflict: "scene_id" },
          );
          if (error) throw error;
        }
        return true;
      } catch (err) {
        qc.setQueryData(key, previous);
        toast.error(err instanceof Error ? err.message : "Gagal menyimpan tanda.");
        return false;
      }
    },
    [organizationId, qc, key],
  );

  return { setBan };
}
