import { useEffect } from "react";

/** Refetch inbox data once when the browser tab becomes visible again. */
export function useRefetchOnTabVisible(refetch: () => void | Promise<unknown>) {
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refetch();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [refetch]);
}
