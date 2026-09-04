import { useRef } from "react";
import { ForgotPasswordScreen } from "@/0-auth/screens/ForgotPasswordScreen";
import { PosBrandMark } from "@/pos-mobile/shared/components/PosBrandMark";
import { PosAuthViewport } from "@/pos-mobile/shared/layout/PosAuthViewport";
import { usePosTabletShell } from "@/pos-mobile/shared/hooks/usePosTabletShell";
import { useMobileKeyboardViewport } from "@/shared/hooks/useMobileKeyboardViewport";
import { POS_AUTH_PATHS } from "../lib/posAuthPaths";
import { useMarkPosAuthSurface } from "../lib/useMarkPosAuthSurface";

/** Public route: `/pos/forgot-password`. */
export default function PosForgotPasswordPage() {
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
        <ForgotPasswordScreen
          brandMark={<PosBrandMark size="form" />}
          submitButtonRef={submitRef}
          onFieldFocus={kb.onInputFocus}
          onFieldBlur={kb.onInputBlur}
          hideSubtitle
          loginHref={POS_AUTH_PATHS.login}
        />
      </div>
    </PosAuthViewport>
  );
}
