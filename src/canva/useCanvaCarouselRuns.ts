import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/shared/lib/supabaseClient";
import { CAROUSEL_QUERY_KEY } from "@/6-1-dashboard/hook/useCarouselImages";
import type { CanvaCarouselRun } from "./CanvaCarouselNote";

export function useCanvaCarouselRuns(planIds: string[]) {
  const ids = [...new Set(planIds.filter(Boolean))].sort();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["canva-carousel-runs", ids],
    enabled: ids.length > 0,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<CanvaCarouselRun[]> => {
      const { data, error } = await supabase.rpc("canva_carousel_status_for_plans", {
        p_plan_ids: ids,
      });
      if (error) throw error;
      return Array.isArray(data) ? (data as CanvaCarouselRun[]) : [];
    },
    refetchInterval: (query) => {
      const rows = query.state.data;
      if (!Array.isArray(rows)) return false;
      const waiting = rows.some((row) =>
        row.status === "queued"
        || row.status === "running"
        || (row.refresh_requested === true && row.images_ready !== true)
        || row.revision_requested === true
        || (row.status === "succeeded" && row.images_ready !== true && !row.error)
      );
      return waiting ? 5000 : false;
    },
  });
  const imageRefreshKey = (query.data ?? [])
    .map((row) => `${row.social_media_plan_id}:${row.images_ready === true}:${row.refresh_requested === true}`)
    .join(",");
  useEffect(() => {
    if (!imageRefreshKey.includes(":true:")) return;
    void queryClient.invalidateQueries({ queryKey: [CAROUSEL_QUERY_KEY] });
  }, [imageRefreshKey, queryClient]);
  return query;
}
