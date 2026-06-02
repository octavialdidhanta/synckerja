import { useRef } from "react";
import { ForgotPasswordScreen } from "@/0-auth/screens/ForgotPasswordScreen";
import { SynckerjaBrandMark } from "@/shared/components/mobile/SynckerjaBrandMark";
import { MobileAuthViewport } from "@/shared/components/mobile/MobileAuthViewport";
import { useMobileKeyboardViewport } from "@/shared/hooks/useMobileKeyboardViewport";
import { cn } from "@/shared/lib/utils";

export default function MobileForgotPasswordPage() {
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
          <ForgotPasswordScreen
            brandMark={<SynckerjaBrandMark size="sm" />}
            hideSubtitle
            submitButtonRef={submitRef}
            onFieldFocus={kb.onInputFocus}
            onFieldBlur={kb.onInputBlur}
          />
        </div>
      </div>
    </MobileAuthViewport>
  );
}
