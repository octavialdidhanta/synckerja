import { useEffect, useRef } from "react";

/**
 * Android/browser Back closes storefront overlays instead of leaving the site.
 * Re-arms a same-URL history entry after every pop so the store stays on screen.
 */
export function useOrderStorefrontBackGuard(args: {
  enabled: boolean;
  onBack: () => void;
}) {
  const onBackRef = useRef(args.onBack);
  onBackRef.current = args.onBack;

  useEffect(() => {
    if (!args.enabled || typeof window === "undefined") return;

    const arm = () => {
      window.history.pushState({ synckerjaOrderStay: true }, "", window.location.href);
    };
    arm();

    const onPopState = () => {
      onBackRef.current();
      arm();
    };
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
    };
  }, [args.enabled]);
}
