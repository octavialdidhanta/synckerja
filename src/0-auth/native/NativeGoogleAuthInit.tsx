import { useEffect } from "react";
import { isNativeCapacitorAuth } from "@/0-auth/lib/ssoRedirectUrl";
import { ensureNativeGoogleSocialLoginInitialized } from "@/0-auth/lib/nativeGoogleSso";

/** Pre-initializes native Google Sign-In SDK when env client IDs are present. */
export function NativeGoogleAuthInit() {
  useEffect(() => {
    if (!isNativeCapacitorAuth()) {
      return;
    }
    void ensureNativeGoogleSocialLoginInitialized().catch(() => {
      /* Missing env or SDK — startGoogleSignIn surfaces not_configured */
    });
  }, []);

  return null;
}
