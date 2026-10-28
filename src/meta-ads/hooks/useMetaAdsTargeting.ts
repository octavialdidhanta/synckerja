import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { parseEdgeFunctionError } from "@/meta-ads/lib/parseEdgeFunctionError";
import { supabase } from "@/shared/lib/supabaseClient";

export type MetaTargetingType =
  | "interest"
  | "behavior"
  | "demographic"
  | "life_event"
  | "industry"
  | "income"
  | "family_status"
  | "work_employer"
  | "other";

export type MetaTargetingItem = {
  id: string;
  name: string;
  type: MetaTargetingType;
  path: string[];
  audience_size_lower: number | null;
  audience_size_upper: number | null;
  description: string | null;
};

export type MetaReachEstimate = {
  estimate_ready: boolean;
  users_lower: number | null;
  users_upper: number | null;
  estimate_dau_lower: number | null;
  estimate_dau_upper: number | null;
};

export type MetaInterestList = {
  id: string;
  name: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  meta_ads_interest_list_items?: Array<{ count: number }> | { count: number };
};

export type MetaInterestListItem = {
  id: string;
  list_id: string;
  meta_targeting_id: string;
  name: string;
  type: string;
  path: unknown;
  audience_size_lower: number | null;
  audience_size_upper: number | null;
  sort_order: number;
};

async function invokeTargeting<T>(
  organizationId: string,
  action: string,
  extra?: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await supabase.functions.invoke("meta-ads-targeting", {
    body: { action, organization_id: organizationId, ...extra },
  });
  if (error) throw await parseEdgeFunctionError(error, data);
  const payload = data as { error?: string } & T;
  if (payload && typeof payload === "object" && "error" in payload && payload.error) {
    throw await parseEdgeFunctionError(null, payload);
  }
  return payload;
}

function mergeTargetingSearchItems(groups: MetaTargetingItem[][]): MetaTargetingItem[] {
  const hits = new Map<string, { item: MetaTargetingItem; count: number; firstIndex: number }>();
  let order = 0;
  for (const items of groups) {
    for (const item of items) {
      const prev = hits.get(item.id);
      if (!prev) {
        hits.set(item.id, { item, count: 1, firstIndex: order++ });
        continue;
      }
      prev.count += 1;
      const prevSize = prev.item.audience_size_upper ?? prev.item.audience_size_lower ?? 0;
      const nextSize = item.audience_size_upper ?? item.audience_size_lower ?? 0;
      if (nextSize > prevSize) prev.item = item;
    }
  }
  return [...hits.values()]
    .sort((a, b) => b.count - a.count || a.firstIndex - b.firstIndex)
    .map((entry) => entry.item);
}

export function useMetaAdsTargetingSearch(args: {
  organizationId: string | null | undefined;
  adAccountId: string;
  q?: string;
  queries?: string[];
  typeFilter: string;
  enabled?: boolean;
}) {
  const { organizationId, adAccountId, q, queries, typeFilter, enabled = true } = args;
  const uniqueQueries = [
    ...new Set(
      (queries?.length ? queries : q ? [q] : [])
        .map((term) => term.trim())
        .filter((term) => term.length >= 2),
    ),
  ];
  const results = useQueries({
    queries: uniqueQueries.map((trimmed) => ({
      queryKey: ["meta-ads-targeting-search", organizationId, adAccountId, trimmed, typeFilter],
      enabled: Boolean(organizationId && adAccountId && enabled),
      staleTime: 5 * 60 * 1000,
      queryFn: () =>
        invokeTargeting<{ items: MetaTargetingItem[]; cached?: boolean }>(
          organizationId!,
          "search",
          { ad_account_id: adAccountId, q: trimmed, type_filter: typeFilter },
        ),
    })),
  });
  const items = mergeTargetingSearchItems(results.map((result) => result.data?.items ?? []));
  const errorResult = results.find((result) => result.error);
  return {
    data: uniqueQueries.length ? { items } : undefined,
    isPending: uniqueQueries.length > 0 && results.some((result) => result.isPending),
    isFetching: results.some((result) => result.isFetching),
    isError: Boolean(errorResult) && items.length === 0,
    error: errorResult?.error ?? null,
    queries: uniqueQueries,
    refetch: () => Promise.all(results.map((result) => result.refetch())),
  };
}

