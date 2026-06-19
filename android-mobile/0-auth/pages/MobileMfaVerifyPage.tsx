import { useRef } from "react";
import { MfaVerifyScreen } from "@/0-auth/screens/MfaVerifyScreen";
import { SynckerjaBrandMark } from "@/shared/components/mobile/SynckerjaBrandMark";
import { MobileAuthViewport } from "@/shared/components/mobile/MobileAuthViewport";
import { useMobileKeyboardViewport } from "@/shared/hooks/useMobileKeyboardViewport";

export default function MobileMfaVerifyPage() {
  const submitRef = useRef<HTMLButtonElement>(null);
  const kb = useMobileKeyboardViewport({ submitAnchorRef: submitRef });

  return (
    <MobileAuthViewport
      panelRef={kb.panelRef}
      keyboardPaddingBottom={kb.keyboardPaddingBottom}
      keyboardOpen={kb.keyboardOpen}
      contentAlign="center"
    >
      <div className="flex min-h-full w-full flex-1 flex-col justify-center py-2">
        <div className="mx-auto w-full max-w-md">
          <MfaVerifyScreen
            brandMark={<SynckerjaBrandMark size="sm" />}
            onFieldFocus={kb.onInputFocus}
            onFieldBlur={kb.onInputBlur}
            submitButtonRef={submitRef}
          />
        </div>
      </div>
    </MobileAuthViewport>
  );
}
