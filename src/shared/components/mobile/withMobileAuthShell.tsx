import { useRef, type ReactNode } from "react";
import { MobileAuthViewport } from "@/shared/components/mobile/MobileAuthViewport";
import { useMobileKeyboardViewport } from "@/shared/hooks/useMobileKeyboardViewport";

type Props = {
  children: (args: {
    submitAnchorRef: React.RefObject<HTMLButtonElement | null>;
    onFieldFocus: () => void;
    onFieldBlur: () => void;
  }) => ReactNode;
};

/** Wraps short auth flows with keyboard-aware mobile viewport. */
export function WithMobileAuthShell({ children }: Props) {
  const submitRef = useRef<HTMLButtonElement>(null);
  const kb = useMobileKeyboardViewport({ submitAnchorRef: submitRef });

  return (
    <MobileAuthViewport
      panelRef={kb.panelRef}
      keyboardPaddingBottom={kb.keyboardPaddingBottom}
      keyboardOpen={kb.keyboardOpen}
    >
      {children({
        submitAnchorRef: submitRef,
        onFieldFocus: kb.onInputFocus,
        onFieldBlur: kb.onInputBlur,
      })}
    </MobileAuthViewport>
  );
}