export function useMetaAdsTargetingSuggest() {
  return useMutation({
    mutationFn: (args: {
      organizationId: string;
      adAccountId: string;
      interestList: string[];
      items?: Array<{ id: string; name: string; type?: string; path?: string[] }>;
      context?: string[];
    }) =>
      invokeTargeting<{ items: MetaTargetingItem[] }>(args.organizationId, "suggest", {
        ad_account_id: args.adAccountId,
        interest_list: args.interestList,
        items: args.items,
        context: args.context,
        force_refresh: true,
      }),
  });
}

export type MetaDeliverySummary = {
  mau_lower: number | null;
  mau_upper: number | null;
  estimate_ready: boolean | null;
  curve_available: boolean;
};

export type MetaOverlapUsersRange = {
  lower: number | null;
  upper: number | null;
  mid: number;
};

export type InterestResearchGender = "all" | "male" | "female";
export type InterestResearchObjective =
  | "conversions"
  | "traffic"
  | "awareness"
  | "engagement";
export type InterestResearchPlacement =
  | "automatic"
  | "facebook"
  | "instagram"
  | "audience_network"
  | "messenger";

export type MetaGeoLocation = {
  key: string;
  name: string;
  type: string;
  country_code?: string | null;
  country_name?: string | null;
  region?: string | null;
  region_id?: number | null;
  primary_city?: string | null;
  supports_city?: boolean | null;
  supports_region?: boolean | null;
  geo_hierarchy_level?: string | null;
  geo_hierarchy_name?: string | null;
  display_name?: string | null;
  address_string?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  selectable?: boolean;
  /** Kilometers around this location. Cities: 17–80. Pins: 1–80. */
  radius_km?: number | null;
};

export type InterestResearchFilters = {
  countryCode: string;
  gender: InterestResearchGender;
  ageMin: number;
  ageMax: number;
  /** Major currency units for display (e.g. 10 USD or 150000 IDR). Echoed to API; not used to invent DAU. */
  dailyBudget: number;
  currency: string;
  objective: InterestResearchObjective;
  placement: InterestResearchPlacement;
  /** Granular Meta geo selections; empty → fallback countryCode. */
  locations: MetaGeoLocation[];
};

/** Meta Ads Manager: 18–65+ maps to targeting age_min 18, age_max 65 (65 includes older). */
export const META_TARGETING_AGE_MIN = 18;
export const META_TARGETING_AGE_MAX = 65;

export function sanitizeMetaAgeRange(ageMin: unknown, ageMax: unknown): { ageMin: number; ageMax: number } {
  const toInt = (v: unknown, fallback: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.round(n) : fallback;
  };
  const min = Math.max(
    META_TARGETING_AGE_MIN,
    Math.min(META_TARGETING_AGE_MAX, toInt(ageMin, META_TARGETING_AGE_MIN)),
  );
  const max = Math.max(
    min,
    Math.min(META_TARGETING_AGE_MAX, toInt(ageMax, META_TARGETING_AGE_MAX)),
  );
  return { ageMin: min, ageMax: max };
}

export const DEFAULT_INTEREST_RESEARCH_FILTERS: InterestResearchFilters = {
  countryCode: "ID",
  gender: "all",
  ageMin: META_TARGETING_AGE_MIN,
  ageMax: META_TARGETING_AGE_MAX,
  dailyBudget: 150_000,
  currency: "IDR",
  objective: "conversions",
  placement: "automatic",
  locations: [],
};

