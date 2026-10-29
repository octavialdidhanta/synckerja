import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Bookmark, Calculator, Download, FolderOpen, GitCompare, Loader2, Megaphone, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/shared/components/ui/tooltip";
import { cn } from "@/shared/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import {
  formatAudienceSizeExact,
  isMetaReachPrivacyFloor,
  locationsFingerprintClient,
  targetingItemsToCsv,
  DEFAULT_INTEREST_RESEARCH_FILTERS,
  MAX_INTEREST_LIST_MATCH_GROUP,
  officialReachCount,
  useMetaAdsInterestListDetail,
  useMetaAdsInterestListMutations,
  useMetaAdsInterestLists,
  useMetaAdsListGroupedReach,
  useMetaAdsTargetingEstimateRows,
  useMetaAdsTargetingSearch,
  type InterestResearchFilters,
  type MetaInterestListItem,
  type MetaReachEstimate,
  type MetaTargetingItem,
} from "@/meta-ads/hooks/useMetaAdsTargeting";
import { POPULATION_UNION_ITEM_CAP } from "./population-budget";
import { PopulationOverlapViz } from "./population-budget/PopulationOverlapViz";
import { InterestResearchCreateAdDialog } from "@/6-0-meta-ads/components/interest-research/InterestResearchCreateAdDialog";
import { InterestResearchOverlapSearchField } from "@/6-0-meta-ads/components/interest-research/InterestResearchOverlapSearchField";

function warnMetaSync(error: string | null | undefined, t: (key: string, fallback: string, opts?: Record<string, string>) => string) {
  if (!error) return;
  toast.message(
    t(
      "digitalMarketing.metaAds.interestMetaSyncFailed",
      "List updated. Ads Manager sync failed: {{error}}",
      { error },
    ),
  );
}

function formatPotentialUpper(lower: number | null, upper: number | null): string {
  if (isMetaReachPrivacyFloor(lower, upper)) return "≤1K";
  const high = upper ?? lower;
  if (high == null) return "—";
  return formatAudienceSizeExact(high, high);
}

function listItemToTargeting(item: MetaInterestListItem): MetaTargetingItem {
  return {
    id: item.meta_targeting_id,
    name: item.name,
    type: (item.type as MetaTargetingItem["type"]) || "interest",
    path: Array.isArray(item.path) ? (item.path as string[]) : [],
    audience_size_lower: item.audience_size_lower,
    audience_size_upper: item.audience_size_upper,
    description: null,
  };
}

