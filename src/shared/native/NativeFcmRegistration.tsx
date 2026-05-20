import { useEffect, useState, type ComponentType } from "react";
import { Capacitor } from "@capacitor/core";

/** Native-only: daftar FCM + foreground banner Live Chat (chunk terpisah, tidak di web). */
export function NativeFcmRegistration() {
  const [Inner, setInner] = useState<ComponentType | null>(null);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let cancelled = false;
    void import("./NativeFcmRegistrationInner").then((mod) => {
      if (!cancelled) setInner(() => mod.default);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!Inner) return null;
  return <Inner />;
}
