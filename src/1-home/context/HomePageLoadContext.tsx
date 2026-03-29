import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type HomeSectionId =
  | "motivation"
  | "profile"
  | "okr"
  | "activity"
  | "status";

export type HomeSectionStatus = {
  loading: boolean;
  error: Error | null;
};

const INITIAL: Record<HomeSectionId, HomeSectionStatus> = {
  motivation: { loading: true, error: null },
  profile: { loading: true, error: null },
  okr: { loading: true, error: null },
  activity: { loading: true, error: null },
  status: { loading: true, error: null },
};

type HomePageLoadContextValue = {
  sections: Record<HomeSectionId, HomeSectionStatus>;
  showFullPageSkeleton: boolean;
  updateSection: (id: HomeSectionId, status: HomeSectionStatus) => void;
};

const HomePageLoadContext = createContext<HomePageLoadContextValue | null>(
  null,
);

export function HomePageLoadProvider({ children }: { children: React.ReactNode }) {
  const [sections, setSections] =
    useState<Record<HomeSectionId, HomeSectionStatus>>(INITIAL);

  const updateSection = useCallback(
    (id: HomeSectionId, status: HomeSectionStatus) => {
      setSections((prev) => {
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

  const showFullPageSkeleton = useMemo(
    () => Object.values(sections).some((s) => s.loading),
    [sections],
  );

  const value = useMemo(
    () => ({
      sections,
      showFullPageSkeleton,
      updateSection,
    }),
    [sections, showFullPageSkeleton, updateSection],
  );

  return (
    <HomePageLoadContext.Provider value={value}>
      {children}
    </HomePageLoadContext.Provider>
  );
}

export function useHomePageLoad() {
  const ctx = useContext(HomePageLoadContext);
  if (!ctx) {
    throw new Error("useHomePageLoad must be used within HomePageLoadProvider");
  }
  return ctx;
}

/** Optional: sections rendered outside provider (e.g. tests). */
export function useHomePageLoadOptional() {
  return useContext(HomePageLoadContext);
}

export function useReportHomeSectionStatus(
  id: HomeSectionId,
  loading: boolean,
  error: Error | null,
) {
  const ctx = useHomePageLoadOptional();
  const updateSection = ctx?.updateSection;
  const errMsg = error?.message ?? "";

  useEffect(() => {
    if (!updateSection) return;
    updateSection(id, { loading, error });
  }, [id, loading, errMsg, updateSection]);
}
