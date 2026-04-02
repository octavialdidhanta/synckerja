import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";

/**
 * Logical load groups. Multiple components may report the same id (ref-counted):
 * e.g. PenaltyStatistics + RecentPenaltiesWidget + PenaltyTrendsChart → `dashboard_penalties`.
 */
export const attendanceLoadSectionIds = {
  dashboardPenalties: "dashboard_penalties",
  dashboardAnalytics: "dashboard_analytics",
  attendanceRecords: "attendance_records",
  attendanceSidebar: "attendance_sidebar",
  attendanceCalendar: "attendance_calendar",
  /** Active panel on `/attendance/settings` (one section mounted at a time). */
  attendanceSettings: "attendance_settings",
} as const;

export type AttendanceLoadSectionId =
  (typeof attendanceLoadSectionIds)[keyof typeof attendanceLoadSectionIds];

type Ctx = {
  increment: (id: string) => void;
  decrement: (id: string) => void;
  hasPendingLoad: boolean;
};

const AttendancePageLoadContext = createContext<Ctx | null>(null);

export function AttendancePageLoadProvider({ children }: { children: ReactNode }) {
  const countsRef = useRef<Record<string, number>>({});
  const [version, setVersion] = useState(0);

  const increment = useCallback((id: string) => {
    countsRef.current[id] = (countsRef.current[id] ?? 0) + 1;
    setVersion((v) => v + 1);
  }, []);

  const decrement = useCallback((id: string) => {
    countsRef.current[id] = Math.max(0, (countsRef.current[id] ?? 0) - 1);
    setVersion((v) => v + 1);
  }, []);

  const hasPendingLoad = useMemo(() => {
    return Object.values(countsRef.current).some((c) => c > 0);
  }, [version]);

  const value = useMemo(
    () => ({
      increment,
      decrement,
      hasPendingLoad,
    }),
    [increment, decrement, hasPendingLoad],
  );

  return (
    <AttendancePageLoadContext.Provider value={value}>{children}</AttendancePageLoadContext.Provider>
  );
}

export function useAttendancePageLoad() {
  const ctx = useContext(AttendancePageLoadContext);
  if (!ctx) {
    throw new Error("useAttendancePageLoad must be used within AttendancePageLoadProvider");
  }
  return ctx;
}

export function useAttendancePageLoadOptional() {
  return useContext(AttendancePageLoadContext);
}

/**
 * Ref-counts loading for `id`: skeleton stays until every reporter with `loading === true` has finished.
 * Use `useLayoutEffect` so the parent can re-render before paint (avoids a flash of empty content).
 */
export function useReportAttendanceSection(id: string, loading: boolean) {
  const ctx = useAttendancePageLoadOptional();
  const increment = ctx?.increment;
  const decrement = ctx?.decrement;

  useLayoutEffect(() => {
    if (!increment || !decrement) return;
    if (loading) {
      increment(id);
    }
    return () => {
      if (loading) {
        decrement(id);
      }
    };
  }, [id, loading, increment, decrement]);
}

/**
 * Ref-counted load for the visible `/attendance/settings` section.
 * Always waits for `useCurrentOrg().loading` so queries that are disabled until org exists
 * do not clear the skeleton early; combine with each panel’s own loading / `isPending`.
 */
export function useReportAttendanceSettingsLoading(loading: boolean) {
  const { loading: orgLoading } = useCurrentOrg();
  useReportAttendanceSection(
    attendanceLoadSectionIds.attendanceSettings,
    Boolean(orgLoading || loading),
  );
}
