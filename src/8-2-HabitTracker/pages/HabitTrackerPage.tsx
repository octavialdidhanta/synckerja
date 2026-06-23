import { HabitTrackerModuleShell } from "../layout/HabitTrackerModuleShell";
import { HabitTrackerProvider, useHabitTracker } from "../context/HabitTrackerContext";
import { useDebouncedReady } from "@/shared/hooks/useDebouncedReady";
import { HabitFilters } from "../components/HabitFilters";
import { HabitSpreadsheetView } from "../components/HabitSpreadsheetView";
import { HabitStats } from "../components/HabitStats";
import {
  HABIT_TRACKER_MAIN_GRID,
  HABIT_TRACKER_TABLE_CARD,
} from "../layout/habitTrackerLayout";

const HabitTrackerContent = () => {
  const { initialLoading } = useHabitTracker();
  const showContent = useDebouncedReady(!initialLoading, 250);

  return (
    <HabitTrackerModuleShell showContent={showContent}>
      <div className={HABIT_TRACKER_MAIN_GRID}>
        <div className="col-span-12 flex h-full min-w-0 flex-col">
          <div className="flex h-full min-w-0 flex-1 flex-col gap-2">
            <div className="shrink-0">
              <HabitStats />
            </div>

            <div className="shrink-0">
              <HabitFilters />
            </div>

            <div className={HABIT_TRACKER_TABLE_CARD}>
              <HabitSpreadsheetView />
            </div>
          </div>
        </div>
      </div>
    </HabitTrackerModuleShell>
  );
};

export default function HabitTrackerPage() {
  return (
    <HabitTrackerProvider>
      <HabitTrackerContent />
    </HabitTrackerProvider>
  );
}
