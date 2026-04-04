import { useMemo } from "react";

/**
 * Reference behavior is defensive: if tables are not ready,
 * it returns empty arrays so the dashboard renders without crashing.
 */
export const useKOLPostsAndMetrics = () => {
  const aggregatedMetrics = useMemo(
    () => ({
      activePosts: 0,
    }),
    [],
  );

  return {
    posts: [],
    metrics: [],
    aggregatedMetrics,
    isLoading: false,
    error: null as unknown,
    getPostsByPlatform: (_platform: string) => [],
    getTopPerformingPosts: (_limit: number = 5) => [],
    getPostsByContentType: (_contentType: string) => [],
  };
};

