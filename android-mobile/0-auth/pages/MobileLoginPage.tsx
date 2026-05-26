import { useRef } from "react";
import { LoginScreen } from "@/0-auth/screens/LoginScreen";
import { SynckerjaBrandMark } from "@/shared/components/mobile/SynckerjaBrandMark";
import { MobileAuthViewport } from "@/shared/components/mobile/MobileAuthViewport";
import { useMobileKeyboardViewport } from "@/shared/hooks/useMobileKeyboardViewport";
import { cn } from "@/shared/lib/utils";

export default function MobileLoginPage() {
  const submitRef = useRef<HTMLButtonElement>(null);
  const kb = useMobileKeyboardViewport({ submitAnchorRef: submitRef });

  return (
    <MobileAuthViewport
      panelRef={kb.panelRef}
      keyboardPaddingBottom={kb.keyboardPaddingBottom}
      keyboardOpen={kb.keyboardOpen}
      contentAlign="form"
    >
      <div
        className={cn(
          "flex w-full flex-col",
          kb.keyboardOpen ? "min-h-0" : "min-h-full flex-1 justify-center py-2",
        )}
      >
        <div className="mx-auto w-full max-w-md">
          <LoginScreen
            brandMark={<SynckerjaBrandMark size="sm" />}
            submitButtonRef={submitRef}
            onFieldFocus={kb.onInputFocus}
            onFieldBlur={kb.onInputBlur}
          />
        </div>
      </div>
    </MobileAuthViewport>
  );
}
