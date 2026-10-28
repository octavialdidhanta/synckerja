/// <reference path="../edge-runtime.d.ts" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  getUserFromBearer,
  metaAdsCorsHeaders,
  metaAdsJson,
  readPlatformMetaAdsOAuth,
} from "../_shared/metaAdsAuth.ts";
import { metaActId, resolveOrgMetaAdsForTargeting } from "../_shared/metaAdsOrgResolver.ts";
import {
  applyOfficialPotential,
  buildInterestTargetingSpec,
  buildIntersectionTargetingSpec,
  createPausedInterestAdDraft,
  deliveryEstimate,
  extractDailyReachBounds,
  firstDeliveryRow,
  isInvalidTargetingGraphError,
  isMetaReachPrivacyFloor,
  locationsFingerprint,
  mapObjectiveToOptimizationGoal,
  parseMetaGeoLocations,
  reachEstimate,
  resolveLocationsForEstimate,
  resolveSuggestedInterests,
  runTargetingSpike,
  rankSearchItems,
  searchActTargeting,
  searchAdGeoLocations,
  searchAdInterests,
  searchAdWorkEmployers,
  searchQueryVariants,
  searchTargetingCategory,
  exploreRelatedInterests,
  summarizeDeliveryRow,
  validateAdInterests,
  type MetaGeoLocation,
  type MetaReachEstimate,
  type MetaTargetingItem,
} from "../_shared/metaAdsTargetingApi.ts";

const CACHE_TTL_MS = 10 * 60 * 1000;
const memoryCache = new Map<string, { expires: number; payload: unknown }>();

function cacheGet(key: string): unknown | null {
  const hit = memoryCache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expires) {
    memoryCache.delete(key);
    return null;
  }
  return hit.payload;
}

function cacheSet(key: string, payload: unknown) {
  if (memoryCache.size > 200) {
    const first = memoryCache.keys().next().value;
    if (first) memoryCache.delete(first);
  }
  memoryCache.set(key, { expires: Date.now() + CACHE_TTL_MS, payload });
}

function filterByType(
  items: MetaTargetingItem[],
  typeFilter: string,
): MetaTargetingItem[] {
  const f = typeFilter.trim().toLowerCase();
  if (!f || f === "all") return items;
  if (f === "interest" || f === "interests") return items.filter((i) => i.type === "interest");
  if (f === "behavior" || f === "behaviours" || f === "behaviors") {
    return items.filter((i) => i.type === "behavior");
  }
  if (f === "demographic" || f === "demographics") {
    return items.filter((i) =>
      ["demographic", "life_event", "industry", "income", "family_status"].includes(i.type)
    );
  }
  return items.filter((i) => i.type === f);
}

type ResearchFilters = {
  countryCode: string;
  genders: number[];
  ageMin: number;
  ageMax: number;
  placement: string;
  objective: string;
  optimizationGoal: string;
  objectiveDowngraded: boolean;
  dailyBudget: number | null;
  promotedObject: Record<string, unknown> | null;
  locations: MetaGeoLocation[];
  geoUnresolved: boolean;
};

function parseResearchFilters(
  body: Record<string, unknown>,
  countryCode: string,
  account: { pixel_id?: string; default_event_name?: string },
): ResearchFilters {
  const genderRaw = String(body.gender ?? body.genders ?? "all").trim().toLowerCase();
  let genders: number[] = [];
  if (genderRaw === "male" || genderRaw === "1" || genderRaw === "[1]") genders = [1];
  else if (genderRaw === "female" || genderRaw === "2" || genderRaw === "[2]") genders = [2];
  else if (Array.isArray(body.genders)) {
    genders = body.genders.map((g) => Number(g)).filter((g) => g === 1 || g === 2);
  }

  const ageMin = body.age_min != null && Number.isFinite(Number(body.age_min))
    ? Math.max(18, Math.min(65, Math.round(Number(body.age_min))))
    : 18;
  const ageMax = body.age_max != null && Number.isFinite(Number(body.age_max))
    ? Math.max(ageMin, Math.min(65, Math.round(Number(body.age_max))))
    : 65;

  const placement = String(body.placement ?? "automatic").trim().toLowerCase() || "automatic";
  const objective = String(body.objective ?? "conversions").trim().toLowerCase() || "conversions";
  let optimizationGoal = body.optimization_goal != null
    ? String(body.optimization_goal).trim().toUpperCase()
    : mapObjectiveToOptimizationGoal(objective);

  const dailyBudget = body.daily_budget != null && Number.isFinite(Number(body.daily_budget))
    ? Number(body.daily_budget)
    : null;

  let promotedObject: Record<string, unknown> | null = null;
  if (body.promoted_object && typeof body.promoted_object === "object") {
    promotedObject = body.promoted_object as Record<string, unknown>;
  } else if (
    optimizationGoal === "OFFSITE_CONVERSIONS" &&
    account.pixel_id &&
    account.pixel_id !== "0"
  ) {
    promotedObject = {
      pixel_id: account.pixel_id,
      custom_event_type: String(account.default_event_name ?? "PURCHASE").toUpperCase(),
    };
  }

  let objectiveDowngraded = false;
  if (optimizationGoal === "OFFSITE_CONVERSIONS" && !promotedObject) {
    optimizationGoal = "REACH";
    objectiveDowngraded = true;
  }

  const locations = parseMetaGeoLocations(body.locations);

  return {
    countryCode,
    genders,
    ageMin,
    ageMax,
    placement,
    objective,
    optimizationGoal,
    objectiveDowngraded,
    dailyBudget,
    promotedObject,
    locations,
    geoUnresolved: false,
  };
}

