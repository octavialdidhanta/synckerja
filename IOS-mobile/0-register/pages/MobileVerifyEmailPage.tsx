import { VerifyEmailScreen } from "@/0-register/screens/VerifyEmailScreen";
import { SynckerjaBrandMark } from "@/shared/components/mobile/SynckerjaBrandMark";
import { MobileAuthViewport } from "@/shared/components/mobile/MobileAuthViewport";
import { useMobileKeyboardViewport } from "@/shared/hooks/useMobileKeyboardViewport";

export default function MobileVerifyEmailPage() {
  const kb = useMobileKeyboardViewport();

  return (
    <MobileAuthViewport
      panelRef={kb.panelRef}
      keyboardPaddingBottom={kb.keyboardPaddingBottom}
      keyboardOpen={kb.keyboardOpen}
    >
      <VerifyEmailScreen
        brandMark={<SynckerjaBrandMark />}
        renderShell={(body) => <div className="w-full min-w-0">{body}</div>}
      />
    </MobileAuthViewport>
  );
}
