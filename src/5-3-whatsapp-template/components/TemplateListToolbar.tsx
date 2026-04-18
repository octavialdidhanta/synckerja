import { useEffect, useMemo, useState } from "react";
import { Search, SlidersHorizontal, ChevronDown } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/shared/components/ui/radio-group";
import { Label } from "@/shared/components/ui/label";
import { cn } from "@/shared/lib/utils";
import type { DateRangePreset } from "../types";
import { STATUS_FILTER_OPTIONS, type StatusFilterOption } from "../types";

const CATEGORY_OPTIONS = ["Marketing", "Utility", "Authentication"] as const;

const DATE_LABELS: Record<DateRangePreset, string> = {
  "7": "Last 7 days",
  "30": "Last 30 days",
  "60": "Last 60 days",
  "90": "Last 90 days",
};

export type TemplateListToolbarProps = {
  searchQuery: string;
  onSearchQueryChange: (v: string) => void;
  categoryFilters: string[];
  onCategoryFiltersChange: (v: string[]) => void;
  languageOptions: string[];
  languageFilters: string[];
  onLanguageFiltersChange: (v: string[]) => void;
  statusFilters: StatusFilterOption[];
  onStatusFiltersChange: (v: StatusFilterOption[]) => void;
  datePreset: DateRangePreset;
  onDatePresetChange: (v: DateRangePreset) => void;
  dateFilterDisabled: boolean;
  onResetFilters: () => void;
  onCreateClick: () => void;
};

export function TemplateListToolbar({
  searchQuery,
  onSearchQueryChange,
  categoryFilters,
  onCategoryFiltersChange,
  languageOptions,
  languageFilters,
  onLanguageFiltersChange,
  statusFilters,
  onStatusFiltersChange,
  datePreset,
  onDatePresetChange,
  dateFilterDisabled,
  onResetFilters,
  onCreateClick,
}: TemplateListToolbarProps) {
  const [statusOpen, setStatusOpen] = useState(false);
  const [statusDraft, setStatusDraft] = useState<Set<StatusFilterOption>>(() => new Set(statusFilters));

  useEffect(() => {
    if (statusOpen) {
      setStatusDraft(
        statusFilters.length === 0 ? new Set(STATUS_FILTER_OPTIONS) : new Set(statusFilters),
      );
    }
  }, [statusOpen, statusFilters]);

  const statusSummary = useMemo(() => {
    if (statusFilters.length === 0) return "Status";
    if (statusFilters.length === STATUS_FILTER_OPTIONS.length) return "All statuses";
    return `${statusFilters.length} options selected`;
  }, [statusFilters]);

  const toggleCategory = (c: string) => {
    const set = new Set(categoryFilters);
    if (set.has(c)) set.delete(c);
    else set.add(c);
    onCategoryFiltersChange([...set]);
  };

  const toggleLanguage = (l: string) => {
    const set = new Set(languageFilters);
    if (set.has(l)) set.delete(l);
    else set.add(l);
    onLanguageFiltersChange([...set]);
  };

  const toggleStatusDraft = (s: StatusFilterOption) => {
    setStatusDraft((prev) => {
      const n = new Set(prev);
      if (n.has(s)) n.delete(s);
      else n.add(s);
      return n;
    });
  };

  const selectAllStatusDraft = () => {
    if (statusDraft.size === STATUS_FILTER_OPTIONS.length) setStatusDraft(new Set());
    else setStatusDraft(new Set(STATUS_FILTER_OPTIONS));
  };

  const applyStatus = () => {
    if (statusDraft.size === STATUS_FILTER_OPTIONS.length) onStatusFiltersChange([]);
    else onStatusFiltersChange([...statusDraft]);
    setStatusOpen(false);
  };

  return (
    <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        <div className="relative min-w-[140px] max-w-xs flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search"
            className="pl-9"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            aria-label="Search templates"
          />
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="min-w-[7rem] justify-between gap-1 font-normal">
              Category
              <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-52 p-2" align="start">
            <div className="space-y-2">
              {CATEGORY_OPTIONS.map((c) => (
                <label key={c} className="flex cursor-pointer items-center gap-2 text-sm">
                  <Checkbox checked={categoryFilters.includes(c)} onCheckedChange={() => toggleCategory(c)} />
                  {c}
                </label>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="min-w-[7rem] justify-between gap-1 font-normal">
              Language
              <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2" align="start">
            <div className="scrollbar-hide seamless-scroll max-h-56 space-y-2 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {languageOptions.length === 0 ? (
                <p className="px-1 text-xs text-muted-foreground">Tidak ada bahasa di data saat ini</p>
              ) : (
                languageOptions.map((l) => (
                  <label key={l} className="flex cursor-pointer items-center gap-2 text-sm">
                    <Checkbox checked={languageFilters.includes(l)} onCheckedChange={() => toggleLanguage(l)} />
                    {l}
                  </label>
                ))
              )}
            </div>
          </PopoverContent>
        </Popover>

        <Popover open={statusOpen} onOpenChange={setStatusOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn("min-w-[8rem] max-w-[11rem] justify-between gap-1 truncate font-normal")}>
              <span className="truncate">{statusSummary}</span>
              <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-0" align="start">
            <div className="scrollbar-hide seamless-scroll max-h-72 space-y-0 overflow-y-auto overflow-x-hidden p-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <label className="flex cursor-pointer items-center gap-2 border-b border-slate-100 px-1 py-2 text-sm font-medium">
                <Checkbox
                  checked={statusDraft.size === STATUS_FILTER_OPTIONS.length}
                  onCheckedChange={() => selectAllStatusDraft()}
                />
                Select all
              </label>
              {STATUS_FILTER_OPTIONS.map((s) => (
                <label key={s} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1.5 text-sm hover:bg-slate-50">
                  <Checkbox checked={statusDraft.has(s)} onCheckedChange={() => toggleStatusDraft(s)} />
                  {s}
                </label>
              ))}
            </div>
            <div className="flex justify-end border-t border-slate-100 p-2">
              <Button size="sm" onClick={applyStatus}>
                Apply
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="min-w-[8rem] justify-between gap-1 font-normal"
              disabled={dateFilterDisabled}
              title={dateFilterDisabled ? "Tanggal terakhir diubah tidak tersedia dari API template untuk saat ini." : undefined}
            >
              {DATE_LABELS[datePreset]}
              <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-52 p-3" align="start">
            <RadioGroup
              value={datePreset}
              onValueChange={(v) => onDatePresetChange(v as DateRangePreset)}
              className="space-y-2"
              disabled={dateFilterDisabled}
            >
              {(Object.keys(DATE_LABELS) as DateRangePreset[]).map((key) => (
                <div key={key} className="flex items-center space-x-2">
                  <RadioGroupItem value={key} id={`dr-${key}`} disabled={dateFilterDisabled} />
                  <Label htmlFor={`dr-${key}`} className="cursor-pointer text-sm font-normal">
                    {DATE_LABELS[key]}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </PopoverContent>
        </Popover>

        <Button type="button" variant="outline" size="icon" className="shrink-0" onClick={onResetFilters} title="Reset filters">
          <SlidersHorizontal className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Button type="button" variant="secondary" size="sm" disabled title="Compare (coming soon)">
          Compare
        </Button>
        <Button type="button" size="sm" className="bg-[#1877F2] hover:bg-[#166FE5]" onClick={onCreateClick}>
          Create Template
        </Button>
      </div>
    </div>
  );
}
