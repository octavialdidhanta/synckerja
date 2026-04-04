import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { contentPostService } from "@/shared/services/content-post/supabase";

export const useContentPostMilestones = (postIds: string[]) => {
  const query = useQuery({
    queryKey: ["kol-content-milestones", ...postIds.sort()],
    enabled: postIds.length > 0,
    queryFn: async () => contentPostService.listMilestonesByPostIds(postIds),
  });

  const milestonesByPost = query.data || {};

  const getMilestonesForPost = useMemo(
    () => (postId: string) => milestonesByPost[postId] || [],
    [milestonesByPost],
  );

  /** Hanya bermakna jika `postIds.length > 0` — menghindari frame di mana fetch sekunder belum terdaftar (flicker). */
  const awaitingInitialFetch = postIds.length > 0 && query.status === "pending";

  return {
    milestonesByPost,
    getMilestonesForPost,
    isLoading: query.isLoading,
    isPending: query.isPending,
    awaitingInitialFetch,
  };
};
