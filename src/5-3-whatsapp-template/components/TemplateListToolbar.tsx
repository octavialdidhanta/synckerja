import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Search, SlidersHorizontal, ChevronDown } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/shared/components/ui/radio-group";
import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { cn } from "@/shared/lib/utils";
import type { WhatsAppAccount } from "@/5-3-whatsapp/types";
import type { DateRangePreset } from "../types";
import {
  QUALITY_FILTER_OPTIONS,
  STATUS_FILTER_OPTIONS,
  type QualityFilterOption,
  type StatusFilterOption,
} from "../types";

function whatsAppAccountLabel(a: WhatsAppAccount): string {
  const name = (a.whatsapp_business_name ?? "").trim();
  const phone = (a.display_phone_number ?? "").trim();
  if (name && phone) return `${name} (${phone})`;
  if (name) return name;
  if (phone) return phone;
  return a.phone_number_id;
}

const CATEGORY_OPTIONS = ["Marketing", "Utility", "Authentication"] as const;

const DATE_LABELS: Record<DateRangePreset, string> = {
  all: "All time",
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
  qualityFilters: QualityFilterOption[];
  onQualityFiltersChange: (v: QualityFilterOption[]) => void;
  datePreset: DateRangePreset;
  onDatePresetChange: (v: DateRangePreset) => void;
  dateFilterDisabled: boolean;
  onResetFilters: () => void;
  onCreateClick: () => void;
  whatsappAccounts: WhatsAppAccount[];
  whatsappAccountsLoading: boolean;
  selectedWhatsappAccountId: string | null;
  onSelectedWhatsappAccountIdChange: (id: string) => void;
  catalogFilterSlot?: ReactNode;
};

