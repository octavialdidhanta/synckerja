import { useNativeFcmRegistration } from "@/shared/native/useNativeFcmRegistration";
import { useLiveChatFCM } from "@/mobile/4-livechat/hooks/useLiveChatFCM";

/** Native-only: daftar FCM, simpan token; + foreground banner untuk Live Chat. */
export function NativeFcmRegistration() {
  useNativeFcmRegistration();
  useLiveChatFCM();
  return null;
}
