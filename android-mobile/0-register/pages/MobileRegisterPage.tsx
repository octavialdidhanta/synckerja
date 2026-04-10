import { useRef } from "react";
import { RegistrationForm } from "@/0-register/components/RegistrationForm";
import { SynckerjaBrandMark } from "@/shared/components/mobile/SynckerjaBrandMark";
import { MobileAuthViewport } from "@/shared/components/mobile/MobileAuthViewport";
import { useMobileKeyboardViewport } from "@/shared/hooks/useMobileKeyboardViewport";

export default function MobileRegisterPage() {
  const submitRef = useRef<HTMLButtonElement>(null);
  const kb = useMobileKeyboardViewport({ submitAnchorRef: submitRef });

  return (
    <MobileAuthViewport
      panelRef={kb.panelRef}
      keyboardPaddingBottom={kb.keyboardPaddingBottom}
      keyboardOpen={kb.keyboardOpen}
    >
      <div className="w-full max-w-md">
        <RegistrationForm
          brandMark={<SynckerjaBrandMark />}
          submitButtonRef={submitRef}
          onKeyboardInputFocus={kb.onInputFocus}
          onKeyboardInputBlur={kb.onInputBlur}
        />
      </div>
    </MobileAuthViewport>
  );
}
