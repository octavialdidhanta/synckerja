import { useCallback, useState } from "react";

/** Tracks header refresh while a force-fetch runs outside TanStack Query's isFetching. */
export function useSmpManualRefresh() {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const runRefresh = useCallback(async (task: () => Promise<void>) => {
    setIsRefreshing(true);
    try {
      await task();
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  return { isRefreshing, runRefresh };
}
