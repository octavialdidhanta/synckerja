import { useNativeFcmRegistration } from "@/shared/native/useNativeFcmRegistration";
import { useLiveChatFCM } from "@/mobile/4-livechat/hooks/useLiveChatFCM";

/** Native-only implementation — loaded dynamically to keep web initial bundle small. */
export default function NativeFcmRegistrationInner() {
  useNativeFcmRegistration();
  useLiveChatFCM();
  return null;
}
