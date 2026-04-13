/* Provider + hooks: not a components-only module for fast refresh. */
/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/** Mirrors CSS selector in `index.css` for `.modal-above-safe-area` override. */
export const MOBILE_SHELL_NAV_SUPPRESSED_ATTR = "data-mobile-shell-nav-suppressed";

function syncDocumentHtmlAttr(depth: number) {
  if (typeof document === "undefined") return;
  if (depth > 0) {
    document.documentElement.setAttribute(MOBILE_SHELL_NAV_SUPPRESSED_ATTR, "true");
  } else {
    document.documentElement.removeAttribute(MOBILE_SHELL_NAV_SUPPRESSED_ATTR);
  }
}

const MobileAppNavSuppressionDepthContext = createContext(0);

type MobileAppNavSuppressionApi = {
  increment: () => void;
  decrement: () => void;
};

const MobileAppNavSuppressionApiContext = createContext<MobileAppNavSuppressionApi | null>(null);

export function MobileAppNavSuppressionProvider({ children }: { children: ReactNode }) {
  const [depth, setDepth] = useState(0);

  useEffect(() => {
    syncDocumentHtmlAttr(depth);
  }, [depth]);

  const increment = useCallback(() => {
    setDepth((d) => d + 1);
  }, []);

  const decrement = useCallback(() => {
    setDepth((d) => Math.max(0, d - 1));
  }, []);

  const api = useMemo(
    () => ({
      increment,
      decrement,
    }),
    [increment, decrement],
  );

  return (
    <MobileAppNavSuppressionApiContext.Provider value={api}>
      <MobileAppNavSuppressionDepthContext.Provider value={depth}>{children}</MobileAppNavSuppressionDepthContext.Provider>
    </MobileAppNavSuppressionApiContext.Provider>
  );
}

/** True while at least one mobile fullscreen shell has registered (tab bar should hide). */
export function useMobileAppNavSuppressed(): boolean {
  return useContext(MobileAppNavSuppressionDepthContext) > 0;
}

/**
 * Register app bottom nav suppression while `active` is true (e.g. DialogContent mounted for a fullscreen shell).
 * No-op if provider is missing (tests / Storybook).
 */
export function useRegisterMobileAppNavSuppression(active: boolean): void {
  const api = useContext(MobileAppNavSuppressionApiContext);
  useLayoutEffect(() => {
    if (!active || !api) return;
    api.increment();
    return () => api.decrement();
  }, [active, api]);
}
