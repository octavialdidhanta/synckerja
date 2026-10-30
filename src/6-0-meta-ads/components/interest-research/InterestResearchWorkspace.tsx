import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  Columns2,
  Compass,
  ArrowLeft,
  Copy,
  Download,
  GitCompare,
  Info,
  ListPlus,
  Loader2,
  Megaphone,
  Search,
  Stethoscope,
  Target,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";
import { cn } from "@/shared/lib/utils";
import {
  DEFAULT_INTEREST_RESEARCH_FILTERS,
  formatAudienceSize,
  isMetaReachPrivacyFloor,
  locationsFingerprintClient,
  targetingItemsToCsv,
  useMetaAdsInterestListMutations,
  useMetaAdsInterestLists,
  useMetaAdsTargetingEstimate,
  useMetaAdsTargetingEstimateRows,
  useMetaAdsTargetingOverlapRows,
  useMetaAdsTargetingSearch,
  useMetaAdsTargetingSpike,
  useMetaAdsTargetingSuggest,
  type InterestResearchFilters,
  type MetaEstimateRow,
  type MetaOverlapRow,
  type MetaTargetingItem,
} from "@/meta-ads/hooks/useMetaAdsTargeting";
import { InterestResearchCreateAdDialog } from "@/6-0-meta-ads/components/interest-research/InterestResearchCreateAdDialog";
import { InterestResearchAudienceOverlapDialog } from "@/6-0-meta-ads/components/interest-research/InterestResearchAudienceOverlapDialog";
import {
  filterBroadBehaviourNoise,
  type CompositionHop,
} from "@/6-0-meta-ads/components/interest-research/InterestResearchCompositionBar";
import {
  InterestResearchOverlapPanel,
  type InterestResearchOverlapResult,
} from "@/6-0-meta-ads/components/interest-research/InterestResearchOverlapPanel";
import {
  InterestResearchReachPanel,
  type InterestResearchReachResult,
} from "@/6-0-meta-ads/components/interest-research/InterestResearchReachPanel";
import { InterestResearchFilterBar } from "@/6-0-meta-ads/components/interest-research/InterestResearchFilterBar";
import {
  InterestResearchPopulationBudgetPanel,
  type PopulationBudgetSession,
} from "@/6-0-meta-ads/components/interest-research/population-budget";

function targetingPathLabel(item: MetaTargetingItem): string {
  const path = (item.path ?? []).map((p) => String(p).trim()).filter(Boolean);
  const joined = path.join(" > ");
  if (path.length >= 2) return joined;
  if (item.type === "work_employer") return "Demographics > Work > Employers";
  if (item.type === "industry") return "Demographics > Work > Industries";
  if (item.type === "life_event") return "Demographics > Life Events";
  if (item.type === "behavior") return "Behaviors";
  if (item.type === "income") return "Demographics > Income";
  if (item.type === "family_status") return "Demographics > Family Status";
  if (joined.toLowerCase().includes("additional")) return "Interests > Additional Interests";
  if (item.type === "interest" || path[0]?.toLowerCase() === "interests") {
    return path.length ? joined : "Interests";
  }
  return joined || "Interests";
}

const MAX_SEARCH_QUERIES = 8;

function parseSearchTerms(raw: string): string[] {
  return raw
    .split(/[,;\n]+/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 2);
}

type ExploreLayer = {
  hop: CompositionHop;
  seeds: MetaTargetingItem[];
  items: MetaTargetingItem[];
};

type TableViewMode = "default" | "audience_overlap";

function OverlapCellFrame({
  loading,
  ov,
  andFloor,
  retryDisabled,
  onRetry,
  children,
}: {
  loading: boolean;
  ov?: MetaOverlapRow;
  andFloor: boolean;
  retryDisabled: boolean;
  onRetry: () => void;
  children: (ov: MetaOverlapRow) => ReactNode;
}) {
  const { t } = useTranslation();
  if (loading) {
    return <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />;
  }
  if (ov?.error) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs text-destructive"
            disabled={retryDisabled}
            onClick={onRetry}
          >
            {t("digitalMarketing.metaAds.interestDailyError", "Retry")}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[260px] text-xs">
          {ov.error}
        </TooltipContent>
      </Tooltip>
    );
  }
  if (ov && andFloor) {
    return (
      <span className="inline-flex items-center gap-1 text-muted-foreground">
        —
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
              aria-label={t(
                "digitalMarketing.metaAds.interestOverlapFloorTitle",
                "Irisan terlalu kecil",
              )}
            >
              <Info className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[240px] text-xs">
            {t(
              "digitalMarketing.metaAds.interestOverlapFloorHint",
              "Irisan terlalu kecil untuk dihitung (batas privasi Meta).",
            )}
          </TooltipContent>
        </Tooltip>
      </span>
    );
  }
  if (ov) return <>{children(ov)}</>;
  return (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      className="h-7 px-2 text-xs"
      disabled={retryDisabled}
      onClick={onRetry}
    >
      <Target className="mr-1 h-3 w-3" />
      {t("digitalMarketing.metaAds.interestEstimateRow", "Estimate")}
    </Button>
  );
}

type InterestResearchWorkspaceProps = {
  organizationId: string;
  adAccountId: string;
  countryCode?: string;
  externalItems?: MetaTargetingItem[] | null;
  onExternalItemsConsumed?: () => void;
  onReachResultChange?: (result: InterestResearchReachResult | null) => void;
  onOverlapResultChange?: (result: InterestResearchOverlapResult | null) => void;
  onResearchFiltersChange?: (filters: InterestResearchFilters) => void;
  populationBudget?: PopulationBudgetSession | null;
  onClosePopulationBudget?: () => void;
  onSelectedItemsChange?: (items: MetaTargetingItem[]) => void;
};

