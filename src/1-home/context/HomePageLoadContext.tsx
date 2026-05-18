import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const SKELETON_HIDE_DEBOUNCE_MS = 220;

export type HomeSectionId =
  | "motivation"
  | "profile"
  | "okr"
  | "activity"
  | "status";

/** Section yang harus siap sebelum skeleton penuh hilang (tanpa flicker). */
const BLOCKING_HOME_SECTIONS: HomeSectionId[] = ["motivation", "profile", "okr"];

export type HomeSectionStatus = {
  loading: boolean;
  error: Error | null;
};

function createInitialSections(): Record<HomeSectionId, HomeSectionStatus> {
  return {
    motivation: { loading: true, error: null },
    profile: { loading: true, error: null },
    okr: { loading: true, error: null },
    activity: { loading: false, error: null },
    status: { loading: false, error: null },
  };
}

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
    useState<Record<HomeSectionId, HomeSectionStatus>>(createInitialSections);

  const rawPendingLoad = useMemo(
    () => BLOCKING_HOME_SECTIONS.some((id) => sections[id].loading),
    [sections],
  );

  const [showFullPageSkeleton, setShowFullPageSkeleton] = useState(true);
  /** After first successful reveal, ignore brief `loading` blips (refetch) — avoids full-page skeleton flicker. */
  const hasRevealedContentRef = useRef(false);

  useEffect(() => {
    if (rawPendingLoad) {
      if (!hasRevealedContentRef.current) {
        setShowFullPageSkeleton(true);
      }
      return;
    }
    const id = window.setTimeout(() => {
      requestAnimationFrame(() => {
        setShowFullPageSkeleton(false);
        hasRevealedContentRef.current = true;
      });
    }, SKELETON_HIDE_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [rawPendingLoad]);

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

  useLayoutEffect(() => {
    if (!updateSection) return;
    updateSection(id, { loading, error });
  }, [id, loading, errMsg, updateSection]);
}
