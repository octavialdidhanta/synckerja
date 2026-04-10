import { useRef, type ReactNode, type RefObject } from "react";
import { cn } from "@/shared/lib/utils";
import { useMobileKeyboardViewport } from "@/shared/hooks/useMobileKeyboardViewport";

const scrollHide =
  "scrollbar-hide seamless-scroll nested-scroll-touch-chain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

type ChildrenRender = (args: {
  submitAnchorRef: RefObject<HTMLButtonElement | null>;
  onFieldFocus: () => void;
  onFieldBlur: () => void;
}) => ReactNode;

export type MobileFormScrollViewportProps = {
  children: ChildrenRender;
  className?: string;
  contentClassName?: string;
};

/**
 * Form panjang di native/mobile: scroll selalu aktif + penyesuaian keyboard (mirip auth, tanpa center saat keyboard tutup).
 */
export function MobileFormScrollViewport({
  children,
  className,
  contentClassName,
}: MobileFormScrollViewportProps) {
  const submitRef = useRef<HTMLButtonElement>(null);
  const kb = useMobileKeyboardViewport({ submitAnchorRef: submitRef });

  return (
    <div
      className={cn(
        "safe-area-top flex h-dvh min-h-0 w-full flex-col overflow-hidden bg-[hsl(var(--brand-white))]",
        className,
      )}
    >
      <div
        className="flex min-h-0 flex-1 flex-col"
        style={kb.keyboardPaddingBottom > 0 ? { paddingBottom: kb.keyboardPaddingBottom } : undefined}
      >
        <div
          ref={kb.panelRef}
          className={cn(
            "flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto px-4 py-4",
            scrollHide,
            contentClassName,
          )}
        >
          {children({
            submitAnchorRef: submitRef,
            onFieldFocus: kb.onInputFocus,
            onFieldBlur: kb.onInputBlur,
          })}
        </div>
      </div>
    </div>
  );
}
