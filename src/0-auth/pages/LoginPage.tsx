import { useRef } from "react";
import { AuthSplitLayout } from "@/0-auth/components/AuthSplitLayout";
import { LoginScreen } from "@/0-auth/screens/LoginScreen";
import { useMobileKeyboardViewport } from "@/shared/hooks/useMobileKeyboardViewport";

export default function LoginPage() {
  const submitRef = useRef<HTMLButtonElement>(null);
  const kb = useMobileKeyboardViewport({ submitAnchorRef: submitRef });

  return (
    <AuthSplitLayout scrollPanelRef={kb.panelRef} keyboardPaddingBottom={kb.keyboardPaddingBottom}>
      <LoginScreen
        submitButtonRef={submitRef}
        onFieldFocus={kb.onInputFocus}
        onFieldBlur={kb.onInputBlur}
      />
    </AuthSplitLayout>
  );
}
