import { createContext } from "react";

export type ExpenseDashboardRefreshContextValue = {
  refetchRef: React.MutableRefObject<(() => Promise<void>) | null>;
  isRefreshing: boolean;
};

export const ExpenseDashboardRefreshContext =
  createContext<ExpenseDashboardRefreshContextValue | null>(null);

