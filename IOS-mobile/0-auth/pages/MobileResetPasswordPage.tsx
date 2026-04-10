import { ResetPasswordScreen } from "@/0-auth/screens/ResetPasswordScreen";
import { SynckerjaBrandMark } from "@/shared/components/mobile/SynckerjaBrandMark";
import { WithMobileAuthShell } from "@/shared/components/mobile/withMobileAuthShell";

export default function MobileResetPasswordPage() {
  return (
    <WithMobileAuthShell>
      {({ submitAnchorRef, onFieldFocus, onFieldBlur }) => (
        <ResetPasswordScreen
          brandMark={<SynckerjaBrandMark />}
          submitButtonRef={submitAnchorRef}
          onFieldFocus={onFieldFocus}
          onFieldBlur={onFieldBlur}
        />
      )}
    </WithMobileAuthShell>
  );
}
