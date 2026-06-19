import type { ReactNode, RefObject } from "react";
import { cn } from "@/shared/lib/utils";

const scrollHide =
  "scrollbar-hide seamless-scroll nested-scroll-touch-chain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

export type MobileAuthViewportProps = {
  children: ReactNode;
  panelRef: RefObject<HTMLDivElement | null>;
  keyboardPaddingBottom: number;
  /** True when native keyboard open or visual viewport compressed (mobile web). */
  keyboardOpen: boolean;
  /**
   * `center` — short forms (login): vertically centered when keyboard closed.
   * `form` — tall forms (register): centered when keyboard closed, scroll from top when keyboard open.
   */
  contentAlign?: "center" | "form";
  className?: string;
  innerClassName?: string;
};

/**
 * Full-viewport mobile shell for short auth flows: no scroll when keyboard closed; scroll when keyboard open.
 */
export function MobileAuthViewport({
  children,
  panelRef,
  keyboardPaddingBottom,
  keyboardOpen,
  contentAlign = "center",
  className,
  innerClassName,
}: MobileAuthViewportProps) {
  const isFormLayout = contentAlign === "form";

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
            "flex min-h-0 flex-1 flex-col overflow-x-hidden px-4 py-3 sm:px-5 sm:py-6",
            scrollHide,
            isFormLayout || keyboardOpen
              ? "items-stretch overflow-y-auto"
              : "items-center overflow-y-hidden",
            keyboardOpen
              ? isFormLayout
                ? "justify-start"
                : "justify-center"
              : isFormLayout
                ? "justify-center"
                : "justify-center",
            isFormLayout && "safe-area-padding-bottom-capped",
            innerClassName,
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
