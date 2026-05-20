import { useEffect, useState, type ComponentType } from "react";
import { cn } from "@/shared/lib/utils";

/** Lightweight fallback while a route-matched skeleton chunk loads (stays in the main bundle). */
export function RouteSkeletonBootShell({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col bg-gray-100",
        className,
      )}
      aria-busy="true"
      aria-label="Loading"
    >
      <div className="flex min-h-0 flex-1 animate-pulse flex-col gap-2 p-4">
        <div className="h-8 w-48 max-w-[80%] rounded-md bg-muted" />
        <div className="min-h-[min(70vh,520px)] flex-1 rounded-lg border border-border bg-muted/60" />
      </div>
    </div>
  );
}

/**
 * Loads a route skeleton via dynamic import on first render (separate chunk, not in initial JS).
 * On chunk failure (e.g. stale SW after deploy), keeps the boot shell instead of breaking the route.
 */
export function createDeferredSkeleton(
  loader: () => Promise<{ default: ComponentType<object> }>,
): ComponentType<object> {
  function DeferredRouteSkeleton() {
    const [Resolved, setResolved] = useState<ComponentType<object> | null>(null);

    useEffect(() => {
      let cancelled = false;
      void loader()
        .then((mod) => {
          if (!cancelled) setResolved(() => mod.default);
        })
        .catch(() => {
          /* keep RouteSkeletonBootShell */
        });
      return () => {
        cancelled = true;
      };
    }, []);

    if (!Resolved) return <RouteSkeletonBootShell />;
    return <Resolved />;
  }

  DeferredRouteSkeleton.displayName = "DeferredRouteSkeleton";
  return DeferredRouteSkeleton;
}
