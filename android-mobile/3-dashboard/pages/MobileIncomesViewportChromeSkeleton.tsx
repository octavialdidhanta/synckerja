import type { ReactNode } from "react";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { useVisualViewport } from "@/shared/hooks/useVisualViewport";
import { cn } from "@/shared/lib/utils";

const SCROLL_HIDE =
  "scrollbar-hide [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

export type MobileIncomesViewportChromeSkeletonProps = {
  /** Wrapper for portal (e.g. `fixed inset-0 z-[200] min-h-[100dvh] bg-background`). */
  wrapperClassName?: string;
  /** `aria-label` + `sr-only` (already translated string). */
  ariaLabel: string;
  /** Scroll body after top spacer — use `mx-auto w-full max-w-md content-padding-above-nav-default px-2 pt-2`. */
  children: ReactNode;
};

/**
 * Header + scroll + bottom nav (3 tabs), shared by income dashboard & transaction mobile routes.
 * Matches `MobileIncomesShell` chrome without sidebar.
 */
export function MobileIncomesViewportChromeSkeleton({
  wrapperClassName,
  ariaLabel,
  children,
}: MobileIncomesViewportChromeSkeletonProps) {
  const { mainFixedStyle } = useVisualViewport();

  const inner = (
    <main
      className="fixed inset-x-0 z-0 flex flex-col bg-background"
      style={mainFixedStyle}
      aria-busy="true"
      aria-label={ariaLabel}
    >
      <span className="sr-only">{ariaLabel}</span>
      <header className="safe-area-top sticky top-0 z-30 flex flex-shrink-0 items-center justify-between border-b border-border bg-card p-3">
        <div className="flex min-w-0 items-center gap-2">
          <Skeleton className="h-9 w-9 shrink-0 rounded-md" aria-hidden />
          <div className="min-w-0 space-y-2">
            <Skeleton className="h-5 w-28 max-w-full" aria-hidden />
            <Skeleton className="h-3 w-36 max-w-full" aria-hidden />
          </div>
        </div>
        <div />
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div
          className={cn(
            "scrollbar-hide flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto seamless-scroll",
            SCROLL_HIDE,
          )}
        >
          <div className="h-0 shrink-0" aria-hidden />
          <div className="flex min-h-full min-w-0 flex-1 flex-col">{children}</div>
        </div>
      </div>

      <nav
        className="mobile-app-bottom-nav fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-card"
        aria-hidden
      >
        <div className="safe-area-bottom-lower mx-auto grid min-h-[52px] w-full max-w-md grid-cols-3 px-1">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-1 px-1 py-2">
              <Skeleton className="mb-0 h-5 w-5 rounded-md" aria-hidden />
              <Skeleton className="h-2.5 w-14 max-w-full rounded-sm" aria-hidden />
            </div>
          ))}
        </div>
      </nav>
    </main>
  );

  if (wrapperClassName) {
    return <div className={wrapperClassName}>{inner}</div>;
  }
  return inner;
}
