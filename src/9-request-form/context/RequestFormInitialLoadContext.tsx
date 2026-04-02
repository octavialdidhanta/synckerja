import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useCurrentOrg } from "@/shared/hooks/useCurrentOrg";
import { usePurchaseRequests } from "@/9-request-form/hooks/usePurchaseRequests";

const HIDE_SKELETON_DEBOUNCE_MS = 200;

type RequestFormInitialLoadContextValue = {
  /** True while org bootstrap or first purchase-requests list fetch is in flight */
  showSkeleton: boolean;
  organizationId: string | null;
  orgLoading: boolean;
  listError: Error | null;
};

const RequestFormInitialLoadContext = createContext<RequestFormInitialLoadContextValue | null>(null);

export function RequestFormInitialLoadProvider({ children }: { children: ReactNode }) {
  const { organizationId, loading: orgLoading } = useCurrentOrg();
  const { isLoading: listLoading, isError, error } = usePurchaseRequests();

  const rawPending = orgLoading || (!!organizationId && listLoading);
  const [showSkeleton, setShowSkeleton] = useState(rawPending);

  useEffect(() => {
    if (rawPending) {
      setShowSkeleton(true);
      return;
    }
    const id = window.setTimeout(() => setShowSkeleton(false), HIDE_SKELETON_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [rawPending]);

  const value = useMemo<RequestFormInitialLoadContextValue>(() => {
    let listError: Error | null = null;
    if (isError && error != null) {
      listError = error instanceof Error ? error : new Error(String(error));
    }
    return {
      showSkeleton,
      organizationId,
      orgLoading,
      listError,
    };
  }, [showSkeleton, organizationId, orgLoading, isError, error]);

  return (
    <RequestFormInitialLoadContext.Provider value={value}>{children}</RequestFormInitialLoadContext.Provider>
  );
}

export function useRequestFormInitialLoad() {
  const ctx = useContext(RequestFormInitialLoadContext);
  if (!ctx) {
    throw new Error("useRequestFormInitialLoad must be used within RequestFormInitialLoadProvider");
  }
  return ctx;
}
