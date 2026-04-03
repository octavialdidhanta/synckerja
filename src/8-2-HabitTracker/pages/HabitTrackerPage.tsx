import { HabitTrackerModuleShell } from "../layout/HabitTrackerModuleShell";
import { HabitTrackerProvider, useHabitTracker } from "../context/HabitTrackerContext";
import { useDebouncedReady } from "@/shared/hooks/useDebouncedReady";
import { HabitFilters } from "../components/HabitFilters";
import { HabitSpreadsheetView } from "../components/HabitSpreadsheetView";
import { HabitStats } from "../components/HabitStats";

const HabitTrackerContent = () => {
  const { initialLoading } = useHabitTracker();
  const showContent = useDebouncedReady(!initialLoading, 250);

  return (
    <HabitTrackerModuleShell showContent={showContent}>
      <div className="col-span-12 flex min-h-0 flex-col">
        <div className="flex min-h-0 max-h-[calc(100vh-120px)] flex-1 flex-col">
          <div className="mb-2 flex-shrink-0">
            <HabitStats />
          </div>
          <div className="mb-2 flex-shrink-0">
            <HabitFilters />
          </div>
          <div className="min-h-0 flex-1">
            <HabitSpreadsheetView />
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
