import { useSearchParams } from "react-router-dom";
import { EmailVerificationStatus } from "@/0-register/components/EmailVerificationStatus";
import { SynckerjaBrandMark } from "@/shared/components/mobile/SynckerjaBrandMark";
import { MobileAuthViewport } from "@/shared/components/mobile/MobileAuthViewport";
import { useMobileKeyboardViewport } from "@/shared/hooks/useMobileKeyboardViewport";

export default function MobileEmailVerifiedPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || undefined;
  const kb = useMobileKeyboardViewport();

  return (
    <MobileAuthViewport
      panelRef={kb.panelRef}
      keyboardPaddingBottom={kb.keyboardPaddingBottom}
      keyboardOpen={kb.keyboardOpen}
    >
      <EmailVerificationStatus
        token={token}
        brandMark={<SynckerjaBrandMark />}
        renderShell={(body) => <div className="w-full min-w-0">{body}</div>}
      />
    </MobileAuthViewport>
  );
}
