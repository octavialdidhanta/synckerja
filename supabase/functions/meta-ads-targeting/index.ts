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
  adsManagerAdsetsUrl,
  adsManagerAdsUrl,
  adsManagerAudiencesUrl,
  applyOfficialPotential,
  buildGroupedInterestTargetingSpec,
  buildInterestTargetingSpec,
  buildIntersectionTargetingSpec,
  buildUnionInterestTargetingSpec,
  flexibleSpecKeyForItem,
  createOrUpdateMetaSavedAudience,
  createPausedInterestAdDraft,
  listAdAccountCampaigns,
  deleteMetaSavedAudience,
  isDeletedOrMissingAdObjectError,
  updateAdsetTargeting,
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
    (optimizationGoal === "OFFSITE_CONVERSIONS" || optimizationGoal === "VALUE") &&
    account.pixel_id &&
    account.pixel_id !== "0"
  ) {
    promotedObject = {
      pixel_id: account.pixel_id,
      custom_event_type: String(account.default_event_name ?? "PURCHASE").toUpperCase(),
    };
  }

  let objectiveDowngraded = false;
  if (
    (optimizationGoal === "OFFSITE_CONVERSIONS" || optimizationGoal === "VALUE") &&
    !promotedObject
  ) {
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

const LIST_ROW_SELECT =
  "id, name, created_by, created_at, updated_at, ad_account_id, meta_saved_audience_id, meta_ad_account_id, meta_saved_audience_pushed_at, meta_saved_audience_filters, meta_push_kind, meta_campaign_id, meta_adset_id";

type InterestListRow = {
  id: string;
  name: string;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
  ad_account_id?: string | null;
  meta_saved_audience_id?: string | null;
  meta_ad_account_id?: string | null;
  meta_saved_audience_pushed_at?: string | null;
  meta_saved_audience_filters?: Record<string, unknown> | null;
  meta_push_kind?: string | null;
  meta_campaign_id?: string | null;
  meta_adset_id?: string | null;
};

function accountDigits(adAccountId: string | null | undefined): string {
  return String(adAccountId ?? "").replace(/\D/g, "");
}

function listBelongsToAccount(list: InterestListRow, adAccountId: string): boolean {
  const owner = accountDigits(list.ad_account_id);
  const current = accountDigits(adAccountId);
  return Boolean(owner && current && owner === current);
}

function snapshotAudienceFilters(
  body: Record<string, unknown>,
  countryCode: string,
): Record<string, unknown> {
  return {
    country_code: countryCode,
    gender: body.gender ?? "all",
    age_min: body.age_min ?? 18,
    age_max: body.age_max ?? 65,
    placement: body.placement ?? "automatic",
    locations: Array.isArray(body.locations) ? body.locations : [],
    daily_budget: body.daily_budget ?? null,
    objective: body.objective ?? "conversions",
  };
}

function mergeBodyWithFilterSnapshot(
  body: Record<string, unknown>,
  snapshot: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const snap = snapshot && typeof snapshot === "object" ? snapshot : {};
  const hasLive =
    body.country_code != null ||
    body.gender != null ||
    body.age_min != null ||
    body.age_max != null ||
    body.placement != null ||
    body.locations != null;
  if (hasLive) return body;
  return { ...body, ...snap };
}

const MAX_LIST_MATCH_GROUP = 4;

type ListSpecItem = {
  id: string;
  name?: string;
  type?: string;
  path?: string[];
  match_group: number;
};

function parseMatchGroup(value: unknown): number {
  const n = Math.floor(Number(value ?? 0));
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

function listItemsToSpecEntries(
  rows: Array<{
    meta_targeting_id?: string;
    name?: string;
    type?: string;
    path?: unknown;
    match_group?: number;
  }>,
): ListSpecItem[] {
  return rows
    .map((row) => ({
      id: String(row.meta_targeting_id ?? "").trim(),
      name: row.name ? String(row.name) : undefined,
      type: row.type ? String(row.type) : undefined,
      path: Array.isArray(row.path) ? row.path.map((p) => String(p)) : undefined,
      match_group: parseMatchGroup(row.match_group),
    }))
    .filter((row) => row.id);
}

function groupListSpecItems(items: ListSpecItem[]): Array<Array<{
  id: string;
  name?: string;
  type?: string;
  path?: string[];
}>> {
  const byGroup = new Map<number, ListSpecItem[]>();
  for (const item of items) {
    const g = item.match_group;
    const list = byGroup.get(g) ?? [];
    list.push(item);
    byGroup.set(g, list);
  }
  const max = Math.max(0, ...byGroup.keys());
  const groups: Array<Array<{ id: string; name?: string; type?: string; path?: string[] }>> = [];
  for (let i = 0; i <= max; i++) {
    groups.push((byGroup.get(i) ?? []).map(({ match_group: _g, ...entry }) => entry));
  }
  return groups;
}

function targetingSpecFromListItems(
  items: ListSpecItem[],
  specArgs: {
    countryCodes: string[];
    ageMin: number;
    ageMax: number;
    genders?: number[];
    placement?: string;
    selectedLocations?: MetaGeoLocation[];
  },
): Record<string, unknown> {
  const groups = groupListSpecItems(items).filter((group) => group.length > 0);
  return buildGroupedInterestTargetingSpec({
    countryCodes: specArgs.countryCodes,
    ageMin: specArgs.ageMin,
    ageMax: specArgs.ageMax,
    genders: specArgs.genders,
    placement: specArgs.placement,
    selectedLocations: specArgs.selectedLocations,
    idsOnly: true,
    groups,
  });
}

function specHasFlexibleTargeting(spec: Record<string, unknown>): boolean {
  const rows = spec.flexible_spec as Array<Record<string, unknown>> | undefined;
  return Boolean(rows?.some((row) => row && Object.keys(row).length > 0));
}

async function loadListSpecItems(
  admin: ReturnType<typeof createClient>,
  listId: string,
): Promise<ListSpecItem[]> {
  const { data, error } = await admin
    .from("meta_ads_interest_list_items")
    .select("meta_targeting_id, name, type, path, match_group")
    .eq("list_id", listId)
    .order("match_group", { ascending: true })
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return listItemsToSpecEntries(data ?? []);
}

async function clearSavedAudienceLink(
  admin: ReturnType<typeof createClient>,
  listId: string,
): Promise<void> {
  await admin
    .from("meta_ads_interest_lists")
    .update({
      meta_saved_audience_id: null,
      meta_ad_account_id: null,
      meta_saved_audience_pushed_at: null,
      meta_saved_audience_filters: null,
      meta_push_kind: null,
      meta_campaign_id: null,
      meta_adset_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", listId);
}

async function syncPushedSavedAudience(args: {
  admin: ReturnType<typeof createClient>;
  accessToken: string;
  account: { ad_account_id: string; pixel_id?: string; default_event_name?: string };
  act: string;
  list: InterestListRow;
  body: Record<string, unknown>;
  countryCode: string;
}): Promise<string | null> {
  const kind = String(args.list.meta_push_kind ?? "saved_audience");
  const objectId =
    kind === "adset_draft"
      ? String(args.list.meta_adset_id ?? "").trim()
      : String(args.list.meta_saved_audience_id ?? "").trim();
  if (!objectId) return null;
  try {
    const items = await loadListSpecItems(args.admin, args.list.id);
    if (!items.length) {
      await deleteMetaSavedAudience(args.accessToken, objectId);
      await clearSavedAudienceLink(args.admin, args.list.id);
      return null;
    }
    const merged = mergeBodyWithFilterSnapshot(args.body, args.list.meta_saved_audience_filters);
    const country =
      String(merged.country_code ?? args.countryCode ?? "ID").trim().toUpperCase() || "ID";
    const filters = await parseResearchFiltersForReach(
      args.accessToken,
      merged,
      country,
      args.account,
    );
    const includeCount = items.filter((item) => item.match_group === 0).length;
    if (!includeCount) {
      return "Include group must have at least one interest";
    }
    const spec = targetingSpecFromListItems(items, {
      countryCodes: [filters.countryCode],
      ageMin: filters.ageMin,
      ageMax: filters.ageMax,
      genders: filters.genders,
      placement: filters.placement,
      selectedLocations: filters.locations,
    });
    if (!specHasFlexibleTargeting(spec)) {
      return "Saved audience targeting is empty";
    }
    if (kind === "adset_draft") {
      try {
        await updateAdsetTargeting(args.accessToken, objectId, {
          name: args.list.name,
          targetingSpec: spec,
        });
        return null;
      } catch (err) {
        if (!isDeletedOrMissingAdObjectError(err)) throw err;
        const draft = await createPausedInterestAdDraft(args.accessToken, args.act, {
          targetingSpec: spec,
          campaignName: `Synckerja ${args.list.name}`.slice(0, 80),
          adsetName: String(args.list.name ?? "").slice(0, 80) || "Interest list",
          dailyBudget: 50_000,
          objective: filters.objective,
          promotedObject: filters.promotedObject,
        });
        await args.admin
          .from("meta_ads_interest_lists")
          .update({
            meta_push_kind: "adset_draft",
            meta_campaign_id: draft.campaign_id,
            meta_adset_id: draft.adset_id,
            meta_saved_audience_id: null,
            meta_ad_account_id: args.account.ad_account_id,
            meta_saved_audience_pushed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", args.list.id);
        return null;
      }
    }
    await createOrUpdateMetaSavedAudience(args.accessToken, args.act, {
      name: args.list.name,
      targetingSpec: spec,
      existingAudienceId: objectId,
    });
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : "Meta saved audience sync failed";
  }
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

    if (action === "listCampaigns") {
      const campaigns = await listAdAccountCampaigns(accessToken, act);
      return metaAdsJson({ campaigns, ad_account_id: account.ad_account_id }, 200);
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

    if (action === "targeting_categories") {
      const cacheKey = `cat:v1:${organizationId}`;
      if (!forceRefresh) {
        const cached = cacheGet(cacheKey);
        if (cached) return metaAdsJson({ ...(cached as object), cached: true }, 200);
      }
      const [interests, behaviors, demographics] = await Promise.all([
        searchTargetingCategory(accessToken, "interests").catch(() => [] as MetaTargetingItem[]),
        searchTargetingCategory(accessToken, "behaviors").catch(() => [] as MetaTargetingItem[]),
        searchTargetingCategory(accessToken, "demographics").catch(() => [] as MetaTargetingItem[]),
      ]);
      const items = [...interests, ...behaviors, ...demographics].reduce<MetaTargetingItem[]>(
        (acc, item) => {
          if (!item.id || acc.some((row) => row.id === item.id)) return acc;
          acc.push(item);
          return acc;
        },
        [],
      );
      const payload = { items, ad_account_id: account.ad_account_id, cached: false };
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

      const mixedKeys = new Set(
        rawItems.map((item) => flexibleSpecKeyForItem(item)).filter((key): key is string => Boolean(key)),
      ).size > 1;
      const parseGroupItems = (raw: unknown) =>
        (Array.isArray(raw) ? raw : [])
          .map((entry) => {
            const row = (entry ?? {}) as Record<string, unknown>;
            return {
              id: String(row.id ?? ""),
              name: row.name ? String(row.name) : undefined,
              type: row.type ? String(row.type) : undefined,
              path: Array.isArray(row.path) ? row.path.map((p) => String(p)) : undefined,
            };
          })
          .filter((item) => item.id);
      const groupedItems = (Array.isArray(body.groups) ? body.groups : [])
        .map((group) => parseGroupItems(group))
        .filter((group) => group.length > 0);
      const useGrouped = groupedItems.length >= 2;
      const useUnion = !useGrouped && (body.union === true || mixedKeys);
      const items = useUnion ? rawItems.slice(0, 8) : rawItems;
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
      const specArgs = {
        countryCodes: [filters.countryCode],
        ageMin: filters.ageMin,
        ageMax: filters.ageMax,
        genders: filters.genders,
        placement: filters.placement,
        selectedLocations: filters.locations,
        idsOnly: true as const,
      };
      const spec = useGrouped
        ? buildGroupedInterestTargetingSpec({ ...specArgs, groups: groupedItems })
        : useUnion && items.length
        ? buildUnionInterestTargetingSpec({ ...specArgs, items })
        : buildInterestTargetingSpec({
          ...specArgs,
          items: items.length ? items : undefined,
          interests: !items.length && interests.length ? interests : undefined,
          behaviors: !items.length && behaviors.length ? behaviors : undefined,
        });
      const fp = filtersFingerprint(filters);
      const groupedKey = groupedItems
        .map((group) => group.map((item) => item.id).sort().join("+"))
        .join("|");
      const unionKey = items.map((item) => item.id).sort().join("+");
      const estimateCacheKey = useGrouped && groupedKey
        ? `est:grouped:v1:${organizationId}:${account.ad_account_id}:${fp}:${groupedKey}`
        : useUnion && unionKey
        ? `est:union:v1:${organizationId}:${account.ad_account_id}:${fp}:${unionKey}`
        : "";
      if (estimateCacheKey && !forceRefresh) {
        const cached = cacheGet(estimateCacheKey);
        if (cached) return metaAdsJson(cached, 200);
      }
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
      const payload = {
        estimate: applyOfficialPotential({ reach: estimate, delivery: delivery_summary }),
        daily,
        daily_source: dailyBounds.source,
        delivery_summary,
        targeting_spec: spec,
        union: useUnion,
        grouped: useGrouped,
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
      };
      if (estimateCacheKey) cacheSet(estimateCacheKey, payload);
      return metaAdsJson(payload, 200);
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
        .slice(0, 8);
      const items = (Array.isArray(body.items) ? body.items as Array<Record<string, unknown>> : [])
        .map((i) => parseItem(i))
        .filter((i) => i.id)
        .slice(0, 20);
      if (!seeds.length) return metaAdsJson({ error: "Missing seed" }, 400);

      const specSeed = buildUnionInterestTargetingSpec({
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

      let seedLower: number | null = null;
      let seedUpper: number | null = null;
      let seedFloor = false;
      try {
        const estSeed = await reachEstimate(accessToken, act, specSeed);
        seedLower = estSeed.users_lower;
        seedUpper = estSeed.users_upper;
        seedFloor = isMetaReachPrivacyFloor(estSeed.users_lower, estSeed.users_upper);
      } catch {
        seedFloor = false;
      }
      const seedMid = mid(seedLower, seedUpper);
      const pctSelFor = (
        andLower: number | null,
        andUpper: number | null,
        extraFloor: boolean,
      ) => {
        const andFloor = isMetaReachPrivacyFloor(andLower, andUpper);
        const num = mid(andLower, andUpper);
        if (seedFloor || andFloor || extraFloor || seedMid <= 0) return null;
        return Math.min(100, Math.max(0, (num / seedMid) * 100));
      };

      const estimateAgainstUnion = async (
        specB: Record<string, unknown>,
        rowId: string,
      ) => {
        const estB = await reachEstimate(accessToken, act, specB);
        const bLower = estB.users_lower;
        const bUpper = estB.users_upper;
        const bFloor = isMetaReachPrivacyFloor(bLower, bUpper);
        const bReach = { users_lower: bLower, users_upper: bUpper };
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
        const andFloor = isMetaReachPrivacyFloor(estAnd.users_lower, estAnd.users_upper);
        const den = mid(bLower, bUpper);
        const seedDen = mid(seedLower, seedUpper);
        const num = mid(estAnd.users_lower, estAnd.users_upper);
        const capped = den > 0 && seedDen > 0 ? Math.min(num, den, seedDen) : num;
        const pct =
          seedFloor || andFloor || bFloor || den <= 0
            ? null
            : Math.min(100, Math.max(0, (capped / den) * 100));
        return {
          id: rowId,
          and: {
            users_lower: estAnd.users_lower,
            users_upper: estAnd.users_upper,
            estimate_ready: estAnd.estimate_ready,
          },
          b: bReach,
          comparison_users: bReach,
          pct,
          pct_com: pct,
          pct_sel: pctSelFor(estAnd.users_lower, estAnd.users_upper, bFloor),
        };
      };

      if (body.union_items === true) {
        if (!items.length) {
          return metaAdsJson({
            rows: [],
            seed: { users_lower: seedLower, users_upper: seedUpper },
            seed_ids: seeds.map((s) => s.id),
            ad_account_id: account.ad_account_id,
            country_code: filters.countryCode,
          }, 200);
        }
        const unionKey = items.map((item) => item.id).sort().join("+");
        const cacheKey =
          `ovrow:v6:${organizationId}:${account.ad_account_id}:${fp}:${seedKey}:union:${unionKey}`;
        if (!forceRefresh) {
          const cached = cacheGet(cacheKey);
          if (cached) {
            return metaAdsJson({
              rows: [cached],
              seed: { users_lower: seedLower, users_upper: seedUpper },
              seed_ids: seeds.map((s) => s.id),
              ad_account_id: account.ad_account_id,
              country_code: filters.countryCode,
            }, 200);
          }
        }
        const specB = buildUnionInterestTargetingSpec({
          countryCodes: [filters.countryCode],
          items,
          ageMin: filters.ageMin,
          ageMax: filters.ageMax,
          genders: filters.genders,
          placement: filters.placement,
          selectedLocations: filters.locations,
          idsOnly: true,
        });
        if (!(specB.flexible_spec as unknown[] | undefined)?.length) {
          return metaAdsJson({
            error: "Comparison targeting type is not supported for overlap.",
          }, 400);
        }
        const row = await estimateAgainstUnion(specB, "__comparison_union__");
        cacheSet(cacheKey, row);
        return metaAdsJson({
          rows: [row],
          seed: { users_lower: seedLower, users_upper: seedUpper },
          seed_ids: seeds.map((s) => s.id),
          ad_account_id: account.ad_account_id,
          country_code: filters.countryCode,
        }, 200);
      }

      const rows = await mapPool(items, 2, async (item) => {
        const cacheKey =
          `ovrow:v6:${organizationId}:${account.ad_account_id}:${fp}:${seedKey}:${item.id}`;
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
              b: { users_lower: null, users_upper: null },
              comparison_users: { users_lower: null, users_upper: null },
              pct: null,
              pct_com: null,
              pct_sel: null,
              error: "Unsupported targeting type for overlap",
            };
          }
          const estB = await reachEstimate(accessToken, act, specB);
          const bLower = estB.users_lower;
          const bUpper = estB.users_upper;
          const bFloor = isMetaReachPrivacyFloor(bLower, bUpper);
          const bReach = { users_lower: bLower, users_upper: bUpper };

          if (seedIds.has(item.id) && seeds.length === 1) {
            const row = {
              id: item.id,
              and: {
                users_lower: seedLower,
                users_upper: seedUpper,
                estimate_ready: true,
              },
              b: bReach,
              comparison_users: bReach,
              pct: 100,
              pct_com: 100,
              pct_sel: 100,
            };
            cacheSet(cacheKey, row);
            return row;
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
          const andFloor = isMetaReachPrivacyFloor(estAnd.users_lower, estAnd.users_upper);
          const den = mid(bLower, bUpper);
          const seedDen = mid(seedLower, seedUpper);
          const num = mid(estAnd.users_lower, estAnd.users_upper);
          const capped = den > 0 && seedDen > 0 ? Math.min(num, den, seedDen) : num;
          const pct =
            seedFloor || andFloor || bFloor || den <= 0
              ? null
              : Math.min(100, Math.max(0, (capped / den) * 100));
          const row = {
            id: item.id,
            and: {
              users_lower: estAnd.users_lower,
              users_upper: estAnd.users_upper,
              estimate_ready: estAnd.estimate_ready,
            },
            b: bReach,
            comparison_users: bReach,
            pct,
            pct_com: pct,
            pct_sel: pctSelFor(estAnd.users_lower, estAnd.users_upper, bFloor),
          };
          cacheSet(cacheKey, row);
          return row;
        } catch (e) {
          return {
            id: item.id,
            and: { users_lower: null, users_upper: null, estimate_ready: false },
            b: { users_lower: null, users_upper: null },
            comparison_users: { users_lower: null, users_upper: null },
            pct: null,
            pct_com: null,
            pct_sel: null,
            error: e instanceof Error ? e.message : String(e),
          };
        }
      });

      return metaAdsJson({
        rows,
        seed: { users_lower: seedLower, users_upper: seedUpper },
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
      const ownerAccountId = accountDigits(account.ad_account_id);
      const { data, error } = await admin
        .from("meta_ads_interest_lists")
        .select(`${LIST_ROW_SELECT}, meta_ads_interest_list_items(count)`)
        .eq("organization_id", organizationId)
        .eq("ad_account_id", ownerAccountId)
        .order("updated_at", { ascending: false });
      if (error) return metaAdsJson({ error: error.message }, 500);
      return metaAdsJson({ lists: data ?? [] }, 200);
    }

    if (action === "getList") {
      const listId = String(body.list_id ?? "").trim();
      if (!listId) return metaAdsJson({ error: "Missing list_id" }, 400);
      const { data: list, error: listErr } = await admin
        .from("meta_ads_interest_lists")
        .select(LIST_ROW_SELECT)
        .eq("organization_id", organizationId)
        .eq("id", listId)
        .maybeSingle();
      if (listErr) return metaAdsJson({ error: listErr.message }, 500);
      if (!list || !listBelongsToAccount(list as InterestListRow, account.ad_account_id)) {
        return metaAdsJson({ error: "List not found" }, 404);
      }
      const { data: items, error: itemsErr } = await admin
        .from("meta_ads_interest_list_items")
        .select("*")
        .eq("list_id", listId)
        .order("match_group", { ascending: true })
        .order("sort_order", { ascending: true });
      if (itemsErr) return metaAdsJson({ error: itemsErr.message }, 500);
      return metaAdsJson({ list, items: items ?? [] }, 200);
    }

    if (action === "list_grouped_reach") {
      const listId = String(body.list_id ?? "").trim();
      if (!listId) return metaAdsJson({ error: "Missing list_id" }, 400);
      const { data: list, error: listErr } = await admin
        .from("meta_ads_interest_lists")
        .select(LIST_ROW_SELECT)
        .eq("organization_id", organizationId)
        .eq("id", listId)
        .maybeSingle();
      if (listErr) return metaAdsJson({ error: listErr.message }, 500);
      if (!list || !listBelongsToAccount(list as InterestListRow, account.ad_account_id)) {
        return metaAdsJson({ error: "List not found" }, 404);
      }
      const items = await loadListSpecItems(admin, listId);
      const groups = groupListSpecItems(items);
      const include = groups[0] ?? [];
      if (!include.length) {
        return metaAdsJson({ error: "Include group must have at least one interest" }, 400);
      }
      const filters = await parseResearchFiltersForReach(accessToken, body, countryCode, account);
      const specArgs = {
        countryCodes: [filters.countryCode],
        ageMin: filters.ageMin,
        ageMax: filters.ageMax,
        genders: filters.genders,
        placement: filters.placement,
        selectedLocations: filters.locations,
        idsOnly: true as const,
      };
      const includeSpec = buildUnionInterestTargetingSpec({ ...specArgs, items: include });
      const includeReach = applyOfficialPotential({
        reach: await reachEstimate(accessToken, act, includeSpec),
        delivery: { mau_lower: null, mau_upper: null, estimate_ready: null },
      });
      const nonempty = groups.filter((group) => group.length > 0);
      let firstNarrow = null as MetaReachEstimate | null;
      let intersection = null as MetaReachEstimate | null;
      if (nonempty.length >= 2) {
        const narrowSpec = buildUnionInterestTargetingSpec({ ...specArgs, items: nonempty[1] });
        firstNarrow = applyOfficialPotential({
          reach: await reachEstimate(accessToken, act, narrowSpec),
          delivery: { mau_lower: null, mau_upper: null, estimate_ready: null },
        });
        const andSpec = buildGroupedInterestTargetingSpec({ ...specArgs, groups: nonempty });
        intersection = applyOfficialPotential({
          reach: await reachEstimate(accessToken, act, andSpec),
          delivery: { mau_lower: null, mau_upper: null, estimate_ready: null },
        });
      }
      return metaAdsJson({
        include: includeReach,
        first_narrow: firstNarrow,
        intersection,
        country_code: filters.countryCode,
        group_counts: groups.map((group) => group.length),
      }, 200);
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
          ad_account_id: accountDigits(account.ad_account_id),
        })
        .select(LIST_ROW_SELECT)
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
        .eq("ad_account_id", accountDigits(account.ad_account_id))
        .select(LIST_ROW_SELECT)
        .maybeSingle();
      if (error) return metaAdsJson({ error: error.message }, 500);
      if (!data) return metaAdsJson({ error: "List not found" }, 404);
      const metaSyncError = await syncPushedSavedAudience({
        admin,
        accessToken,
        account,
        act,
        list: data as InterestListRow,
        body,
        countryCode,
      });
      return metaAdsJson({ list: data, meta_sync_error: metaSyncError }, 200);
    }

    if (action === "deleteList") {
      const listId = String(body.list_id ?? "").trim();
      if (!listId) return metaAdsJson({ error: "Missing list_id" }, 400);
      const { data: existing } = await admin
        .from("meta_ads_interest_lists")
        .select(LIST_ROW_SELECT)
        .eq("organization_id", organizationId)
        .eq("id", listId)
        .maybeSingle();
      let metaSyncError: string | null = null;
      const existingRow = existing as InterestListRow | null;
      if (!existingRow || !listBelongsToAccount(existingRow, account.ad_account_id)) {
        return metaAdsJson({ error: "List not found" }, 404);
      }
      const objectId =
        String(existingRow?.meta_push_kind ?? "") === "adset_draft"
          ? String(existingRow?.meta_adset_id ?? "").trim()
          : String(existingRow?.meta_saved_audience_id ?? "").trim();
      if (objectId) {
        try {
          await deleteMetaSavedAudience(accessToken, objectId);
        } catch (syncErr) {
          metaSyncError = syncErr instanceof Error
            ? syncErr.message
            : "Meta object could not be deleted";
        }
      }
      const { error } = await admin
        .from("meta_ads_interest_lists")
        .delete()
        .eq("organization_id", organizationId)
        .eq("id", listId)
        .eq("ad_account_id", accountDigits(account.ad_account_id));
      if (error) return metaAdsJson({ error: error.message }, 500);
      return metaAdsJson({ ok: true, meta_sync_error: metaSyncError }, 200);
    }

    if (action === "addListItems") {
      const listId = String(body.list_id ?? "").trim();
      if (!listId) return metaAdsJson({ error: "Missing list_id" }, 400);
      const { data: owned } = await admin
        .from("meta_ads_interest_lists")
        .select(LIST_ROW_SELECT)
        .eq("organization_id", organizationId)
        .eq("id", listId)
        .maybeSingle();
      if (!owned || !listBelongsToAccount(owned as InterestListRow, account.ad_account_id)) {
        return metaAdsJson({ error: "List not found" }, 404);
      }

      const rawItems = Array.isArray(body.items) ? body.items as Array<Record<string, unknown>> : [];
      if (rawItems.length === 0) return metaAdsJson({ error: "Missing items" }, 400);

      const matchGroup = parseMatchGroup(body.match_group);
      if (matchGroup > MAX_LIST_MATCH_GROUP) {
        return metaAdsJson({ error: "match_group must be between 0 and 4" }, 400);
      }

      const { data: existingRows } = await admin
        .from("meta_ads_interest_list_items")
        .select("meta_targeting_id, sort_order")
        .eq("list_id", listId)
        .order("sort_order", { ascending: false });
      const existingIds = new Set(
        (existingRows ?? []).map((row) => String((row as { meta_targeting_id?: string }).meta_targeting_id ?? "")),
      );
      let sortBase = Number((existingRows?.[0] as { sort_order?: number } | undefined)?.sort_order ?? 0);

      const seenIncoming = new Set<string>();
      const skipped_ids: string[] = [];
      const rows = [];
      for (const item of rawItems) {
        const id = String(item.id ?? item.meta_targeting_id ?? "").trim();
        const name = String(item.name ?? "").trim();
        if (!id || !name) continue;
        if (seenIncoming.has(id) || existingIds.has(id)) {
          skipped_ids.push(id);
          continue;
        }
        seenIncoming.add(id);
        sortBase += 1;
        rows.push({
          list_id: listId,
          meta_targeting_id: id,
          name,
          type: String(item.type ?? "interest").trim() || "interest",
          path: Array.isArray(item.path) ? item.path : [],
          audience_size_lower: item.audience_size_lower != null
            ? Number(item.audience_size_lower)
            : null,
          audience_size_upper: item.audience_size_upper != null
            ? Number(item.audience_size_upper)
            : null,
          sort_order: sortBase,
          match_group: matchGroup,
        });
      }

      if (rows.length === 0) {
        return metaAdsJson({
          error: skipped_ids.length
            ? "Those interests are already in this list"
            : "No valid items",
          skipped_ids,
          added: 0,
        }, skipped_ids.length ? 409 : 400);
      }

      const { error } = await admin
        .from("meta_ads_interest_list_items")
        .insert(rows);
      if (error) return metaAdsJson({ error: error.message }, 500);

      await admin
        .from("meta_ads_interest_lists")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", listId);

      const metaSyncError = await syncPushedSavedAudience({
        admin,
        accessToken,
        account,
        act,
        list: owned as InterestListRow,
        body,
        countryCode,
      });
      return metaAdsJson({
        ok: true,
        added: rows.length,
        skipped_ids,
        meta_sync_error: metaSyncError,
      }, 200);
    }

    if (action === "removeListItem") {
      const listId = String(body.list_id ?? "").trim();
      const itemId = String(body.item_id ?? "").trim();
      if (!listId || !itemId) return metaAdsJson({ error: "Missing list_id/item_id" }, 400);
      const { data: owned } = await admin
        .from("meta_ads_interest_lists")
        .select(LIST_ROW_SELECT)
        .eq("organization_id", organizationId)
        .eq("id", listId)
        .maybeSingle();
      if (!owned || !listBelongsToAccount(owned as InterestListRow, account.ad_account_id)) {
        return metaAdsJson({ error: "List not found" }, 404);
      }
      const { error } = await admin
        .from("meta_ads_interest_list_items")
        .delete()
        .eq("list_id", listId)
        .eq("id", itemId);
      if (error) return metaAdsJson({ error: error.message }, 500);
      const metaSyncError = await syncPushedSavedAudience({
        admin,
        accessToken,
        account,
        act,
        list: owned as InterestListRow,
        body,
        countryCode,
      });
      return metaAdsJson({ ok: true, meta_sync_error: metaSyncError }, 200);
    }

    if (action === "removeListGroup") {
      const listId = String(body.list_id ?? "").trim();
      const matchGroup = parseMatchGroup(body.match_group);
      if (!listId) return metaAdsJson({ error: "Missing list_id" }, 400);
      if (matchGroup < 1) return metaAdsJson({ error: "Can only remove Narrow groups" }, 400);
      const { data: owned } = await admin
        .from("meta_ads_interest_lists")
        .select(LIST_ROW_SELECT)
        .eq("organization_id", organizationId)
        .eq("id", listId)
        .maybeSingle();
      if (!owned || !listBelongsToAccount(owned as InterestListRow, account.ad_account_id)) {
        return metaAdsJson({ error: "List not found" }, 404);
      }
      const { error } = await admin
        .from("meta_ads_interest_list_items")
        .delete()
        .eq("list_id", listId)
        .eq("match_group", matchGroup);
      if (error) return metaAdsJson({ error: error.message }, 500);
      const metaSyncError = await syncPushedSavedAudience({
        admin,
        accessToken,
        account,
        act,
        list: owned as InterestListRow,
        body,
        countryCode,
      });
      return metaAdsJson({ ok: true, meta_sync_error: metaSyncError }, 200);
    }

    if (action === "createSavedAudience") {
      const listId = String(body.list_id ?? "").trim();
      if (!listId) return metaAdsJson({ error: "Missing list_id" }, 400);
      const { data: list, error: listErr } = await admin
        .from("meta_ads_interest_lists")
        .select(LIST_ROW_SELECT)
        .eq("organization_id", organizationId)
        .eq("id", listId)
        .maybeSingle();
      if (listErr) return metaAdsJson({ error: listErr.message }, 500);
      if (!list || !listBelongsToAccount(list as InterestListRow, account.ad_account_id)) {
        return metaAdsJson({ error: "List not found" }, 404);
      }
      const items = await loadListSpecItems(admin, listId);
      if (!items.length) {
        return metaAdsJson({ error: "List has no interests to push" }, 400);
      }
      if (!items.some((item) => item.match_group === 0)) {
        return metaAdsJson({ error: "Include group must have at least one interest" }, 400);
      }
      const pushFilters = await parseResearchFiltersForReach(accessToken, body, countryCode, account);
      const spec = targetingSpecFromListItems(items, {
        countryCodes: [pushFilters.countryCode],
        ageMin: pushFilters.ageMin,
        ageMax: pushFilters.ageMax,
        genders: pushFilters.genders,
        placement: pushFilters.placement,
        selectedLocations: pushFilters.locations,
      });
      if (!specHasFlexibleTargeting(spec)) {
        return metaAdsJson({
          error: "Select at least one supported targeting option (interest, behaviour, life event, etc.).",
        }, 400);
      }
      const listRow = list as InterestListRow;
      const sameAccount =
        String(listRow.meta_ad_account_id ?? "").replace(/\D/g, "") ===
        String(account.ad_account_id).replace(/\D/g, "");
      const existingKind = sameAccount ? String(listRow.meta_push_kind ?? "saved_audience") : "";
      const existingAudienceId = sameAccount && existingKind !== "adset_draft"
        ? String(listRow.meta_saved_audience_id ?? "").trim() || null
        : null;
      const existingAdsetId = sameAccount && existingKind === "adset_draft"
        ? String(listRow.meta_adset_id ?? "").trim() || null
        : null;
      const listName = String(listRow.name ?? "");
      const createNew = body.create_new === true;
      const draftCampaignName =
        String(body.campaign_name ?? "").trim() || `Synckerja ${listName}`.slice(0, 80);
      const draftAdsetName =
        String(body.adset_name ?? "").trim() || listName.slice(0, 80) || "Interest list";
      const draftDailyBudget = Number(body.daily_budget);
      const attachCampaignId = String(body.campaign_id ?? "").trim() || null;
      const makeDraft = () =>
        createPausedInterestAdDraft(accessToken, act, {
          targetingSpec: spec,
          campaignName: draftCampaignName,
          adsetName: draftAdsetName,
          dailyBudget: Number.isFinite(draftDailyBudget) && draftDailyBudget > 0
            ? draftDailyBudget
            : 50_000,
          lifetimeBudget: Number(body.lifetime_budget) > 0 ? Number(body.lifetime_budget) : null,
          campaignId: attachCampaignId,
          objective: pushFilters.objective,
          promotedObject: pushFilters.promotedObject,
          buyingType: String(body.buying_type ?? "AUCTION"),
          budgetLevel: String(body.budget_level ?? "CAMPAIGN"),
          bidStrategy: String(body.bid_strategy ?? "LOWEST_COST_WITHOUT_CAP"),
          bidAmount: Number(body.bid_amount) > 0 ? Number(body.bid_amount) : null,
          roasAverageFloor: Number(body.roas_average_floor) > 0 ? Number(body.roas_average_floor) : null,
          adName: String(body.ad_name ?? "").trim() || null,
          destinationType: String(body.destination_type ?? "").trim() || null,
          optimizationGoal: String(body.optimization_goal ?? "").trim() || null,
          attributionModel: String(body.attribution_model ?? "").trim() || null,
          websiteUrl: String(body.website_url ?? body.websiteUrl ?? body.link_url ?? "").trim() || null,
          imageUrl: String(body.image_url ?? body.imageUrl ?? "").trim() || null,
        });

      let pushKind: "saved_audience" | "adset_draft" = "saved_audience";
      let savedAudienceId: string | null = null;
      let campaignId: string | null = sameAccount ? String(listRow.meta_campaign_id ?? "").trim() || null : null;
      let adsetId: string | null = existingAdsetId;
      let adId: string | null = null;
      let updatedFlag = false;
      let adsManagerUrl = "";

      // Meta Graph Saved Audience object is read-only (create/update/delete unsupported).
      // ads_management Standard Access is not enough; POST /saved_audiences returns (#3).
      if (existingAdsetId && !createNew) {
        try {
          await updateAdsetTargeting(accessToken, existingAdsetId, {
            name: listName,
            targetingSpec: spec,
          });
          pushKind = "adset_draft";
          updatedFlag = true;
          adsManagerUrl = adsManagerAdsetsUrl(account.ad_account_id, {
            campaignId,
            adsetId: existingAdsetId,
          });
        } catch (err) {
          if (!isDeletedOrMissingAdObjectError(err)) throw err;
          const draft = await makeDraft();
          pushKind = "adset_draft";
          campaignId = draft.campaign_id;
          adsetId = draft.adset_id;
          adId = draft.ad_id;
          adsManagerUrl = draft.ad_id
            ? adsManagerAdsUrl(account.ad_account_id, {
              campaignId: draft.campaign_id,
              adsetId: draft.adset_id,
              adId: draft.ad_id,
            })
            : adsManagerAdsetsUrl(account.ad_account_id, {
              campaignId: draft.campaign_id,
              adsetId: draft.adset_id,
            });
        }
      } else if (existingAudienceId && !createNew) {
        const pushed = await createOrUpdateMetaSavedAudience(accessToken, act, {
          name: listName,
          targetingSpec: spec,
          existingAudienceId,
        });
        savedAudienceId = pushed.id;
        updatedFlag = pushed.updated;
        adsManagerUrl = adsManagerAudiencesUrl(account.ad_account_id, pushed.id);
      } else {
        const draft = await makeDraft();
        pushKind = "adset_draft";
        campaignId = draft.campaign_id;
        adsetId = draft.adset_id;
        adId = draft.ad_id;
        adsManagerUrl = draft.ad_id
          ? adsManagerAdsUrl(account.ad_account_id, {
            campaignId: draft.campaign_id,
            adsetId: draft.adset_id,
            adId: draft.ad_id,
          })
          : adsManagerAdsetsUrl(account.ad_account_id, {
            campaignId: draft.campaign_id,
            adsetId: draft.adset_id,
          });
      }

      const now = new Date().toISOString();
      const { data: updated, error: saveErr } = await admin
        .from("meta_ads_interest_lists")
        .update({
          ad_account_id: accountDigits(account.ad_account_id),
          meta_saved_audience_id: savedAudienceId,
          meta_ad_account_id: account.ad_account_id,
          meta_saved_audience_pushed_at: now,
          meta_saved_audience_filters: snapshotAudienceFilters(body, countryCode),
          meta_push_kind: pushKind,
          meta_campaign_id: campaignId,
          meta_adset_id: adsetId,
          updated_at: now,
        })
        .eq("id", listId)
        .eq("organization_id", organizationId)
        .select(LIST_ROW_SELECT)
        .maybeSingle();
      if (saveErr) return metaAdsJson({ error: saveErr.message }, 500);
      return metaAdsJson({
        list: updated,
        saved_audience_id: savedAudienceId,
        adset_id: adsetId,
        ad_id: adId,
        campaign_id: campaignId,
        ad_account_id: account.ad_account_id,
        ads_manager_url: adsManagerUrl,
        updated: updatedFlag,
        push_kind: pushKind,
        targeting_spec: spec,
      }, 200);
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
        lifetimeBudget: Number(body.lifetime_budget) > 0 ? Number(body.lifetime_budget) : null,
        campaignId: body.campaign_id != null ? String(body.campaign_id) : null,
        objective: draftFilters.objective,
        promotedObject: draftFilters.promotedObject,
        buyingType: String(body.buying_type ?? "AUCTION"),
        budgetLevel: String(body.budget_level ?? "CAMPAIGN"),
        bidStrategy: String(body.bid_strategy ?? "LOWEST_COST_WITHOUT_CAP"),
        bidAmount: Number(body.bid_amount) > 0 ? Number(body.bid_amount) : null,
        roasAverageFloor: Number(body.roas_average_floor) > 0 ? Number(body.roas_average_floor) : null,
        adName: body.ad_name != null ? String(body.ad_name) : undefined,
        destinationType: body.destination_type != null ? String(body.destination_type) : null,
        optimizationGoal: body.optimization_goal != null ? String(body.optimization_goal) : null,
        attributionModel: body.attribution_model != null ? String(body.attribution_model) : null,
        websiteUrl: String(body.website_url ?? body.websiteUrl ?? body.link_url ?? "").trim() || null,
        imageUrl: String(body.image_url ?? body.imageUrl ?? "").trim() || null,
      });
      return metaAdsJson({
        ...draft,
        targeting_spec: spec,
        ad_account_id: account.ad_account_id,
        ads_manager_url: draft.ad_id
          ? adsManagerAdsUrl(account.ad_account_id, {
            campaignId: draft.campaign_id,
            adsetId: draft.adset_id,
            adId: draft.ad_id,
          })
          : adsManagerAdsetsUrl(account.ad_account_id, {
            campaignId: draft.campaign_id,
            adsetId: draft.adset_id,
          }),
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
