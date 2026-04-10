import { AuthSplitLayout } from "@/0-auth/components/AuthSplitLayout";
import { GoogleOAuthCallbackScreen } from "@/0-auth/screens/GoogleOAuthCallbackScreen";

export default function GoogleOAuthCallbackPage() {
  return (
    <AuthSplitLayout>
      <GoogleOAuthCallbackScreen />
    </AuthSplitLayout>
  );
}
