import { useRef, type ReactNode } from "react";
import { MobileAuthViewport } from "@/shared/components/mobile/MobileAuthViewport";
import { useMobileKeyboardViewport } from "@/shared/hooks/useMobileKeyboardViewport";
import { cn } from "@/shared/lib/utils";

type Props = {
  children: (args: {
    submitAnchorRef: React.RefObject<HTMLButtonElement | null>;
    onFieldFocus: () => void;
    onFieldBlur: () => void;
  }) => ReactNode;
  /** Extra classes on the scroll panel while the keyboard is open (e.g. `pt-12` to nudge content down). */
  keyboardOpenInnerClassName?: string;
};

/** Wraps short auth flows with keyboard-aware mobile viewport. */
export function WithMobileAuthShell({ children, keyboardOpenInnerClassName }: Props) {
  const submitRef = useRef<HTMLButtonElement>(null);
  const kb = useMobileKeyboardViewport({ submitAnchorRef: submitRef });

  return (
    <MobileAuthViewport
      panelRef={kb.panelRef}
      keyboardPaddingBottom={kb.keyboardPaddingBottom}
      keyboardOpen={kb.keyboardOpen}
      innerClassName={cn(kb.keyboardOpen && keyboardOpenInnerClassName)}
    >
      {children({
        submitAnchorRef: submitRef,
        onFieldFocus: kb.onInputFocus,
        onFieldBlur: kb.onInputBlur,
      })}
    </MobileAuthViewport>
  );
}
