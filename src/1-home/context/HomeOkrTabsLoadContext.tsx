import React, {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";

export type HomeOkrTabId = "company" | "department" | "individual";

export type OkrTabStatus = {
  loading: boolean;
  error: Error | null;
};

/** Only the default tab blocks the home skeleton; others report after first visit. */
const INITIAL_TABS: Record<HomeOkrTabId, OkrTabStatus> = {
  company: { loading: true, error: null },
  department: { loading: false, error: null },
  individual: { loading: false, error: null },
};

type Ctx = {
  tabs: Record<HomeOkrTabId, OkrTabStatus>;
  setTab: (id: HomeOkrTabId, status: OkrTabStatus) => void;
};

const HomeOkrTabsLoadContext = createContext<Ctx | null>(null);

export function HomeOkrTabsLoadProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [tabs, setTabs] =
    useState<Record<HomeOkrTabId, OkrTabStatus>>(INITIAL_TABS);

  const setTab = useCallback((id: HomeOkrTabId, status: OkrTabStatus) => {
    setTabs((prev) => {
      const cur = prev[id];
      const sameErr =
        (cur.error?.message ?? "") === (status.error?.message ?? "");
      if (cur.loading === status.loading && sameErr) {
        return prev;
      }
      return { ...prev, [id]: status };
    });
  }, []);

  const value = useMemo(() => ({ tabs, setTab }), [tabs, setTab]);

  return (
    <HomeOkrTabsLoadContext.Provider value={value}>
      {children}
    </HomeOkrTabsLoadContext.Provider>
  );
}

export function useReportOkrTabStatus(
  id: HomeOkrTabId,
  loading: boolean,
  error: Error | null,
) {
  const ctx = useContext(HomeOkrTabsLoadContext);
  const setTab = ctx?.setTab;
  const errMsg = error?.message ?? "";

  useLayoutEffect(() => {
    if (!setTab) return;
    setTab(id, { loading, error });
  }, [id, loading, errMsg, setTab]);
}

export function useHomeOkrTabsAggregate() {
  const ctx = useContext(HomeOkrTabsLoadContext);
  if (!ctx) {
    throw new Error(
      "useHomeOkrTabsAggregate must be used within HomeOkrTabsLoadProvider",
    );
  }
  const { tabs } = ctx;
  const anyLoading =
    tabs.company.loading ||
    tabs.department.loading ||
    tabs.individual.loading;
  const firstError =
    tabs.company.error ||
    tabs.department.error ||
    tabs.individual.error ||
    null;
  return { tabs, anyLoading, firstError };
}
