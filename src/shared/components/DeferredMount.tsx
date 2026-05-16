import { useEffect, useState, type ReactNode } from 'react';

type DeferredMountProps = {
  children: ReactNode;
  fallback?: ReactNode;
  idleTimeoutMs?: number;
  delayMs?: number;
};

/** Defers mounting children until idle — below-fold / sidebar on data-heavy pages. */
export function DeferredMount({
  children,
  fallback = null,
  idleTimeoutMs = 1200,
  delayMs = 150,
}: DeferredMountProps) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const mount = () => {
      if (!cancelled) setReady(true);
    };

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      const id = window.requestIdleCallback(mount, { timeout: idleTimeoutMs });
      return () => {
        cancelled = true;
        window.cancelIdleCallback(id);
      };
    }

    const timer = window.setTimeout(mount, delayMs);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [idleTimeoutMs, delayMs]);

  if (!ready) return <>{fallback}</>;
  return <>{children}</>;
}
