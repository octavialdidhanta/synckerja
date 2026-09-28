import { lazy, Suspense } from "react";
import { ThinkingLabPageSkeleton } from "@/thinking-lab/page/ThinkingLabPageSkeleton";

const ThinkingLabPage = lazy(() =>
  import("@/thinking-lab/page/ThinkingLabPage").then((module) => ({ default: module.ThinkingLabPage })),
);

export function ThinkingLabRouteElement() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full min-h-0 flex-1 bg-gray-100">
          <ThinkingLabPageSkeleton />
        </div>
      }
    >
      <ThinkingLabPage />
    </Suspense>
  );
}
