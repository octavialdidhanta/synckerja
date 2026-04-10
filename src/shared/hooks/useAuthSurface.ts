import { Capacitor } from "@capacitor/core";
import { useIsMobile } from "@/mobile/shared/hooks/use-mobile";

/**
 * Resolves which auth/onboarding surface to render: desktop split layout vs mobile (Android/web) vs iOS native.
 */
export function useAuthSurface() {
  const isMobile = useIsMobile();
  const isIosNative = Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";
  const isDesktop = !isMobile;
  return { isDesktop, isMobile, isIosNative };
}
