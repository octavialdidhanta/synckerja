import { useEffect, useRef } from "react";
import type { OrganizationAccessState } from "@/shared/auth/organizationAccess/organizationAccessTypes";

type UseOrganizationAccessFocusRefreshOptions = {
  organizationAccessState: OrganizationAccessState;
  onRefresh: () => void | Promise<void>;
};

const DEBOUNCE_MS = 400;

export function useOrganizationAccessFocusRefresh({
  organizationAccessState,
  onRefresh,
}: UseOrganizationAccessFocusRefreshOptions) {
  const stateRef = useRef(organizationAccessState);
  stateRef.current = organizationAccessState;
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      const state = stateRef.current;
      if (state !== "ready" && state !== "loading") {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          debounceRef.current = null;
          void onRefresh();
        }, DEBOUNCE_MS);
      }
    };

    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [onRefresh]);
}
