import { LoginScreen } from "@/0-auth/screens/LoginScreen";
import { SynckerjaBrandMark } from "@/shared/components/mobile/SynckerjaBrandMark";
import { WithMobileAuthShell } from "@/shared/components/mobile/withMobileAuthShell";

export default function MobileLoginPage() {
  return (
    <WithMobileAuthShell>
      {({ submitAnchorRef, onFieldFocus, onFieldBlur }) => (
        <LoginScreen
          brandMark={<SynckerjaBrandMark />}
          submitButtonRef={submitAnchorRef}
          onFieldFocus={onFieldFocus}
          onFieldBlur={onFieldBlur}
        />
      )}
    </WithMobileAuthShell>
  );
}
