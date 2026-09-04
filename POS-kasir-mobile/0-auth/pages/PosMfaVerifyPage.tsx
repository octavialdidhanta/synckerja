import { useRef } from "react";
import { MfaVerifyScreen } from "@/0-auth/screens/MfaVerifyScreen";
import { PosBrandMark } from "@/pos-mobile/shared/components/PosBrandMark";
import { PosAuthViewport } from "@/pos-mobile/shared/layout/PosAuthViewport";
import { usePosTabletShell } from "@/pos-mobile/shared/hooks/usePosTabletShell";
import { useMobileKeyboardViewport } from "@/shared/hooks/useMobileKeyboardViewport";
import { POS_AUTH_PATHS } from "../lib/posAuthPaths";
import { useMarkPosAuthSurface } from "../lib/useMarkPosAuthSurface";

/** Public route: `/pos/login/mfa`. */
export default function PosMfaVerifyPage() {
  usePosTabletShell();
  useMarkPosAuthSurface();
  const submitRef = useRef<HTMLButtonElement>(null);
  const kb = useMobileKeyboardViewport({ submitAnchorRef: submitRef });

  return (
    <PosAuthViewport>
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
          brandMark={<PosBrandMark size="form" />}
          submitButtonRef={submitRef}
          onFieldFocus={kb.onInputFocus}
          onFieldBlur={kb.onInputBlur}
          loginPath={POS_AUTH_PATHS.login}
        />
      </div>
    </PosAuthViewport>
  );
}