function ListMatchGroupBlock({
  organizationId,
  adAccountId,
  matchGroup,
  items,
  blockedIds,
  selectedItems,
  adding,
  potentialById,
  potentialLoading,
  onAdd,
  onRemoveItem,
  onRemoveGroup,
}: {
  organizationId: string;
  adAccountId: string;
  matchGroup: number;
  items: MetaInterestListItem[];
  blockedIds: Set<string>;
  selectedItems: MetaTargetingItem[];
  adding?: boolean;
  potentialById: Record<string, { lower: number | null; upper: number | null }>;
  potentialLoading: boolean;
  onAdd: (items: MetaTargetingItem[]) => void;
  onRemoveItem: (item: MetaInterestListItem) => void;
  onRemoveGroup?: () => void;
}) {
  const { t } = useTranslation();
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const handle = window.setTimeout(() => setDebounced(query.trim()), 300);
    return () => window.clearTimeout(handle);
  }, [query]);
  const searchQuery = useMetaAdsTargetingSearch({
    organizationId,
    adAccountId,
    q: debounced,
    typeFilter: "all",
    enabled: searchOpen && Boolean(adAccountId) && debounced.length >= 2,
  });
  const hits = useMemo(
    () => (searchQuery.data?.items ?? []).filter((item) => !blockedIds.has(item.id)),
    [blockedIds, searchQuery.data?.items],
  );
  const addableSelected = useMemo(
    () => selectedItems.filter((item) => !blockedIds.has(item.id)),
    [blockedIds, selectedItems],
  );
  const title =
    matchGroup === 0
      ? t("digitalMarketing.metaAds.interestListInclude", "Include people who match")
      : t("digitalMarketing.metaAds.interestListNarrow", "and must also match");
  const tone =
    matchGroup === 0
      ? {
          wrap: "border-sky-200 bg-sky-50",
          title: "text-sky-800",
          divide: "divide-sky-100",
          hover: "hover:bg-sky-100/80",
        }
      : [
          {
            wrap: "border-rose-200 bg-rose-50",
            title: "text-rose-800",
            divide: "divide-rose-100",
            hover: "hover:bg-rose-100/80",
          },
          {
            wrap: "border-teal-200 bg-teal-50",
            title: "text-teal-800",
            divide: "divide-teal-100",
            hover: "hover:bg-teal-100/80",
          },
          {
            wrap: "border-amber-200 bg-amber-50",
            title: "text-amber-800",
            divide: "divide-amber-100",
            hover: "hover:bg-amber-100/80",
          },
          {
            wrap: "border-violet-200 bg-violet-50",
            title: "text-violet-800",
            divide: "divide-violet-100",
            hover: "hover:bg-violet-100/80",
          },
        ][Math.max(0, matchGroup - 1) % 4];

  const addPicker = (
    <Popover
      open={searchOpen}
      onOpenChange={(open) => {
        setSearchOpen(open);
        if (!open) setQuery("");
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          aria-label={t("digitalMarketing.metaAds.interestListAddToGroup", "Add interests")}
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[280px] p-2" onOpenAutoFocus={(event) => event.preventDefault()}>
        {addableSelected.length > 0 ? (
          <button
            type="button"
            disabled={adding}
            className="mb-2 flex w-full items-center justify-between rounded-md bg-sky-50 px-2 py-1.5 text-left text-xs font-medium text-sky-900 hover:bg-sky-100 disabled:opacity-60"
            onClick={() => {
              onAdd(addableSelected);
              setSearchOpen(false);
            }}
          >
            <span>
              {t("digitalMarketing.metaAds.interestListAddSelected", "Add {{count}} selected", {
                count: addableSelected.length,
              })}
            </span>
            {adding ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
          </button>
        ) : (
          <p className="mb-2 text-[11px] text-muted-foreground">
            {t(
              "digitalMarketing.metaAds.interestListAddHint",
              "Search below, or check rows in the table then add them here.",
            )}
          </p>
        )}
        <InterestResearchOverlapSearchField
          organizationId={organizationId}
          adAccountId={adAccountId}
          query={query}
          onQueryChange={setQuery}
          hits={hits}
          searching={searchQuery.isFetching}
          blockedIds={blockedIds}
          onPick={(item) => {
            onAdd([item]);
            setQuery("");
            setSearchOpen(false);
          }}
          onPickMany={(picked) => {
            onAdd(picked);
            setQuery("");
            setSearchOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );

  return (
    <div className={cn("mx-1.5 mb-1.5 rounded-md border px-2 py-1.5 first:mt-1.5", tone.wrap)}>
      <div className="mb-1 flex h-6 items-center justify-between gap-2">
        <p className={cn("text-[11px] font-semibold uppercase tracking-wide", tone.title)}>{title}</p>
        <div className="flex items-center gap-0.5">
          {addPicker}
          {onRemoveGroup ? (
            <button
              type="button"
              className={cn("rounded p-0.5 text-slate-500", tone.hover)}
              aria-label={t("digitalMarketing.metaAds.interestListRemoveNarrow", "Remove this Narrow row")}
              onClick={onRemoveGroup}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      </div>
      <div className="scrollbar-hide h-[120px] max-h-[120px] overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {items.length === 0 ? (
        addableSelected.length > 0 ? (
          <button
            type="button"
            disabled={adding}
            className={cn("text-left text-[11px] font-medium underline-offset-2 hover:underline disabled:opacity-60", tone.title)}
            onClick={() => onAdd(addableSelected)}
          >
            {t("digitalMarketing.metaAds.interestListAddSelected", "Add {{count}} selected", {
              count: addableSelected.length,
            })}
          </button>
        ) : (
          <button
            type="button"
            className="text-left text-[11px] text-slate-500 hover:text-slate-700"
            onClick={() => setSearchOpen(true)}
          >
            {t(
              "digitalMarketing.metaAds.interestListGroupEmpty",
              "Add interests: check the table, or tap + to search.",
            )}
          </button>
        )
      ) : (
        <ul className={cn("divide-y text-xs", tone.divide)}>
          {items.map((item) => (
            <li key={item.id} className="group flex items-start justify-between gap-2 py-1.5">
              <div className="min-w-0">
                <p className="truncate font-medium text-gray-900">{item.name}</p>
                <p className="mt-0.5 inline-flex items-center gap-1.5 text-slate-600">
                  <span className="capitalize">{item.type}</span>
                  <span className="text-slate-300">·</span>
                  <span className="tabular-nums">
                    {formatPotentialUpper(
                      potentialById[item.meta_targeting_id]?.lower ?? null,
                      potentialById[item.meta_targeting_id]?.upper ?? null,
                    )}
                  </span>
                  {potentialLoading ? <Loader2 className="h-3 w-3 animate-spin text-slate-400" /> : null}
                </p>
              </div>
              <button
                type="button"
                className={cn(
                  "invisible shrink-0 rounded p-0.5 text-slate-400 group-hover:visible",
                  tone.hover,
                )}
                aria-label={t("digitalMarketing.metaAds.interestRemoveItem", "Remove item")}
                onClick={() => onRemoveItem(item)}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      </div>
    </div>
  );
}

type InterestResearchSavedPanelProps = {
  organizationId: string;
  adAccountId?: string;
  filters?: InterestResearchFilters | null;
  onLoadItems?: (items: MetaTargetingItem[]) => void;
  onCalculatePopulation?: (session: {
    listId?: string | null;
    listName: string;
    items: MetaTargetingItem[];
    targetingGroups?: MetaTargetingItem[][];
  }) => void;
  selectedItems?: MetaTargetingItem[];
  topContent?: ReactNode;
};

export function InterestResearchSavedPanel({
  organizationId,
  adAccountId = "",
  filters = null,
  onLoadItems,
  onCalculatePopulation,
  selectedItems = [],
  topContent,
}: InterestResearchSavedPanelProps) {
  const { t } = useTranslation();
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [confirmRename, setConfirmRename] = useState(false);
  const [confirmDeleteList, setConfirmDeleteList] = useState(false);
  const [confirmRemoveItem, setConfirmRemoveItem] = useState<{ id: string; name: string } | null>(null);
  const [confirmRemoveGroup, setConfirmRemoveGroup] = useState<number | null>(null);
  const [extraNarrowGroups, setExtraNarrowGroups] = useState<number[]>([]);
  const [groupedReach, setGroupedReach] = useState<{
    include: MetaReachEstimate;
    first_narrow: MetaReachEstimate | null;
    intersection: MetaReachEstimate | null;
  } | null>(null);
  const [groupedReachLoading, setGroupedReachLoading] = useState(false);
  const [overlapVizOpen, setOverlapVizOpen] = useState(false);
  const groupedReachMutation = useMetaAdsListGroupedReach();
  const listsQuery = useMetaAdsInterestLists(organizationId, adAccountId, Boolean(organizationId));
  const detailQuery = useMetaAdsInterestListDetail(
    organizationId,
    selectedListId,
    adAccountId,
    Boolean(selectedListId),
  );
  const mutations = useMetaAdsInterestListMutations(organizationId, adAccountId);
  const [createAdsOpen, setCreateAdsOpen] = useState(false);
  const estimateRowsMutation = useMetaAdsTargetingEstimateRows();
  const [potentialById, setPotentialById] = useState<
    Record<string, { lower: number | null; upper: number | null }>
  >({});
  const [potentialLoading, setPotentialLoading] = useState(false);

  const lists = listsQuery.data?.lists ?? [];
  const items = detailQuery.data?.items ?? [];
  const itemsByGroup = useMemo(() => {
    const map = new Map<number, MetaInterestListItem[]>();
    for (const item of items) {
      const group = Math.max(0, Math.floor(Number(item.match_group ?? 0) || 0));
      const list = map.get(group) ?? [];
      list.push(item);
      map.set(group, list);
    }
    return map;
  }, [items]);
  const displayedGroups = useMemo(() => {
    const set = new Set<number>([0, ...itemsByGroup.keys(), ...extraNarrowGroups]);
    return [...set].sort((a, b) => a - b);
  }, [extraNarrowGroups, itemsByGroup]);
  const blockedIds = useMemo(
    () => new Set(items.map((item) => item.meta_targeting_id)),
    [items],
  );
  const targetingGroups = useMemo(
    () =>
      displayedGroups
        .map((group) => (itemsByGroup.get(group) ?? []).map(listItemToTargeting))
        .filter((group) => group.length > 0),
    [displayedGroups, itemsByGroup],
  );
  const hasNarrow = targetingGroups.length >= 2;

  useEffect(() => {
    setSelectedListId(null);
  }, [adAccountId]);

  useEffect(() => {
    setExtraNarrowGroups([]);
    setGroupedReach(null);
  }, [selectedListId]);
  const filtersKey = filters
    ? [
        filters.countryCode,
        filters.gender,
        filters.ageMin,
        filters.ageMax,
        filters.placement,
        locationsFingerprintClient(filters.locations ?? []),
      ].join("|")
    : "";

  useEffect(() => {
    if (!adAccountId || !filters || !items.length) {
      setPotentialById({});
      setPotentialLoading(false);
      return;
    }
    let cancelled = false;
    const handle = window.setTimeout(() => {
      setPotentialLoading(true);
      void estimateRowsMutation
        .mutateAsync({
          organizationId,
          adAccountId,
          filters,
          items: items.slice(0, 20).map((item) => ({
            id: item.meta_targeting_id,
            name: item.name,
            type: item.type,
            path: Array.isArray(item.path) ? (item.path as string[]) : [],
            audience_size_lower: item.audience_size_lower,
            audience_size_upper: item.audience_size_upper,
          })),
        })
        .then((res) => {
          if (cancelled) return;
          const next: Record<string, { lower: number | null; upper: number | null }> = {};
          for (const row of res.rows ?? []) {
            next[row.id] = {
              lower: row.potential.users_lower,
              upper: row.potential.users_upper,
            };
          }
          setPotentialById(next);
        })
        .catch(() => {
          if (!cancelled) setPotentialById({});
        })
        .finally(() => {
          if (!cancelled) setPotentialLoading(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adAccountId, organizationId, selectedListId, items.map((item) => item.meta_targeting_id).join(","), filtersKey]);

  useEffect(() => {
    const includeCount = itemsByGroup.get(0)?.length ?? 0;
    if (!adAccountId || !filters || !selectedListId || includeCount === 0 || !hasNarrow) {
      setGroupedReach(null);
      setGroupedReachLoading(false);
      return;
    }
    let cancelled = false;
    const handle = window.setTimeout(() => {
      setGroupedReachLoading(true);
      void groupedReachMutation
        .mutateAsync({
          organizationId,
          adAccountId,
          listId: selectedListId,
          filters,
        })
        .then((res) => {
          if (cancelled) return;
          setGroupedReach({
            include: res.include,
            first_narrow: res.first_narrow,
            intersection: res.intersection,
          });
        })
        .catch(() => {
          if (!cancelled) setGroupedReach(null);
        })
        .finally(() => {
          if (!cancelled) setGroupedReachLoading(false);
        });
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    adAccountId,
    organizationId,
    selectedListId,
    hasNarrow,
    items.map((item) => `${item.match_group ?? 0}:${item.meta_targeting_id}`).join(","),
    filtersKey,
  ]);
  const selectedList = lists.find((list) => list.id === selectedListId) ?? null;
  const selectedListName = selectedList?.name || renameValue.trim() || "this list";

  const exportSelected = () => {
    if (!items.length) return;
    const mapped: MetaTargetingItem[] = items.map((i) => ({
      id: i.meta_targeting_id,
      name: i.name,
      type: (i.type as MetaTargetingItem["type"]) || "interest",
      path: Array.isArray(i.path) ? (i.path as string[]) : [],
      audience_size_lower: i.audience_size_lower,
      audience_size_upper: i.audience_size_upper,
      description: null,
    }));
    const blob = new Blob([targetingItemsToCsv(mapped)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `meta-interest-list-${selectedListId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-gray-200 px-3 py-2.5">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold leading-5 tracking-tight text-gray-900">
            {t("digitalMarketing.metaAds.interestSavedTitle", "Saved lists")}
          </h3>
          {lists.length > 0 ? (
            <span className="text-xs tabular-nums text-muted-foreground">{lists.length}</span>
          ) : null}
        </div>
      </div>

      <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 flex-1 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {topContent ? <div className="border-b border-gray-100 p-3">{topContent}</div> : null}
        <div className="p-2.5">
        {listsQuery.isPending ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : lists.length === 0 ? (
          <div className="flex flex-col items-center px-4 py-12 text-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <Bookmark className="h-4 w-4" />
            </span>
            <p className="mt-3 text-sm font-medium text-gray-900">
              {t("digitalMarketing.metaAds.interestNoLists", "No saved lists yet.")}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {t(
                "digitalMarketing.metaAds.interestNoListsHint",
                "Save a targeting list from search to reuse it here.",
              )}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white">
            {lists.map((list) => {
              const countRaw = list.meta_ads_interest_list_items;
              const count = Array.isArray(countRaw)
                ? Number(countRaw[0]?.count ?? 0)
                : Number((countRaw as { count?: number } | undefined)?.count ?? 0);
              const active = selectedListId === list.id;
              return (
                <li
                  key={list.id}
                  className={cn("transition-colors", active ? "bg-slate-50" : "bg-white hover:bg-slate-50/70")}
                >
                  {active && renaming ? (
                    <div className="flex gap-1.5 px-2 py-1.5">
                      <Input
                        autoFocus
                        className="h-8 text-xs"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") {
                            setRenameValue(list.name);
                            setRenaming(false);
                          }
                        }}
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8"
                        disabled={
                          !renameValue.trim() ||
                          renameValue.trim() === list.name ||
                          mutations.renameList.isPending
                        }
                        onClick={() => setConfirmRename(true)}
                      >
                        {t("common.save", "Save")}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-8"
                        onClick={() => {
                          setRenameValue(list.name);
                          setRenaming(false);
                        }}
                      >
                        {t("common.cancel", "Cancel")}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-0.5 px-1.5 py-1">
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-1 text-left"
                        onClick={() => {
                          setSelectedListId(list.id);
                          setRenameValue(list.name);
                          setRenaming(false);
                          setConfirmRename(false);
                        }}
                      >
                        <span
                          className={cn(
                            "flex h-6 w-6 shrink-0 items-center justify-center rounded-md",
                            active ? "bg-white text-slate-700 ring-1 ring-slate-200" : "bg-slate-100 text-slate-500",
                          )}
                        >
                          <Bookmark className="h-3 w-3" />
                        </span>
                        <span className="min-w-0 flex-1 leading-tight">
                          <span className="block truncate text-[13px] font-medium text-gray-900">{list.name}</span>
                          <span className="text-[11px] font-normal text-muted-foreground">
                            {t("digitalMarketing.metaAds.interestListCount", "{{count}} items", {
                              count,
                            })}
                          </span>
                        </span>
                      </button>
                      {active ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 shrink-0 p-0 text-muted-foreground"
                          title={t("digitalMarketing.metaAds.interestRename", "Rename")}
                          aria-label={t("digitalMarketing.metaAds.interestRename", "Rename")}
                          onClick={() => {
                            setRenameValue(list.name);
                            setRenaming(true);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      ) : null}
                    </div>
                  )}
                  {active ? (
                    <div className="border-t border-slate-200 px-1.5 pb-1.5 pt-1.5">
                      <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
                        <TooltipProvider delayDuration={250}>
                          <div className="flex items-center gap-0.5 border-b border-slate-200 px-0.5 py-0">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0 text-muted-foreground"
                                  aria-label="CSV"
                                  onClick={exportSelected}
                                >
                                  <Download className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>CSV</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0 text-muted-foreground"
                                  disabled={!items.length || !adAccountId}
                                  aria-label={t("digitalMarketing.metaAds.interestCreateAdsTitle", "Create draft campaign")}
                                  onClick={() => setCreateAdsOpen(true)}
                                >
                                  <Megaphone className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                {t("digitalMarketing.metaAds.interestCreateAdsTitle", "Create draft campaign")}
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0 text-muted-foreground"
                                  disabled={!items.length || !adAccountId}
                                  aria-label={t(
                                    "digitalMarketing.metaAds.populationBudgetButton",
                                    "Hitung budget populasi ini",
                                  )}
                                  onClick={() => {
                                    if (items.length > POPULATION_UNION_ITEM_CAP) {
                                      toast.message(
                                        t(
                                          "digitalMarketing.metaAds.populationBudgetCapped",
                                          "Using the first {{count}} interests for the official union (Meta estimate cap).",
                                          { count: POPULATION_UNION_ITEM_CAP },
                                        ),
                                      );
                                    }
                                    onCalculatePopulation?.({
                                      listId: selectedListId,
                                      listName: selectedList?.name ?? selectedListName,
                                      items: items.map(listItemToTargeting),
                                      targetingGroups,
                                    });
                                  }}
                                >
                                  <Calculator className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                {t("digitalMarketing.metaAds.populationBudgetButton", "Hitung budget populasi ini")}
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0 text-muted-foreground"
                                  disabled={!hasNarrow || !adAccountId}
                                  aria-label={t(
                                    "digitalMarketing.metaAds.interestListOverlapViz",
                                    "View overlap visualization",
                                  )}
                                  onClick={() => setOverlapVizOpen(true)}
                                >
                                  <GitCompare className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                {t(
                                  "digitalMarketing.metaAds.interestListOverlapViz",
                                  "View overlap visualization",
                                )}
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0 text-muted-foreground"
                                  disabled={!items.length}
                                  aria-label={t("digitalMarketing.metaAds.interestLoadList", "Load")}
                                  onClick={() => {
                                    const mapped: MetaTargetingItem[] = items.map((i) => ({
                                      id: i.meta_targeting_id,
                                      name: i.name,
                                      type: (i.type as MetaTargetingItem["type"]) || "interest",
                                      path: Array.isArray(i.path) ? (i.path as string[]) : [],
                                      audience_size_lower: i.audience_size_lower,
                                      audience_size_upper: i.audience_size_upper,
                                      description: null,
                                    }));
                                    onLoadItems?.(mapped);
                                  }}
                                >
                                  <FolderOpen className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                {t("digitalMarketing.metaAds.interestLoadList", "Load")}
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="ml-auto h-7 w-7 p-0 text-muted-foreground hover:bg-red-50 hover:text-destructive"
                                  disabled={mutations.deleteList.isPending}
                                  aria-label={t("digitalMarketing.metaAds.interestDeleteList", "Delete list")}
                                  onClick={() => setConfirmDeleteList(true)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                {t("digitalMarketing.metaAds.interestDeleteList", "Delete list")}
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </TooltipProvider>

                        {detailQuery.isPending ? (
                          <div className="flex justify-center py-6">
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          </div>
                        ) : (
                          <div>
                            {displayedGroups.map((group) => (
                              <ListMatchGroupBlock
                                key={`${list.id}-${group}`}
                                organizationId={organizationId}
                                adAccountId={adAccountId}
                                matchGroup={group}
                                items={itemsByGroup.get(group) ?? []}
                                blockedIds={blockedIds}
                                selectedItems={selectedItems}
                                adding={mutations.addItems.isPending}
                                potentialById={potentialById}
                                potentialLoading={potentialLoading}
                                onAdd={async (picked) => {
                                  if (!selectedListId || !picked.length) return;
                                  try {
                                    const added = await mutations.addItems.mutateAsync({
                                      listId: selectedListId,
                                      items: picked,
                                      matchGroup: group,
                                      filters,
                                    });
                                    warnMetaSync(added.meta_sync_error, t);
                                  } catch (e) {
                                    toast.error(e instanceof Error ? e.message : "Add failed");
                                  }
                                }}
                                onRemoveItem={(item) => setConfirmRemoveItem({ id: item.id, name: item.name })}
                                onRemoveGroup={
                                  group > 0
                                    ? () => {
                                        if ((itemsByGroup.get(group) ?? []).length) {
                                          setConfirmRemoveGroup(group);
                                          return;
                                        }
                                        setExtraNarrowGroups((prev) => prev.filter((value) => value !== group));
                                      }
                                    : undefined
                                }
                              />
                            ))}
                            {displayedGroups.length - 1 < MAX_INTEREST_LIST_MATCH_GROUP ? (
                              <button
                                type="button"
                                className="flex w-full items-center gap-1.5 px-2 py-2 text-left text-[12px] font-medium text-sky-800 hover:bg-sky-50"
                                onClick={() => {
                                  const next = Math.max(...displayedGroups, 0) + 1;
                                  if (next > MAX_INTEREST_LIST_MATCH_GROUP) return;
                                  setExtraNarrowGroups((prev) =>
                                    prev.includes(next) ? prev : [...prev, next],
                                  );
                                }}
                              >
                                <Plus className="h-3.5 w-3.5" />
                                {t(
                                  "digitalMarketing.metaAds.interestListAddNarrow",
                                  "And must also match",
                                )}
                              </button>
                            ) : null}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
        </div>
      </div>

      <AlertDialog open={confirmRename} onOpenChange={setConfirmRename}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("digitalMarketing.metaAds.interestRenameListTitle", "Rename saved list?")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                "digitalMarketing.metaAds.interestRenameListBody",
                "Change the name from “{{from}}” to “{{to}}”.",
                { from: selectedList?.name ?? selectedListName, to: renameValue.trim() },
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel", "Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={mutations.renameList.isPending}
              onClick={async (event) => {
                event.preventDefault();
                if (!selectedListId) return;
                try {
                  const renamed = await mutations.renameList.mutateAsync({
                    listId: selectedListId,
                    name: renameValue.trim(),
                    filters,
                  });
                  setConfirmRename(false);
                  setRenaming(false);
                  toast.success(t("digitalMarketing.metaAds.interestListRenamed", "List renamed"));
                  warnMetaSync(renamed.meta_sync_error, t);
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Rename failed");
                }
              }}
            >
              {t("digitalMarketing.metaAds.interestRenameListConfirm", "Rename")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmDeleteList} onOpenChange={setConfirmDeleteList}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("digitalMarketing.metaAds.interestDeleteListTitle", "Delete saved list?")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                "digitalMarketing.metaAds.interestDeleteListBody",
                "“{{name}}” and its {{count}} items will be removed. This cannot be undone.",
                { name: selectedListName, count: items.length },
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel", "Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={mutations.deleteList.isPending}
              onClick={async (event) => {
                event.preventDefault();
                if (!selectedListId) return;
                try {
                  const deleted = await mutations.deleteList.mutateAsync(selectedListId);
                  setSelectedListId(null);
                  setConfirmDeleteList(false);
                  toast.success(t("digitalMarketing.metaAds.interestListDeleted", "List deleted"));
                  if (deleted.meta_sync_error) {
                    toast.message(
                      t(
                        "digitalMarketing.metaAds.interestMetaDeleteFailed",
                        "List deleted here. Delete the audience in Ads Manager if it is still there: {{error}}",
                        { error: deleted.meta_sync_error },
                      ),
                    );
                  }
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Delete failed");
                }
              }}
            >
              {t("digitalMarketing.metaAds.interestDeleteListConfirm", "Delete list")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(confirmRemoveItem)}
        onOpenChange={(open) => {
          if (!open) setConfirmRemoveItem(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("digitalMarketing.metaAds.interestRemoveItemTitle", "Remove this interest?")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                "digitalMarketing.metaAds.interestRemoveItemBody",
                "“{{name}}” will be removed from “{{list}}”.",
                { name: confirmRemoveItem?.name ?? "", list: selectedListName },
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel", "Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={mutations.removeItem.isPending}
              onClick={async (event) => {
                event.preventDefault();
                if (!selectedListId || !confirmRemoveItem) return;
                try {
                  const removed = await mutations.removeItem.mutateAsync({
                    listId: selectedListId,
                    itemId: confirmRemoveItem.id,
                    filters,
                  });
                  setConfirmRemoveItem(null);
                  warnMetaSync(removed.meta_sync_error, t);
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Remove failed");
                }
              }}
            >
              {t("digitalMarketing.metaAds.interestRemoveItemConfirm", "Remove")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={confirmRemoveGroup != null}
        onOpenChange={(open) => {
          if (!open) setConfirmRemoveGroup(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("digitalMarketing.metaAds.interestListRemoveNarrowTitle", "Remove this Narrow row?")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                "digitalMarketing.metaAds.interestListRemoveNarrowBody",
                "All interests in this “and must also match” group will be removed from the list.",
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel", "Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={mutations.removeGroup.isPending}
              onClick={async (event) => {
                event.preventDefault();
                if (!selectedListId || confirmRemoveGroup == null) return;
                try {
                  const removed = await mutations.removeGroup.mutateAsync({
                    listId: selectedListId,
                    matchGroup: confirmRemoveGroup,
                    filters,
                  });
                  setExtraNarrowGroups((prev) => prev.filter((value) => value !== confirmRemoveGroup));
                  setConfirmRemoveGroup(null);
                  warnMetaSync(removed.meta_sync_error, t);
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Remove failed");
                }
              }}
            >
              {t("digitalMarketing.metaAds.interestListRemoveNarrowConfirm", "Remove row")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={overlapVizOpen} onOpenChange={setOverlapVizOpen}>
        <DialogContent className="max-w-[560px] bg-white sm:rounded-xl">
          <DialogHeader>
            <DialogTitle>
              {t(
                "digitalMarketing.metaAds.interestListOverlapVizTitle",
                "Siapa yang melihat iklan?",
              )}
            </DialogTitle>
          </DialogHeader>
          {groupedReachLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : groupedReach ? (
            <PopulationOverlapViz
              sources={[
                {
                  id: "include",
                  name: t(
                    "digitalMarketing.metaAds.interestListIncludeReach",
                    "Include (OR)",
                  ),
                  reach: officialReachCount(groupedReach.include),
                  overlapPct: (() => {
                    const andCount = officialReachCount(groupedReach.intersection);
                    const includeCount = officialReachCount(groupedReach.include);
                    return andCount != null && includeCount
                      ? (andCount / includeCount) * 100
                      : null;
                  })(),
                },
                {
                  id: "narrow",
                  name: t(
                    "digitalMarketing.metaAds.interestListNarrowReach",
                    "Narrow",
                  ),
                  reach: officialReachCount(groupedReach.first_narrow),
                  overlapPct: (() => {
                    const andCount = officialReachCount(groupedReach.intersection);
                    const narrowCount = officialReachCount(groupedReach.first_narrow);
                    return andCount != null && narrowCount
                      ? (andCount / narrowCount) * 100
                      : null;
                  })(),
                },
              ]}
              union={officialReachCount(groupedReach.intersection)}
              overlap={officialReachCount(groupedReach.intersection)}
              uniqueLabel={t(
                "digitalMarketing.metaAds.interestListAndAudience",
                "Audience iklan",
              )}
              uniqueHint={t(
                "digitalMarketing.metaAds.interestListAndAudienceHint",
                "Hanya irisan tengah (bertuliskan Iklan). Bagian lingkaran yang tidak bertumpuk tidak ditayangkan iklan.",
              )}
              overlapBadge={t("digitalMarketing.metaAds.interestListOverlapBadge", "Iklan")}
              footerNote={t(
                "digitalMarketing.metaAds.interestListOverlapFooter",
                "Lingkaran biru = semua orang Include. Lingkaran merah = semua orang Narrow. Area tumpang tindih = Include AND Narrow, dan itulah targeting ad set saat Create draft dari list ini.",
              )}
            />
          ) : (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">
              {t(
                "digitalMarketing.metaAds.interestListAndReachUnavailable",
                "AND reach is unavailable for this list.",
              )}
            </p>
          )}
        </DialogContent>
      </Dialog>

      <InterestResearchCreateAdDialog
        open={createAdsOpen}
        onOpenChange={setCreateAdsOpen}
        organizationId={organizationId}
        adAccountId={adAccountId}
        filters={filters ?? DEFAULT_INTEREST_RESEARCH_FILTERS}
        listId={selectedListId}
        listName={selectedList?.name ?? selectedListName}
        lastCampaignId={selectedList?.meta_campaign_id}
        items={items.map((item) => ({
          id: item.meta_targeting_id,
          name: item.name,
          type: (item.type as MetaTargetingItem["type"]) || "interest",
          path: Array.isArray(item.path) ? (item.path as string[]) : [],
          audience_size_lower: item.audience_size_lower,
          audience_size_upper: item.audience_size_upper,
          description: null,
        }))}
      />

    </section>
  );
}
