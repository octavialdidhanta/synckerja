import { Search } from "lucide-react";
import { Input } from "@/shared/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { useHabitTracker } from "../context/HabitTrackerContext";

export const HabitFilters = () => {
  const { filters, updateFilter } = useHabitTracker();
  return (
    <div className="rounded-md border border-border bg-card p-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <div className="relative min-w-[180px] flex-1">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search habits..."
            value={filters.search}
            onChange={(e) => updateFilter("search", e.target.value)}
            className="h-9 border-border pl-8"
          />
        </div>
        <Select value={filters.frequency} onValueChange={(value) => updateFilter("frequency", value as typeof filters.frequency)}>
          <SelectTrigger className="h-9 w-full text-left text-sm text-foreground sm:w-36 lg:w-40">
            <SelectValue placeholder="Frequency" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Frequencies</SelectItem>
            <SelectItem value="daily">Daily</SelectItem>
            <SelectItem value="weekly">Weekly</SelectItem>
            <SelectItem value="monthly">Monthly</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filters.status} onValueChange={(value) => updateFilter("status", value as typeof filters.status)}>
          <SelectTrigger className="h-9 w-full text-left text-sm text-foreground sm:w-36 lg:w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};