export function interestResearchFiltersPayload(filters: InterestResearchFilters): Record<string, unknown> {
  const age = sanitizeMetaAgeRange(filters.ageMin, filters.ageMax);
  return {
    country_code: filters.countryCode,
    gender: filters.gender,
    age_min: age.ageMin,
    age_max: age.ageMax,
    daily_budget: filters.dailyBudget,
    objective: filters.objective,
    placement: filters.placement,
    locations: filters.locations ?? [],
  };
}

export function locationsFingerprintClient(locations: MetaGeoLocation[]): string {
  return (locations ?? [])
    .map((l) => `${l.type}:${l.key}:${l.radius_km ?? ""}:${l.latitude ?? ""}:${l.longitude ?? ""}`)
    .sort()
    .join(",");
}

const GEO_RADIUS_MAX_KM = 80;
export const META_CITY_RADIUS_MIN_KM = 17;
export const META_PIN_RADIUS_MIN_KM = 1;
export const META_CITY_RADIUS_OPTIONS_KM = [17, 25, 40, 50, 80] as const;
export const META_PIN_RADIUS_OPTIONS_KM = [1, 2, 5, 10, 17, 25, 40, 50, 80] as const;
export const META_GEO_RADIUS_NONE = "none";

export function isFacebookPlaceKey(key: string | null | undefined): boolean {
  return /^\d{6,}$/.test(String(key ?? ""));
}

export function locationUsesPinRadius(loc: MetaGeoLocation): boolean {
  const key = String(loc.key ?? "");
  if (key.startsWith("osm:") || key.startsWith("pin:") || key.startsWith("gplace:")) return true;
  const type = String(loc.type ?? "").toLowerCase();
  return type === "address" || type === "place" || type === "landmark";
}

export function makeMapPinLocation(args: {
  lat: number;
  lng: number;
  label: string;
  radiusKm?: number;
  countryCode?: string | null;
  key?: string;
  type?: "place" | "address";
}): MetaGeoLocation {
  const lat = Number(args.lat.toFixed(5));
  const lng = Number(args.lng.toFixed(5));
  const name = args.label.trim() || `${lat}, ${lng}`;
  return {
    key: args.key ?? `pin:${lat},${lng}`,
    name,
    type: args.type ?? "address",
    country_code: args.countryCode ?? null,
    display_name: name,
    address_string: name,
    latitude: lat,
    longitude: lng,
    selectable: true,
    radius_km: args.radiusKm ?? 2,
  };
}

export function locationAllowsRadius(loc: MetaGeoLocation): boolean {
  const type = String(loc.type ?? "").toLowerCase();
  if (["country", "country_group", "region", "zip", "geo_market"].includes(type)) return false;
  const name = loc.name.trim().toLowerCase();
  if (name === "indonesia" || name === loc.country_name?.trim().toLowerCase()) {
    if (type === "place" || type === "landmark") return false;
  }
  return loc.selectable !== false;
}

export function locationRadiusMinKm(loc: MetaGeoLocation): number {
  return locationUsesPinRadius(loc) ? META_PIN_RADIUS_MIN_KM : META_CITY_RADIUS_MIN_KM;
}

export function clampLocationRadiusKm(loc: MetaGeoLocation, km: number): number {
  const n = Number.isFinite(km) ? Math.round(km) : locationRadiusMinKm(loc);
  return Math.min(GEO_RADIUS_MAX_KM, Math.max(locationRadiusMinKm(loc), n));
}

export function useMetaAdsGeoSearch(args: {
  organizationId: string | null | undefined;
  adAccountId: string;
  q: string;
  countryCode?: string;
  enabled?: boolean;
}) {
  const { organizationId, adAccountId, q, countryCode = "ID", enabled = true } = args;
  const trimmed = q.trim();
  return useQuery({
    queryKey: ["meta-ads-geo-search", "v19", organizationId, adAccountId, trimmed, countryCode],
    enabled: Boolean(organizationId && adAccountId && trimmed.length >= 2 && enabled),
    staleTime: 30 * 1000,
    queryFn: () =>
      invokeTargeting<{ locations: MetaGeoLocation[]; cached?: boolean }>(
        organizationId!,
        "geoSearch",
        {
          ad_account_id: adAccountId,
          q: trimmed,
          country_code: countryCode,
          force_refresh: true,
        },
      ),
  });
}

