import { lazy, Suspense, useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";

const NativeAppServices = lazy(() =>
  import("@/shared/components/NativeAppServices").then((m) => ({ default: m.NativeAppServices })),
);

/**
 * Capacitor / FCM / OAuth bridges.
 * Native: mount immediately (notification tap deep-link must not wait on idle).
 * Web: defer until idle for Lighthouse first paint.
 */
export function DeferredNativeAppServices() {
  const [ready, setReady] = useState(() => Capacitor.isNativePlatform());

  useEffect(() => {
    if (ready) return;

    let cancelled = false;
    const mount = () => {
      if (!cancelled) setReady(true);
    };

    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      const id = window.requestIdleCallback(mount, { timeout: 2500 });
      return () => {
        cancelled = true;
        window.cancelIdleCallback(id);
      };
    }

    const timer = window.setTimeout(mount, 800);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [ready]);

  if (!ready) return null;

  return (
    <Suspense fallback={null}>
      <NativeAppServices />
    </Suspense>
  );
}
