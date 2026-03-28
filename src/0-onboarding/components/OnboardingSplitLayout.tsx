import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/shared/lib/utils";
import { AuthTestimonialsPanel } from "@/0-register/components/AuthTestimonialsPanel";

type OnboardingSplitLayoutProps = {
  children: ReactNode;
  /** Applied to the scrollable column (e.g. items-center justify-center). */
  scrollClassName?: string;
  rightColumnStyle?: CSSProperties;
  /**
   * Lock layout to the viewport height (100dvh) and scroll content inside the right column.
   * Use for long pages (e.g. terms) so the scroll area is full-height, not max-h-[calc(100vh-120px)].
   */
  fillViewport?: boolean;
};

export function OnboardingSplitLayout({
  children,
  scrollClassName,
  rightColumnStyle,
  fillViewport = false,
}: OnboardingSplitLayoutProps) {
  return (
    <div
      className={cn(
        "flex w-full flex-col overflow-hidden safe-area-top lg:flex-row lg:items-stretch",
        fillViewport
          ? "h-[100dvh] max-h-[100dvh] min-h-0 lg:h-[100dvh] lg:max-h-[100dvh]"
          : "min-h-[100dvh] max-h-[100dvh] lg:max-h-none lg:min-h-screen",
      )}
    >
      <div
        className={cn(
          "hidden min-h-0 w-full min-w-0 lg:flex lg:max-w-[50%] lg:flex-1 xl:max-w-[48%]",
          fillViewport
            ? "lg:min-h-0 lg:max-h-full lg:overflow-hidden"
            : "self-stretch",
        )}
      >
        <AuthTestimonialsPanel compact={fillViewport} />
      </div>
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col bg-[hsl(var(--brand-white))] lg:border-l lg:border-slate-200/80",
          fillViewport && "min-h-0 overflow-hidden lg:min-h-0",
        )}
        style={rightColumnStyle}
      >
        <div
          className={cn(
            "flex flex-1 min-h-0 flex-col px-5 py-8 sm:px-10 lg:py-12",
            fillViewport
              ? "overflow-y-auto overflow-x-hidden seamless-scroll nested-scroll-touch-chain"
              : "overflow-y-auto seamless-scroll max-h-[calc(100vh-120px)] lg:max-h-none",
            scrollClassName,
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
