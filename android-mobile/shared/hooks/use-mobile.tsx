import * as React from "react";
import { Capacitor } from "@capacitor/core";

/** Lebar viewport di bawah ini = permukaan mobile (`useAuthSurface`, route android-mobile, dll.). */
const MOBILE_BREAKPOINT = 768;

function computeIsMobileWeb(): boolean {
  return typeof window !== "undefined" && window.innerWidth <= MOBILE_BREAKPOINT;
}

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    if (Capacitor.isNativePlatform()) return true;
    // Sertakan tepat 768px (preset “tablet” di DevTools = 768 lebar → sebelumnya jatuh ke desktop).
    return computeIsMobileWeb();
  });

  React.useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      setIsMobile(true);
      return;
    }
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);
    const onChange = () => {
      setIsMobile(computeIsMobileWeb());
    };
    mql.addEventListener("change", onChange);
    setIsMobile(computeIsMobileWeb());
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}
