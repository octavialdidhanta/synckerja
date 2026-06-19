import { useRef } from "react";
import { AuthSplitLayout } from "@/0-auth/components/AuthSplitLayout";
import { MfaVerifyScreen } from "@/0-auth/screens/MfaVerifyScreen";
import { useMobileKeyboardViewport } from "@/shared/hooks/useMobileKeyboardViewport";

export default function MfaVerifyPage() {
  const submitRef = useRef<HTMLButtonElement>(null);
  const kb = useMobileKeyboardViewport({ submitAnchorRef: submitRef });

  return (
    <AuthSplitLayout scrollPanelRef={kb.panelRef} keyboardPaddingBottom={kb.keyboardPaddingBottom}>
      <MfaVerifyScreen
        submitButtonRef={submitRef}
        onFieldFocus={kb.onInputFocus}
        onFieldBlur={kb.onInputBlur}
      />
    </AuthSplitLayout>
  );
}
