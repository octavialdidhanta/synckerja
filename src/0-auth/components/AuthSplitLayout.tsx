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
    <div className="flex min-h-[100dvh] max-h-[100dvh] w-full flex-col overflow-hidden safe-area-top lg:max-h-none lg:min-h-screen lg:flex-row">
      <div className="hidden min-h-0 w-full min-w-0 lg:flex lg:max-w-[50%] lg:flex-1 lg:items-center lg:justify-center lg:min-h-screen xl:max-w-[48%]">
        <AuthTestimonialsPanel />
      </div>

      <div
        className="flex min-h-0 flex-1 flex-col bg-[hsl(var(--brand-white))] lg:border-l lg:border-slate-200/80"
        style={rightColumnStyle}
      >
        <div
          ref={scrollPanelRef}
          className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-5 py-8 sm:px-10 seamless-scroll max-h-[calc(100vh-120px)] lg:max-h-none lg:py-12"
        >
          {children}
        </div>
      </div>
    </div>
  );
}