export function InterestResearchWorkspace({
  organizationId,
  adAccountId,
  countryCode = "ID",
  externalItems = null,
  onExternalItemsConsumed,
  onReachResultChange,
  onOverlapResultChange,
  onResearchFiltersChange,
  populationBudget = null,
  onClosePopulationBudget,
  onSelectedItemsChange,
}: InterestResearchWorkspaceProps) {
  const { t } = useTranslation();
  const [queryInput, setQueryInput] = useState("");
  const [submittedQueries, setSubmittedQueries] = useState<string[]>([]);
  const [researchMode, setResearchMode] = useState<"search" | "explore">("search");
  const [exploreBarSeeds, setExploreBarSeeds] = useState<MetaTargetingItem[]>([]);
  const [typeFilter, setTypeFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [exploreStack, setExploreStack] = useState<ExploreLayer[]>([]);
  const [reachResult, setReachResult] = useState<InterestResearchReachResult | null>(null);
  const [overlapResult, setOverlapResult] = useState<InterestResearchOverlapResult | null>(null);
  const [saveListId, setSaveListId] = useState<string>("");
  const [newListName, setNewListName] = useState("");
  const [spikeSummary, setSpikeSummary] = useState<string | null>(null);
  const [createAdOpen, setCreateAdOpen] = useState(false);
  const [suggestedDailyBudget, setSuggestedDailyBudget] = useState<number | null>(null);
  const onCalculatedDailyBudget = useCallback((daily: number | null) => {
    setSuggestedDailyBudget(daily);
  }, []);
  const [overlapDialogOpen, setOverlapDialogOpen] = useState(false);
  const [filters, setFilters] = useState<InterestResearchFilters>({
    ...DEFAULT_INTEREST_RESEARCH_FILTERS,
    countryCode,
  });
  const [rowEstimates, setRowEstimates] = useState<Record<string, MetaEstimateRow>>({});
  const [rowOverlaps, setRowOverlaps] = useState<Record<string, MetaOverlapRow>>({});
  const [rowsLoading, setRowsLoading] = useState(false);
  const [overlapLoading, setOverlapLoading] = useState(false);
  const [estimatingRowId, setEstimatingRowId] = useState<string | null>(null);
  const [overlappingRowId, setOverlappingRowId] = useState<string | null>(null);
  const [objectiveDowngraded, setObjectiveDowngraded] = useState(false);
  const [tableView, setTableView] = useState<TableViewMode>("default");
  const estimateReqRef = useRef(0);
  const INITIAL_ESTIMATE_COUNT = 10;

  useEffect(() => {
    if (!populationBudget) setSuggestedDailyBudget(null);
  }, [populationBudget]);

  useEffect(() => {
    if (!externalItems?.length) return;
    const items = externalItems;
    setResearchMode("explore");
    setExploreBarSeeds([]);
    setQueryInput("");
    setSubmittedQueries([]);
    setExploreStack([
      {
        hop: {
          id: "saved",
          label: t("digitalMarketing.metaAds.interestHopSaved", "Saved list"),
        },
        seeds: [],
        items,
      },
    ]);
    setSelectedIds(new Set(items.map((i) => i.id)));
    const consume = window.setTimeout(() => onExternalItemsConsumed?.(), 0);
    return () => window.clearTimeout(consume);
  }, [externalItems, onExternalItemsConsumed, t]);

  useEffect(() => {
    onReachResultChange?.(reachResult);
  }, [reachResult, onReachResultChange]);

  useEffect(() => {
    onResearchFiltersChange?.(filters);
  }, [filters, onResearchFiltersChange]);

  useEffect(() => {
    onOverlapResultChange?.(overlapResult);
  }, [overlapResult, onOverlapResultChange]);

  const searchQuery = useMetaAdsTargetingSearch({
    organizationId,
    adAccountId,
    queries: submittedQueries,
    typeFilter,
    enabled: Boolean(adAccountId),
  });
  const submittedQueryLabel = submittedQueries.join(" + ");
  const suggestMutation = useMetaAdsTargetingSuggest();
  const estimateMutation = useMetaAdsTargetingEstimate();
  const estimateRowsMutation = useMetaAdsTargetingEstimateRows();
  const overlapRowsMutation = useMetaAdsTargetingOverlapRows();
  const spikeMutation = useMetaAdsTargetingSpike();
  const listsQuery = useMetaAdsInterestLists(organizationId, adAccountId, Boolean(organizationId));
  const listMutations = useMetaAdsInterestListMutations(organizationId, adAccountId);

  useEffect(() => {
    setSaveListId("");
  }, [adAccountId]);

  const rawExploreItems =
    exploreStack.length > 0 ? exploreStack[exploreStack.length - 1]?.items ?? [] : null;
  const exploreItems = rawExploreItems
    ? filterBroadBehaviourNoise(rawExploreItems, true)
    : null;
  const searchItems = searchQuery.data?.items
    ? filterBroadBehaviourNoise(searchQuery.data.items, true)
    : [];
  const resultItems = researchMode === "explore" ? exploreItems ?? [] : searchItems;
  const selectedItems = useMemo(
    () => resultItems.filter((i) => selectedIds.has(i.id)),
    [resultItems, selectedIds],
  );
  const selectedItemsKey = useMemo(
    () => selectedItems.map((item) => item.id).join(","),
    [selectedItems],
  );
  useEffect(() => {
    onSelectedItemsChange?.(selectedItems);
    // Sync by id list only — a fresh [] every render must not loop the parent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedItemsKey, onSelectedItemsChange]);
  const visibleEstimateItems = useMemo(
    () => resultItems.slice(0, INITIAL_ESTIMATE_COUNT),
    [resultItems],
  );
  const visibleIdsKey = useMemo(
    () => visibleEstimateItems.map((i) => i.id).join(","),
    [visibleEstimateItems],
  );
  const exploreSeeds = useMemo(() => {
    const layer = exploreStack[exploreStack.length - 1];
    return layer?.seeds?.length ? layer.seeds : [];
  }, [exploreStack]);
  const exploreSeedsKey = useMemo(
    () => exploreSeeds.map((s) => s.id).join(","),
    [exploreSeeds],
  );
  const showOverlapColumn = researchMode === "explore" && exploreSeeds.length > 0;
  const audienceOverlapView = showOverlapColumn && tableView === "audience_overlap";

  useEffect(() => {
    if (!showOverlapColumn) setTableView("default");
  }, [showOverlapColumn]);

  const overlapSeedLabel =
    exploreSeeds.length === 1
      ? exploreSeeds[0].name
      : exploreSeeds.length
        ? `${exploreSeeds.length} seeds`
        : "";
  const filtersKey = useMemo(
    () =>
      [
        filters.countryCode,
        filters.gender,
        filters.ageMin,
        filters.ageMax,
        filters.dailyBudget,
        filters.objective,
        filters.placement,
        locationsFingerprintClient(filters.locations ?? []),
      ].join("|"),
    [filters],
  );

  useEffect(() => {
    if (!visibleEstimateItems.length || !adAccountId) {
      setRowEstimates({});
      setRowOverlaps({});
      setRowsLoading(false);
      setOverlapLoading(false);
      return;
    }
    const reqId = ++estimateReqRef.current;
    setRowEstimates({});
    setRowOverlaps({});
    setRowsLoading(true);
    const itemsSnapshot = visibleEstimateItems;
    const filtersSnapshot = filters;
    const seedsSnapshot = exploreSeeds;
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await estimateRowsMutation.mutateAsync({
            organizationId,
            adAccountId,
            filters: filtersSnapshot,
            forceRefresh: true,
            items: itemsSnapshot.map((i) => ({
              id: i.id,
              name: i.name,
              type: i.type,
              path: i.path,
              audience_size_lower: i.audience_size_lower,
              audience_size_upper: i.audience_size_upper,
            })),
          });
          if (reqId !== estimateReqRef.current) return;
          const next: Record<string, MetaEstimateRow> = {};
          for (const row of res.rows ?? []) next[row.id] = row;
          setRowEstimates(next);
          if (
            (res.filters as { objective_downgraded?: boolean } | undefined)?.objective_downgraded
          ) {
            setObjectiveDowngraded(true);
          }
          const failed = (res.rows ?? []).filter((row) => row.error);
          for (const failedRow of failed) {
            if (reqId !== estimateReqRef.current) return;
            const item = itemsSnapshot.find((i) => i.id === failedRow.id);
            if (!item) continue;
            await new Promise((r) => window.setTimeout(r, 450));
            if (reqId !== estimateReqRef.current) return;
            try {
              const retryRes = await estimateRowsMutation.mutateAsync({
                organizationId,
                adAccountId,
                filters: filtersSnapshot,
                items: [
                  {
                    id: item.id,
                    name: item.name,
                    type: item.type,
                    path: item.path,
                    audience_size_lower: item.audience_size_lower,
                    audience_size_upper: item.audience_size_upper,
                  },
                ],
              });
              const recovered = retryRes.rows?.[0];
              if (recovered && reqId === estimateReqRef.current) {
                next[item.id] = recovered;
                setRowEstimates((prev) => ({ ...prev, [item.id]: recovered }));
              }
            } catch {
              // Keep the original Retry cell if Meta is still rate-limited.
            }
          }
          if (seedsSnapshot.length && reqId === estimateReqRef.current) {
            setOverlapLoading(true);
            try {
              const latestEstimates =
                reqId === estimateReqRef.current ? { ...next } : next;
              const ov = await overlapRowsMutation.mutateAsync({
                organizationId,
                adAccountId,
                filters: filtersSnapshot,
                seed: seedsSnapshot.map((s) => ({
                  id: s.id,
                  name: s.name,
                  type: s.type,
                  path: s.path,
                })),
                items: itemsSnapshot.map((i) => {
                  const est = latestEstimates[i.id]?.potential;
                  return {
                    id: i.id,
                    name: i.name,
                    type: i.type,
                    path: i.path,
                    potential_lower: est?.users_lower ?? null,
                    potential_upper: est?.users_upper ?? null,
                  };
                }),
              });
              if (reqId !== estimateReqRef.current) return;
              const ovMap: Record<string, MetaOverlapRow> = {};
              for (const row of ov.rows ?? []) ovMap[row.id] = row;
              setRowOverlaps(ovMap);
            } catch (ovErr) {
              if (reqId !== estimateReqRef.current) return;
              toast.error(ovErr instanceof Error ? ovErr.message : "Overlap estimate failed");
            } finally {
              if (reqId === estimateReqRef.current) setOverlapLoading(false);
            }
          }
        } catch (e) {
          if (reqId !== estimateReqRef.current) return;
          toast.error(e instanceof Error ? e.message : "Row estimate failed");
        } finally {
          if (reqId === estimateReqRef.current) {
            setRowsLoading(false);
            if (!seedsSnapshot.length) setOverlapLoading(false);
          }
        }
      })();
    }, 700);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- filtersKey + visibleIdsKey + seeds drive refetch
  }, [organizationId, adAccountId, filtersKey, visibleIdsKey, exploreSeedsKey]);

  const findResultItem = (id: string) =>
    resultItems.find((item) => item.id === id) ??
    searchItems.find((item) => item.id === id) ??
    exploreItems?.find((item) => item.id === id) ??
    exploreBarSeeds.find((item) => item.id === id);

  const removeExploreBarSeed = (id: string) => {
    setExploreBarSeeds((prev) => prev.filter((item) => item.id !== id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const toggleId = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      const selectedForBar = [...next]
        .map((itemId) => findResultItem(itemId))
        .filter((item): item is MetaTargetingItem => Boolean(item))
        .slice(0, 5);
      setExploreBarSeeds(selectedForBar);
      return next;
    });
  };

  const toggleAll = (checked: boolean) => {
    if (!checked) {
      setSelectedIds(new Set());
      setExploreBarSeeds([]);
      return;
    }
    const picked = resultItems.slice(0, 5);
    setSelectedIds(new Set(resultItems.map((i) => i.id)));
    setExploreBarSeeds(picked);
  };

  const runSearch = () => {
    const typed = parseSearchTerms(queryInput).slice(0, MAX_SEARCH_QUERIES);
    if (typed.length) {
      setExploreStack([]);
      setSelectedIds(new Set());
      setExploreBarSeeds([]);
      setSubmittedQueries(typed);
      setQueryInput("");
      setResearchMode("search");
      return;
    }
    if (exploreBarSeeds.length) {
      const fromSeeds = exploreBarSeeds
        .map((seed) => seed.name.trim())
        .filter((term) => term.length >= 2)
        .slice(0, MAX_SEARCH_QUERIES);
      setExploreStack([]);
      setSelectedIds(new Set());
      setExploreBarSeeds([]);
      if (fromSeeds.length) setSubmittedQueries(fromSeeds);
      setResearchMode("search");
      return;
    }
    setResearchMode("search");
    if (submittedQueries.length) {
      void searchQuery.refetch();
      return;
    }
    toast.error(
      t(
        "digitalMarketing.metaAds.interestSearchNeedKeyword",
        "Enter a keyword (min. 2 characters) to search.",
      ),
    );
  };

  const removeSearchQuery = (term: string) => {
    setExploreStack([]);
    setSelectedIds(new Set());
    setSubmittedQueries((prev) => prev.filter((item) => item !== term));
  };

  const applyExplore = async (seedItems: MetaTargetingItem[], hopLabel: string) => {
    const usedSeeds = seedItems.filter((i) => i.id || i.name.trim()).slice(0, 10);
    if (!usedSeeds.length) {
      toast.error(
        t(
          "digitalMarketing.metaAds.interestSelectFirst",
          "Select at least one interest, demographic, or behavior",
        ),
      );
      return;
    }
    const res = await suggestMutation.mutateAsync({
      organizationId,
      adAccountId,
      interestList: usedSeeds.map((i) => i.name),
      items: usedSeeds.map((i) => ({
        id: i.id,
        name: i.name,
        type: i.type,
        path: i.path,
      })),
      context: [
        submittedQueryLabel,
        ...exploreStack.map((layer) => layer.hop.label),
        hopLabel,
      ].filter(Boolean),
    });
    if (!res.items.length) {
      toast.error(
        t(
          "digitalMarketing.metaAds.interestExploreEmpty",
          "No related targeting from Meta for this selection.",
        ),
      );
      return;
    }
    setExploreStack((prev) => [
      ...prev,
      {
        hop: {
          id: usedSeeds.map((i) => i.id).join("+").slice(0, 48) || hopLabel,
          label: usedSeeds.map((i) => i.name).join(" · ") || hopLabel,
        },
        seeds: usedSeeds,
        items: res.items,
      },
    ]);
    setExploreBarSeeds(usedSeeds);
    setSelectedIds(new Set());
    setResearchMode("explore");
    toast.success(
      t("digitalMarketing.metaAds.interestExploreDone", "Found {{count}} related targeting", {
        count: res.items.length,
      }),
    );
  };

  const runExplore = async (seeds?: MetaTargetingItem[]) => {
    const nextSeeds = (seeds ?? (exploreBarSeeds.length ? exploreBarSeeds : selectedItems)).filter(
      (i) => i.id || i.name.trim(),
    );
    if (!nextSeeds.length) {
      toast.error(
        t(
          "digitalMarketing.metaAds.interestSelectFirst",
          "Select at least one interest, demographic, or behavior",
        ),
      );
      return;
    }
    try {
      const label =
        nextSeeds.length === 1
          ? nextSeeds[0].name
          : t("digitalMarketing.metaAds.interestHopSeeds", "{{count}} seeds", {
              count: nextSeeds.length,
            });
      await applyExplore(nextSeeds, label);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Explore failed");
    }
  };

  const switchToExplore = () => {
    const fromIds = [...selectedIds]
      .map((id) => findResultItem(id))
      .filter((item): item is MetaTargetingItem => Boolean(item));
    const seeds = (fromIds.length ? fromIds : exploreBarSeeds.length ? exploreBarSeeds : selectedItems)
      .filter((item) => item.id || item.name.trim());
    if (!seeds.length) {
      toast.error(
        t(
          "digitalMarketing.metaAds.interestSelectFirst",
          "Select at least one interest, demographic, or behavior",
        ),
      );
      return;
    }
    setResearchMode("explore");
    void runExplore(seeds);
  };

  const runEstimate = async () => {
    if (selectedItems.length === 0) {
      toast.error(t("digitalMarketing.metaAds.interestSelectFirst", "Select at least one interest"));
      return;
    }
    try {
      const res = await estimateMutation.mutateAsync({
        organizationId,
        adAccountId,
        filters,
        items: selectedItems.map((i) => ({
          id: i.id,
          name: i.name,
          type: i.type,
          path: i.path,
        })),
      });
      const next: InterestResearchReachResult = {
        estimate: res.estimate,
        delivery_summary: res.delivery_summary ?? {
          mau_lower: null,
          mau_upper: null,
          estimate_ready: null,
          curve_available: false,
        },
        country_code: res.country_code,
        daily: res.daily ?? null,
        daily_source: res.daily_source ?? null,
        objective_downgraded: res.objective_downgraded === true,
      };
      setReachResult(next);
      setObjectiveDowngraded(res.objective_downgraded === true);
      toast.success(
        t("digitalMarketing.metaAds.interestReachToast", "Potential reach ({{country}}): {{range}}", {
          country: res.country_code,
          range: formatAudienceSize(res.estimate.users_lower, res.estimate.users_upper),
        }),
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Estimate failed");
    }
  };

  const runOverlap = () => {
    if (selectedItems.length < 2) {
      toast.error(
        t("digitalMarketing.metaAds.interestOverlapNeedTwoPlus", "Select at least two items to compare"),
      );
      return;
    }
    setOverlapDialogOpen(true);
  };

  const copyIds = async () => {
    const source = selectedItems.length ? selectedItems : resultItems;
    if (!source.length) return;
    await navigator.clipboard.writeText(source.map((i) => i.id).join("\n"));
    toast.success(t("digitalMarketing.metaAds.interestCopiedIds", "Copied interest IDs"));
  };

  const downloadCsv = () => {
    const source = selectedItems.length ? selectedItems : resultItems;
    if (!source.length) return;
    const blob = new Blob([targetingItemsToCsv(source)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `meta-interest-${submittedQueries[0] || "export"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const saveSelected = async () => {
    if (!selectedItems.length) {
      toast.error(t("digitalMarketing.metaAds.interestSelectFirst", "Select at least one interest"));
      return;
    }
    try {
      let listId = saveListId;
      if (!listId) {
        const name =
          newListName.trim() ||
          t("digitalMarketing.metaAds.interestDefaultListName", "Interest list {{date}}", {
            date: new Date().toLocaleDateString(),
          });
        const created = await listMutations.createList.mutateAsync(name);
        listId = created.list.id;
        setSaveListId(listId);
      }
      const added = await listMutations.addItems.mutateAsync({
        listId,
        items: selectedItems,
        filters,
      });
      toast.success(
        t("digitalMarketing.metaAds.interestSaved", "Saved {{count}} items", {
          count: selectedItems.length,
        }),
      );
      if (added.meta_sync_error) {
        toast.message(
          t(
            "digitalMarketing.metaAds.interestMetaSyncFailed",
            "List updated. Ads Manager sync failed: {{error}}",
            { error: added.meta_sync_error },
          ),
        );
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    }
  };

  const runEstimateRow = async (item: (typeof resultItems)[number]) => {
    if (!adAccountId || estimatingRowId) return;
    setEstimatingRowId(item.id);
    try {
      const res = await estimateRowsMutation.mutateAsync({
        organizationId,
        adAccountId,
        filters,
        items: [
          {
            id: item.id,
            name: item.name,
            type: item.type,
            path: item.path,
            audience_size_lower: item.audience_size_lower,
            audience_size_upper: item.audience_size_upper,
          },
        ],
      });
      const row = res.rows?.[0];
      if (row) {
        setRowEstimates((prev) => ({ ...prev, [row.id]: row }));
      }
      if ((res.filters as { objective_downgraded?: boolean } | undefined)?.objective_downgraded) {
        setObjectiveDowngraded(true);
      }
      if (exploreSeeds.length) {
        setOverlappingRowId(item.id);
        const ov = await overlapRowsMutation.mutateAsync({
          organizationId,
          adAccountId,
          filters,
          seed: exploreSeeds.map((s) => ({
            id: s.id,
            name: s.name,
            type: s.type,
            path: s.path,
          })),
          items: [
            {
              id: item.id,
              name: item.name,
              type: item.type,
              path: item.path,
              potential_lower: row?.potential?.users_lower ?? null,
              potential_upper: row?.potential?.users_upper ?? null,
            },
          ],
        });
        const ovRow = ov.rows?.[0];
        if (ovRow) setRowOverlaps((prev) => ({ ...prev, [ovRow.id]: ovRow }));
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Estimate failed");
    } finally {
      setEstimatingRowId(null);
      setOverlappingRowId(null);
    }
  };

  const runOverlapRow = async (item: (typeof resultItems)[number]) => {
    if (!adAccountId || overlappingRowId || !exploreSeeds.length) return;
    setOverlappingRowId(item.id);
    try {
      const est = rowEstimates[item.id]?.potential;
      const ov = await overlapRowsMutation.mutateAsync({
        organizationId,
        adAccountId,
        filters,
        seed: exploreSeeds.map((s) => ({
          id: s.id,
          name: s.name,
          type: s.type,
          path: s.path,
        })),
        items: [
          {
            id: item.id,
            name: item.name,
            type: item.type,
            path: item.path,
            potential_lower: est?.users_lower ?? null,
            potential_upper: est?.users_upper ?? null,
          },
        ],
      });
      const ovRow = ov.rows?.[0];
      if (ovRow) setRowOverlaps((prev) => ({ ...prev, [ovRow.id]: ovRow }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Overlap estimate failed");
    } finally {
      setOverlappingRowId(null);
    }
  };

  const runSpike = async () => {
    try {
      const res = await spikeMutation.mutateAsync({
        organizationId,
        adAccountId,
        countryCode: filters.countryCode,
      });
      const failed = res.report.checks.filter((c) => !c.ok).map((c) => c.name);
      const summary = res.ok
        ? t("digitalMarketing.metaAds.interestSpikeOkDaily", "OK")
        : t("digitalMarketing.metaAds.interestSpikeFail", "Failed{{detail}}", {
            detail: failed.length ? `: ${failed.join(", ")}` : "",
          });
      setSpikeSummary(summary);
      if (res.ok) toast.success(summary);
      else toast.error(summary);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Spike failed");
    }
  };

  const canExplore =
    selectedIds.size > 0 || selectedItems.length > 0 || exploreBarSeeds.length > 0;

  const busy =
    searchQuery.isPending ||
    suggestMutation.isPending ||
    estimateMutation.isPending;

  return (
    <TooltipProvider delayDuration={200}>
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div className="shrink-0 space-y-2 border-b border-gray-200 px-4 pb-2 pt-4">
        {populationBudget ? (
          <>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 shrink-0 gap-1 px-2"
                onClick={() => onClosePopulationBudget?.()}
              >
                <ArrowLeft className="h-4 w-4" />
                {t("common.back", "Back")}
              </Button>
              <div className="min-w-0 flex-1">
                <h2 className="flex items-center gap-1.5 text-base font-semibold">
                  <span className="truncate">
                    {t("digitalMarketing.metaAds.populationBudgetTitle", "Hitung budget populasi ini")}
                  </span>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        aria-label={t(
                          "digitalMarketing.metaAds.populationBudgetNoteTitle",
                          "How this estimate is calculated",
                        )}
                        className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-muted-foreground/30 bg-muted/60 text-muted-foreground transition-colors hover:bg-muted"
                      >
                        <Info className="h-3 w-3" strokeWidth={2.5} />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      side="bottom"
                      align="start"
                      className="w-[min(100vw-2rem,22rem)] text-left text-sm leading-relaxed"
                    >
                      <p className="font-medium text-foreground">
                        {t(
                          "digitalMarketing.metaAds.populationBudgetNoteTitle",
                          "How this estimate is calculated",
                        )}
                      </p>
                      <p className="mt-1 text-muted-foreground">
                        {t(
                          "digitalMarketing.metaAds.populationBudgetNoteBody",
                          "Population is Meta’s official unique reach for this list (OR union) with the location, gender, age, and placement filters on the page — not the sum of each row. Impressions = population × frequency (frequency is views per person for the whole campaign). Total budget = (impressions / 1000) × CPM. Days only split total into a daily budget.",
                        )}
                      </p>
                    </PopoverContent>
                  </Popover>
                </h2>
                {populationBudget.listName ? (
                  <p className="truncate text-xs text-muted-foreground">{populationBudget.listName}</p>
                ) : null}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 shrink-0 gap-1.5"
                disabled={!adAccountId || populationBudget.items.length === 0}
                onClick={() => setCreateAdOpen(true)}
              >
                <Megaphone className="h-3.5 w-3.5" />
                {t("digitalMarketing.metaAds.interestCreateAdsTitle", "Create draft campaign")}
              </Button>
            </div>
            <InterestResearchFilterBar
              organizationId={organizationId}
              adAccountId={adAccountId}
              filters={filters}
              onChange={setFilters}
            />
          </>
        ) : (
        <>
        <div className="flex items-center gap-2">
          <div className="flex min-h-10 min-w-0 flex-1 flex-wrap items-center gap-1 rounded-md border border-input bg-background px-2 py-1">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            {researchMode === "search" && exploreBarSeeds.length === 0
              ? submittedQueries.map((term) => (
                  <span
                    key={`q-${term}`}
                    className="inline-flex max-w-full items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-900"
                  >
                    <span className="truncate">{term}</span>
                    <button
                      type="button"
                      className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full text-sky-700 hover:bg-sky-100 hover:text-sky-950"
                      aria-label={t("digitalMarketing.metaAds.interestSearchRemove", "Hapus {{q}}", {
                        q: term,
                      })}
                      onClick={() => removeSearchQuery(term)}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))
              : null}
            {exploreBarSeeds.map((seed) => (
              <span
                key={seed.id}
                className="inline-flex max-w-full items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-900"
              >
                <span className="truncate">{seed.name}</span>
                <button
                  type="button"
                  className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full text-violet-700 hover:bg-violet-200"
                  aria-label={t("digitalMarketing.metaAds.interestSearchRemove", "Hapus {{q}}", {
                    q: seed.name,
                  })}
                  onClick={() => removeExploreBarSeed(seed.id)}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            {researchMode === "explore" ? (
              <span className="h-7 min-w-[10rem] flex-1 text-sm leading-7 text-muted-foreground">
                {exploreBarSeeds.length
                  ? t(
                      "digitalMarketing.metaAds.interestExploreBarHint",
                      "Select more interests in the table…",
                    )
                  : t(
                      "digitalMarketing.metaAds.interestExplorePlaceholder",
                      "Select interests in the table to explore similar ones",
                    )}
              </span>
            ) : (
              <input
                className="h-7 min-w-[10rem] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                value={queryInput}
                placeholder={t(
                  "digitalMarketing.metaAds.interestSearchPlaceholder",
                  "Find interests that contain a keyword",
                )}
                onChange={(e) => setQueryInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    runSearch();
                  }
                  if (e.key === "Backspace" && !queryInput && submittedQueries.length) {
                    removeSearchQuery(submittedQueries[submittedQueries.length - 1]);
                  }
                }}
              />
            )}
          </div>
          <div className="inline-flex h-10 shrink-0 overflow-hidden rounded-md border border-input bg-background">
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                <Button
                  type="button"
                  variant={researchMode === "search" ? "default" : "ghost"}
                  className="h-10 rounded-none px-3"
                  aria-pressed={researchMode === "search"}
                  onClick={() => runSearch()}
                >
                  {searchQuery.isPending && researchMode === "search" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="mr-2 h-4 w-4" />
                  )}
                  {t("digitalMarketing.metaAds.interestSearch", "Search")}
                </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                {t(
                  "digitalMarketing.metaAds.interestSearchHint",
                  "Find interests that contain a keyword",
                )}
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                <Button
                  type="button"
                  variant={researchMode === "explore" ? "default" : canExplore ? "secondary" : "ghost"}
                  className="h-10 rounded-none px-3"
                  aria-pressed={researchMode === "explore"}
                  onClick={switchToExplore}
                >
                  {suggestMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Compass className="mr-2 h-4 w-4" />
                  )}
                  {t("digitalMarketing.metaAds.interestExplore", "Explore")}
                </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                {t(
                  "digitalMarketing.metaAds.interestExploreHint",
                  "Find related interests, demographics, and behaviors from the selection",
                )}
              </TooltipContent>
            </Tooltip>
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-10 w-10 shrink-0 text-muted-foreground"
                aria-label={t("digitalMarketing.metaAds.interestDiagnostics", "Diagnostics")}
              >
                <Stethoscope className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-48 space-y-2 p-3">
              <Button
                type="button"
                size="sm"
                className="w-full"
                onClick={runSpike}
                disabled={spikeMutation.isPending}
              >
                {spikeMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                {t("digitalMarketing.metaAds.interestRunSpike", "Check API")}
              </Button>
              {spikeSummary ? <p className="text-center text-xs text-muted-foreground">{spikeSummary}</p> : null}
            </PopoverContent>
          </Popover>
        </div>

        <InterestResearchFilterBar
          organizationId={organizationId}
          adAccountId={adAccountId}
          filters={filters}
          onChange={setFilters}
          onSave={saveSelected}
          saveDisabled={!selectedItems.length || listMutations.addItems.isPending}
          savePending={listMutations.addItems.isPending || listMutations.createList.isPending}
          typeFilter={typeFilter}
          onTypeFilterChange={setTypeFilter}
          endSlot={
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <Select
                    value={audienceOverlapView ? "audience_overlap" : "default"}
                    onValueChange={(value) =>
                      setTableView(value === "audience_overlap" ? "audience_overlap" : "default")
                    }
                    disabled={!showOverlapColumn}
                  >
                    <SelectTrigger className="h-6 w-auto min-w-[148px] gap-0.5 border-0 bg-transparent px-0 py-0 text-xs font-medium shadow-none focus:ring-0 focus:ring-offset-0 [&>span]:line-clamp-none [&>svg]:h-3 [&>svg]:w-3">
                      <Columns2 className="mr-1 h-3.5 w-3.5 text-muted-foreground" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent align="end">
                      <SelectItem value="default">
                        {t("digitalMarketing.metaAds.interestTableViewDefault", "Default columns")}
                      </SelectItem>
                      <SelectItem value="audience_overlap">
                        {t(
                          "digitalMarketing.metaAds.interestTableViewAudienceOverlap",
                          "Audience Overlap",
                        )}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[240px] text-xs">
                {showOverlapColumn
                  ? t(
                      "digitalMarketing.metaAds.interestTableViewAudienceOverlapHint",
                      "Tampilkan Overlap, % Com., dan % Sel. tanpa mengubah seed Explore.",
                    )
                  : t(
                      "digitalMarketing.metaAds.interestTableViewAudienceOverlapNeedExplore",
                      "Explore dulu satu atau lebih interest untuk memakai Audience Overlap.",
                    )}
              </TooltipContent>
            </Tooltip>
          }
        >
          {selectedItems.length > 0 ? (
            <>
              <Button
                type="button"
                variant="ghost"
                className="h-6 shrink-0 rounded-none px-2.5 text-xs font-medium text-foreground hover:bg-transparent hover:text-sky-800"
                onClick={runEstimate}
                disabled={busy}
              >
                {estimateMutation.isPending ? (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                ) : (
                  <Target className="mr-1 h-3 w-3" />
                )}
                {t("digitalMarketing.metaAds.interestEstimate", "Estimate reach")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="h-6 shrink-0 rounded-none px-2.5 text-xs font-medium text-foreground hover:bg-transparent hover:text-sky-800"
                onClick={runOverlap}
                disabled={busy || selectedItems.length < 2}
              >
                <GitCompare className="mr-1 h-3 w-3" />
                {t("digitalMarketing.metaAds.interestOverlap", "Overlap")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="h-6 shrink-0 rounded-none px-2.5 text-xs font-medium text-foreground hover:bg-transparent hover:text-sky-800"
                onClick={copyIds}
              >
                <Copy className="mr-1 h-3 w-3" />
                {t("digitalMarketing.metaAds.interestCopyIds", "Copy IDs")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="h-6 shrink-0 rounded-none px-2.5 text-xs font-medium text-foreground hover:bg-transparent hover:text-sky-800"
                onClick={downloadCsv}
              >
                <Download className="mr-1 h-3 w-3" />
                {t("digitalMarketing.metaAds.interestDownloadCsv", "Download CSV")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="h-6 shrink-0 rounded-none px-2.5 text-xs font-medium text-foreground hover:bg-transparent hover:text-sky-800"
                onClick={() => setCreateAdOpen(true)}
              >
                <Megaphone className="mr-1 h-3 w-3" />
                {t("digitalMarketing.metaAds.interestCreateAdsTitle", "Create draft campaign")}
              </Button>
              <Select
                value={saveListId || "__new"}
                onValueChange={(v) => setSaveListId(v === "__new" ? "" : v)}
              >
                <SelectTrigger className="h-6 w-auto shrink-0 gap-0.5 rounded-none border-0 bg-transparent px-2.5 py-0 text-xs font-medium shadow-none focus:ring-0 focus:ring-offset-0 [&>span]:line-clamp-none [&>svg]:h-3 [&>svg]:w-3">
                  <ListPlus className="h-3 w-3" />
                  <SelectValue placeholder="List" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__new">
                    {t("digitalMarketing.metaAds.interestNewList", "New list")}
                  </SelectItem>
                  {(listsQuery.data?.lists ?? []).map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
                  {!saveListId ? (
                    <Input
                      className="h-6 w-[120px] shrink-0 rounded-none border-0 bg-transparent px-2.5 text-xs shadow-none focus-visible:ring-0"
                      value={newListName}
                      placeholder={t("digitalMarketing.metaAds.interestListName", "List name")}
                      onChange={(e) => setNewListName(e.target.value)}
                    />
                  ) : null}
            </>
          ) : null}
        </InterestResearchFilterBar>
        </>
        )}
      </div>

      <InterestResearchCreateAdDialog
        open={createAdOpen}
        onOpenChange={setCreateAdOpen}
        organizationId={organizationId}
        adAccountId={adAccountId}
        filters={filters}
        items={populationBudget ? populationBudget.items : selectedItems}
        listId={populationBudget?.listId}
        listName={populationBudget?.listName}
        suggestedDailyBudget={populationBudget ? suggestedDailyBudget : null}
      />
      <InterestResearchAudienceOverlapDialog
        open={overlapDialogOpen}
        onOpenChange={setOverlapDialogOpen}
        organizationId={organizationId}
        adAccountId={adAccountId}
        filters={filters}
        checkedItems={selectedItems}
        rowEstimates={rowEstimates}
      />

      <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 flex-1 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {populationBudget ? (
          <InterestResearchPopulationBudgetPanel
            organizationId={organizationId}
            adAccountId={adAccountId}
            filters={filters}
            items={populationBudget.items}
            targetingGroups={populationBudget.targetingGroups}
            onCalculatedDailyBudget={onCalculatedDailyBudget}
          />
        ) : (
          <>
        {overlapResult ? (
          <div className="px-4 pt-4">
            <InterestResearchOverlapPanel result={overlapResult} variant="full" />
          </div>
        ) : null}
        {reachResult ? (
          <div className="px-4 pt-4 xl:hidden">
            <InterestResearchReachPanel result={reachResult} />
          </div>
        ) : null}
        {searchQuery.isError ? (
          <div className="p-4">
            <Alert variant="destructive">
              <AlertTitle>{t("digitalMarketing.metaAds.interestError", "Search failed")}</AlertTitle>
              <AlertDescription>
                {searchQuery.error instanceof Error
                  ? searchQuery.error.message
                  : "Unknown error"}
              </AlertDescription>
            </Alert>
          </div>
        ) : null}

        {researchMode === "search" && !submittedQueries.length ? (
          <div className="flex h-full min-h-[200px] items-center justify-center p-6 text-sm text-muted-foreground">
            {t(
              "digitalMarketing.metaAds.interestEmptyPrompt",
              "Enter a keyword (min. 2 characters) and press Enter to find interests that contain it.",
            )}
          </div>
        ) : researchMode === "explore" && !exploreStack.length ? (
          <div className="flex h-full min-h-[200px] items-center justify-center p-6 text-sm text-muted-foreground">
            {t(
              "digitalMarketing.metaAds.interestEmptyExplorePrompt",
              "Switch to Search, select one or more interests, then Explore to find similar interests.",
            )}
          </div>
        ) : (
          <TooltipProvider delayDuration={200}>
            <table className={cn("w-full text-left text-sm", audienceOverlapView ? "min-w-[760px]" : "min-w-[820px]")}>
              <thead className="sticky top-0 z-[1] border-b bg-gray-50 text-xs text-muted-foreground">
                <tr>
                  <th className="w-10 px-3 py-2">
                    <Checkbox
                      checked={resultItems.length > 0 && selectedIds.size === resultItems.length}
                      onCheckedChange={(v) => toggleAll(v === true)}
                      aria-label="Select all"
                    />
                  </th>
                  <th className="w-10 px-1 py-2 font-medium">#</th>
                  <th className="px-3 py-2 font-medium">
                    {t("digitalMarketing.metaAds.interestColName", "Name")}
                  </th>
                  {!audienceOverlapView ? (
                    <th className="px-3 py-2 font-medium">
                      {t("digitalMarketing.metaAds.interestColType", "Type")}
                    </th>
                  ) : null}
                  {!audienceOverlapView ? (
                    <th className="px-3 py-2 font-medium">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-help border-b border-dotted border-muted-foreground/50">
                            {t("digitalMarketing.metaAds.interestColAudienceSize", "Audience Size")}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[220px] text-xs">
                          {t(
                            "digitalMarketing.metaAds.interestAudienceSizeHint",
                            "Ukuran interest global dari katalog Meta. Tidak berubah saat filter lokasi/usia/gender.",
                          )}
                        </TooltipContent>
                      </Tooltip>
                    </th>
                  ) : null}
                  <th className="px-3 py-2 font-medium">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-help border-b border-dotted border-muted-foreground/50">
                          {t("digitalMarketing.metaAds.interestColPotential", "Potential Reach")}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[220px] text-xs">
                        {t(
                          "digitalMarketing.metaAds.interestPotentialHint",
                          "Estimasi jangkauan Meta sesuai filter. Jika semua baris ≤1K, itu batas privasi Meta (bukan angka yang berubah mengikuti umur).",
                        )}
                      </TooltipContent>
                    </Tooltip>
                  </th>
                  {audienceOverlapView ? (
                    <>
                      <th className="px-3 py-2 font-medium">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-help border-b border-dotted border-muted-foreground/50">
                              {t("digitalMarketing.metaAds.interestColOverlapPeople", "Overlap")}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[240px] text-xs">
                            {t(
                              "digitalMarketing.metaAds.interestColOverlapPeopleHint",
                              "Jumlah orang yang masuk seed dan baris ini (AND reachestimate).",
                            )}
                          </TooltipContent>
                        </Tooltip>
                      </th>
                      <th className="px-3 py-2 font-medium">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-help border-b border-dotted border-muted-foreground/50">
                              {t("digitalMarketing.metaAds.interestColPctCom", "% Com.")}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[240px] text-xs">
                            {t(
                              "digitalMarketing.metaAds.interestColPctComHint",
                              "% overlap of comparison audience — persentase audiens baris ini yang juga ada di seed.",
                            )}
                          </TooltipContent>
                        </Tooltip>
                      </th>
                      <th className="px-3 py-2 font-medium">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-help border-b border-dotted border-muted-foreground/50">
                              {t("digitalMarketing.metaAds.interestColPctSel", "% Sel.")}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[240px] text-xs">
                            {t(
                              "digitalMarketing.metaAds.interestColPctSelHint",
                              "% overlap of selected audience — persentase audiens seed yang juga ada di baris ini.",
                            )}
                          </TooltipContent>
                        </Tooltip>
                      </th>
                    </>
                  ) : showOverlapColumn ? (
                    <th className="px-3 py-2 font-medium">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-help">
                            <span className="border-b border-dotted border-muted-foreground/50">
                              {t("digitalMarketing.metaAds.interestColOverlap", "Irisan")}
                            </span>
                            {overlapSeedLabel ? (
                              <span className="mt-0.5 block text-[10px] font-normal leading-tight text-muted-foreground">
                                {t(
                                  "digitalMarketing.metaAds.interestOverlapColWith",
                                  "dengan {{seed}}",
                                  { seed: overlapSeedLabel },
                                )}
                              </span>
                            ) : null}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[240px] text-xs">
                          {t(
                            "digitalMarketing.metaAds.interestOverlapColHint",
                            "Berapa persen audiens baris ini juga termasuk di {{seed}}. Semakin tinggi, semakin mirip.",
                            { seed: overlapSeedLabel },
                          )}
                        </TooltipContent>
                      </Tooltip>
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {resultItems.map((item, index) => {
                  const checked = selectedIds.has(item.id);
                  const row = rowEstimates[item.id];
                  const potential = row?.potential;
                  const pathLabel = targetingPathLabel(item);
                  const reachLoading =
                    (rowsLoading && index < INITIAL_ESTIMATE_COUNT && !potential && !row?.error) ||
                    estimatingRowId === item.id;
                  const hasPotential =
                    potential?.users_lower != null || potential?.users_upper != null;
                  const ov = rowOverlaps[item.id];
                  const overlapLoadingCell =
                    showOverlapColumn &&
                    ((overlapLoading && index < INITIAL_ESTIMATE_COUNT && !ov) ||
                      overlappingRowId === item.id);
                  const andFloor =
                    ov &&
                    isMetaReachPrivacyFloor(ov.and.users_lower, ov.and.users_upper);
                  return (
                    <tr
                      key={item.id}
                      className={cn(
                        "border-b border-gray-100 hover:bg-gray-50/80",
                        checked && "bg-sky-50/60",
                      )}
                    >
                      <td className="px-3 py-2">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => toggleId(item.id)}
                          aria-label={item.name}
                        />
                      </td>
                      <td className="px-1 py-2 tabular-nums text-muted-foreground">{index + 1}</td>
                      <td className="px-3 py-2">
                        <p className="font-medium leading-tight text-gray-900">{item.name}</p>
                        <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">
                          {pathLabel}
                        </p>
                      </td>
                      {!audienceOverlapView ? (
                        <td className="px-3 py-2 capitalize text-muted-foreground">
                          {item.type.replace(/_/g, " ")}
                        </td>
                      ) : null}
                      {!audienceOverlapView ? (
                        <td className="px-3 py-2 tabular-nums text-gray-900">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-help">
                                {formatAudienceSize(
                                  item.audience_size_lower,
                                  item.audience_size_upper,
                                )}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs">
                              {t(
                                "digitalMarketing.metaAds.interestAudienceSizeCellHint",
                                "Global (katalog Meta)",
                              )}
                            </TooltipContent>
                          </Tooltip>
                        </td>
                      ) : null}
                      <td className="px-3 py-2 tabular-nums text-gray-900">
                        {reachLoading ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                        ) : row?.error ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs text-destructive"
                                disabled={Boolean(estimatingRowId) || rowsLoading}
                                onClick={() => void runEstimateRow(item)}
                              >
                                {t("digitalMarketing.metaAds.interestDailyError", "Retry")}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-[260px] text-xs">
                              {row.error}
                            </TooltipContent>
                          </Tooltip>
                        ) : hasPotential ? (
                          <span className="inline-flex items-center gap-1">
                            <span>
                              {formatAudienceSize(
                                potential?.users_lower ?? null,
                                potential?.users_upper ?? null,
                              )}
                            </span>
                            {isMetaReachPrivacyFloor(
                              potential?.users_lower,
                              potential?.users_upper,
                            ) ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    className="inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
                                    aria-label={t(
                                      "digitalMarketing.metaAds.interestPotentialFloorTitle",
                                      "Potential Reach terpotong di ≤1K",
                                    )}
                                  >
                                    <Info className="h-3.5 w-3.5" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-[260px] text-xs">
                                  {t(
                                    "digitalMarketing.metaAds.interestPotentialFloorHint",
                                    "Meta tidak merilis estimasi di bawah 1.000 untuk targeting ini. Umur 18–35 vs 18–65 bisa tampil sama karena keduanya terpotong di lantai privasi, bukan karena jangkauannya identik.",
                                  )}
                                </TooltipContent>
                              </Tooltip>
                            ) : null}
                          </span>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            className="h-7 px-2 text-xs"
                            disabled={Boolean(estimatingRowId) || rowsLoading}
                            onClick={() => void runEstimateRow(item)}
                          >
                            <Target className="mr-1 h-3 w-3" />
                            {t("digitalMarketing.metaAds.interestEstimateRow", "Estimate")}
                          </Button>
                        )}
                      </td>
                      {audienceOverlapView ? (
                        <>
                          <td className="px-3 py-2 tabular-nums text-gray-900">
                            <OverlapCellFrame
                              loading={overlapLoadingCell}
                              ov={ov}
                              andFloor={Boolean(andFloor)}
                              retryDisabled={Boolean(overlappingRowId) || overlapLoading}
                              onRetry={() => void runOverlapRow(item)}
                            >
                              {(rowOv) => (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="cursor-help font-medium tabular-nums">
                                      {formatAudienceSize(rowOv.and.users_lower, rowOv.and.users_upper)}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-[240px] text-xs">
                                    {t(
                                      "digitalMarketing.metaAds.interestColOverlapPeopleHint",
                                      "Jumlah orang yang masuk seed dan baris ini (AND reachestimate).",
                                    )}
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </OverlapCellFrame>
                          </td>
                          <td className="px-3 py-2 tabular-nums text-gray-900">
                            <OverlapCellFrame
                              loading={overlapLoadingCell}
                              ov={ov}
                              andFloor={Boolean(andFloor)}
                              retryDisabled={Boolean(overlappingRowId) || overlapLoading}
                              onRetry={() => void runOverlapRow(item)}
                            >
                              {(rowOv) =>
                                rowOv.pct != null ? (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="cursor-help font-medium tabular-nums">
                                        {Math.round(rowOv.pct)}%
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="max-w-[240px] text-xs">
                                      {t(
                                        "digitalMarketing.metaAds.interestPctComCellHint",
                                        "{{pct}}% audiens baris ini juga termasuk di {{seed}}.",
                                        {
                                          pct: Math.round(rowOv.pct),
                                          seed: overlapSeedLabel,
                                        },
                                      )}
                                    </TooltipContent>
                                  </Tooltip>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )
                              }
                            </OverlapCellFrame>
                          </td>
                          <td className="px-3 py-2 tabular-nums text-gray-900">
                            <OverlapCellFrame
                              loading={overlapLoadingCell}
                              ov={ov}
                              andFloor={Boolean(andFloor)}
                              retryDisabled={Boolean(overlappingRowId) || overlapLoading}
                              onRetry={() => void runOverlapRow(item)}
                            >
                              {(rowOv) =>
                                rowOv.pct_sel != null ? (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="cursor-help font-medium tabular-nums">
                                        {Math.round(rowOv.pct_sel)}%
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="max-w-[240px] text-xs">
                                      {t(
                                        "digitalMarketing.metaAds.interestPctSelCellHint",
                                        "{{pct}}% audiens {{seed}} juga termasuk di baris ini.",
                                        {
                                          pct: Math.round(rowOv.pct_sel),
                                          seed: overlapSeedLabel,
                                        },
                                      )}
                                    </TooltipContent>
                                  </Tooltip>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )
                              }
                            </OverlapCellFrame>
                          </td>
                        </>
                      ) : showOverlapColumn ? (
                        <td className="px-3 py-2 tabular-nums text-gray-900">
                          <OverlapCellFrame
                            loading={overlapLoadingCell}
                            ov={ov}
                            andFloor={Boolean(andFloor)}
                            retryDisabled={Boolean(overlappingRowId) || overlapLoading}
                            onRetry={() => void runOverlapRow(item)}
                          >
                            {(rowOv) =>
                              rowOv.pct != null ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="inline-flex cursor-help flex-col leading-tight">
                                      <span className="font-medium tabular-nums">
                                        {Math.round(rowOv.pct)}%
                                      </span>
                                      <span className="mt-0.5 text-[11px] font-normal tabular-nums text-muted-foreground">
                                        {formatAudienceSize(
                                          rowOv.and.users_lower,
                                          rowOv.and.users_upper,
                                        )}
                                      </span>
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-[240px] text-xs">
                                    {t(
                                      "digitalMarketing.metaAds.interestOverlapCellHint",
                                      "{{pct}}% audiens baris ini juga termasuk di {{seed}} (sekitar {{people}} orang).",
                                      {
                                        pct: Math.round(rowOv.pct),
                                        seed: overlapSeedLabel,
                                        people: formatAudienceSize(
                                          rowOv.and.users_lower,
                                          rowOv.and.users_upper,
                                        ),
                                      },
                                    )}
                                  </TooltipContent>
                                </Tooltip>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )
                            }
                          </OverlapCellFrame>
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
                {resultItems.length === 0 && !searchQuery.isFetching ? (
                  <tr>
                    <td colSpan={audienceOverlapView ? 7 : showOverlapColumn ? 7 : 6} className="px-3 py-8 text-center text-muted-foreground">
                      {t("digitalMarketing.metaAds.interestNoResults", "No results")}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </TooltipProvider>
        )}
          </>
        )}
        <div
          className="h-2 flex-shrink-0 [@media(max-height:900px)]:h-3 [@media(max-height:760px)]:h-4"
          aria-hidden
        />
      </div>
    </div>
    </TooltipProvider>
  );
}