async function parseResearchFiltersForReach(
  accessToken: string,
  body: Record<string, unknown>,
  countryCode: string,
  account: { pixel_id?: string; default_event_name?: string },
): Promise<ResearchFilters> {
  const filters = parseResearchFilters(body, countryCode, account);
  const locations = await resolveLocationsForEstimate(accessToken, filters.locations);
  return {
    ...filters,
    locations,
    geoUnresolved: filters.locations.length > 0 && locations.length === 0,
  };
}

function filtersFingerprint(f: ResearchFilters): string {
  return [
    f.countryCode,
    f.genders.join(",") || "all",
    f.ageMin,
    f.ageMax,
    f.placement,
    f.optimizationGoal,
    f.dailyBudget ?? "",
    locationsFingerprint(f.locations),
  ].join("|");
}

async function estimateOneItem(
  accessToken: string,
  act: string,
  item: { id: string; name?: string; type?: string; path?: string[] },
  filters: ResearchFilters,
  audienceHint?: { lower: number | null; upper: number | null },
): Promise<{
  id: string;
  name?: string;
  audience_size_lower: number | null;
  audience_size_upper: number | null;
  potential: MetaReachEstimate;
  daily: { lower: number | null; upper: number | null } | null;
  daily_source: string | null;
  delivery_summary: ReturnType<typeof summarizeDeliveryRow>;
  error?: string;
}> {
  if (filters.geoUnresolved) {
    return {
      id: item.id,
      name: item.name,
      audience_size_lower: audienceHint?.lower ?? null,
      audience_size_upper: audienceHint?.upper ?? null,
      potential: {
        estimate_ready: false,
        users_lower: null,
        users_upper: null,
        estimate_dau_lower: null,
        estimate_dau_upper: null,
        raw: null,
      },
      daily: null,
      daily_source: null,
      delivery_summary: summarizeDeliveryRow(null),
      error: "Location is not an official Meta targeting key",
    };
  }

  const spec = buildInterestTargetingSpec({
    countryCodes: [filters.countryCode],
    items: [item],
    ageMin: filters.ageMin,
    ageMax: filters.ageMax,
    genders: filters.genders,
    placement: filters.placement,
    selectedLocations: filters.locations,
    idsOnly: true,
  });
  const flexible = (spec.flexible_spec as Array<Record<string, unknown>> | undefined)?.[0];
  if (!flexible || Object.keys(flexible).length === 0) {
    return {
      id: item.id,
      name: item.name,
      audience_size_lower: audienceHint?.lower ?? null,
      audience_size_upper: audienceHint?.upper ?? null,
      potential: {
        estimate_ready: false,
        users_lower: null,
        users_upper: null,
        estimate_dau_lower: null,
        estimate_dau_upper: null,
        raw: null,
      },
      daily: null,
      daily_source: null,
      delivery_summary: summarizeDeliveryRow(null),
      error: "Unsupported targeting type for reach estimate",
    };
  }

  const runReach = async (targetingItem: { id: string; name?: string; type?: string; path?: string[] }) => {
    const nextSpec = buildInterestTargetingSpec({
      countryCodes: [filters.countryCode],
      items: [targetingItem],
      ageMin: filters.ageMin,
      ageMax: filters.ageMax,
      genders: filters.genders,
      placement: filters.placement,
      selectedLocations: filters.locations,
      idsOnly: true,
    });
    const potential = await reachEstimate(accessToken, act, nextSpec);
    return { spec: nextSpec, potential };
  };

  let specUsed = spec;
  let potential: MetaReachEstimate;
  try {
    const first = await runReach(item);
    specUsed = first.spec;
    potential = first.potential;
  } catch (e) {
    if (!item.name || !isInvalidTargetingGraphError(e)) throw e;
    const resolved = (await resolveSuggestedInterests(accessToken, [{
      id: item.id,
      name: item.name,
      type: (item.type as MetaTargetingItem["type"]) ?? "interest",
      path: item.path ?? [],
      audience_size_lower: audienceHint?.lower ?? null,
      audience_size_upper: audienceHint?.upper ?? null,
      description: null,
    }]))[0];
    if (!resolved || resolved.id === item.id) throw e;
    const second = await runReach(resolved);
    specUsed = second.spec;
    potential = second.potential;
  }
  let deliveryRow: Record<string, unknown> | null = null;
  if (isMetaReachPrivacyFloor(potential.users_lower, potential.users_upper)) {
    try {
      const delivery = await deliveryEstimate(
        accessToken,
        act,
        specUsed,
        filters.optimizationGoal,
        filters.promotedObject,
      );
      deliveryRow = firstDeliveryRow(delivery);
    } catch {
      deliveryRow = null;
    }
  }
  const dailyBounds = extractDailyReachBounds({ reach: potential, deliveryRow });
  const daily =
    dailyBounds.lower != null || dailyBounds.upper != null
      ? { lower: dailyBounds.lower, upper: dailyBounds.upper }
      : null;
  const delivery_summary = summarizeDeliveryRow(deliveryRow);

  return {
    id: item.id,
    name: item.name,
    audience_size_lower: audienceHint?.lower ?? null,
    audience_size_upper: audienceHint?.upper ?? null,
    potential: applyOfficialPotential({ reach: potential, delivery: delivery_summary }),
    daily,
    daily_source: dailyBounds.source,
    delivery_summary,
  };
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(concurrency, Math.max(1, items.length)) }, async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: metaAdsCorsHeaders });
  }
  if (req.method !== "POST") {
    return metaAdsJson({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    return metaAdsJson({ error: "Server misconfigured" }, 500);
  }
  if (!readPlatformMetaAdsOAuth()) {
    return metaAdsJson({ error: "Meta Ads is not configured on the server" }, 503);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const userRes = await getUserFromBearer(admin, req.headers.get("Authorization"));
  if ("error" in userRes) return userRes.error;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return metaAdsJson({ error: "Invalid JSON body" }, 400);
  }

  const organizationId = String(body.organization_id ?? "").trim();
  if (!organizationId) return metaAdsJson({ error: "Missing organization_id" }, 400);

  const { data: profile } = await admin
    .from("profiles")
    .select("active_organization_id")
    .eq("user_id", userRes.userId)
    .maybeSingle();
  const activeOrg = profile?.active_organization_id != null
    ? String(profile.active_organization_id)
    : "";
  if (!activeOrg || activeOrg !== organizationId) {
    return metaAdsJson({ error: "Forbidden" }, 403);
  }

  const action = String(body.action ?? "search").trim();
  const adAccountIdParam = body.ad_account_id != null ? String(body.ad_account_id).trim() : null;
  const forceRefresh = body.force_refresh === true;
  const countryCode = String(body.country_code ?? "ID").trim().toUpperCase() || "ID";

  const resolved = await resolveOrgMetaAdsForTargeting(admin, organizationId, adAccountIdParam);
  if (!resolved) {
    return metaAdsJson({ error: "Meta Ads not connected or no account configured" }, 400);
  }
  const { accessToken, account } = resolved;
  const act = metaActId(account.ad_account_id);

  try {
    if (action === "spike") {
      const report = await runTargetingSpike(accessToken, act, countryCode);
      console.info("[meta-ads-targeting] spike", JSON.stringify({
        org: organizationId,
        act,
        ok: report.ok,
        pages: report.pages_targeting_go,
        daily_reach_available: report.daily_reach_available,
        checks: report.checks.map((c) => ({ name: c.name, ok: c.ok, detail: c.detail })),
      }));
      return metaAdsJson({
        ok: report.ok,
        pages_targeting_go: report.pages_targeting_go,
        daily_reach_available: report.daily_reach_available,
        ad_account_id: account.ad_account_id,
        report,
      }, 200);
    }

    if (action === "search") {
      const q = String(body.q ?? "").trim();
      if (!q) return metaAdsJson({ error: "Missing q" }, 400);
      const typeFilter = String(body.type_filter ?? "all").trim();
      const cacheKey = `search:v4:${organizationId}:${account.ad_account_id}:${typeFilter}:${q.toLowerCase()}`;
      if (!forceRefresh) {
        const cached = cacheGet(cacheKey);
        if (cached) return metaAdsJson({ ...(cached as object), cached: true }, 200);
      }

      const variants = searchQueryVariants(q);
      const [interestBatches, actHits, employers] = await Promise.all([
        Promise.all(variants.map((v) => searchAdInterests(accessToken, v, 200).catch(() => []))),
        searchActTargeting(accessToken, act, q, undefined, 200).catch(() => [] as MetaTargetingItem[]),
        Promise.all(
          variants.map((v) => searchAdWorkEmployers(accessToken, v, 100).catch(() => [])),
        ).then((batches) => batches.flat()),
      ]);
      const interests = interestBatches.flat();

      let extras: MetaTargetingItem[] = [];
      const tf = typeFilter.toLowerCase();
      if (tf === "all" || tf === "behavior" || tf === "behaviours" || tf === "behaviors") {
        try {
          const behaviors = await searchTargetingCategory(accessToken, "behaviors");
          extras = extras.concat(
            behaviors.filter((b) => b.name.toLowerCase().includes(q.toLowerCase())).slice(0, 40),
          );
        } catch {
          /* optional */
        }
      }
      if (tf === "all" || tf === "demographic" || tf === "demographics") {
        try {
          const demos = await searchTargetingCategory(accessToken, "demographics");
          extras = extras.concat(
            demos.filter((b) => b.name.toLowerCase().includes(q.toLowerCase())).slice(0, 40),
          );
        } catch {
          /* optional */
        }
      }

      const merged = rankSearchItems(
        filterByType(
          [...interests, ...actHits, ...employers, ...extras].reduce<MetaTargetingItem[]>((acc, item) => {
            if (!acc.some((x) => x.id === item.id)) acc.push(item);
            return acc;
          }, []),
          typeFilter,
        ),
        q,
      );

      const payload = {
        items: merged,
        ad_account_id: account.ad_account_id,
        q,
        type_filter: typeFilter,
        cached: false,
      };
      cacheSet(cacheKey, payload);
      return metaAdsJson(payload, 200);
    }

    if (action === "geoSearch") {
      const q = String(body.q ?? "").trim();
      if (q.length < 2) return metaAdsJson({ error: "Missing q (min 2 characters)" }, 400);
      const biasCountry = String(body.country_code ?? countryCode).trim().toUpperCase() || "ID";
      const cacheKey = `geo:v19:${organizationId}:${biasCountry}:${q.toLowerCase()}`;
      if (!forceRefresh) {
        const cached = cacheGet(cacheKey);
        if (cached) return metaAdsJson({ ...(cached as object), cached: true }, 200);
      }
      const locations = await searchAdGeoLocations(accessToken, {
        q,
        countryCode: biasCountry,
        limit: 25,
        adAccountId: account.ad_account_id,
      });
      const payload = {
        locations,
        country_code: biasCountry,
        ad_account_id: account.ad_account_id,
        cached: false,
      };
      cacheSet(cacheKey, payload);
      return metaAdsJson(payload, 200);
    }

    if (action === "suggest") {
      const interestList = Array.isArray(body.interest_list)
        ? body.interest_list.map((x) => String(x))
        : [];
      const cacheKey = `suggest:v13:${organizationId}:${interestList.join("\n")}:${
        Array.isArray(body.items)
          ? (body.items as Array<{ id?: string }>).map((i) => String(i.id ?? "")).join(",")
          : ""
      }`;
      if (!forceRefresh) {
        const cached = cacheGet(cacheKey);
        if (cached) return metaAdsJson({ ...(cached as object), cached: true }, 200);
      }
      const seedItems: MetaTargetingItem[] = Array.isArray(body.items)
        ? (body.items as Array<{ id?: string; name?: string; type?: string; path?: string[] }>)
            .map((i) => ({
              id: String(i.id ?? ""),
              name: String(i.name ?? ""),
              type: (i.type as MetaTargetingItem["type"]) || "interest",
              path: Array.isArray(i.path) ? i.path.map((p) => String(p)) : [],
              audience_size_lower: null,
              audience_size_upper: null,
              description: null,
            }))
            .filter((i) => i.id || i.name)
        : interestList.map((name) => ({
            id: "",
            name,
            type: "interest" as const,
            path: [],
            audience_size_lower: null,
            audience_size_upper: null,
            description: null,
          }));
      const items = await exploreRelatedInterests(accessToken, seedItems, [], act);
      const payload = { items, ad_account_id: account.ad_account_id, cached: false };
      if (items.length) cacheSet(cacheKey, payload);
      return metaAdsJson(payload, 200);
    }

    if (action === "validate") {
      const ids = Array.isArray(body.interest_ids)
        ? body.interest_ids.map((x) => String(x))
        : [];
      const results = await validateAdInterests(accessToken, ids);
      return metaAdsJson({ results, ad_account_id: account.ad_account_id }, 200);
    }

    if (action === "estimate" || action === "estimate_rows") {
      const filters = await parseResearchFiltersForReach(accessToken, body, countryCode, account);
      const rawItems = Array.isArray(body.items)
        ? (body.items as Array<{
          id?: string;
          name?: string;
          type?: string;
          path?: string[];
          audience_size_lower?: number | null;
          audience_size_upper?: number | null;
        }>)
          .map((i) => ({
            id: String(i.id ?? ""),
            name: i.name ? String(i.name) : undefined,
            type: i.type ? String(i.type) : undefined,
            path: Array.isArray(i.path) ? i.path.map((p) => String(p)) : undefined,
            audience_size_lower: i.audience_size_lower != null
              ? Number(i.audience_size_lower)
              : null,
            audience_size_upper: i.audience_size_upper != null
              ? Number(i.audience_size_upper)
              : null,
          }))
          .filter((i) => i.id)
        : [];

      if (action === "estimate_rows") {
        const items = rawItems.slice(0, 10);
        if (!items.length) return metaAdsJson({ error: "Missing items" }, 400);
        const fp = filtersFingerprint(filters);
        const rows = await mapPool(items, 2, async (item) => {
          const cacheKey =
            `estrow:v14:${organizationId}:${account.ad_account_id}:${fp}:${item.id}`;
          if (!forceRefresh) {
            const cached = cacheGet(cacheKey);
            if (cached) return cached as Awaited<ReturnType<typeof estimateOneItem>>;
          }
          try {
            const row = await estimateOneItem(accessToken, act, item, filters, {
              lower: item.audience_size_lower,
              upper: item.audience_size_upper,
            });
            cacheSet(cacheKey, row);
            return row;
          } catch (e) {
            return {
              id: item.id,
              name: item.name,
              audience_size_lower: item.audience_size_lower,
              audience_size_upper: item.audience_size_upper,
              potential: {
                estimate_ready: false,
                users_lower: null,
                users_upper: null,
                estimate_dau_lower: null,
                estimate_dau_upper: null,
                raw: null,
              },
              daily: null,
              daily_source: null,
              delivery_summary: summarizeDeliveryRow(null),
              error: e instanceof Error ? e.message : String(e),
            };
          }
        });
        return metaAdsJson({
          rows,
          filters: {
            country_code: filters.countryCode,
            genders: filters.genders,
            age_min: filters.ageMin,
            age_max: filters.ageMax,
            placement: filters.placement,
            objective: filters.objective,
            optimization_goal: filters.optimizationGoal,
            objective_downgraded: filters.objectiveDowngraded,
            daily_budget: filters.dailyBudget,
            locations: filters.locations,
          },
          ad_account_id: account.ad_account_id,
          country_code: filters.countryCode,
        }, 200);
      }

      const items = rawItems;
      const interests = Array.isArray(body.interests)
        ? (body.interests as Array<{ id?: string; name?: string }>)
          .map((i) => ({ id: String(i.id ?? ""), name: i.name ? String(i.name) : undefined }))
          .filter((i) => i.id)
        : [];
      const behaviors = Array.isArray(body.behaviors)
        ? (body.behaviors as Array<{ id?: string; name?: string }>)
          .map((i) => ({ id: String(i.id ?? ""), name: i.name ? String(i.name) : undefined }))
          .filter((i) => i.id)
        : [];
      const spec = buildInterestTargetingSpec({
        countryCodes: [filters.countryCode],
        items: items.length ? items : undefined,
        interests: !items.length && interests.length ? interests : undefined,
        behaviors: !items.length && behaviors.length ? behaviors : undefined,
        ageMin: filters.ageMin,
        ageMax: filters.ageMax,
        genders: filters.genders,
        placement: filters.placement,
        selectedLocations: filters.locations,
        idsOnly: true,
      });
      const flexible = (spec.flexible_spec as Array<Record<string, unknown>> | undefined)?.[0];
      const geo = spec.geo_locations as Record<string, unknown> | undefined;
      const hasGeo = Boolean(geo && Object.keys(geo).length);
      if ((!flexible || Object.keys(flexible).length === 0) && !hasGeo) {
        return metaAdsJson({
          error:
            "Selected targeting cannot be used for reach estimate (unsupported demographic type). Pick an interest or behaviour.",
        }, 400);
      }
      const estimate = await reachEstimate(accessToken, act, spec);
      let deliveryRow: Record<string, unknown> | null = null;
      try {
        const delivery = await deliveryEstimate(
          accessToken,
          act,
          spec,
          filters.optimizationGoal,
          filters.promotedObject,
        );
        deliveryRow = firstDeliveryRow(delivery);
      } catch {
        deliveryRow = null;
      }
      const dailyBounds = extractDailyReachBounds({ reach: estimate, deliveryRow });
      const daily =
        dailyBounds.lower != null || dailyBounds.upper != null
          ? { lower: dailyBounds.lower, upper: dailyBounds.upper }
          : null;
      const delivery_summary = summarizeDeliveryRow(deliveryRow);
      return metaAdsJson({
        estimate: applyOfficialPotential({ reach: estimate, delivery: delivery_summary }),
        daily,
        daily_source: dailyBounds.source,
        delivery_summary,
        targeting_spec: spec,
        filters: {
          country_code: filters.countryCode,
          genders: filters.genders,
          age_min: filters.ageMin,
          age_max: filters.ageMax,
          placement: filters.placement,
          objective: filters.objective,
          optimization_goal: filters.optimizationGoal,
          objective_downgraded: filters.objectiveDowngraded,
          daily_budget: filters.dailyBudget,
          locations: filters.locations,
        },
        objective_downgraded: filters.objectiveDowngraded,
        ad_account_id: account.ad_account_id,
        country_code: filters.countryCode,
        approximate: false,
      }, 200);
    }

    if (action === "overlap_rows") {
      const filters = await parseResearchFiltersForReach(accessToken, body, countryCode, account);
      const parseItem = (raw: Record<string, unknown>) => ({
        id: String(raw.id ?? ""),
        name: raw.name ? String(raw.name) : undefined,
        type: raw.type ? String(raw.type) : undefined,
        path: Array.isArray(raw.path) ? raw.path.map((p) => String(p)) : undefined,
        potential_lower: raw.potential_lower != null ? Number(raw.potential_lower) : null,
        potential_upper: raw.potential_upper != null ? Number(raw.potential_upper) : null,
      });
      const seedRaw = Array.isArray(body.seed)
        ? body.seed
        : Array.isArray(body.seeds)
        ? body.seeds
        : body.seed && typeof body.seed === "object"
        ? [body.seed]
        : [];
      const seeds = (seedRaw as Array<Record<string, unknown>>)
        .map((s) => parseItem(s))
        .filter((s) => s.id)
        .slice(0, 5);
      const items = (Array.isArray(body.items) ? body.items as Array<Record<string, unknown>> : [])
        .map((i) => parseItem(i))
        .filter((i) => i.id)
        .slice(0, 10);
      if (!seeds.length) return metaAdsJson({ error: "Missing seed" }, 400);
      if (!items.length) return metaAdsJson({ error: "Missing items" }, 400);

      const specSeed = buildInterestTargetingSpec({
        countryCodes: [filters.countryCode],
        items: seeds,
        ageMin: filters.ageMin,
        ageMax: filters.ageMax,
        genders: filters.genders,
        placement: filters.placement,
        selectedLocations: filters.locations,
        idsOnly: true,
      });
      if (!(specSeed.flexible_spec as unknown[] | undefined)?.length) {
        return metaAdsJson({ error: "Seed targeting type is not supported for overlap." }, 400);
      }

      const mid = (lower: number | null, upper: number | null) => {
        if (lower != null && upper != null) return (lower + upper) / 2;
        return lower ?? upper ?? 0;
      };
      const seedIds = new Set(seeds.map((s) => s.id));
      const fp = filtersFingerprint(filters);
      const seedKey = seeds.map((s) => s.id).sort().join("+");

      let seedFloor = false;
      try {
        const estSeed = await reachEstimate(accessToken, act, specSeed);
        seedFloor = isMetaReachPrivacyFloor(estSeed.users_lower, estSeed.users_upper);
      } catch {
        seedFloor = false;
      }

      const rows = await mapPool(items, 2, async (item) => {
        if (seedIds.has(item.id)) {
          const lo = item.potential_lower;
          const hi = item.potential_upper;
          return {
            id: item.id,
            and: { users_lower: lo, users_upper: hi, estimate_ready: true },
            pct: 100,
          };
        }
        const cacheKey =
          `ovrow:v2:${organizationId}:${account.ad_account_id}:${fp}:${seedKey}:${item.id}`;
        if (!forceRefresh) {
          const cached = cacheGet(cacheKey);
          if (cached) return cached as Record<string, unknown>;
        }
        try {
          const specB = buildInterestTargetingSpec({
            countryCodes: [filters.countryCode],
            items: [item],
            ageMin: filters.ageMin,
            ageMax: filters.ageMax,
            genders: filters.genders,
            placement: filters.placement,
            selectedLocations: filters.locations,
            idsOnly: true,
          });
          if (!(specB.flexible_spec as unknown[] | undefined)?.length) {
            return {
              id: item.id,
              and: { users_lower: null, users_upper: null, estimate_ready: false },
              pct: null,
              error: "Unsupported targeting type for overlap",
            };
          }
          const specAnd = buildIntersectionTargetingSpec(specSeed, specB);
          let estAnd = await reachEstimate(accessToken, act, specAnd);
          if (isMetaReachPrivacyFloor(estAnd.users_lower, estAnd.users_upper)) {
            try {
              const delivery = await deliveryEstimate(
                accessToken,
                act,
                specAnd,
                filters.optimizationGoal,
                filters.promotedObject,
              );
              estAnd = applyOfficialPotential({
                reach: estAnd,
                delivery: summarizeDeliveryRow(firstDeliveryRow(delivery)),
              });
            } catch {
              /* keep AND reach */
            }
          }
          let bLower = item.potential_lower;
          let bUpper = item.potential_upper;
          if (bLower == null && bUpper == null) {
            const estB = await reachEstimate(accessToken, act, specB);
            bLower = estB.users_lower;
            bUpper = estB.users_upper;
          }
          const andFloor = isMetaReachPrivacyFloor(estAnd.users_lower, estAnd.users_upper);
          const bFloor = isMetaReachPrivacyFloor(bLower, bUpper);
          const den = mid(bLower, bUpper);
          const num = mid(estAnd.users_lower, estAnd.users_upper);
          const pct =
            seedFloor || andFloor || bFloor || den <= 0
              ? null
              : Math.min(100, Math.max(0, (num / den) * 100));
          const row = {
            id: item.id,
            and: {
              users_lower: estAnd.users_lower,
              users_upper: estAnd.users_upper,
              estimate_ready: estAnd.estimate_ready,
            },
            pct,
          };
          cacheSet(cacheKey, row);
          return row;
        } catch (e) {
          return {
            id: item.id,
            and: { users_lower: null, users_upper: null, estimate_ready: false },
            pct: null,
            error: e instanceof Error ? e.message : String(e),
          };
        }
      });

      return metaAdsJson({
        rows,
        seed_ids: seeds.map((s) => s.id),
        ad_account_id: account.ad_account_id,
        country_code: filters.countryCode,
      }, 200);
    }

    if (action === "overlap") {
      const a = body.a as { id?: string; name?: string; type?: string; path?: string[] } | undefined;
      const b = body.b as { id?: string; name?: string; type?: string; path?: string[] } | undefined;
      if (!a?.id || !b?.id) return metaAdsJson({ error: "Missing a/b targeting ids" }, 400);
      if (String(a.id) === String(b.id)) {
        return metaAdsJson({ error: "Select two different items to compare overlap." }, 400);
      }
      const filters = await parseResearchFiltersForReach(accessToken, body, countryCode, account);

      const toSpec = (item: { id: string; name?: string; type?: string; path?: string[] }) =>
        buildInterestTargetingSpec({
          countryCodes: [filters.countryCode],
          items: [item],
          ageMin: filters.ageMin,
          ageMax: filters.ageMax,
          genders: filters.genders,
          placement: filters.placement,
          selectedLocations: filters.locations,
          idsOnly: true,
        });

      const specA = toSpec({
        id: String(a.id),
        name: a.name ? String(a.name) : undefined,
        type: a.type,
        path: Array.isArray(a.path) ? a.path.map((p) => String(p)) : undefined,
      });
      const specB = toSpec({
        id: String(b.id),
        name: b.name ? String(b.name) : undefined,
        type: b.type,
        path: Array.isArray(b.path) ? b.path.map((p) => String(p)) : undefined,
      });
      if (!(specA.flexible_spec as unknown[] | undefined)?.length) {
        return metaAdsJson({ error: "Item A targeting type is not supported for overlap." }, 400);
      }
      if (!(specB.flexible_spec as unknown[] | undefined)?.length) {
        return metaAdsJson({ error: "Item B targeting type is not supported for overlap." }, 400);
      }
      const specAnd = buildIntersectionTargetingSpec(specA, specB);

      const mid = (e: { users_lower: number | null; users_upper: number | null }) => {
        if (e.users_lower != null && e.users_upper != null) return (e.users_lower + e.users_upper) / 2;
        return e.users_lower ?? e.users_upper ?? 0;
      };
      const range = (e: { users_lower: number | null; users_upper: number | null }) => ({
        lower: e.users_lower,
        upper: e.users_upper,
        mid: mid(e),
      });

      const liftIfFloor = async (reach: MetaReachEstimate, spec: Record<string, unknown>) => {
        if (!isMetaReachPrivacyFloor(reach.users_lower, reach.users_upper)) return reach;
        try {
          const delivery = await deliveryEstimate(
            accessToken,
            act,
            spec,
            filters.optimizationGoal,
            filters.promotedObject,
          );
          return applyOfficialPotential({
            reach,
            delivery: summarizeDeliveryRow(firstDeliveryRow(delivery)),
          });
        } catch {
          return reach;
        }
      };

      let estA: MetaReachEstimate;
      let estB: MetaReachEstimate;
      try {
        [estA, estB] = await Promise.all([
          reachEstimate(accessToken, act, specA),
          reachEstimate(accessToken, act, specB),
        ]);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return metaAdsJson({
          error: `Reach estimate failed for A or B: ${msg}`,
          code: "REACH_AB_FAILED",
          targeting_spec_a: specA,
          targeting_spec_b: specB,
        }, 400);
      }

      let estAnd: MetaReachEstimate;
      try {
        estAnd = await reachEstimate(accessToken, act, specAnd);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return metaAdsJson({
          error: `AND reach estimate failed: ${msg}. Try two Interests of the same type.`,
          code: "REACH_AND_FAILED",
          targeting_spec_and: specAnd,
        }, 400);
      }

      [estA, estB, estAnd] = await Promise.all([
        liftIfFloor(estA, specA),
        liftIfFloor(estB, specB),
        liftIfFloor(estAnd, specAnd),
      ]);

      const floorBlocksPct =
        isMetaReachPrivacyFloor(estA.users_lower, estA.users_upper) ||
        isMetaReachPrivacyFloor(estB.users_lower, estB.users_upper) ||
        isMetaReachPrivacyFloor(estAnd.users_lower, estAnd.users_upper);

      const smaller = Math.min(mid(estA), mid(estB));
      const intersectionMid = mid(estAnd);
      const overlapPct =
        floorBlocksPct || smaller <= 0
          ? null
          : Math.min(100, Math.max(0, (intersectionMid / smaller) * 100));

      const intersectionUsers = range(estAnd);

      return metaAdsJson({
        approximate: false,
        method: "and_reachestimate",
        a: estA,
        b: estB,
        intersection: estAnd,
        a_users: range(estA),
        b_users: range(estB),
        intersection_users: intersectionUsers,
        a_label: a.name ? String(a.name) : String(a.id),
        b_label: b.name ? String(b.name) : String(b.id),
        overlap_users: Math.round(intersectionMid),
        overlap_pct_of_smaller: overlapPct,
        ad_account_id: account.ad_account_id,
        country_code: filters.countryCode,
        note: "Potential Reach of A AND B from reachestimate — not Ads Manager overlap API.",
      }, 200);
    }

    if (action === "listLists") {
      const { data, error } = await admin
        .from("meta_ads_interest_lists")
        .select("id, name, created_by, created_at, updated_at, meta_ads_interest_list_items(count)")
        .eq("organization_id", organizationId)
        .order("updated_at", { ascending: false });
      if (error) return metaAdsJson({ error: error.message }, 500);
      return metaAdsJson({ lists: data ?? [] }, 200);
    }

    if (action === "getList") {
      const listId = String(body.list_id ?? "").trim();
      if (!listId) return metaAdsJson({ error: "Missing list_id" }, 400);
      const { data: list, error: listErr } = await admin
        .from("meta_ads_interest_lists")
        .select("id, name, created_by, created_at, updated_at")
        .eq("organization_id", organizationId)
        .eq("id", listId)
        .maybeSingle();
      if (listErr) return metaAdsJson({ error: listErr.message }, 500);
      if (!list) return metaAdsJson({ error: "List not found" }, 404);
      const { data: items, error: itemsErr } = await admin
        .from("meta_ads_interest_list_items")
        .select("*")
        .eq("list_id", listId)
        .order("sort_order", { ascending: true });
      if (itemsErr) return metaAdsJson({ error: itemsErr.message }, 500);
      return metaAdsJson({ list, items: items ?? [] }, 200);
    }

    if (action === "createList") {
      const name = String(body.name ?? "").trim();
      if (!name) return metaAdsJson({ error: "Missing name" }, 400);
      const { data, error } = await admin
        .from("meta_ads_interest_lists")
        .insert({
          organization_id: organizationId,
          name,
          created_by: userRes.userId,
        })
        .select("id, name, created_by, created_at, updated_at")
        .single();
      if (error) return metaAdsJson({ error: error.message }, 500);
      return metaAdsJson({ list: data }, 200);
    }

    if (action === "renameList") {
      const listId = String(body.list_id ?? "").trim();
      const name = String(body.name ?? "").trim();
      if (!listId || !name) return metaAdsJson({ error: "Missing list_id/name" }, 400);
      const { data, error } = await admin
        .from("meta_ads_interest_lists")
        .update({ name, updated_at: new Date().toISOString() })
        .eq("organization_id", organizationId)
        .eq("id", listId)
        .select("id, name, created_by, created_at, updated_at")
        .maybeSingle();
      if (error) return metaAdsJson({ error: error.message }, 500);
      if (!data) return metaAdsJson({ error: "List not found" }, 404);
      return metaAdsJson({ list: data }, 200);
    }

    if (action === "deleteList") {
      const listId = String(body.list_id ?? "").trim();
      if (!listId) return metaAdsJson({ error: "Missing list_id" }, 400);
      const { error } = await admin
        .from("meta_ads_interest_lists")
        .delete()
        .eq("organization_id", organizationId)
        .eq("id", listId);
      if (error) return metaAdsJson({ error: error.message }, 500);
      return metaAdsJson({ ok: true }, 200);
    }

    if (action === "addListItems") {
      const listId = String(body.list_id ?? "").trim();
      if (!listId) return metaAdsJson({ error: "Missing list_id" }, 400);
      const { data: owned } = await admin
        .from("meta_ads_interest_lists")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("id", listId)
        .maybeSingle();
      if (!owned) return metaAdsJson({ error: "List not found" }, 404);

      const rawItems = Array.isArray(body.items) ? body.items as Array<Record<string, unknown>> : [];
      if (rawItems.length === 0) return metaAdsJson({ error: "Missing items" }, 400);

      const { data: existing } = await admin
        .from("meta_ads_interest_list_items")
        .select("sort_order")
        .eq("list_id", listId)
        .order("sort_order", { ascending: false })
        .limit(1);
      let sortBase = Number((existing?.[0] as { sort_order?: number } | undefined)?.sort_order ?? 0);

      const rows = rawItems.map((item) => {
        sortBase += 1;
        return {
          list_id: listId,
          meta_targeting_id: String(item.id ?? item.meta_targeting_id ?? "").trim(),
          name: String(item.name ?? "").trim(),
          type: String(item.type ?? "interest").trim() || "interest",
          path: Array.isArray(item.path) ? item.path : [],
          audience_size_lower: item.audience_size_lower != null
            ? Number(item.audience_size_lower)
            : null,
          audience_size_upper: item.audience_size_upper != null
            ? Number(item.audience_size_upper)
            : null,
          sort_order: sortBase,
        };
      }).filter((r) => r.meta_targeting_id && r.name);

      if (rows.length === 0) return metaAdsJson({ error: "No valid items" }, 400);

      const { error } = await admin
        .from("meta_ads_interest_list_items")
        .upsert(rows, { onConflict: "list_id,meta_targeting_id" });
      if (error) return metaAdsJson({ error: error.message }, 500);

      await admin
        .from("meta_ads_interest_lists")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", listId);

      return metaAdsJson({ ok: true, added: rows.length }, 200);
    }

    if (action === "removeListItem") {
      const listId = String(body.list_id ?? "").trim();
      const itemId = String(body.item_id ?? "").trim();
      if (!listId || !itemId) return metaAdsJson({ error: "Missing list_id/item_id" }, 400);
      const { data: owned } = await admin
        .from("meta_ads_interest_lists")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("id", listId)
        .maybeSingle();
      if (!owned) return metaAdsJson({ error: "List not found" }, 404);
      const { error } = await admin
        .from("meta_ads_interest_list_items")
        .delete()
        .eq("list_id", listId)
        .eq("id", itemId);
      if (error) return metaAdsJson({ error: error.message }, 500);
      return metaAdsJson({ ok: true }, 200);
    }

    if (action === "createAdDraft") {
      const items = Array.isArray(body.items)
        ? (body.items as Array<{ id?: string; name?: string; type?: string; path?: string[] }>)
          .map((i) => ({
            id: String(i.id ?? ""),
            name: i.name ? String(i.name) : undefined,
            type: i.type ? String(i.type) : undefined,
            path: Array.isArray(i.path) ? i.path.map((p) => String(p)) : undefined,
          }))
          .filter((i) => i.id)
        : [];
      const interests = Array.isArray(body.interests)
        ? (body.interests as Array<{ id?: string; name?: string }>)
          .map((i) => ({ id: String(i.id ?? ""), name: i.name ? String(i.name) : undefined }))
          .filter((i) => i.id)
        : [];
      const behaviors = Array.isArray(body.behaviors)
        ? (body.behaviors as Array<{ id?: string; name?: string }>)
          .map((i) => ({ id: String(i.id ?? ""), name: i.name ? String(i.name) : undefined }))
          .filter((i) => i.id)
        : [];
      const draftFilters = await parseResearchFiltersForReach(accessToken, body, countryCode, account);
      const spec = buildInterestTargetingSpec({
        countryCodes: [draftFilters.countryCode],
        items: items.length ? items : undefined,
        interests: !items.length && interests.length ? interests : undefined,
        behaviors: !items.length && behaviors.length ? behaviors : undefined,
        ageMin: draftFilters.ageMin,
        ageMax: draftFilters.ageMax,
        genders: draftFilters.genders,
        placement: draftFilters.placement,
        selectedLocations: draftFilters.locations,
        idsOnly: true,
      });
      const flexible = (spec.flexible_spec as Array<Record<string, unknown>> | undefined)?.[0];
      if (!flexible || Object.keys(flexible).length === 0) {
        return metaAdsJson({
          error: "Select at least one supported targeting option (interest, behaviour, life event, etc.).",
        }, 400);
      }
      const draft = await createPausedInterestAdDraft(accessToken, act, {
        targetingSpec: spec,
        campaignName: body.campaign_name != null ? String(body.campaign_name) : undefined,
        adsetName: body.adset_name != null ? String(body.adset_name) : undefined,
        dailyBudget: body.daily_budget != null ? Number(body.daily_budget) : 50_000,
        campaignId: body.campaign_id != null ? String(body.campaign_id) : null,
      });
      return metaAdsJson({
        ...draft,
        targeting_spec: spec,
        ad_account_id: account.ad_account_id,
        note: "Created as PAUSED draft. Review in Meta Ads Manager before enabling.",
      }, 200);
    }

    return metaAdsJson({ error: "Unknown action" }, 400);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Targeting request failed";
    console.error("[meta-ads-targeting]", action, msg);
    if (/rate limit|user request limit|(#17)|(#4)/i.test(msg)) {
      return metaAdsJson({
        error: "Meta API rate limit reached. Wait a moment and try again.",
        code: "RATE_LIMIT",
      }, 429);
    }
    return metaAdsJson({ error: msg }, 400);
  }
});
