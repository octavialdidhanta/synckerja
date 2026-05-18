import type { ReactNode } from "react";
import { HomePageSkeleton } from "@/1-home/skeletons/HomePageSkeleton";
import { useHomePageLoad } from "@/1-home/context/HomePageLoadContext";
import { cn } from "@/shared/lib/utils";

/**
 * Satu lapisan skeleton penuh sampai section kritis home siap (tanpa swap ke skeleton per-panel).
 */
export function HomePageSkeletonGate({ children }: { children: ReactNode }) {
  const { showFullPageSkeleton } = useHomePageLoad();

  return (
    <div className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div
        className={cn(
          "flex h-full min-h-0 min-w-0 flex-1 flex-col",
          showFullPageSkeleton && "invisible pointer-events-none",
        )}
        aria-hidden={showFullPageSkeleton}
      >
        {children}
      </div>
      {showFullPageSkeleton ? (
        <div className="absolute inset-0 z-10 flex min-h-0 flex-col bg-background" aria-busy>
          <HomePageSkeleton />
        </div>
      ) : null}
    </div>
  );
}


