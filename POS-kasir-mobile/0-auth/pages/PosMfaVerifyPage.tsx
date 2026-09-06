import { useRef } from "react";
import { MfaVerifyScreen } from "@/0-auth/screens/MfaVerifyScreen";
import { useMobileKeyboardViewport } from "@/shared/hooks/useMobileKeyboardViewport";
import { POS_AUTH_PATHS } from "../lib/posAuthPaths";

/** Public route: `/pos/login/mfa` — brand stays in {@link PosAuthFunnelLayout}. */
export default function PosMfaVerifyPage() {
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
      <MfaVerifyScreen
        brandMark={null}
        submitButtonRef={submitRef}
        onFieldFocus={kb.onInputFocus}
        onFieldBlur={kb.onInputBlur}
        loginPath={POS_AUTH_PATHS.login}
      />
    </div>
  );
}
