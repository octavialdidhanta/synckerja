import { createContext } from "react";
import type { MutableRefObject } from "react";

export const ExpenseDashboardRefreshContext = createContext<{
  refetchRef: MutableRefObject<(() => Promise<void>) | null>;
  isRefreshing: boolean;
} | null>(null);
