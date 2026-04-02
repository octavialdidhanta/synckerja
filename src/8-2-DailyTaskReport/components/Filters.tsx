import React from "react";
import { RefreshCw, Search } from "lucide-react";
import { Input } from "@/shared/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { useDailyTaskReport } from "../context/ReportContext";

export const Filters = () => {
  const { filters, updateFilter, options } = useDailyTaskReport() as any;
  const handleClear = () => {
    updateFilter("search", "");
    updateFilter("status", "all");
    updateFilter("timePeriod", "all");
    updateFilter("customStart", "");
    updateFilter("customEnd", "");
    updateFilter("pic", "all");
    updateFilter("task", "all");
    updateFilter("step", "all");
    updateFilter("subStep", "all");
  };

  return (
    <div className="rounded-md border border-border bg-card p-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <div className="relative flex-1 min-w-[150px]">
          <Search className="absolute right-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 transform text-muted-foreground" />
          <Input
            type="text"
            value={filters.search}
            onChange={(e) => updateFilter("search", e.target.value)}
            placeholder="Search employee, task, step..."
            className="h-9 w-full rounded-md border border-border pl-4 pr-10 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-blue"
          />
        </div>

        <Select value={filters.status} onValueChange={(v) => updateFilter("status", v)}>
          <SelectTrigger className="h-9 w-full text-left text-sm text-foreground sm:w-32 lg:w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="ontime">On-Time</SelectItem>
            <SelectItem value="late">Late</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.timePeriod} onValueChange={(v) => updateFilter("timePeriod", v)}>
          <SelectTrigger className="h-9 w-full text-left text-sm text-foreground sm:w-32 lg:w-36">
            <SelectValue placeholder="Time Period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Time</SelectItem>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="yesterday">Yesterday</SelectItem>
            <SelectItem value="this_week">This Week</SelectItem>
            <SelectItem value="this_month">This Month</SelectItem>
            <SelectItem value="last_month">Last Month</SelectItem>
            <SelectItem value="custom">Custom Range</SelectItem>
          </SelectContent>
        </Select>

        {filters.timePeriod === "custom" && (
          <div className="flex items-center gap-1">
            <Input type="date" value={filters.customStart || ""} onChange={(e) => updateFilter("customStart", e.target.value)} className="h-9" />
            <span className="text-xs text-gray-500">to</span>
            <Input type="date" value={filters.customEnd || ""} onChange={(e) => updateFilter("customEnd", e.target.value)} className="h-9" />
          </div>
        )}

        <Select value={filters.pic || "all"} onValueChange={(v) => updateFilter("pic", v)}>
          <SelectTrigger className="h-9 w-full text-left text-sm text-foreground sm:w-36">
            <SelectValue placeholder="PIC" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All PIC</SelectItem>
            {(options?.pics ?? []).map((n: string) => (
              <SelectItem key={n} value={n}>
                {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.task || "all"}
          onValueChange={(v) => {
            updateFilter("task", v);
            updateFilter("step", "all");
            updateFilter("subStep", "all");
          }}
        >
          <SelectTrigger className="h-9 w-full text-left text-sm text-foreground sm:w-36">
            <SelectValue placeholder="Task" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tasks</SelectItem>
            {(options?.tasks ?? []).map((t: string) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.step || "all"}
          onValueChange={(v) => {
            updateFilter("step", v);
            updateFilter("subStep", "all");
          }}
        >
          <SelectTrigger className="h-9 w-full text-left text-sm text-foreground sm:w-36">
            <SelectValue placeholder="Step" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Steps</SelectItem>
            {(options?.steps ?? []).map((s: string) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.subStep || "all"} onValueChange={(v) => updateFilter("subStep", v)}>
          <SelectTrigger className="h-9 w-full text-left text-sm text-foreground sm:w-36">
            <SelectValue placeholder="Sub-step" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sub-steps</SelectItem>
            {(options?.subSteps ?? []).map((s: string) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <button
          onClick={handleClear}
          className="ml-auto flex h-9 items-center justify-center rounded-md border border-border px-3 transition-colors hover:bg-brand-blue/10 hover:text-brand-blue"
          title="Clear filters"
        >
          <RefreshCw className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>
    </div>
  );
};

