import { useRef } from "react";
import { ForgotPasswordScreen } from "@/0-auth/screens/ForgotPasswordScreen";
import { useMobileKeyboardViewport } from "@/shared/hooks/useMobileKeyboardViewport";
import { POS_AUTH_PATHS } from "../lib/posAuthPaths";

/** Public route: `/pos/forgot-password` — brand from {@link PosAuthFunnelLayout}. */
export default function PosForgotPasswordPage() {
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
      <ForgotPasswordScreen
        brandMark={null}
        submitButtonRef={submitRef}
        onFieldFocus={kb.onInputFocus}
        onFieldBlur={kb.onInputBlur}
        hideSubtitle
        loginHref={POS_AUTH_PATHS.login}
      />
    </div>
  );
}
