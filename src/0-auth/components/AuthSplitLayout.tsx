import type { CSSProperties, ReactNode, RefObject } from "react";
import { AuthTestimonialsPanel } from "@/0-register/components/AuthTestimonialsPanel";

export type AuthSplitLayoutProps = {
  children: ReactNode;
  /** Ref for the scrollable form column (login uses this for keyboard scroll). */
  scrollPanelRef?: RefObject<HTMLDivElement | null>;
  /** Extra bottom padding when native keyboard is open (Capacitor). */
  keyboardPaddingBottom?: number;
};

export function AuthSplitLayout({
  children,
  scrollPanelRef,
  keyboardPaddingBottom,
}: AuthSplitLayoutProps) {
  const rightColumnStyle: CSSProperties | undefined =
    keyboardPaddingBottom && keyboardPaddingBottom > 0
      ? { paddingBottom: keyboardPaddingBottom }
      : undefined;

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden safe-area-top lg:flex-row lg:items-stretch">
      <div className="hidden min-h-0 w-full min-w-0 self-stretch lg:flex lg:max-w-[50%] lg:flex-1 xl:max-w-[48%]">
        <AuthTestimonialsPanel />
      </div>

      <div
        className="flex min-h-0 flex-1 flex-col bg-[hsl(var(--brand-white))] lg:border-l lg:border-slate-200/80"
        style={rightColumnStyle}
      >
        <div
          ref={scrollPanelRef}
          className="scrollbar-hide seamless-scroll flex min-h-0 flex-1 flex-col items-stretch justify-start overflow-x-hidden overflow-y-auto px-4 py-4 sm:px-10 sm:py-8 lg:items-center lg:justify-center lg:py-12"
        >
          <div className="mx-auto w-full max-w-md">{children}</div>
        </div>
      </div>
    </div>
  );
}
