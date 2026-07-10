import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type OkrPageDetailTabId = "company" | "department" | "individual";

export type OkrPageDetailStatus = {
  loading: boolean;
  error: Error | null;
};

const INITIAL: Record<OkrPageDetailTabId, OkrPageDetailStatus> = {
  company: { loading: false, error: null },
  department: { loading: false, error: null },
  individual: { loading: false, error: null },
};

type Ctx = {
  tabs: Record<OkrPageDetailTabId, OkrPageDetailStatus>;
  setTab: (id: OkrPageDetailTabId, status: OkrPageDetailStatus) => void;
};

const OkrPageDetailLoadContext = createContext<Ctx | null>(null);

export function OkrPageDetailLoadProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [tabs, setTabs] =
    useState<Record<OkrPageDetailTabId, OkrPageDetailStatus>>(INITIAL);

  const setTab = useCallback(
    (id: OkrPageDetailTabId, status: OkrPageDetailStatus) => {
      setTabs((prev) => {
        const cur = prev[id];
        const sameErr =
          (cur.error?.message ?? "") === (status.error?.message ?? "");
        if (cur.loading === status.loading && sameErr) {
          return prev;
        }
        return { ...prev, [id]: status };
      });
    },
    [],
  );

  const value = useMemo(() => ({ tabs, setTab }), [tabs, setTab]);

  return (
    <OkrPageDetailLoadContext.Provider value={value}>
      {children}
    </OkrPageDetailLoadContext.Provider>
  );
}

/** No-op when used outside OkrPage (e.g. Home). */
export function useReportOkrPageDetail(
  id: OkrPageDetailTabId,
  loading: boolean,
  error: Error | null,
) {
  const ctx = useContext(OkrPageDetailLoadContext);
  const setTab = ctx?.setTab;
  const errMsg = error?.message ?? "";

  useEffect(() => {
    if (!setTab) return;
    setTab(id, { loading, error });
  }, [id, loading, errMsg, setTab]);
}

export function useOkrPageDetailTabs() {
  const ctx = useContext(OkrPageDetailLoadContext);
  if (!ctx) {
    throw new Error(
      "useOkrPageDetailTabs must be used within OkrPageDetailLoadProvider",
    );
  }
  return ctx.tabs;
}
