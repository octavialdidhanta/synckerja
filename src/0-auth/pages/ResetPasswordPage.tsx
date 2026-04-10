import { useRef } from "react";
import { AuthSplitLayout } from "@/0-auth/components/AuthSplitLayout";
import { ResetPasswordScreen } from "@/0-auth/screens/ResetPasswordScreen";
import { useMobileKeyboardViewport } from "@/shared/hooks/useMobileKeyboardViewport";

export default function ResetPasswordPage() {
  const submitRef = useRef<HTMLButtonElement>(null);
  const kb = useMobileKeyboardViewport({ submitAnchorRef: submitRef });

  return (
    <AuthSplitLayout scrollPanelRef={kb.panelRef} keyboardPaddingBottom={kb.keyboardPaddingBottom}>
      <ResetPasswordScreen
        submitButtonRef={submitRef}
        onFieldFocus={kb.onInputFocus}
        onFieldBlur={kb.onInputBlur}
      />
    </AuthSplitLayout>
  );
}