export type MetaEstimateRow = {
  id: string;
  name?: string;
  audience_size_lower: number | null;
  audience_size_upper: number | null;
  potential: MetaReachEstimate;
  daily: { lower: number | null; upper: number | null } | null;
  daily_source: string | null;
  delivery_summary: MetaDeliverySummary;
  error?: string;
};

export type MetaOverlapRow = {
  id: string;
  and: {
    users_lower: number | null;
    users_upper: number | null;
    estimate_ready?: boolean;
  };
  pct: number | null;
  error?: string;
};

export function useMetaAdsGeoAudienceEstimate(args: {
  organizationId: string | null | undefined;
  adAccountId: string;
  filters: InterestResearchFilters;
  enabled?: boolean;
}) {
  const { organizationId, adAccountId, filters, enabled = true } = args;
  const age = sanitizeMetaAgeRange(filters.ageMin, filters.ageMax);
  const locFp = locationsFingerprintClient(filters.locations ?? []);
  return useQuery({
    queryKey: [
      "meta-ads-geo-audience",
      "v2",
      organizationId,
      adAccountId,
      filters.countryCode,
      filters.gender,
      age.ageMin,
      age.ageMax,
      filters.placement,
      locFp,
    ],
    enabled: Boolean(organizationId && adAccountId && enabled),
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
    queryFn: () =>
      invokeTargeting<{
        estimate: MetaReachEstimate;
        country_code: string;
      }>(organizationId!, "estimate", {
        ad_account_id: adAccountId,
        items: [],
        force_refresh: true,
        ...interestResearchFiltersPayload(filters),
      }),
  });
}

export function useMetaAdsTargetingEstimate() {
  return useMutation({
    mutationFn: (args: {
      organizationId: string;
      adAccountId: string;
      filters?: InterestResearchFilters;
      countryCode?: string;
      items: Array<{ id: string; name?: string; type?: string; path?: string[] }>;
    }) => {
      const filters = args.filters ?? {
        ...DEFAULT_INTEREST_RESEARCH_FILTERS,
        countryCode: args.countryCode ?? "ID",
      };
      return invokeTargeting<{
        estimate: MetaReachEstimate;
        daily: { lower: number | null; upper: number | null } | null;
        daily_source: string | null;
        delivery_summary: MetaDeliverySummary;
        country_code: string;
        objective_downgraded?: boolean;
      }>(args.organizationId, "estimate", {
        ad_account_id: args.adAccountId,
        items: args.items,
        ...interestResearchFiltersPayload(filters),
      });
    },
  });
}

export function useMetaAdsTargetingEstimateRows() {
  return useMutation({
    mutationFn: (args: {
      organizationId: string;
      adAccountId: string;
      filters: InterestResearchFilters;
      items: Array<{
        id: string;
        name?: string;
        type?: string;
        path?: string[];
        audience_size_lower?: number | null;
        audience_size_upper?: number | null;
      }>;
      forceRefresh?: boolean;
    }) =>
      invokeTargeting<{
        rows: MetaEstimateRow[];
        country_code: string;
        filters?: Record<string, unknown>;
      }>(args.organizationId, "estimate_rows", {
        ad_account_id: args.adAccountId,
        items: args.items,
        force_refresh: args.forceRefresh === true,
        ...interestResearchFiltersPayload(args.filters),
      }),
  });
}

