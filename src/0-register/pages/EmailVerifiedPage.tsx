import { Navigate, useSearchParams } from "react-router-dom";
import { EmailVerificationStatus } from "@/0-register/components/EmailVerificationStatus";

export default function EmailVerifiedPage() {
  const [searchParams] = useSearchParams();
  // Verification is code-based now (confirm_email_verification_otp). The old token-only link
  // flow is no longer callable from the client, so send stale links to the code screen.
  if (searchParams.get("token")) {
    return <Navigate to="/verify-email" replace />;
  }
  return <EmailVerificationStatus />;
}
