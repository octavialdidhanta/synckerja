import { createContext } from "react";

export type IncomeDashboardRefreshContextValue = {
  refetchRef: React.MutableRefObject<(() => Promise<void>) | null>;
  isRefreshing: boolean;
};

export const IncomeDashboardRefreshContext = createContext<IncomeDashboardRefreshContextValue | null>(null);
