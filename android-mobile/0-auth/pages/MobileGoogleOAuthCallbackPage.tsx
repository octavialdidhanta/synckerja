import { GoogleOAuthCallbackScreen } from "@/0-auth/screens/GoogleOAuthCallbackScreen";
import { MobileOnboardingViewport } from "@/shared/components/mobile/MobileOnboardingViewport";

export default function MobileGoogleOAuthCallbackPage() {
  return (
    <MobileOnboardingViewport scrollAlways>
      <GoogleOAuthCallbackScreen />
    </MobileOnboardingViewport>
  );
}
