import { useRef } from "react";
import { RegistrationForm } from "@/0-register/components/RegistrationForm";
import { useMobileKeyboardViewport } from "@/shared/hooks/useMobileKeyboardViewport";
import { POS_AUTH_PATHS } from "../lib/posAuthPaths";

/** Public route: `/pos/register` (shell from {@link PosAuthFunnelLayout}). */
export default function PosRegisterPage() {
  const submitRef = useRef<HTMLButtonElement>(null);
  const kb = useMobileKeyboardViewport({ submitAnchorRef: submitRef });

  return (
    <div
      ref={kb.panelRef}
      className="w-full"
      style={
        kb.keyboardPaddingBottom > 0
          ? { paddingBottom: kb.keyboardPaddingBottom }
          : undefined
      }
    >
        <RegistrationForm
          brandMark={null}
          submitButtonRef={submitRef}
          onKeyboardInputFocus={kb.onInputFocus}
          onKeyboardInputBlur={kb.onInputBlur}
          loginHref={POS_AUTH_PATHS.login}
        />
    </div>
  );
}
