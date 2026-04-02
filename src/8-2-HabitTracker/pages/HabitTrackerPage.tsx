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
        <div className="flex min-h-0 flex-1 flex-col max-h-[calc(100vh-120px)]">
          <div className="mb-0.5 flex-shrink-0">
            <HabitStats />
          </div>
          <div className="flex-shrink-0 px-0 pb-0.5">
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
