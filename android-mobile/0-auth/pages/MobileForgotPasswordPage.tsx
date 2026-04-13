import { ForgotPasswordScreen } from "@/0-auth/screens/ForgotPasswordScreen";
import { SynckerjaBrandMark } from "@/shared/components/mobile/SynckerjaBrandMark";
import { WithMobileAuthShell } from "@/shared/components/mobile/withMobileAuthShell";

export default function MobileForgotPasswordPage() {
  return (
    <WithMobileAuthShell keyboardOpenInnerClassName="!pt-14">
      {({ submitAnchorRef, onFieldFocus, onFieldBlur }) => (
        <ForgotPasswordScreen
          brandMark={<SynckerjaBrandMark />}
          hideSubtitle
          submitButtonRef={submitAnchorRef}
          onFieldFocus={onFieldFocus}
          onFieldBlur={onFieldBlur}
        />
      )}
    </WithMobileAuthShell>
  );
}
