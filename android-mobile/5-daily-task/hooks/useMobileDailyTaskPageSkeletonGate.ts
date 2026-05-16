import { useEffect, useRef, useState } from "react";
import { useDailyTask } from "@/8-2-DailyTask/context/DailyTaskContext";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";

const SKELETON_MIN_MS = 280;

/** True for the default task list tab (not jobdesc / summary / initiative). */
export function isDefaultDailyTaskListView(view: string | null): boolean {
  return view !== "jobdesc" && view !== "summary" && view !== "initiative";
}

/**
 * Single page-level skeleton gate for mobile `/tools/daily-task` default view.
 * Keeps shell mounted (invisible) and debounces hide to avoid guard → content flicker.
 */
export function useMobileDailyTaskPageSkeletonGate(view: string | null) {
  const isDefaultTaskView = isDefaultDailyTaskListView(view);
  const { isLoading, tasks } = useDailyTask();
  const { loading: orgLoading } = useCurrentOrg();

  const [minSettleDone, setMinSettleDone] = useState(false);
  const skeletonShownAtRef = useRef<number | null>(null);
  const prevBlockingRef = useRef(false);

  const blockingLoad =
    isDefaultTaskView && (orgLoading || (isLoading && tasks.length === 0));

  useEffect(() => {
    if (!isDefaultTaskView) {
      skeletonShownAtRef.current = null;
      setMinSettleDone(true);
      return;
    }

    const pending = blockingLoad;
    const wasPending = prevBlockingRef.current;
    prevBlockingRef.current = pending;

    if (pending) {
      if (skeletonShownAtRef.current == null) skeletonShownAtRef.current = Date.now();
      setMinSettleDone(false);
      return;
    }

    if (wasPending && skeletonShownAtRef.current != null) {
      const elapsed = Date.now() - skeletonShownAtRef.current;
      const remaining = Math.max(0, SKELETON_MIN_MS - elapsed);
      const tId = window.setTimeout(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              setMinSettleDone(true);
              skeletonShownAtRef.current = null;
            });
          });
        });
      }, remaining);
      return () => window.clearTimeout(tId);
    }

    skeletonShownAtRef.current = null;
    setMinSettleDone(true);
  }, [blockingLoad, isDefaultTaskView]);

  const showPageSkeleton = isDefaultTaskView && (blockingLoad || !minSettleDone);

  return { showPageSkeleton, isDefaultTaskView };
}
