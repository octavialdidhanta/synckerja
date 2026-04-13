import { lazy, Suspense, useSyncExternalStore, type ReactNode } from "react";
import { HabitTrackerPageSkeleton } from "@/8-2-HabitTracker/skeletons/HabitTrackerPageSkeleton";
import HabitTrackerMobilePage from "@/mobile/1-habits/HabitTrackerMobilePage";

const HabitTrackerPage = lazy(() => import("@/8-2-HabitTracker/pages/HabitTrackerPage"));

/** Lebar < lg (1024px): shell `android-mobile/1-habits` + header ala Home. Lebih lebar: modul desktop + `ToolsHeaderAndTab` (PT Synckerja, dll.). */
const HABITS_MOBILE_SHELL_MQ = "(max-width: 1023px)";

function subscribeHabitsMobileShell(callback: () => void) {
  const mql = window.matchMedia(HABITS_MOBILE_SHELL_MQ);
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

function getHabitsMobileShellSnapshot() {
  return window.matchMedia(HABITS_MOBILE_SHELL_MQ).matches;
}

function useHabitsMobileShell() {
  return useSyncExternalStore(
    subscribeHabitsMobileShell,
    getHabitsMobileShellSnapshot,
    () => true,
  );
}

function ShellSuspense({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-gray-100" aria-busy>
          <HabitTrackerPageSkeleton />
        </div>
      }
    >
      {children}
    </Suspense>
  );
}

/** `/tools/habits-tracker`: viewport sempit/tablet → `android-mobile/1-habits` (header seperti Home); layar lebar → spreadsheet desktop. */
export function HabitTrackerRouteElement() {
  const useMobileShell = useHabitsMobileShell();
  if (!useMobileShell) {
    return (
      <ShellSuspense>
        <HabitTrackerPage />
      </ShellSuspense>
    );
  }
  /* Eager import: dynamic `import("@/mobile/...")` was requested as a separate dev URL and often 500’d on resolve errors → blank screen. */
  return <HabitTrackerMobilePage />;
}
