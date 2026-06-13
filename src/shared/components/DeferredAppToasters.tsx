import { lazy, Suspense, useEffect, useState } from "react";

const AppToasters = lazy(() =>
  import("@/shared/components/AppToasters").then((m) => ({ default: m.AppToasters })),
);

/** Defers toast UI chunks until after first paint (Lighthouse: unused JS + main-thread). */
export function DeferredAppToasters() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const mount = () => {
      if (!cancelled) setReady(true);
    };

    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      const id = window.requestIdleCallback(mount, { timeout: 1200 });
      return () => {
        cancelled = true;
        window.cancelIdleCallback(id);
      };
    }

    const timer = window.setTimeout(mount, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  if (!ready) return null;

  return (
    <Suspense fallback={null}>
      <AppToasters />
    </Suspense>
  );
}
