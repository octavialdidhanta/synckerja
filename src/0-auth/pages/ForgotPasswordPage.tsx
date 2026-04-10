import { useRef } from "react";
import { AuthSplitLayout } from "@/0-auth/components/AuthSplitLayout";
import { ForgotPasswordScreen } from "@/0-auth/screens/ForgotPasswordScreen";
import { useMobileKeyboardViewport } from "@/shared/hooks/useMobileKeyboardViewport";

export default function ForgotPasswordPage() {
  const submitRef = useRef<HTMLButtonElement>(null);
  const kb = useMobileKeyboardViewport({ submitAnchorRef: submitRef });

  return (
    <AuthSplitLayout scrollPanelRef={kb.panelRef} keyboardPaddingBottom={kb.keyboardPaddingBottom}>
      <ForgotPasswordScreen
        submitButtonRef={submitRef}
        onFieldFocus={kb.onInputFocus}
        onFieldBlur={kb.onInputBlur}
      />
    </AuthSplitLayout>
  );
}
