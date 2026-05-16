import { useLocation } from "react-router-dom";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { cn } from "@/shared/lib/utils";
import { getOkrActiveTabFromPath, type OkrPageTabId } from "../utils/okrPaths";

const TAB_ORDER: OkrPageTabId[] = ["company-objectives", "department-objectives", "individual-objectives"];

/** Tab label widths approximate `layout.okr.tab.*` in ID/EN. */
const TAB_LABEL_WIDTH = ["w-36", "w-40", "w-36"] as const;

/** Mirrors `HeaderAndTab` (px-1 py-3, title block, icon+label tabs) for OKR route skeletons. */
export function OkrHeaderAndTabSkeleton() {
  const activeTab = getOkrActiveTabFromPath(useLocation().pathname);
  const activeIndex = TAB_ORDER.indexOf(activeTab);

  return (
    <div className="px-1 py-3" aria-hidden>
      <div className="mb-3 space-y-2">
        <Skeleton className="h-7 w-[min(100%,12rem)] max-w-full rounded-md" />
        <Skeleton className="h-3 w-[min(100%,20rem)] max-w-full rounded-sm" />
      </div>
      <div className="-mb-3">
        <nav className="flex space-x-6">
          {TAB_ORDER.map((tabId, i) => {
            const isActive = i === activeIndex;
            return (
              <div
                key={tabId}
                className={cn(
                  "flex items-center gap-1.5 border-b-2 px-1 py-1.5",
                  isActive ? "border-brand-blue/60" : "border-transparent",
                )}
              >
                <Skeleton className={cn("h-4 w-4 shrink-0 rounded-sm", isActive && "opacity-90")} />
                <Skeleton className={cn("h-4 rounded-sm", TAB_LABEL_WIDTH[i] ?? "w-32", isActive && "opacity-90")} />
              </div>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
