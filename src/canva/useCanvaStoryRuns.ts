import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { presentCanvaCreditQuota } from "@/canva/canvaCreditQuota";
import { supabase } from "@/shared/lib/supabaseClient";
import type { CanvaStoryRun } from "./CanvaStoryNote";

export const CANVA_STORY_RUNS_KEY = "canva-story-runs";

export function useCanvaStoryRuns(planIds: string[]) {
  const ids = [...new Set(planIds.filter(Boolean))].sort();
  const query = useQuery({
    queryKey: [CANVA_STORY_RUNS_KEY, ids],
    enabled: ids.length > 0,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<CanvaStoryRun[]> => {
      const { data, error } = await supabase.rpc("canva_story_status_for_plans", {
        p_plan_ids: ids,
      });
      if (error) throw error;
      return Array.isArray(data) ? (data as CanvaStoryRun[]) : [];
    },
    refetchInterval: (current) => {
      const rows = current.state.data;
      if (!Array.isArray(rows)) return false;
      const waiting = rows.some((row) =>
        row.status === "queued"
        || row.status === "running"
        || (row.refresh_requested === true && row.images_ready !== true)
        || (row.status === "succeeded" && row.images_ready !== true && !row.error)
      );
      return waiting ? 5000 : false;
    },
  });

  const creditErrorKey = (query.data ?? [])
    .map((row) => String(row.error ?? ""))
    .filter((error) => error)
    .join("|");
  useEffect(() => {
    if (!creditErrorKey) return;
    for (const part of creditErrorKey.split("|")) {
      if (presentCanvaCreditQuota(part)) break;
    }
  }, [creditErrorKey]);

  return query;
}