export function useMetaAdsTargetingOverlapRows() {
  return useMutation({
    mutationFn: (args: {
      organizationId: string;
      adAccountId: string;
      filters: InterestResearchFilters;
      seed: Array<{ id: string; name?: string; type?: string; path?: string[] }>;
      items: Array<{
        id: string;
        name?: string;
        type?: string;
        path?: string[];
        potential_lower?: number | null;
        potential_upper?: number | null;
      }>;
      forceRefresh?: boolean;
    }) =>
      invokeTargeting<{
        rows: MetaOverlapRow[];
        seed_ids: string[];
        country_code: string;
      }>(args.organizationId, "overlap_rows", {
        ad_account_id: args.adAccountId,
        seed: args.seed,
        items: args.items,
        force_refresh: args.forceRefresh === true,
        ...interestResearchFiltersPayload(args.filters),
      }),
  });
}

export function useMetaAdsTargetingOverlap() {
  return useMutation({
    mutationFn: (args: {
      organizationId: string;
      adAccountId: string;
      filters?: InterestResearchFilters;
      countryCode?: string;
      a: { id: string; name?: string; type?: string; path?: string[] };
      b: { id: string; name?: string; type?: string; path?: string[] };
    }) => {
      const filters = args.filters ?? {
        ...DEFAULT_INTEREST_RESEARCH_FILTERS,
        countryCode: args.countryCode ?? "ID",
      };
      return invokeTargeting<{
        approximate: boolean;
        method?: "and_reachestimate";
        overlap_users: number;
        overlap_pct_of_smaller: number | null;
        a: MetaReachEstimate;
        b: MetaReachEstimate;
        intersection?: MetaReachEstimate;
        a_users: MetaOverlapUsersRange;
        b_users: MetaOverlapUsersRange;
        intersection_users: MetaOverlapUsersRange;
        union_users?: MetaOverlapUsersRange;
        a_label: string;
        b_label: string;
        note?: string;
        country_code?: string;
      }>(args.organizationId, "overlap", {
        ad_account_id: args.adAccountId,
        a: args.a,
        b: args.b,
        ...interestResearchFiltersPayload(filters),
      });
    },
  });
}

export function useMetaAdsTargetingSpike() {
  return useMutation({
    mutationFn: (args: { organizationId: string; adAccountId: string; countryCode?: string }) =>
      invokeTargeting<{
        ok: boolean;
        pages_targeting_go: boolean;
        daily_reach_available?: boolean;
        report: {
          ok: boolean;
          pages_targeting_go: boolean;
          daily_reach_available?: boolean;
          checks: Array<{ name: string; ok: boolean; detail: string }>;
        };
      }>(args.organizationId, "spike", {
        ad_account_id: args.adAccountId,
        country_code: args.countryCode ?? "ID",
      }),
  });
}

export function useMetaAdsCreateAdDraft() {
  return useMutation({
    mutationFn: (args: {
      organizationId: string;
      adAccountId: string;
      countryCode?: string;
      filters?: InterestResearchFilters;
      items: Array<{ id: string; name?: string; type?: string; path?: string[] }>;
      campaignName?: string;
      adsetName?: string;
      dailyBudget?: number;
      campaignId?: string;
    }) => {
      const filters = args.filters ?? {
        ...DEFAULT_INTEREST_RESEARCH_FILTERS,
        countryCode: args.countryCode ?? "ID",
      };
      return invokeTargeting<{
        campaign_id: string;
        adset_id: string;
        status: string;
        note?: string;
      }>(args.organizationId, "createAdDraft", {
        ad_account_id: args.adAccountId,
        items: args.items,
        campaign_name: args.campaignName,
        adset_name: args.adsetName,
        daily_budget: args.dailyBudget,
        campaign_id: args.campaignId,
        ...interestResearchFiltersPayload(filters),
      });
    },
  });
}

export function useMetaAdsInterestLists(organizationId: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: ["meta-ads-interest-lists", organizationId],
    enabled: Boolean(organizationId && enabled),
    queryFn: () =>
      invokeTargeting<{ lists: MetaInterestList[] }>(organizationId!, "listLists"),
  });
}

