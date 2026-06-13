import { lazy, Suspense, useEffect, useState } from "react";

const NativeAppServices = lazy(() =>
  import("@/shared/components/NativeAppServices").then((m) => ({ default: m.NativeAppServices })),
);

/** Capacitor / FCM / OAuth bridges — not needed for first paint on web Lighthouse. */
export function DeferredNativeAppServices() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
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
  }, []);

  if (!ready) return null;

  return (
    <Suspense fallback={null}>
      <NativeAppServices />
    </Suspense>
  );
}
