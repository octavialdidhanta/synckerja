import { useSearchParams } from "react-router-dom";
import { EmailVerificationStatus } from "@/0-register/components/EmailVerificationStatus";

export default function EmailVerifiedPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || undefined;
  return <EmailVerificationStatus token={token} />;
}