export function useMetaAdsInterestListDetail(
  organizationId: string | null | undefined,
  listId: string | null,
  enabled = true,
) {
  return useQuery({
    queryKey: ["meta-ads-interest-list", organizationId, listId],
    enabled: Boolean(organizationId && listId && enabled),
    queryFn: () =>
      invokeTargeting<{ list: MetaInterestList; items: MetaInterestListItem[] }>(
        organizationId!,
        "getList",
        { list_id: listId },
      ),
  });
}

export function useMetaAdsInterestListMutations(organizationId: string | null | undefined) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["meta-ads-interest-lists", organizationId] });
    void queryClient.invalidateQueries({ queryKey: ["meta-ads-interest-list", organizationId] });
  };

  const createList = useMutation({
    mutationFn: (name: string) =>
      invokeTargeting<{ list: MetaInterestList }>(organizationId!, "createList", { name }),
    onSuccess: invalidate,
  });

  const renameList = useMutation({
    mutationFn: (args: { listId: string; name: string }) =>
      invokeTargeting<{ list: MetaInterestList }>(organizationId!, "renameList", {
        list_id: args.listId,
        name: args.name,
      }),
    onSuccess: invalidate,
  });

  const deleteList = useMutation({
    mutationFn: (listId: string) =>
      invokeTargeting<{ ok: boolean }>(organizationId!, "deleteList", { list_id: listId }),
    onSuccess: invalidate,
  });

  const addItems = useMutation({
    mutationFn: (args: { listId: string; items: MetaTargetingItem[] }) =>
      invokeTargeting<{ ok: boolean; added: number }>(organizationId!, "addListItems", {
        list_id: args.listId,
        items: args.items,
      }),
    onSuccess: invalidate,
  });

  const removeItem = useMutation({
    mutationFn: (args: { listId: string; itemId: string }) =>
      invokeTargeting<{ ok: boolean }>(organizationId!, "removeListItem", {
        list_id: args.listId,
        item_id: args.itemId,
      }),
    onSuccess: invalidate,
  });

  return { createList, renameList, deleteList, addItems, removeItem };
}

/** Meta will not publish reach below this; Ads Manager shows it as &lt;1,000. */
export const META_REACH_PRIVACY_FLOOR = 1000;

export function isMetaReachPrivacyFloor(
  lower: number | null | undefined,
  upper: number | null | undefined,
): boolean {
  const vals = [lower, upper].filter(
    (n): n is number => n != null && Number.isFinite(n) && n > 0,
  );
  if (vals.length === 0) return false;
  return vals.every((n) => n <= META_REACH_PRIVACY_FLOOR);
}

export function formatAudienceSize(lower: number | null, upper: number | null): string {
  if (lower == null && upper == null) return "—";
  if (isMetaReachPrivacyFloor(lower, upper)) return "≤1K";
  const fmt = (n: number) => {
    const abs = Math.abs(n);
    if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
    if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(Math.round(n));
  };
  if (lower != null && upper != null && lower !== upper) return `${fmt(lower)}–${fmt(upper)}`;
  return fmt(lower ?? upper ?? 0);
}

/** Full integer formatting like Adsumo Audience Size (705,993,360). */
export function formatAudienceSizeExact(lower: number | null, upper: number | null): string {
  if (lower == null && upper == null) return "—";
  const fmt = (n: number) => Math.round(n).toLocaleString("en-US");
  if (lower != null && upper != null && lower !== upper) return `${fmt(lower)}–${fmt(upper)}`;
  return fmt(lower ?? upper ?? 0);
}

export function midBound(lower: number | null, upper: number | null): number | null {
  if (lower != null && upper != null) return (lower + upper) / 2;
  return lower ?? upper ?? null;
}

export function targetingItemsToCsv(items: MetaTargetingItem[]): string {
  const header = "id,name,type,path,audience_size_lower,audience_size_upper";
  const rows = items.map((i) =>
    [
      i.id,
      JSON.stringify(i.name),
      i.type,
      JSON.stringify((i.path ?? []).join(" > ")),
      i.audience_size_lower ?? "",
      i.audience_size_upper ?? "",
    ].join(","),
  );
  return [header, ...rows].join("\n");
}
