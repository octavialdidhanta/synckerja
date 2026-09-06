import { NativeFcmRegistration } from "@/shared/native/NativeFcmRegistration";
import { NativeGoogleAuthInit } from "@/0-auth/native/NativeGoogleAuthInit";
import { NativeSupabaseOAuthBridge } from "@/0-auth/native/NativeSupabaseOAuthBridge";

/** FCM / OAuth only — notification tap bridge mounts eagerly from App (cold-start deep links). */
export function NativeAppServices() {
  return (
    <>
      <NativeFcmRegistration />
      <NativeGoogleAuthInit />
      <NativeSupabaseOAuthBridge />
    </>
  );
}
