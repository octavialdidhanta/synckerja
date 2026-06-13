import { NativeFcmRegistration } from "@/shared/native/NativeFcmRegistration";
import { NativeGoogleAuthInit } from "@/0-auth/native/NativeGoogleAuthInit";
import { NativeSupabaseOAuthBridge } from "@/0-auth/native/NativeSupabaseOAuthBridge";
import { NativeNotificationTapBridge } from "@/shared/native/NativeNotificationTapBridge";

export function NativeAppServices() {
  return (
    <>
      <NativeFcmRegistration />
      <NativeGoogleAuthInit />
      <NativeSupabaseOAuthBridge />
      <NativeNotificationTapBridge />
    </>
  );
}
