import type { ReactNode, RefObject } from "react";
import { cn } from "@/shared/lib/utils";

const scrollHide =
  "scrollbar-hide seamless-scroll nested-scroll-touch-chain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

export type MobileOnboardingViewportProps = {
  children: ReactNode;
  /** Optional scroll container ref (keyboard / scroll-into-view). */
  panelRef?: RefObject<HTMLDivElement | null>;
  keyboardPaddingBottom?: number;
  /** When true, column is always scrollable (terms, long forms). */
  scrollAlways?: boolean;
  /** When scrollAlways and keyboard closed: still allow scroll if content overflows (default true). */
  keyboardOpen?: boolean;
  className?: string;
  innerClassName?: string;
};

/**
 * Mobile shell for onboarding: default static full height; optional always-scroll with hidden scrollbar.
 */
export function MobileOnboardingViewport({
  children,
  panelRef,
  keyboardPaddingBottom = 0,
  scrollAlways = false,
  keyboardOpen = false,
  className,
  innerClassName,
}: MobileOnboardingViewportProps) {
  const allowScroll = scrollAlways || keyboardOpen;

  return (
    <div
      className={cn(
        "flex h-dvh min-h-0 w-full flex-col overflow-hidden bg-[hsl(var(--brand-white))] safe-area-top",
        className,
      )}
    >
      <div
        className="flex min-h-0 flex-1 flex-col"
        style={keyboardPaddingBottom > 0 ? { paddingBottom: keyboardPaddingBottom } : undefined}
      >
        <div
          ref={panelRef}
          className={cn(
            "flex min-h-0 flex-1 flex-col overflow-x-hidden px-5 py-6",
            scrollHide,
            allowScroll ? "overflow-y-auto" : "overflow-y-hidden",
            !scrollAlways && !allowScroll && "items-center justify-center",
            innerClassName,
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