const filterBtnClass = "h-9 shrink-0 gap-1 px-2.5 font-normal";

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
  qualityFilters,
  onQualityFiltersChange,
  datePreset,
  onDatePresetChange,
  dateFilterDisabled,
  onResetFilters,
  onCreateClick,
  whatsappAccounts,
  whatsappAccountsLoading,
  selectedWhatsappAccountId,
  onSelectedWhatsappAccountIdChange,
  catalogFilterSlot,
}: TemplateListToolbarProps) {
  const [statusOpen, setStatusOpen] = useState(false);
  const [statusDraft, setStatusDraft] = useState<Set<StatusFilterOption>>(() => new Set(statusFilters));
  const [qualityOpen, setQualityOpen] = useState(false);
  const [qualityDraft, setQualityDraft] = useState<Set<QualityFilterOption>>(() => new Set(qualityFilters));

  useEffect(() => {
    if (statusOpen) {
      setStatusDraft(
        statusFilters.length === 0 ? new Set(STATUS_FILTER_OPTIONS) : new Set(statusFilters),
      );
    }
  }, [statusOpen, statusFilters]);

  useEffect(() => {
    if (qualityOpen) {
      setQualityDraft(
        qualityFilters.length === 0 ? new Set(QUALITY_FILTER_OPTIONS) : new Set(qualityFilters),
      );
    }
  }, [qualityOpen, qualityFilters]);

  const statusSummary = useMemo(() => {
    if (statusFilters.length === 0) return "Status";
    if (statusFilters.length === STATUS_FILTER_OPTIONS.length) return "All statuses";
    return `${statusFilters.length} options selected`;
  }, [statusFilters]);

  const qualitySummary = useMemo(() => {
    if (qualityFilters.length === 0) return "Quality";
    if (qualityFilters.length === QUALITY_FILTER_OPTIONS.length) return "All qualities";
    return `${qualityFilters.length} options selected`;
  }, [qualityFilters]);

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

  const toggleQualityDraft = (q: QualityFilterOption) => {
    setQualityDraft((prev) => {
      const n = new Set(prev);
      if (n.has(q)) n.delete(q);
      else n.add(q);
      return n;
    });
  };

  const selectAllQualityDraft = () => {
    if (qualityDraft.size === QUALITY_FILTER_OPTIONS.length) setQualityDraft(new Set());
    else setQualityDraft(new Set(QUALITY_FILTER_OPTIONS));
  };

  const applyQuality = () => {
    if (qualityDraft.size === QUALITY_FILTER_OPTIONS.length) onQualityFiltersChange([]);
    else onQualityFiltersChange([...qualityDraft]);
    setQualityOpen(false);
  };

  return (
    <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex min-w-0 items-center gap-1.5 overflow-x-auto overflow-y-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {catalogFilterSlot ? (
        <>
          {catalogFilterSlot}
          <div className="mx-0.5 h-6 w-px shrink-0 bg-border" aria-hidden />
        </>
      ) : null}

      {whatsappAccounts.length > 0 ? (
        <Select
          value={selectedWhatsappAccountId ?? whatsappAccounts[0]?.id ?? ""}
          onValueChange={onSelectedWhatsappAccountIdChange}
          disabled={whatsappAccountsLoading}
        >
          <SelectTrigger
            className="h-9 w-[11.5rem] shrink-0 justify-between gap-1 font-normal text-left text-sm text-foreground [&>span]:truncate [&>span]:text-left"
            aria-label="WhatsApp account"
          >
            <SelectValue placeholder="Akun WhatsApp" />
          </SelectTrigger>
          <SelectContent align="start">
            {whatsappAccounts.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {whatsAppAccountLabel(a)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}

      <div className="relative h-9 w-36 shrink-0">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search"
          className="h-9 pl-9"
          value={searchQuery}
          onChange={(e) => onSearchQueryChange(e.target.value)}
          aria-label="Search templates"
        />
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className={filterBtnClass}>
            Category
            <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
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
          <Button variant="outline" size="sm" className={filterBtnClass}>
            Language
            <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
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
            <Button variant="outline" size="sm" className={cn(filterBtnClass, "max-w-[7rem]")}>
              <span className="truncate">{statusSummary}</span>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
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

        <Popover open={qualityOpen} onOpenChange={setQualityOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn(filterBtnClass, "max-w-[7rem]")}>
              <span className="truncate">{qualitySummary}</span>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-0" align="start">
            <div className="scrollbar-hide seamless-scroll max-h-72 space-y-0 overflow-y-auto overflow-x-hidden p-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <label className="flex cursor-pointer items-center gap-2 border-b border-slate-100 px-1 py-2 text-sm font-medium">
                <Checkbox
                  checked={qualityDraft.size === QUALITY_FILTER_OPTIONS.length}
                  onCheckedChange={() => selectAllQualityDraft()}
                />
                Select all
              </label>
              {QUALITY_FILTER_OPTIONS.map((q) => (
                <label key={q} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1.5 text-sm hover:bg-slate-50">
                  <Checkbox checked={qualityDraft.has(q)} onCheckedChange={() => toggleQualityDraft(q)} />
                  {q}
                </label>
              ))}
            </div>
            <div className="flex justify-end border-t border-slate-100 p-2">
              <Button size="sm" onClick={applyQuality}>
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
              className={filterBtnClass}
              disabled={dateFilterDisabled}
              title={dateFilterDisabled ? "Tanggal terakhir diubah tidak tersedia dari API template untuk saat ini." : undefined}
            >
              {DATE_LABELS[datePreset]}
              <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
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

      <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={onResetFilters} title="Reset filters">
        <SlidersHorizontal className="h-4 w-4" />
      </Button>

      <div className="sticky right-0 ml-auto flex shrink-0 items-center gap-1.5 bg-white pl-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled
          title="Compare (coming soon)"
          className="h-9 shrink-0 border-brand-blue/20 px-2.5 text-brand-blue hover:bg-brand-blue/10 hover:text-brand-blue disabled:opacity-50"
        >
          Compare
        </Button>
        <Button
          type="button"
          size="sm"
          className="h-9 shrink-0 bg-brand-blue px-3 text-white hover:bg-brand-blue/90"
          onClick={onCreateClick}
        >
          Create Template
        </Button>
      </div>
    </div>
  );
}
