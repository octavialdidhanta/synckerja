import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchMetaAdsOverlapRows,
  locationsFingerprintClient,
  metaAdsOverlapPairQueryKey,
  officialReachCount,
  useMetaAdsTargetingEstimate,
  useMetaAdsTargetingEstimateRows,
  type InterestResearchFilters,
  type MetaTargetingItem,
} from "@/meta-ads/hooks/useMetaAdsTargeting";
import { POPULATION_UNION_ITEM_CAP } from "./populationBudgetMath";

const FILTER_DEBOUNCE_MS = 400;
const OVERLAP_STALE_MS = 30 * 60 * 1000;

export function populationFromEstimate(estimate: {
  users_lower?: number | null;
  users_upper?: number | null;
} | null | undefined): number | null {
  return officialReachCount(estimate);
}

export type PopulationSourceRow = {
  id: string;
  name: string;
  type?: string;
  reach: number | null;
  overlapPct?: number | null;
  error?: string;
};

export function useInterestResearchPopulationReach(args: {
  enabled: boolean;
  organizationId: string;
  adAccountId: string;
  filters: InterestResearchFilters | null;
  items: MetaTargetingItem[];
  targetingGroups?: MetaTargetingItem[][];
}) {
  const estimateMutation = useMetaAdsTargetingEstimate();
  const estimateRowsMutation = useMetaAdsTargetingEstimateRows();
  const [population, setPopulation] = useState<number | null>(null);
  const [sources, setSources] = useState<PopulationSourceRow[]>([]);
  const [officialOverlap, setOfficialOverlap] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const cappedItems = useMemo(
    () => args.items.slice(0, POPULATION_UNION_ITEM_CAP),
    [args.items],
  );
  const groupedTargets = useMemo(
    () => (args.targetingGroups ?? []).map((group) => group.filter((item) => item.id)).filter((group) => group.length > 0),
    [args.targetingGroups],
  );
  const groupedMode = groupedTargets.length >= 2;
  const pairMode = cappedItems.length === 2 && !groupedMode;
  const seedItem = cappedItems[0];
  const comparisonItem = cappedItems[1];

  const overlapPairQuery = useQuery({
    queryKey:
      args.filters && seedItem && comparisonItem
        ? metaAdsOverlapPairQueryKey({
            organizationId: args.organizationId,
            adAccountId: args.adAccountId,
            filters: args.filters,
            seedId: seedItem.id,
            comparisonId: comparisonItem.id,
          })
        : ["meta-ads-overlap-pair", "idle"],
    enabled: Boolean(
      args.enabled && args.organizationId && args.adAccountId && args.filters && pairMode,
    ),
    staleTime: OVERLAP_STALE_MS,
    gcTime: OVERLAP_STALE_MS,
    queryFn: async () => {
      const res = await fetchMetaAdsOverlapRows({
        organizationId: args.organizationId,
        adAccountId: args.adAccountId,
        filters: args.filters!,
        seed: [
          {
            id: seedItem.id,
            name: seedItem.name,
            type: seedItem.type,
            path: seedItem.path,
          },
        ],
        items: [
          {
            id: comparisonItem.id,
            name: comparisonItem.name,
            type: comparisonItem.type,
            path: comparisonItem.path,
          },
        ],
      });
      const row = (res.rows ?? []).find((item) => item.id === comparisonItem.id) ?? res.rows?.[0];
      if (!res.seed || !row) throw new Error("Overlap estimate unavailable");
      return { seed: res.seed, row };
    },
  });

  const filtersKey = args.filters
    ? [
        args.filters.countryCode,
        args.filters.gender,
        args.filters.ageMin,
        args.filters.ageMax,
        args.filters.placement,
        locationsFingerprintClient(args.filters.locations ?? []),
      ].join("|")
    : "";

  const itemsKey = `${cappedItems.map((item) => item.id).sort().join(",")}|${groupedTargets
    .map((group) => group.map((item) => item.id).sort().join("+"))
    .join(";")}`;

  useEffect(() => {
    if (!pairMode || !overlapPairQuery.data || cappedItems.length !== 2) return;
    const { seed, row } = overlapPairQuery.data;
    const seedReach = officialReachCount(seed);
    const comparisonReach = officialReachCount(row.comparison_users ?? row.b);
    const overlap = officialReachCount(row.and);
    const nextSources: PopulationSourceRow[] = [
      {
        id: cappedItems[0].id,
        name: cappedItems[0].name || cappedItems[0].id,
        type: cappedItems[0].type,
        reach: seedReach,
        overlapPct: row.pct_sel ?? null,
      },
      {
        id: cappedItems[1].id,
        name: cappedItems[1].name || cappedItems[1].id,
        type: cappedItems[1].type,
        reach: comparisonReach,
        overlapPct: row.pct_com ?? row.pct ?? null,
      },
    ];
    const rowSum = (seedReach ?? 0) + (comparisonReach ?? 0);
    const largest = Math.max(seedReach ?? 0, comparisonReach ?? 0);
    const unique =
      overlap != null && rowSum > 0 ? Math.max(largest, rowSum - overlap) : seedReach;
    setSources(nextSources);
    setOfficialOverlap(overlap);
    setPopulation(unique);
    setError(overlapPairQuery.error instanceof Error ? overlapPairQuery.error.message : null);
    setLoading(false);
  }, [pairMode, overlapPairQuery.data, overlapPairQuery.error, cappedItems]);

  useEffect(() => {
    if (pairMode) return;
    if (!args.enabled || !args.organizationId || !args.adAccountId || !args.filters || !cappedItems.length) {
      setPopulation(null);
      setSources([]);
      setOfficialOverlap(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    const requestId = ++requestIdRef.current;
    const filters = args.filters;
    const timer = window.setTimeout(() => {
      const payloadItems = cappedItems.map((item) => ({
        id: item.id,
        name: item.name,
        type: item.type,
        path: item.path,
        audience_size_lower: item.audience_size_lower,
        audience_size_upper: item.audience_size_upper,
      }));
      const unionReq = estimateMutation.mutateAsync({
        organizationId: args.organizationId,
        adAccountId: args.adAccountId,
        filters,
        items: cappedItems,
        union: !groupedMode,
        ...(groupedMode ? { groups: groupedTargets } : {}),
      });
      const rowsReq = estimateRowsMutation.mutateAsync({
        organizationId: args.organizationId,
        adAccountId: args.adAccountId,
        filters,
        items: payloadItems,
      });

      void Promise.allSettled([unionReq, rowsReq]).then(([unionRes, rowsRes]) => {
        if (requestId !== requestIdRef.current) return;

        let nextSources: PopulationSourceRow[] = cappedItems.map((item) => ({
          id: item.id,
          name: item.name || item.id,
          type: item.type,
          reach: null,
        }));

        if (rowsRes.status === "fulfilled") {
          const byId = new Map((rowsRes.value.rows ?? []).map((row) => [row.id, row]));
          nextSources = cappedItems.map((item) => {
            const row = byId.get(item.id);
            return {
              id: item.id,
              name: item.name || item.id,
              type: item.type,
              reach: officialReachCount(row?.potential),
              error: row?.error,
            };
          });
        }

        const unionReach =
          unionRes.status === "fulfilled" ? officialReachCount(unionRes.value.estimate) : null;
        if (unionRes.status === "rejected" && unionReach == null) {
          setError(unionRes.reason instanceof Error ? unionRes.reason.message : String(unionRes.reason));
        } else {
          setError(null);
        }

        setSources(nextSources);
        setOfficialOverlap(null);
        setPopulation(unionReach);
        setLoading(false);
      });
    }, FILTER_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      requestIdRef.current += 1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    pairMode,
    overlapPairQuery.isFetching,
    overlapPairQuery.data,
    args.enabled,
    args.organizationId,
    args.adAccountId,
    filtersKey,
    itemsKey,
  ]);

  return {
    population,
    sources,
    officialOverlap,
    loading: pairMode ? overlapPairQuery.isFetching && !overlapPairQuery.data : loading,
    error: pairMode
      ? overlapPairQuery.error instanceof Error
        ? overlapPairQuery.error.message
        : error
      : error,
    cappedItems,
    truncated: args.items.length > POPULATION_UNION_ITEM_CAP,
  };
}
