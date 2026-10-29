import { metaGraphVersion } from "./metaAdsAuth.ts";

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
  raw: unknown;
};

type GraphErrorBody = {
  error?: {
    message?: string;
    code?: number;
    error_subcode?: number;
    error_user_title?: string;
    error_user_msg?: string;
  };
};

function throwGraphError(json: GraphErrorBody, httpStatus: number): never {
  const e = json.error;
  const title = e?.error_user_title?.trim();
  const user = e?.error_user_msg?.trim();
  const base = e?.message ?? `HTTP ${httpStatus}`;
  const sub = e?.error_subcode != null ? ` subcode ${e.error_subcode}` : "";
  const msg = title || user
    ? `${[title, user].filter(Boolean).join(" — ")} (${base}${sub})`
    : `${base}${sub}`;
  const err = new Error(msg) as Error & { code?: number };
  err.code = e?.code;
  throw err;
}

function isTransientGraphError(e: unknown): boolean {
  const code =
    typeof e === "object" && e && "code" in e ? Number((e as { code?: number }).code) : NaN;
  const msg = e instanceof Error ? e.message : String(e);
  if ([1, 2, 4, 17, 32].includes(code)) return true;
  return /rate limit|too many calls|user request limit|temporarily|try again later/i.test(msg);
}

export function isInvalidTargetingGraphError(e: unknown): boolean {
  const code =
    typeof e === "object" && e && "code" in e ? Number((e as { code?: number }).code) : NaN;
  const msg = e instanceof Error ? e.message : String(e);
  return (
    code === 100 ||
    /invalid parameter|targeting_spec|not a valid|invalid interest/i.test(msg)
  );
}

function isBidAmountRequiredError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e ?? "");
  return /1815857|bid amount required|bid_amount field|LOWEST_COST_WITH_BID_CAP|TARGET_COST/i.test(msg);
}

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

async function graphGetPagedData(firstUrl: string, maxItems: number, maxPages = 5): Promise<Array<Record<string, unknown>>> {
  const out: Array<Record<string, unknown>> = [];
  let next: string | null = firstUrl;
  let pages = 0;
  while (next && out.length < maxItems && pages < maxPages) {
    const json = (await graphGetJson(next)) as {
      data?: Array<Record<string, unknown>>;
      paging?: { next?: string };
    };
    const rows = json.data ?? [];
    out.push(...rows);
    next = typeof json.paging?.next === "string" && json.paging.next ? json.paging.next : null;
    pages += 1;
    if (rows.length === 0) break;
  }
  return out.slice(0, maxItems);
}

async function graphGetJson(url: string, attempts = 4): Promise<unknown> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    const res = await fetch(url);
    const json = (await res.json().catch(() => ({}))) as GraphErrorBody & Record<string, unknown>;
    if (res.ok) return json;
    const msg = json?.error?.message ?? `HTTP ${res.status}`;
    const err = new Error(msg) as Error & { code?: number };
    err.code = json?.error?.code;
    last = err;
    if (!isTransientGraphError(err) || i === attempts - 1) throw err;
    await sleep(500 * 2 ** i);
  }
  throw last;
}

async function graphPostForm(
  path: string,
  accessToken: string,
  fields: Record<string, string>,
): Promise<Record<string, unknown>> {
  const body = new URLSearchParams({ ...fields, access_token: accessToken });
  const v = metaGraphVersion();
  const res = await fetch(`https://graph.facebook.com/${v}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await res.json().catch(() => ({}))) as GraphErrorBody & Record<string, unknown>;
  if (!res.ok) throwGraphError(json, res.status);
  return json;
}

async function graphDelete(
  path: string,
  accessToken: string,
): Promise<Record<string, unknown>> {
  const v = metaGraphVersion();
  const url =
    `https://graph.facebook.com/${v}/${path}?access_token=${encodeURIComponent(accessToken)}`;
  const res = await fetch(url, { method: "DELETE" });
  const json = (await res.json().catch(() => ({}))) as GraphErrorBody & Record<string, unknown>;
  if (!res.ok) throwGraphError(json, res.status);
  return json;
}

function isMissingGraphObjectError(err: unknown): boolean {
  const code = (err as { code?: number } | null)?.code;
  const msg = err instanceof Error ? err.message : String(err ?? "");
  if (code === 803) return true;
  return /does not exist|does not belong|cannot be found|object with ID .* does not exist/i.test(msg);
}

export function isDeletedOrMissingAdObjectError(err: unknown): boolean {
  if (isMissingGraphObjectError(err)) return true;
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return (
    /has been deleted|deleted ad sets can't be edited|you can only edit the name|subcode 1487056|campaign has been deleted|campaign archived|archived campaigns|subcode 1487866|archived ad set|this ad set is archived|can't be reactivated|subcode 3858861/i
      .test(msg)
  );
}

export function numericAdAccountId(adAccountId: string): string {
  return String(adAccountId ?? "").replace(/\D/g, "");
}

export function adsManagerAudiencesUrl(
  adAccountId: string,
  savedAudienceId?: string | null,
): string {
  const act = numericAdAccountId(adAccountId);
  const base =
    `https://adsmanager.facebook.com/adsmanager/manage/audiences?act=${encodeURIComponent(act)}`;
  if (savedAudienceId) {
    return `${base}&selected_audience_ids=${encodeURIComponent(savedAudienceId)}`;
  }
  return base;
}

export type MetaAdCampaignOption = {
  id: string;
  name: string;
  objective: string;
  buying_type: string;
  status: string;
  effective_status: string;
  daily_budget: string;
  lifetime_budget: string;
  is_adset_budget_sharing_enabled: boolean;
  uses_campaign_budget: boolean;
};

function campaignUsesCampaignBudget(row: Record<string, unknown>): boolean {
  if (row.is_adset_budget_sharing_enabled === true || row.is_adset_budget_sharing_enabled === "true") {
    return true;
  }
  return Number(row.daily_budget) > 0 || Number(row.lifetime_budget) > 0;
}

export async function listAdAccountCampaigns(
  accessToken: string,
  actId: string,
): Promise<MetaAdCampaignOption[]> {
  const url = graphUrl(
    `${actId}/campaigns?fields=id,name,objective,buying_type,status,effective_status,daily_budget,lifetime_budget,is_adset_budget_sharing_enabled&limit=80`,
    accessToken,
  );
  const rows = await graphGetPagedData(url, 80, 4);
  const usable = new Set(["ACTIVE", "PAUSED"]);
  return rows
    .map((row) => ({
      id: String(row.id ?? "").trim(),
      name: String(row.name ?? "").trim() || String(row.id ?? ""),
      objective: String(row.objective ?? ""),
      buying_type: String(row.buying_type ?? "AUCTION"),
      status: String(row.status ?? ""),
      effective_status: String(row.effective_status ?? row.status ?? ""),
      daily_budget: String(row.daily_budget ?? ""),
      lifetime_budget: String(row.lifetime_budget ?? ""),
      is_adset_budget_sharing_enabled: campaignUsesCampaignBudget(row),
      uses_campaign_budget: campaignUsesCampaignBudget(row),
    }))
    .filter((row) => row.id && usable.has(row.effective_status.toUpperCase()));
}

export function adsManagerAdsetsUrl(
  adAccountId: string,
  args?: { campaignId?: string | null; adsetId?: string | null },
): string {
  const act = numericAdAccountId(adAccountId);
  const params = new URLSearchParams({ act });
  if (args?.campaignId) params.set("selected_campaign_ids", args.campaignId);
  if (args?.adsetId) params.set("selected_adset_ids", args.adsetId);
  return `https://adsmanager.facebook.com/adsmanager/manage/adsets?${params.toString()}`;
}

export function adsManagerAdsUrl(
  adAccountId: string,
  args?: { campaignId?: string | null; adsetId?: string | null; adId?: string | null },
): string {
  const act = numericAdAccountId(adAccountId);
  const params = new URLSearchParams({ act });
  if (args?.campaignId) params.set("selected_campaign_ids", args.campaignId);
  if (args?.adsetId) params.set("selected_adset_ids", args.adsetId);
  if (args?.adId) params.set("selected_ad_ids", args.adId);
  return `https://adsmanager.facebook.com/adsmanager/manage/ads?${params.toString()}`;
}

export function adsManagerCampaignsUrl(
  adAccountId: string,
  campaignId?: string | null,
): string {
  const act = numericAdAccountId(adAccountId);
  const params = new URLSearchParams({ act });
  if (campaignId) params.set("selected_campaign_ids", campaignId);
  return `https://adsmanager.facebook.com/adsmanager/manage/campaigns?${params.toString()}`;
}

export function isMetaAppCapabilityError(err: unknown): boolean {
  const code = (err as { code?: number } | null)?.code;
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return code === 3 || /\(#3\)|does not have the capability/i.test(msg);
}

export async function updateAdsetTargeting(
  accessToken: string,
  adsetId: string,
  args: { name?: string; targetingSpec: Record<string, unknown> },
): Promise<void> {
  const fields: Record<string, string> = {
    targeting: JSON.stringify(sanitizeTargetingForAdset(args.targetingSpec)),
  };
  if (args.name?.trim()) fields.name = args.name.trim();
  await graphPostForm(adsetId, accessToken, fields);
}

export async function createOrUpdateMetaSavedAudience(
  accessToken: string,
  actId: string,
  args: {
    name: string;
    targetingSpec: Record<string, unknown>;
    existingAudienceId?: string | null;
  },
): Promise<{ id: string; updated: boolean }> {
  const baseName = args.name.trim() || "Synckerja audience";
  const targeting = JSON.stringify(args.targetingSpec);
  const post = (path: string, name: string) =>
    graphPostForm(path, accessToken, { name, targeting });

  const tryCreate = async (name: string) => {
    const created = await post(`${actId}/saved_audiences`, name);
    const id = String(created.id ?? "");
    if (!id) throw new Error("Failed to create saved audience");
    return { id, updated: false as const };
  };

  if (args.existingAudienceId) {
    try {
      const updated = await post(args.existingAudienceId, baseName);
      return { id: String(updated.id ?? args.existingAudienceId), updated: true };
    } catch (err) {
      if (!isMissingGraphObjectError(err)) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/already (in use|exists)|duplicate/i.test(msg)) {
          const updated = await post(args.existingAudienceId, `${baseName} (Synckerja)`);
          return { id: String(updated.id ?? args.existingAudienceId), updated: true };
        }
        throw err;
      }
    }
  }

  try {
    return await tryCreate(baseName);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/already (in use|exists)|duplicate/i.test(msg)) {
      return await tryCreate(`${baseName} (Synckerja)`);
    }
    throw err;
  }
}

export async function deleteMetaSavedAudience(
  accessToken: string,
  audienceId: string,
): Promise<{ deleted: boolean; alreadyGone: boolean }> {
  const id = audienceId.trim();
  if (!id) return { deleted: false, alreadyGone: true };
  try {
    await graphDelete(id, accessToken);
    return { deleted: true, alreadyGone: false };
  } catch (err) {
    if (isMissingGraphObjectError(err)) return { deleted: false, alreadyGone: true };
    throw err;
  }
}

const ADSET_FLEXIBLE_KEYS = new Set([
  "interests",
  "behaviors",
  "life_events",
  "industries",
  "income",
  "family_statuses",
  "work_employers",
  "relationship_statuses",
]);

/** Drop estimate-only geo (places) and placement fields that ad set create often rejects. */
export function sanitizeTargetingForAdset(spec: Record<string, unknown>): Record<string, unknown> {
  const geoIn =
    spec.geo_locations && typeof spec.geo_locations === "object"
      ? { ...(spec.geo_locations as Record<string, unknown>) }
      : {};
  delete geoIn.places;
  const hasGeo = ["countries", "regions", "cities", "zips", "custom_locations", "geo_markets"].some(
    (key) => Array.isArray(geoIn[key]) && (geoIn[key] as unknown[]).length > 0,
  );
  if (!hasGeo) geoIn.countries = ["ID"];
  if (!geoIn.location_types) geoIn.location_types = ["home", "recent"];

  const flexibleRaw = Array.isArray(spec.flexible_spec) ? spec.flexible_spec : [];
  const flexible: Array<Record<string, unknown>> = [];
  for (const row of flexibleRaw) {
    if (!row || typeof row !== "object") continue;
    for (const [key, value] of Object.entries(row as Record<string, unknown>)) {
      if (!ADSET_FLEXIBLE_KEYS.has(key) || !Array.isArray(value) || value.length === 0) continue;
      const nextValue = key === "relationship_statuses" ? coerceRelationshipStatusIds(value) : value;
      if (!Array.isArray(nextValue) || nextValue.length === 0) continue;
      flexible.push({ [key]: nextValue });
    }
  }

  const out: Record<string, unknown> = {
    geo_locations: geoIn,
    age_min: spec.age_min ?? 18,
    age_max: spec.age_max ?? 65,
    // Ads Manager "Advantage+ audience" defaults ON for ODAX. Keep original targeting.
    targeting_automation: { advantage_audience: 0 },
    targeting_relaxation_types: { lookalike: 0, custom_audience: 0 },
  };
  if (Array.isArray(spec.genders) && spec.genders.length) out.genders = spec.genders;
  if (flexible.length) out.flexible_spec = flexible;
  return out;
}

function countryOnlyTargeting(spec: Record<string, unknown>): Record<string, unknown> {
  const cleaned = sanitizeTargetingForAdset(spec);
  const countries =
    ((cleaned.geo_locations as Record<string, unknown> | undefined)?.countries as string[] | undefined) ??
    ["ID"];
  return {
    ...cleaned,
    geo_locations: { countries, location_types: ["home", "recent"] },
  };
}

export function mapObjectiveToCampaignDraft(
  objective: string | null | undefined,
  promotedObject?: Record<string, unknown> | null,
): {
  campaignObjective: string;
  optimizationGoal: string;
  billingEvent: string;
  promotedObject: Record<string, unknown> | null;
} {
  const o = String(objective ?? "").trim().toLowerCase();
  if (o === "traffic" || o === "link_clicks") {
    return {
      campaignObjective: "OUTCOME_TRAFFIC",
      optimizationGoal: "REACH",
      billingEvent: "IMPRESSIONS",
      promotedObject: null,
    };
  }
  if (o === "engagement" || o === "post_engagement") {
    return {
      campaignObjective: "OUTCOME_ENGAGEMENT",
      optimizationGoal: "REACH",
      billingEvent: "IMPRESSIONS",
      promotedObject: null,
    };
  }
  if (o === "leads" || o === "lead_generation") {
    return {
      campaignObjective: "OUTCOME_LEADS",
      // Leave Instant Forms / dataset unset so Ads Manager keeps conversion setup editable.
      optimizationGoal: "REACH",
      billingEvent: "IMPRESSIONS",
      promotedObject: null,
    };
  }
  if (o === "app_promotion" || o === "app_installs") {
    return {
      campaignObjective: "OUTCOME_APP_PROMOTION",
      optimizationGoal: "REACH",
      billingEvent: "IMPRESSIONS",
      promotedObject: null,
    };
  }
  if (o === "conversions" || o === "sales" || o === "offsite_conversions") {
    return {
      campaignObjective: "OUTCOME_SALES",
      // LINK_CLICKS publishes conversion location as Website and Ads Manager
      // then locks it. REACH avoids pinning a website destination.
      optimizationGoal: "REACH",
      billingEvent: "IMPRESSIONS",
      promotedObject: null,
    };
  }
  return {
    campaignObjective: "OUTCOME_AWARENESS",
    optimizationGoal: "REACH",
    billingEvent: "IMPRESSIONS",
    promotedObject: null,
  };
}

function budgetAmountFields(opts?: {
  dailyBudget?: number;
  lifetimeBudget?: number;
}): Record<string, string> {
  const lifetime = Math.round(Number(opts?.lifetimeBudget ?? 0));
  if (Number.isFinite(lifetime) && lifetime > 0) {
    return { lifetime_budget: String(Math.max(10_000, lifetime)) };
  }
  const daily = Math.max(10_000, Math.round(opts?.dailyBudget ?? 50_000));
  return { daily_budget: String(daily) };
}

function bidStrategyFields(opts?: {
  bidStrategy?: string | null;
  bidAmount?: number | null;
  roasAverageFloor?: number | null;
}): Record<string, string> {
  const strategy = String(opts?.bidStrategy ?? "LOWEST_COST_WITHOUT_CAP").trim().toUpperCase();
  const fields: Record<string, string> = {
    bid_strategy: strategy || "LOWEST_COST_WITHOUT_CAP",
  };
  if (strategy === "COST_CAP" || strategy === "LOWEST_COST_WITH_BID_CAP") {
    const amount = Math.round(Number(opts?.bidAmount ?? 0));
    if (Number.isFinite(amount) && amount > 0) fields.bid_amount = String(amount);
  }
  if (strategy === "LOWEST_COST_WITH_MIN_ROAS") {
    const floor = Math.round(Number(opts?.roasAverageFloor ?? 0));
    if (Number.isFinite(floor) && floor > 0) {
      fields.bid_constraints = JSON.stringify({ roas_average_floor: floor });
    }
  }
  return fields;
}

async function createPausedCampaign(
  accessToken: string,
  actId: string,
  campaignName: string,
  campaignObjective: string,
  buyingType = "AUCTION",
  opts?: {
    campaignBudget?: boolean;
    dailyBudget?: number;
    lifetimeBudget?: number;
    bidStrategy?: string | null;
    bidAmount?: number | null;
    roasAverageFloor?: number | null;
  },
): Promise<{ id: string; campaignBudget: boolean }> {
  const wantCampaignBudget = opts?.campaignBudget === true;
  const shared: Record<string, string> = {
    name: campaignName,
    objective: campaignObjective,
    buying_type: buyingType === "RESERVED" ? "RESERVED" : "AUCTION",
    status: "PAUSED",
    special_ad_categories: JSON.stringify(["NONE"]),
  };

  const postCampaign = async (fields: Record<string, string>) => {
    const campaign = await graphPostForm(`${actId}/campaigns`, accessToken, fields);
    const campaignId = String(campaign.id ?? "");
    if (!campaignId) throw new Error("Failed to create campaign");
    return campaignId;
  };

  if (wantCampaignBudget) {
    const budget = budgetAmountFields(opts);
    const bid = bidStrategyFields(opts);
    const cboAttempts: Array<Record<string, string>> = [
      {
        ...shared,
        ...budget,
        ...bid,
        is_adset_budget_sharing_enabled: "true",
      },
      {
        ...shared,
        ...budget,
        ...bid,
      },
    ];
    if (bid.bid_strategy === "LOWEST_COST_WITHOUT_CAP") {
      cboAttempts.push({
        ...shared,
        ...budget,
        is_adset_budget_sharing_enabled: "true",
      });
    }
    let lastErr: unknown = null;
    for (const fields of cboAttempts) {
      try {
        const id = await postCampaign(fields);
        return { id, campaignBudget: true };
      } catch (err) {
        lastErr = err;
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error("Failed to create campaign budget");
  }

  const id = await postCampaign({
    ...shared,
    is_adset_budget_sharing_enabled: "false",
  });
  return { id, campaignBudget: false };
}

function applyCampaignIdPlaceholder(name: string, campaignId: string): string {
  if (!name.includes("{{campaign_id}}")) return name;
  return name.split("{{campaign_id}}").join(campaignId);
}

async function finalizeCampaignName(
  accessToken: string,
  campaignId: string,
  campaignName: string,
): Promise<void> {
  const next = applyCampaignIdPlaceholder(campaignName, campaignId);
  if (next === campaignName) return;
  try {
    await graphPostForm(campaignId, accessToken, { name: next });
  } catch {
    /* name patch is best-effort */
  }
}

async function ensureCampaignBidStrategy(
  accessToken: string,
  campaignId: string,
  opts?: {
    bidStrategy?: string | null;
    bidAmount?: number | null;
    roasAverageFloor?: number | null;
  },
): Promise<void> {
  try {
    await graphPostForm(campaignId, accessToken, bidStrategyFields(opts));
  } catch {
    /* campaign may reject bid_strategy; ad set retries still run */
  }
}

async function createPausedReachAdset(
  accessToken: string,
  actId: string,
  campaignId: string,
  args: {
    targetingSpec: Record<string, unknown>;
    adsetName?: string;
    dailyBudget: number;
    lifetimeBudget?: number;
    optimizationGoal: string;
    billingEvent: string;
    promotedObject?: Record<string, unknown> | null;
    useAdsetBudget?: boolean;
    destinationType?: string | null;
    incrementalAttribution?: boolean;
    bidStrategy?: string | null;
    bidAmount?: number | null;
    roasAverageFloor?: number | null;
    startTime?: number | null;
    endTime?: number | null;
  },
): Promise<string> {
  const targeting = sanitizeTargetingForAdset(args.targetingSpec);
  const countryTargeting = countryOnlyTargeting(args.targetingSpec);
  const useAdsetBudget = args.useAdsetBudget !== false;
  const dest = String(args.destinationType ?? "").trim().toUpperCase();
  const goal = String(args.optimizationGoal ?? "").trim().toUpperCase() || "REACH";
  const core: Record<string, string> = {
    name: applyCampaignIdPlaceholder(args.adsetName?.trim() || "Interest Research draft", campaignId),
    campaign_id: campaignId,
    targeting: JSON.stringify(targeting),
    status: "PAUSED",
    billing_event: args.billingEvent || "IMPRESSIONS",
    optimization_goal: goal,
  };
  if (useAdsetBudget) {
    Object.assign(core, budgetAmountFields({
      dailyBudget: args.dailyBudget,
      lifetimeBudget: args.lifetimeBudget,
    }));
    Object.assign(core, bidStrategyFields({
      bidStrategy: args.bidStrategy,
      bidAmount: args.bidAmount,
      roasAverageFloor: args.roasAverageFloor,
    }));
  }
  if (args.startTime) core.start_time = String(args.startTime);
  if (args.endTime) core.end_time = String(args.endTime);
  if (dest && dest !== "NONE") {
    core.destination_type = dest;
  }
  if (args.promotedObject && Object.keys(args.promotedObject).length > 0) {
    core.promoted_object = JSON.stringify(args.promotedObject);
  }
  if (args.incrementalAttribution) {
    core.is_incremental_attribution_enabled = "true";
  }

  const omit = (fields: Record<string, string>, key: string) => {
    const next = { ...fields };
    delete next[key];
    return next;
  };
  const attempts: Array<Record<string, string>> = [core];
  if (core.is_incremental_attribution_enabled) {
    attempts.push(omit(core, "is_incremental_attribution_enabled"));
  }
  const conversionLocked =
    goal === "OFFSITE_CONVERSIONS" ||
    goal === "VALUE" ||
    goal === "CONVERSATIONS" ||
    goal === "QUALITY_CALL" ||
    goal === "APP_INSTALLS";
  if (!conversionLocked && core.destination_type) {
    attempts.push(omit(attempts[attempts.length - 1], "destination_type"));
  }
  if (!conversionLocked && core.promoted_object) {
    attempts.push(omit(attempts[attempts.length - 1], "promoted_object"));
  }
  // CBO: bid lives on the campaign. Sending bid_strategy on the ad set makes Meta
  // treat it as LOWEST_COST_WITH_BID_CAP and demand bid_amount (#1815857).
  if (useAdsetBudget) {
    attempts.push({
      ...core,
      bid_strategy: "LOWEST_COST_WITHOUT_CAP",
    });
  }

  let lastErr: unknown = null;
  for (const fields of attempts) {
    for (const targetingJson of [fields.targeting, JSON.stringify(countryTargeting)]) {
      try {
        const adset = await graphPostForm(`${actId}/adsets`, accessToken, {
          ...fields,
          targeting: targetingJson,
        });
        const adsetId = String(adset.id ?? "");
        if (!adsetId) throw new Error("Failed to create ad set");
        try {
          const applied = JSON.parse(targetingJson) as Record<string, unknown>;
          await graphPostForm(adsetId, accessToken, {
            targeting: JSON.stringify({
              ...applied,
              targeting_automation: { advantage_audience: 0 },
              targeting_relaxation_types: { lookalike: 0, custom_audience: 0 },
            }),
          });
        } catch {
          /* ad set exists; Ads Manager may still show Advantage+ if Graph ignores this */
        }
        return adsetId;
      } catch (err) {
        if (isDeletedOrMissingAdObjectError(err) || isMetaAppCapabilityError(err)) throw err;
        lastErr = err;
        if (isBidAmountRequiredError(err) && fields.bid_strategy) continue;
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Failed to create ad set");
}

async function firstGraphEdgeId(accessToken: string, path: string): Promise<string | null> {
  try {
    const json = await graphGetJson(graphUrl(`${path}?fields=id&limit=5`, accessToken)) as {
      data?: Array<{ id?: string }>;
    };
    const id = String(json.data?.[0]?.id ?? "").trim();
    return id || null;
  } catch {
    return null;
  }
}

async function resolveActFacebookPageId(accessToken: string, actId: string): Promise<string> {
  const pageId =
    (await firstGraphEdgeId(accessToken, `${actId}/assigned_pages`)) ||
    (await firstGraphEdgeId(accessToken, `${actId}/promote_pages`)) ||
    (await firstGraphEdgeId(accessToken, `${actId}/client_pages`));
  if (!pageId) {
    throw new Error(
      "This ad account has no Facebook Page. Assign a Page in Ads Manager, then try again.",
    );
  }
  return pageId;
}

function isMessagingDestinationType(dest: string): boolean {
  const d = dest.toUpperCase();
  return d.includes("MESSENGER") || d.includes("WHATSAPP") || d.includes("INSTAGRAM_DIRECT");
}

async function resolvePageCreativeExtras(
  accessToken: string,
  pageId: string,
): Promise<{ link: string; pictureUrl: string | null; instagramActorId: string | null }> {
  try {
    const json = await graphGetJson(
      graphUrl(`${pageId}?fields=id,link,picture.type(large),instagram_business_account`, accessToken),
    ) as {
      link?: string;
      picture?: { data?: { url?: string } };
      instagram_business_account?: { id?: string };
    };
    return {
      link: String(json.link ?? "").trim() || `https://www.facebook.com/${pageId}`,
      pictureUrl: String(json.picture?.data?.url ?? "").trim() || null,
      instagramActorId: String(json.instagram_business_account?.id ?? "").trim() || null,
    };
  } catch {
    return {
      link: `https://www.facebook.com/${pageId}`,
      pictureUrl: null,
      instagramActorId: null,
    };
  }
}

async function createPausedDraftAd(
  accessToken: string,
  actId: string,
  args: {
    adsetId: string;
    adName: string;
    pageId: string;
    instagramActorId?: string | null;
    messaging?: boolean;
    pictureUrl?: string | null;
    pageLink?: string | null;
    websiteUrl?: string | null;
    imageUrl?: string | null;
    requireWebsiteLink?: boolean;
  },
): Promise<string> {
  const message = args.adName.trim() || "Synckerja draft ad";
  const headline = message.slice(0, 40) || "Draft ad";
  const websiteUrl = String(args.websiteUrl ?? "").trim();
  if (args.requireWebsiteLink && !/^https?:\/\//i.test(websiteUrl)) {
    throw new Error("Website URL is required to create the draft ad.");
  }
  const link = websiteUrl || args.pageLink?.trim() || `https://www.facebook.com/${args.pageId}`;
  const picture = String(args.imageUrl ?? "").trim() || null;
  const objectStorySpec = {
    page_id: args.pageId,
    ...(args.messaging && args.instagramActorId
      ? { instagram_user_id: args.instagramActorId }
      : {}),
    link_data: {
      link,
      message: message.slice(0, 2000),
      name: headline,
      ...(picture ? { picture } : {}),
      call_to_action: args.messaging
        ? { type: "MESSAGE_PAGE" }
        : { type: "LEARN_MORE", value: { link } },
    },
  };
  // standard_enhancements is deprecated (#3858504). Multi-destination ads still
  // require a DOF spec (#2446493) via individual creative features.
  const dofSpec = {
    creative_features_spec: {
      image_enhancement: { enroll_status: "OPT_IN" },
      image_templates: { enroll_status: "OPT_IN" },
      text_optimizations: { enroll_status: "OPT_IN" },
      inline_comment: { enroll_status: "OPT_IN" },
    },
  };

  const creativeAttempts: Array<Record<string, string>> = [
    {
      name: `${message} creative`.slice(0, 80),
      object_story_spec: JSON.stringify(objectStorySpec),
      degrees_of_freedom_spec: JSON.stringify(dofSpec),
    },
    {
      name: `${message} creative`.slice(0, 80),
      object_story_spec: JSON.stringify(objectStorySpec),
    },
  ];

  let lastErr: unknown = null;
  const publishAd = async (creativePayload: Record<string, string>) => {
    const ad = await graphPostForm(`${actId}/ads`, accessToken, {
      name: message.slice(0, 80),
      adset_id: args.adsetId,
      status: "PAUSED",
      ...creativePayload,
    });
    const adId = String(ad.id ?? "").trim();
    if (!adId) throw new Error("Failed to create ad");
    return adId;
  };

  for (const fields of creativeAttempts) {
    try {
      const creative = await graphPostForm(`${actId}/adcreatives`, accessToken, fields);
      const creativeId = String(creative.id ?? "").trim();
      if (!creativeId) continue;
      return await publishAd({ creative: JSON.stringify({ creative_id: creativeId }) });
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Failed to create ad");
}

function optimizationNeedsPixel(goal: string): boolean {
  return goal === "OFFSITE_CONVERSIONS" || goal === "VALUE";
}

function optimizationNeedsPage(goal: string, dest: string): boolean {
  return (
    isMessagingDestinationType(dest) ||
    dest === "PHONE_CALL" ||
    dest === "WEBSITE_AND_CALLS" ||
    goal === "CONVERSATIONS" ||
    goal === "QUALITY_CALL"
  );
}

/** Create PAUSED campaign + ad set + ad. Objective/conversion follow the draft wizard. */
export async function createPausedInterestAdDraft(
  accessToken: string,
  actId: string,
  args: {
    targetingSpec: Record<string, unknown>;
    campaignName?: string;
    adsetName?: string;
    dailyBudget?: number;
    campaignId?: string | null;
    objective?: string | null;
    promotedObject?: Record<string, unknown> | null;
    buyingType?: string | null;
    budgetLevel?: string | null;
    adName?: string | null;
    destinationType?: string | null;
    optimizationGoal?: string | null;
    attributionModel?: string | null;
    websiteUrl?: string | null;
    imageUrl?: string | null;
    lifetimeBudget?: number | null;
    bidStrategy?: string | null;
    bidAmount?: number | null;
    roasAverageFloor?: number | null;
  },
): Promise<{ campaign_id: string; adset_id: string; ad_id: string; status: "PAUSED" }> {
  const campaignName =
    args.campaignName?.trim() || `Synckerja Interest Research ${new Date().toISOString().slice(0, 10)}`;
  const dailyBudget = Math.max(10_000, Math.round(args.dailyBudget ?? 50_000));
  const lifetimeBudget = Math.round(Number(args.lifetimeBudget ?? 0));
  const hasLifetime = Number.isFinite(lifetimeBudget) && lifetimeBudget > 0;
  const nowSec = Math.floor(Date.now() / 1000);
  const endSec = hasLifetime ? nowSec + 7 * 24 * 60 * 60 : null;
  const draft = mapObjectiveToCampaignDraft(args.objective, args.promotedObject);
  const buyingType = String(args.buyingType ?? "AUCTION").toUpperCase() === "RESERVED"
    ? "RESERVED"
    : "AUCTION";
  let campaignBudget = String(args.budgetLevel ?? "CAMPAIGN").toUpperCase() !== "ADSET";
  const attachId = args.campaignId?.trim() || "";
  if (attachId) {
    try {
      const url = graphUrl(
        `${attachId}?fields=daily_budget,lifetime_budget,is_adset_budget_sharing_enabled`,
        accessToken,
      );
      const row = await graphGetJson(url) as Record<string, unknown>;
      campaignBudget = campaignUsesCampaignBudget(row);
    } catch {
      campaignBudget = false;
    }
  }
  const dest = String(args.destinationType ?? "").trim().toUpperCase();
  const goal = String(args.optimizationGoal ?? "").trim().toUpperCase() || draft.optimizationGoal;
  const incremental = String(args.attributionModel ?? "").trim().toLowerCase() === "incremental";
  let promotedObject = args.promotedObject && Object.keys(args.promotedObject).length
    ? { ...args.promotedObject }
    : null;
  if (optimizationNeedsPixel(goal) && !promotedObject?.pixel_id) {
    throw new Error(
      "This conversion setup needs a Meta Pixel on the ad account. Add a pixel in Ads settings, then try again.",
    );
  }

  if (optimizationNeedsPage(goal, dest)) {
    const pageId = await resolveActFacebookPageId(accessToken, actId);
    const pageExtras = await resolvePageCreativeExtras(accessToken, pageId);
    promotedObject = {
      ...(promotedObject ?? {}),
      page_id: pageId,
      ...(pageExtras.instagramActorId && dest.includes("INSTAGRAM")
        ? { instagram_profile_id: pageExtras.instagramActorId }
        : {}),
    };
  }

  const makeAdsetArgs = (useAdsetBudget: boolean) => ({
    targetingSpec: args.targetingSpec,
    adsetName: args.adsetName,
    dailyBudget,
    lifetimeBudget: hasLifetime ? lifetimeBudget : undefined,
    optimizationGoal: goal,
    billingEvent: draft.billingEvent,
    promotedObject,
    useAdsetBudget,
    destinationType: dest || null,
    incrementalAttribution: incremental,
    bidStrategy: args.bidStrategy,
    bidAmount: args.bidAmount,
    roasAverageFloor: args.roasAverageFloor,
    startTime: hasLifetime ? nowSec : null,
    endTime: endSec,
  });
  let campaignId = attachId;
  if (!campaignId) {
    const created = await createPausedCampaign(
      accessToken,
      actId,
      campaignName,
      draft.campaignObjective,
      buyingType,
      {
        campaignBudget,
        dailyBudget: hasLifetime ? undefined : dailyBudget,
        lifetimeBudget: hasLifetime ? lifetimeBudget : undefined,
        bidStrategy: args.bidStrategy,
        bidAmount: args.bidAmount,
        roasAverageFloor: args.roasAverageFloor,
      },
    );
    campaignId = created.id;
    campaignBudget = created.campaignBudget;
    await finalizeCampaignName(accessToken, campaignId, campaignName);
  }
  if (campaignBudget) {
    await ensureCampaignBidStrategy(accessToken, campaignId, {
      bidStrategy: args.bidStrategy,
      bidAmount: args.bidAmount,
      roasAverageFloor: args.roasAverageFloor,
    });
  }

  const createDraftObjects = async (cid: string, useAdsetBudget: boolean) => {
    const adsetId = await createPausedReachAdset(
      accessToken,
      actId,
      cid,
      makeAdsetArgs(useAdsetBudget),
    );
    return { campaign_id: cid, adset_id: adsetId, ad_id: "", status: "PAUSED" as const };
  };

  try {
    return await createDraftObjects(campaignId, !campaignBudget);
  } catch (err) {
    if (attachId && isDeletedOrMissingAdObjectError(err)) {
      const created = await createPausedCampaign(
        accessToken,
        actId,
        campaignName,
        draft.campaignObjective,
        buyingType,
        {
          campaignBudget,
          dailyBudget: hasLifetime ? undefined : dailyBudget,
          lifetimeBudget: hasLifetime ? lifetimeBudget : undefined,
          bidStrategy: args.bidStrategy,
          bidAmount: args.bidAmount,
          roasAverageFloor: args.roasAverageFloor,
        },
      );
      campaignId = created.id;
      campaignBudget = created.campaignBudget;
      await finalizeCampaignName(accessToken, campaignId, campaignName);
      if (campaignBudget) {
        await ensureCampaignBidStrategy(accessToken, campaignId, {
          bidStrategy: args.bidStrategy,
          bidAmount: args.bidAmount,
          roasAverageFloor: args.roasAverageFloor,
        });
      }
      return await createDraftObjects(campaignId, !campaignBudget);
    }
    throw err;
  }
}

function graphUrl(pathAndQuery: string, accessToken: string, version?: string): string {
  const v = version?.trim() || metaGraphVersion();
  const sep = pathAndQuery.includes("?") ? "&" : "?";
  return `https://graph.facebook.com/${v}/${pathAndQuery}${sep}access_token=${encodeURIComponent(accessToken)}`;
}

function numOrNull(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function mapType(
  raw: unknown,
  fallback: MetaTargetingType = "other",
  path: string[] = [],
): MetaTargetingType {
  const s = String(raw ?? "").toLowerCase();
  const pathJoined = path.join(" > ").toLowerCase();
  if (pathJoined.includes("life event") || s.includes("life_event") || s.includes("life event")) {
    return "life_event";
  }
  if (pathJoined.includes("employer") || s.includes("work_employer") || s.includes("employer")) {
    return "work_employer";
  }
  if (pathJoined.includes("industry") || s.includes("industr")) return "industry";
  if (pathJoined.includes("income") || s.includes("income")) return "income";
  if (pathJoined.includes("family") || s.includes("family")) return "family_status";
  if (
    pathJoined.includes("behavior") ||
    pathJoined.includes("behaviour") ||
    s.includes("behavior") ||
    s.includes("behaviour")
  ) {
    return "behavior";
  }
  if (pathJoined.includes("demographic") || s.includes("demographic") || s === "demographics") {
    return "demographic";
  }
  if (pathJoined.includes("interest") || s.includes("interest")) return "interest";
  return fallback;
}

function mapRow(row: Record<string, unknown>, fallbackType: MetaTargetingType): MetaTargetingItem | null {
  const id = String(row.id ?? row.key ?? "").trim();
  const name = String(row.name ?? "").trim();
  if (!id || !name) return null;
  const path = Array.isArray(row.path)
    ? row.path.map((p) => String(p))
    : typeof row.type === "string"
      ? [String(row.type)]
      : [];
  const lower =
    numOrNull(row.audience_size_lower_bound) ??
    numOrNull(row.audience_size) ??
    numOrNull(row.audience_size_lower) ??
    null;
  const upper =
    numOrNull(row.audience_size_upper_bound) ??
    numOrNull(row.audience_size_upper) ??
    lower;
  return {
    id,
    name,
    type: mapType(row.type ?? row.raw_name ?? fallbackType, fallbackType, path),
    path,
    audience_size_lower: lower,
    audience_size_upper: upper,
    description: typeof row.description === "string" ? row.description : null,
  };
}

function dedupeItems(items: MetaTargetingItem[]): MetaTargetingItem[] {
  const seen = new Set<string>();
  const out: MetaTargetingItem[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}

export async function searchAdInterests(
  accessToken: string,
  q: string,
  limit = 50,
): Promise<MetaTargetingItem[]> {
  const query = q.trim();
  if (!query) return [];
  const cap = Math.min(Math.max(limit, 1), 500);
  const rows = await graphGetPagedData(
    graphUrl(
      `search?type=adinterest&q=${encodeURIComponent(query)}&limit=${Math.min(cap, 200)}`,
      accessToken,
    ),
    cap,
  );
  return dedupeItems(
    rows.map((r) => mapRow(r, "interest")).filter((x): x is MetaTargetingItem => Boolean(x)),
  );
}

export async function searchAdWorkEmployers(
  accessToken: string,
  q: string,
  limit = 50,
): Promise<MetaTargetingItem[]> {
  const query = q.trim();
  if (!query) return [];
  const cap = Math.min(Math.max(limit, 1), 500);
  const rows = await graphGetPagedData(
    graphUrl(
      `search?type=adworkemployer&q=${encodeURIComponent(query)}&limit=${Math.min(cap, 200)}`,
      accessToken,
    ),
    cap,
  );
  return dedupeItems(
    rows.map((r) => mapRow(r, "work_employer")).filter((x): x is MetaTargetingItem => Boolean(x)),
  );
}

export function searchQueryVariants(q: string): string[] {
  const trimmed = q.trim();
  if (!trimmed) return [];
  const tokens = trimmed.split(/\s+/).filter((t) => t.length >= 4);
  const out = new Set<string>([trimmed]);
  for (const token of tokens) out.add(token);
  return [...out].slice(0, 4);
}

export async function suggestAdInterests(
  accessToken: string,
  interestList: string[],
): Promise<MetaTargetingItem[]> {
  const list = interestList.map((s) => s.trim()).filter(Boolean).slice(0, 20);
  if (list.length === 0) return [];
  const data = await graphGetJson(
    graphUrl(
      `search?type=adinterestsuggestion&interest_list=${encodeURIComponent(JSON.stringify(list))}`,
      accessToken,
    ),
  );
  const rows = (data as { data?: Array<Record<string, unknown>> }).data ?? [];
  return dedupeItems(
    rows.map((r) => mapRow(r, "interest")).filter((x): x is MetaTargetingItem => Boolean(x)),
  );
}

/** Suggestion IDs are sometimes not valid targeting FB IDs; remap via validate + name search. */
export async function resolveSuggestedInterests(
  accessToken: string,
  items: MetaTargetingItem[],
): Promise<MetaTargetingItem[]> {
  if (!items.length) return [];
  let validity: Array<{ id: string; name: string; valid: boolean; audience_size: number | null }> =
    [];
  try {
    validity = await validateAdInterests(
      accessToken,
      items.map((i) => i.id),
    );
  } catch {
    return items;
  }
  const validMap = new Map(validity.map((v) => [v.id, v]));
  const out: MetaTargetingItem[] = [];
  for (const item of items) {
    const v = validMap.get(item.id);
    if (v?.valid) {
      out.push(item);
      continue;
    }
    try {
      const found = await searchAdInterests(accessToken, item.name, 8);
      const needle = item.name.trim().toLowerCase();
      const match = found.find((x) => x.name.trim().toLowerCase() === needle);
      out.push(
        match
          ? {
              ...item,
              id: match.id,
              type: match.type || item.type,
              path: match.path?.length ? match.path : item.path,
              audience_size_lower: match.audience_size_lower ?? item.audience_size_lower,
              audience_size_upper: match.audience_size_upper ?? item.audience_size_upper,
            }
          : item,
      );
    } catch {
      out.push(item);
    }
  }
  return dedupeItems(out);
}

function targetingListType(item: MetaTargetingItem): string {
  switch (item.type) {
    case "behavior":
      return "behaviors";
    case "life_event":
      return "life_events";
    case "industry":
      return "industries";
    case "income":
      return "income";
    case "family_status":
      return "family_statuses";
    case "work_employer":
      return "work_employers";
    case "demographic":
      return "demographics";
    default:
      return "interests";
  }
}

function categoryClassForType(
  type: MetaTargetingItem["type"],
): "behaviors" | "demographics" | "life_events" | "industries" | "income" | "family_statuses" | null {
  switch (type) {
    case "behavior":
      return "behaviors";
    case "industry":
      return "industries";
    case "life_event":
      return "life_events";
    case "income":
      return "income";
    case "family_status":
      return "family_statuses";
    case "demographic":
      return "demographics";
    default:
      return null;
  }
}

function targetingNameTokens(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9+]+/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 3);
}

/**
 * Detailed Targeting Suggestions:
 * GET /act_{AD_ACCOUNT_ID}/targetingsuggestions
 * targeting_list=[{type, id}], limit max 45.
 * Omit limit_type for mixed demographics/behaviors/interests; also request each seed class.
 */
export async function suggestTargetingFromSelection(
  accessToken: string,
  actId: string,
  seeds: MetaTargetingItem[],
): Promise<MetaTargetingItem[]> {
  const account = actId.trim();
  const targetingList = seeds
    .filter((s) => s.id)
    .slice(0, 20)
    .map((s) => ({
      type: targetingListType(s),
      id: /^\d+$/.test(s.id) ? Number(s.id) : s.id,
    }));
  if (!account || !targetingList.length) return [];
  const limitTypes = [
    "",
    ...new Set(seeds.map((seed) => targetingListType(seed))),
  ];
  const settled = await Promise.allSettled(
    limitTypes.map(async (limitType) => {
      const params = new URLSearchParams({
        targeting_list: JSON.stringify(targetingList),
        limit: "45",
      });
      if (limitType) params.set("limit_type", limitType);
      const data = await graphGetJson(
        graphUrl(`${account}/targetingsuggestions?${params.toString()}`, accessToken),
      );
      const rows = (data as { data?: Array<Record<string, unknown>> }).data ?? [];
      const fallback: MetaTargetingType =
        limitType === "behaviors"
          ? "behavior"
          : limitType === "industries"
            ? "industry"
            : limitType === "life_events"
              ? "life_event"
              : limitType === "income"
                ? "income"
                : limitType === "family_statuses"
                  ? "family_status"
                  : limitType === "demographics"
                    ? "demographic"
                    : limitType === "interests"
                      ? "interest"
                      : "other";
      return rows
        .map((r) => mapRow(r, fallback))
        .filter((x): x is MetaTargetingItem => Boolean(x));
    }),
  );
  const batches = settled
    .filter((r): r is PromiseFulfilledResult<MetaTargetingItem[]> => r.status === "fulfilled")
    .map((r) => r.value);
  return dedupeItems(batches.flat());
}

async function exploreCategoryRelatives(
  accessToken: string,
  seeds: MetaTargetingItem[],
): Promise<MetaTargetingItem[]> {
  const classes = [
    ...new Set(
      seeds
        .map((seed) => categoryClassForType(seed.type))
        .filter((value): value is NonNullable<typeof value> => Boolean(value)),
    ),
  ];
  if (!classes.length) return [];
  const catalogs = await Promise.all(
    classes.map((className) =>
      searchTargetingCategory(accessToken, className).catch(() => [] as MetaTargetingItem[]),
    ),
  );
  const catalog = dedupeItems(catalogs.flat());
  const seedIds = new Set(seeds.map((seed) => seed.id).filter(Boolean));
  const scored: Array<{ item: MetaTargetingItem; score: number }> = [];
  for (const seed of seeds) {
    const seedPath = (seed.path ?? []).map((part) => part.trim().toLowerCase()).filter(Boolean);
    const seedPathJoined = seedPath.join(" > ");
    const seedName = seed.name.trim().toLowerCase();
    const tokens = targetingNameTokens(seed.name);
    for (const item of catalog) {
      if (!item.id || seedIds.has(item.id)) continue;
      const itemPath = (item.path ?? []).map((part) => part.trim().toLowerCase()).filter(Boolean);
      const itemPathJoined = itemPath.join(" > ");
      const itemName = item.name.trim().toLowerCase();
      let score = 0;
      if (itemPath.includes(seedName) || itemName.includes(seedName)) score += 80;
      if (seedPathJoined && itemPathJoined === seedPathJoined) score += 40;
      if (seedPath.length >= 2 && itemPath.slice(0, seedPath.length).join(" > ") === seedPathJoined) {
        score += 25;
      }
      const shared = tokens.filter((token) => itemName.includes(token)).length;
      if (shared) score += shared * 12;
      if (score > 0) scored.push({ item, score });
    }
  }
  scored.sort((a, b) => b.score - a.score);
  return dedupeItems(scored.map((row) => row.item)).slice(0, 45);
}

/**
 * Explore = official Meta suggestion APIs:
 * interests → adinterestsuggestion + targetingsuggestions
 * demographics/behaviors → targetingsuggestions + adTargetingCategory relatives
 * Then adinterestvalid only on interest IDs.
 */
export async function exploreRelatedInterests(
  accessToken: string,
  seeds: MetaTargetingItem[],
  _contextNames: string[] = [],
  actId?: string,
): Promise<MetaTargetingItem[]> {
  const usable = seeds.filter((s) => s.id || s.name.trim()).slice(0, 20);
  if (!usable.length) return [];
  const seedIds = new Set(usable.map((s) => s.id).filter(Boolean));
  const interestNames = [
    ...new Set(
      usable
        .filter((s) => s.type === "interest" || s.type === "other")
        .map((s) => s.name.trim())
        .filter((name) => name.length >= 1),
    ),
  ];

  const [byName, byId, byCategory] = await Promise.all([
    interestNames.length
      ? suggestAdInterests(accessToken, interestNames).catch(() => [] as MetaTargetingItem[])
      : Promise.resolve([] as MetaTargetingItem[]),
    actId
      ? suggestTargetingFromSelection(accessToken, actId, usable).catch(() => [] as MetaTargetingItem[])
      : Promise.resolve([] as MetaTargetingItem[]),
    exploreCategoryRelatives(accessToken, usable).catch(() => [] as MetaTargetingItem[]),
  ]);

  let out = dedupeItems([...byCategory, ...byId, ...byName]).filter(
    (item) => item.id && !seedIds.has(item.id),
  );
  if (!out.length) return [];

  const interestIds = out.filter((item) => item.type === "interest").map((item) => item.id);
  if (interestIds.length) {
    try {
      const validity = await validateAdInterests(accessToken, interestIds);
      if (validity.length) {
        const validIds = new Set(validity.filter((row) => row.valid).map((row) => row.id));
        const knownIds = new Set(validity.map((row) => row.id));
        out = out.filter(
          (item) =>
            item.type !== "interest" || !knownIds.has(item.id) || validIds.has(item.id),
        );
      }
    } catch {
      /* keep Graph suggestion rows if validation is unavailable */
    }
  }

  return out.slice(0, 45);
}

export async function validateAdInterests(
  accessToken: string,
  interestIds: string[],
): Promise<Array<{ id: string; name: string; valid: boolean; audience_size: number | null }>> {
  const ids = interestIds.map((s) => String(s).trim()).filter(Boolean).slice(0, 50);
  if (ids.length === 0) return [];
  const data = await graphGetJson(
    graphUrl(
      `search?type=adinterestvalid&interest_fbid_list=${encodeURIComponent(JSON.stringify(ids))}`,
      accessToken,
    ),
  );
  const rows = (data as { data?: Array<Record<string, unknown>> }).data ?? [];
  return rows.map((r) => ({
    id: String(r.id ?? ""),
    name: String(r.name ?? ""),
    valid: r.valid === true,
    audience_size: numOrNull(r.audience_size),
  }));
}

export async function searchTargetingCategory(
  accessToken: string,
  className: "interests" | "behaviors" | "demographics" | "life_events" | "industries" | "income" | "family_statuses",
): Promise<MetaTargetingItem[]> {
  const data = await graphGetJson(
    graphUrl(`search?type=adTargetingCategory&class=${encodeURIComponent(className)}`, accessToken),
  );
  const rows = (data as { data?: Array<Record<string, unknown>> }).data ?? [];
  const fallback: MetaTargetingType =
    className === "interests"
      ? "interest"
      : className === "behaviors"
        ? "behavior"
        : className === "demographics"
          ? "demographic"
          : className === "life_events"
            ? "life_event"
            : className === "industries"
              ? "industry"
              : className === "income"
                ? "income"
                : "family_status";
  return dedupeItems(
    rows.map((r) => mapRow(r, fallback)).filter((x): x is MetaTargetingItem => Boolean(x)),
  );
}

export function rankSearchItems(items: MetaTargetingItem[], q: string): MetaTargetingItem[] {
  const query = q.trim().toLowerCase();
  const tokens = query
    .split(/[^a-z0-9]+/g)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3);
  const scored = items.map((item) => {
    const name = item.name.toLowerCase();
    const path = (item.path ?? []).join(" ").toLowerCase();
    let score = 0;
    if (name === query) score += 100;
    else if (name.includes(query)) score += 50;
    for (const token of tokens) {
      if (name.includes(token)) score += 12;
      else if (path.includes(token)) score += 4;
    }
    if (item.type === "interest") score += 6;
    return { item, score };
  });
  return scored
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((row) => row.item);
}

export async function searchActTargeting(
  accessToken: string,
  actId: string,
  q: string,
  limitType?: string,
  limit = 50,
): Promise<MetaTargetingItem[]> {
  const query = q.trim();
  if (!query) return [];
  const cap = Math.min(Math.max(limit, 1), 500);
  const params = new URLSearchParams({
    q: query,
    limit: String(Math.min(cap, 200)),
  });
  if (limitType) params.set("limit_type", limitType);
  const rows = await graphGetPagedData(
    graphUrl(`${actId}/targetingsearch?${params.toString()}`, accessToken),
    cap,
  );
  return dedupeItems(
    rows.map((r) => mapRow(r, "other")).filter((x): x is MetaTargetingItem => Boolean(x)),
  );
}

export async function targetingOptionStatus(
  accessToken: string,
  ids: string[],
): Promise<Array<{ id: string; current_status: string; future_plan?: unknown }>> {
  const list = ids.map((s) => String(s).trim()).filter(Boolean).slice(0, 50);
  if (list.length === 0) return [];
  const data = await graphGetJson(
    graphUrl(
      `search?type=targetingoptionstatus&targeting_option_list=${encodeURIComponent(JSON.stringify(list))}`,
      accessToken,
    ),
  );
  const rows = (data as { data?: Array<Record<string, unknown>> }).data ?? [];
  return rows.map((r) => ({
    id: String(r.id ?? ""),
    current_status: String(r.current_status ?? "UNKNOWN"),
    future_plan: r.future_plan,
  }));
}

export async function reachEstimate(
  accessToken: string,
  actId: string,
  targetingSpec: Record<string, unknown>,
): Promise<MetaReachEstimate> {
  // Marketing API (current): only targeting_spec (+ optional object_store_url).
  // `optimize_for` was removed and returns (#100) Invalid parameter.
  const params = new URLSearchParams({
    targeting_spec: JSON.stringify(targetingSpec),
  });
  const data = await graphGetJson(
    graphUrl(`${actId}/reachestimate?${params.toString()}`, accessToken),
  ) as {
    data?: {
      estimate_ready?: boolean;
      users?: number | { lower_bound?: number; upper_bound?: number };
      estimate_dau?: { lower_bound?: number; upper_bound?: number };
      estimate_mau?: { lower_bound?: number; upper_bound?: number };
    };
  };
  const payload = (data.data ?? (data as Record<string, unknown>)) as Record<string, unknown>;
  const users = payload.users;
  let usersLower: number | null = null;
  let usersUpper: number | null = null;
  if (typeof users === "number") {
    usersLower = users;
    usersUpper = users;
  } else if (users && typeof users === "object") {
    const u = users as { lower_bound?: number; upper_bound?: number };
    usersLower = numOrNull(u.lower_bound);
    usersUpper = numOrNull(u.upper_bound);
  }
  // Newer Marketing API shape on AdAccountReachEstimate
  usersLower = usersLower ?? numOrNull(payload.users_lower_bound);
  usersUpper = usersUpper ?? numOrNull(payload.users_upper_bound);
  const dau = payload.estimate_dau as { lower_bound?: number; upper_bound?: number } | undefined;
  const mau = payload.estimate_mau as { lower_bound?: number; upper_bound?: number } | undefined;
  if (usersLower == null && mau) {
    usersLower = numOrNull(mau.lower_bound);
    usersUpper = numOrNull(mau.upper_bound);
  }
  const readyFlag = (payload as { estimate_ready?: boolean }).estimate_ready;
  const estimateReady =
    readyFlag === false
      ? false
      : readyFlag === true
        ? true
        : usersLower != null || usersUpper != null;
  return {
    estimate_ready: estimateReady,
    users_lower: usersLower,
    users_upper: usersUpper,
    estimate_dau_lower: numOrNull(dau?.lower_bound),
    estimate_dau_upper: numOrNull(dau?.upper_bound),
    raw: data,
  };
}

/** Meta Ads Manager will not show reach below 1,000 (privacy floor). */
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

/**
 * Potential Reach is always `{act}/reachestimate` users bounds.
 * Delivery MAU/DAU is not mixed into this field.
 */
export function applyOfficialPotential(args: {
  reach: MetaReachEstimate;
  delivery: {
    mau_lower: number | null;
    mau_upper: number | null;
    estimate_ready: boolean | null;
  };
}): MetaReachEstimate {
  void args.delivery;
  return args.reach;
}

export async function deliveryEstimate(
  accessToken: string,
  actId: string,
  targetingSpec: Record<string, unknown>,
  optimizationGoal = "REACH",
  promotedObject?: Record<string, unknown> | null,
): Promise<unknown> {
  const params = new URLSearchParams({
    targeting_spec: JSON.stringify(targetingSpec),
    optimization_goal: optimizationGoal,
  });
  if (promotedObject && Object.keys(promotedObject).length > 0) {
    params.set("promoted_object", JSON.stringify(promotedObject));
  }
  return graphGetJson(graphUrl(`${actId}/delivery_estimate?${params.toString()}`, accessToken));
}

/** Map Interest Research objective chip → Marketing API optimization_goal. */
export function mapObjectiveToOptimizationGoal(objective: string | null | undefined): string {
  const o = String(objective ?? "").trim().toLowerCase();
  if (o === "conversions" || o === "offsite_conversions") return "OFFSITE_CONVERSIONS";
  if (o === "traffic" || o === "link_clicks") return "LINK_CLICKS";
  if (o === "engagement" || o === "post_engagement") return "POST_ENGAGEMENT";
  if (o === "awareness" || o === "reach") return "REACH";
  return "REACH";
}

export type DailyReachBounds = {
  lower: number | null;
  upper: number | null;
  source: string | null;
};

/** Official Meta DAU bounds only — never invent from budget. */
export function extractDailyReachBounds(args: {
  reach?: MetaReachEstimate | null;
  deliveryRow?: Record<string, unknown> | null;
}): DailyReachBounds {
  const reach = args.reach;
  if (reach && (reach.estimate_dau_lower != null || reach.estimate_dau_upper != null)) {
    return {
      lower: reach.estimate_dau_lower,
      upper: reach.estimate_dau_upper,
      source: "reachestimate.estimate_dau",
    };
  }
  const row = args.deliveryRow;
  if (row) {
    const dauObj = row.estimate_dau as { lower_bound?: number; upper_bound?: number } | undefined;
    const fromObjLower = numOrNull(dauObj?.lower_bound);
    const fromObjUpper = numOrNull(dauObj?.upper_bound);
    if (fromObjLower != null || fromObjUpper != null) {
      return {
        lower: fromObjLower,
        upper: fromObjUpper,
        source: "delivery_estimate.estimate_dau",
      };
    }
    const lower =
      numOrNull(row.estimate_dau_lower_bound) ?? numOrNull(row.estimate_dau_lower);
    const upper =
      numOrNull(row.estimate_dau_upper_bound) ?? numOrNull(row.estimate_dau_upper) ?? lower;
    if (lower != null || upper != null) {
      return {
        lower,
        upper: upper ?? lower,
        source: "delivery_estimate.estimate_dau_bounds",
      };
    }
  }
  return { lower: null, upper: null, source: null };
}

export function firstDeliveryRow(delivery: unknown): Record<string, unknown> | null {
  if (!delivery || typeof delivery !== "object") return null;
  const data = (delivery as { data?: unknown }).data;
  if (Array.isArray(data) && data[0] && typeof data[0] === "object") {
    return data[0] as Record<string, unknown>;
  }
  return delivery as Record<string, unknown>;
}

export function summarizeDeliveryRow(deliveryRow: Record<string, unknown> | null): {
  mau_lower: number | null;
  mau_upper: number | null;
  estimate_ready: boolean | null;
  curve_available: boolean;
} {
  if (!deliveryRow) {
    return {
      mau_lower: null,
      mau_upper: null,
      estimate_ready: null,
      curve_available: false,
    };
  }
  const mauLower =
    numOrNull(deliveryRow.estimate_mau_lower_bound) ??
    numOrNull((deliveryRow.estimate_mau as { lower_bound?: number } | undefined)?.lower_bound);
  const mauUpper =
    numOrNull(deliveryRow.estimate_mau_upper_bound) ??
    numOrNull((deliveryRow.estimate_mau as { upper_bound?: number } | undefined)?.upper_bound) ??
    mauLower;
  return {
    mau_lower: mauLower,
    mau_upper: mauUpper,
    estimate_ready: deliveryRow.estimate_ready === true
      ? true
      : deliveryRow.estimate_ready === false
      ? false
      : null,
    // Meta removed daily_outcomes_curve (Oct 2026); never claim curve availability.
    curve_available: false,
  };
}

export type TargetingSpecEntry = { id: string; name?: string; type?: string; path?: string[] };

function relationshipStatusCode(item: TargetingSpecEntry): number | null {
  const rawId = Number(item.id);
  if (Number.isInteger(rawId) && rawId >= 1 && rawId <= 13) return rawId;
  const name = String(item.name ?? "").trim().toLowerCase();
  const pathJoined = (item.path ?? []).join(" > ").toLowerCase();
  const blob = `${name} ${pathJoined}`;
  if (/\bnewly engaged\b/.test(blob)) return null;
  if (/\bin a relationship\b|\bin_relationship\b/.test(blob)) return 2;
  if (/\bengaged\b/.test(blob) && (pathJoined.includes("relationship") || name === "engaged")) return 4;
  if (/\bmarried\b/.test(blob) && pathJoined.includes("relationship")) return 3;
  if (/^single$/.test(name) || /\brelationship status\b.*\bsingle\b/.test(blob)) return 1;
  if (/civil union/.test(blob)) return 7;
  if (/domestic partnership/.test(blob)) return 8;
  if (/open relationship/.test(blob)) return 9;
  if (/it'?s complicated/.test(blob)) return 10;
  if (/\bseparated\b/.test(blob) && pathJoined.includes("relationship")) return 11;
  if (/\bdivorced\b/.test(blob)) return 12;
  if (/\bwidowed\b/.test(blob)) return 13;
  return null;
}

function coerceRelationshipStatusIds(value: unknown[]): number[] {
  const out: number[] = [];
  const seen = new Set<number>();
  for (const entry of value) {
    let code: number | null = null;
    if (typeof entry === "number" && Number.isInteger(entry)) code = entry;
    else if (typeof entry === "string" && /^\d+$/.test(entry)) code = Number(entry);
    else if (entry && typeof entry === "object") {
      const rec = entry as { id?: unknown; name?: string; path?: string[] };
      code = relationshipStatusCode({
        id: String(rec.id ?? ""),
        name: rec.name,
        path: rec.path,
      });
    }
    if (code == null || code < 1 || code > 13 || seen.has(code)) continue;
    seen.add(code);
    out.push(code);
  }
  return out;
}

function isRelationshipStatusItem(item: TargetingSpecEntry): boolean {
  if (relationshipStatusCode(item) != null) return true;
  const type = String(item.type ?? "").toLowerCase();
  const pathJoined = (item.path ?? []).join(" > ").toLowerCase();
  return type === "demographic" && pathJoined.includes("relationship");
}

/** Map UI/API item types into Meta flexible_spec keys. */
export function flexibleSpecKeyForItem(item: TargetingSpecEntry): string | null {
  const type = String(item.type ?? "").toLowerCase();
  const pathJoined = (item.path ?? []).join(" > ").toLowerCase();
  if (isRelationshipStatusItem(item) || pathJoined.includes("relationship status")) {
    return relationshipStatusCode(item) != null ? "relationship_statuses" : null;
  }
  if (type === "behavior" || type === "behaviours") return "behaviors";
  if (type === "life_event" || pathJoined.includes("life event")) return "life_events";
  if (type === "industry" || pathJoined.includes("industry")) return "industries";
  if (type === "income" || pathJoined.includes("income")) return "income";
  if (type === "family_status" || pathJoined.includes("family status")) return "family_statuses";
  if (
    type === "work_employer" ||
    pathJoined.includes("employer") ||
    pathJoined.includes("work >")
  ) {
    return "work_employers";
  }
  if (type === "interest" || type === "" || type === "other" || type === "demographic") {
    // Default residual to interests only when it looks like an interest path.
    if (pathJoined.includes("behaviour") || pathJoined.includes("behavior")) return "behaviors";
    if (pathJoined.includes("life event")) return "life_events";
    if (pathJoined.includes("employer")) return "work_employers";
    if (type === "demographic" && !pathJoined.includes("interest")) {
      // Unsupported demographic buckets (relationship status etc.) often reject as interests.
      return null;
    }
    if (type === "other" && !pathJoined.includes("interest")) return null;
    return "interests";
  }
  return "interests";
}

export type TargetingPlacementMode =
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
  /** Human label when Meta name is only a code (e.g. ZIP). */
  display_name?: string | null;
  /** For custom_locations / address-like rows. */
  address_string?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  selectable?: boolean;
  radius_km?: number | null;
};

const PLACE_RADIUS_KM = 17;
/**
 * Cities radius in Marketing API is 17–80 km (not 1 km).
 * 1 km is only valid on custom_locations with lat/lng.
 * @see https://developers.facebook.com/docs/marketing-api/audiences/reference/basic-targeting/
 */
const CITY_RADIUS_MIN_KM = 17;

function clampCityRadiusKm(km: number | null | undefined): number {
  const n = km != null && Number.isFinite(Number(km)) ? Math.round(Number(km)) : CITY_RADIUS_MIN_KM;
  return Math.min(80, Math.max(CITY_RADIUS_MIN_KM, n));
}

function clampPinRadiusKm(km: number | null | undefined): number {
  const n = km != null && Number.isFinite(Number(km)) ? Math.round(Number(km)) : 2;
  return Math.min(80, Math.max(1, n));
}

function customLocationRadiusPayload(km: number): { radius: number; distance_unit: "kilometer" } {
  return { radius: clampPinRadiusKm(km), distance_unit: "kilometer" };
}

function locationAddressFallback(loc: MetaGeoLocation): string | null {
  const parts = [
    loc.address_string,
    loc.name,
    loc.primary_city,
    loc.region,
    loc.country_name,
    loc.country_code,
  ]
    .map((p) => (p ? String(p).trim() : ""))
    .filter(Boolean);
  const unique: string[] = [];
  for (const part of parts) {
    if (!unique.some((u) => u.toLowerCase() === part.toLowerCase())) unique.push(part);
  }
  return unique.length ? unique.join(", ") : null;
}

function pushCustomRadius(
  loc: MetaGeoLocation,
  km: number,
  customLocations: Array<Record<string, unknown>>,
): boolean {
  const radiusPayload = customLocationRadiusPayload(km);
  if (loc.latitude != null && loc.longitude != null) {
    customLocations.push({
      latitude: loc.latitude,
      longitude: loc.longitude,
      ...radiusPayload,
    });
    return true;
  }
  const address = locationAddressFallback(loc);
  if (!address) return false;
  customLocations.push({
    address_string: address,
    ...radiusPayload,
  });
  return true;
}

function cityTargetEntry(loc: MetaGeoLocation): { key: string; radius?: number; distance_unit?: string } {
  const km = loc.radius_km;
  if (km != null && Number.isFinite(km) && km >= CITY_RADIUS_MIN_KM) {
    return { key: loc.key, radius: clampCityRadiusKm(km), distance_unit: "kilometer" };
  }
  return { key: loc.key };
}

const JAKARTA_DISTRICT_NAMES = new Set([
  "west jakarta",
  "east jakarta",
  "north jakarta",
  "south jakarta",
  "central jakarta",
  "jakarta barat",
  "jakarta timur",
  "jakarta utara",
  "jakarta selatan",
  "jakarta pusat",
  "kepulauan seribu",
  "thousand islands",
]);

function typeFromGeoHierarchy(hierarchy: string | null | undefined, current: string): string {
  const h = String(hierarchy ?? "")
    .trim()
    .toLowerCase()
    .replace(/_/g, " ");
  if (!h) return current;
  if (h === "district" || h === "subcity" || h === "city district") return "subcity";
  if (h === "city" || h === "medium city" || h === "large city") return current === "subcity" ? current : "city";
  if (h === "region" || h === "state" || h === "province") return "region";
  if (h === "country") return "country";
  if (h === "neighborhood" || h === "community" || h === "urban community") return "neighborhood";
  if (h === "village") return "village";
  if (h === "zip" || h === "zip code" || h === "postal code") return "zip";
  if (h === "place" || h === "landmark") return current || "place";
  return current;
}

/** Normalize Meta adgeolocation type → UI/targeting bucket. */
export function geoBucketForType(type: string): string | null {
  const t = String(type ?? "").trim().toLowerCase();
  if (!t) return null;
  if (t === "country" || t === "country_group") return "countries";
  if (t === "region") return "regions";
  if (
    t === "city" ||
    t === "subcity" ||
    t === "medium_city" ||
    t === "neighborhood" ||
    t === "community" ||
    t === "large_geo_area" ||
    t === "medium_geo_area" ||
    t === "small_geo_area" ||
    t === "metro_area" ||
    t === "subneighborhood" ||
    t === "electoral_district" ||
    t === "village" ||
    t === "subdistrict" ||
    t === "suburb" ||
    t === "district" ||
    t === "town"
  ) {
    return "cities";
  }
  if (t === "zip") return "zips";
  if (t === "place" || t === "landmark") return "places";
  if (t === "address" || t === "municipality" || t === "county") {
    return "custom_locations";
  }
  if (t === "geo_market") return "geo_markets";
  return null;
}

export function normalizeMetaGeoLocation(row: Record<string, unknown>): MetaGeoLocation | null {
  const key = String(row.key ?? row.id ?? "").trim();
  const name = String(row.name ?? row.single_line_address ?? "").trim();
  const hierarchy = row.geo_hierarchy_name != null ? String(row.geo_hierarchy_name) : null;
  let type = String(row.type ?? "").trim().toLowerCase();
  if (type === "adgeolocation") type = "";
  type = typeFromGeoHierarchy(hierarchy, type);
  if (!type && row.single_line_address) type = "address";
  const districtName = name.trim().toLowerCase();
  if (
    JAKARTA_DISTRICT_NAMES.has(districtName) &&
    (type === "city" || type === "place" || type === "landmark" || type === "subcity" || !type)
  ) {
    type = "subcity";
  }
  if (!key || !name || !type) return null;
  const bucket = geoBucketForType(type);
  const lat = numOrNull(row.latitude);
  const lng = numOrNull(row.longitude);
  const address =
    typeof row.address_string === "string" && row.address_string.trim()
      ? row.address_string.trim()
      : type === "address"
      ? name
      : null;
  let selectable = Boolean(bucket);
  if (!selectable && (address || (lat != null && lng != null))) {
    selectable = true;
  }
  return {
    key,
    name,
    type,
    country_code: row.country_code != null ? String(row.country_code) : null,
    country_name: row.country_name != null ? String(row.country_name) : null,
    region: row.region != null ? String(row.region) : null,
    region_id: row.region_id != null ? Number(row.region_id) : null,
    primary_city: row.primary_city != null ? String(row.primary_city) : null,
    supports_city: typeof row.supports_city === "boolean" ? row.supports_city : null,
    supports_region: typeof row.supports_region === "boolean" ? row.supports_region : null,
    geo_hierarchy_level: row.geo_hierarchy_level != null
      ? String(row.geo_hierarchy_level)
      : null,
    geo_hierarchy_name: row.geo_hierarchy_name != null
      ? String(row.geo_hierarchy_name)
      : null,
    address_string: address,
    latitude: lat,
    longitude: lng,
    selectable,
    radius_km: numOrNull(row.radius_km),
  };
}

const GEO_TYPE_PRIORITY: Record<string, number> = {
  country: 1,
  country_group: 2,
  region: 10,
  geo_market: 15,
  city: 20,
  medium_city: 21,
  metro_area: 22,
  large_geo_area: 25,
  medium_geo_area: 26,
  town: 28,
  district: 29,
  subcity: 30,
  village: 31,
  subdistrict: 32,
  suburb: 33,
  neighborhood: 35,
  community: 36,
  subneighborhood: 37,
  small_geo_area: 38,
  zip: 45,
  electoral_district: 50,
  place: 5,
  landmark: 6,
  address: 88,
};

const META_POLYGON_TYPES = new Set([
  "city",
  "medium_city",
  "metro_area",
  "large_geo_area",
  "medium_geo_area",
  "town",
  "district",
  "subcity",
  "village",
  "subdistrict",
  "suburb",
  "neighborhood",
  "community",
  "subneighborhood",
  "small_geo_area",
]);

function isOsmOrPin(loc: MetaGeoLocation): boolean {
  const t = String(loc.type ?? "").toLowerCase();
  const key = String(loc.key ?? "");
  return (
    key.startsWith("osm:") ||
    key.startsWith("pin:") ||
    key.startsWith("gplace:") ||
    t === "place" ||
    t === "landmark" ||
    t === "address"
  );
}

function isCoordinatePinKey(key: string): boolean {
  return key.startsWith("osm:") || key.startsWith("pin:") || key.startsWith("gplace:");
}

function isFacebookPlaceKey(key: string): boolean {
  return /^\d{6,}$/.test(key);
}

const COUNTRY_NAME_ALIASES = new Set([
  "indonesia",
  "malaysia",
  "singapore",
  "thailand",
  "vietnam",
  "philippines",
  "india",
  "japan",
  "australia",
  "united states",
  "united states of america",
  "usa",
  "uk",
  "united kingdom",
  "germany",
  "france",
  "china",
  "south korea",
  "korea",
]);

function isCountryNameQuery(q: string): boolean {
  const n = q.trim().toLowerCase();
  if (n.length < 2) return false;
  if (COUNTRY_NAME_ALIASES.has(n)) return true;
  if (/^[a-z]{2}$/i.test(n)) return true;
  return false;
}

function dropCountryPlaceDupes(hits: MetaGeoLocation[]): MetaGeoLocation[] {
  const countryNames = new Set(
    hits
      .filter((h) => h.type === "country" || h.type === "country_group")
      .map((h) => h.name.trim().toLowerCase()),
  );
  if (!countryNames.size) {
    return hits.filter((h) => {
      if (h.type !== "place" && h.type !== "landmark" && h.type !== "address") return true;
      return !COUNTRY_NAME_ALIASES.has(h.name.trim().toLowerCase());
    });
  }
  return hits.filter((h) => {
    if (h.type === "country" || h.type === "country_group") return true;
    const name = h.name.trim().toLowerCase();
    if (countryNames.has(name)) return false;
    if ((h.type === "place" || h.type === "landmark") && COUNTRY_NAME_ALIASES.has(name)) return false;
    return true;
  });
}

function dropPlacesThatDuplicatePolygons(hits: MetaGeoLocation[]): MetaGeoLocation[] {
  const polygonNames = new Set(
    hits
      .filter((h) => {
        const bucket = geoBucketForType(h.type);
        return bucket === "cities" || bucket === "regions" || bucket === "countries" || bucket === "zips";
      })
      .map((h) => h.name.trim().toLowerCase()),
  );
  if (!polygonNames.size) return hits;
  return hits.filter((h) => {
    if (h.type !== "place" && h.type !== "landmark") return true;
    return !polygonNames.has(h.name.trim().toLowerCase());
  });
}

async function fetchAdGeoBatch(
  accessToken: string,
  args: {
    q: string;
    countryCode?: string | null;
    locationTypes?: string[] | null;
    limit?: number;
    locationTypesRaw?: string | null;
    locale?: string | null;
    graphVersion?: string | null;
  },
): Promise<MetaGeoLocation[]> {
  const params = new URLSearchParams({
    type: "adgeolocation",
    q: args.q,
    limit: String(Math.min(40, Math.max(1, args.limit ?? 20))),
    locale: args.locale?.trim() || "en_US",
  });
  if (args.countryCode?.trim()) {
    params.set("country_code", args.countryCode.trim().toUpperCase());
  }
  if (args.locationTypesRaw) {
    params.set("location_types", args.locationTypesRaw);
  } else if (args.locationTypes?.length) {
    params.set("location_types", JSON.stringify(args.locationTypes));
  }
  const data = await graphGetJson(
    graphUrl(`search?${params.toString()}`, accessToken, args.graphVersion ?? undefined),
  );
  const rows = (data as { data?: Array<Record<string, unknown>> }).data ?? [];
  const out: MetaGeoLocation[] = [];
  for (const row of rows) {
    const item = normalizeMetaGeoLocation(row);
    if (item) out.push(item);
  }
  return out;
}

/** Ads Manager Place typeahead → Graph Place IDs used in geo_locations.places. */
async function searchMetaAdsPlaces(
  accessToken: string,
  args: { q: string; countryCode?: string | null; limit?: number },
): Promise<MetaGeoLocation[]> {
  const q = args.q.trim();
  const per = Math.min(25, Math.max(5, args.limit ?? 20));
  const cc = args.countryCode?.trim().toUpperCase() || null;
  const settled = await Promise.allSettled([
    fetchAdGeoBatch(accessToken, {
      q,
      locationTypes: ["place"],
      limit: per,
      locale: "id_ID",
    }),
    fetchAdGeoBatch(accessToken, {
      q,
      locationTypes: ["place"],
      limit: per,
      locale: "en_US",
    }),
    fetchAdGeoBatch(accessToken, {
      q,
      locationTypesRaw: "['place']",
      limit: per,
      locale: "id_ID",
    }),
    fetchAdGeoBatch(accessToken, {
      q,
      locationTypes: ["place"],
      limit: per,
      locale: "en_US",
      graphVersion: "v18.0",
    }),
    cc
      ? fetchAdGeoBatch(accessToken, {
          q,
          countryCode: cc,
          locationTypes: ["place"],
          limit: per,
          locale: "id_ID",
        })
      : Promise.resolve([] as MetaGeoLocation[]),
    searchGraphPlaces(accessToken, { q, countryCode: cc }),
    ...PLACE_SEARCH_CENTERS.map((center) =>
      searchGraphPlaces(accessToken, { q, countryCode: cc, center }),
    ),
    searchGraphPagesAsPlaces(accessToken, { q, countryCode: cc, limit: per }),
  ]);
  const batches = settled
    .filter((r): r is PromiseFulfilledResult<MetaGeoLocation[]> => r.status === "fulfilled")
    .map((r) => r.value);
  return mergeGeoHits(batches);
}

function mergeGeoHits(batches: MetaGeoLocation[][]): MetaGeoLocation[] {
  const seen = new Set<string>();
  const out: MetaGeoLocation[] = [];
  for (const batch of batches) {
    for (const item of batch) {
      const sig = `${item.type}:${item.key}`;
      if (seen.has(sig)) continue;
      seen.add(sig);
      out.push(item);
    }
  }
  return out;
}

function geoNameScore(item: MetaGeoLocation, q: string): number {
  const query = q.trim().toLowerCase();
  if (!query) return 0;
  const name = item.name.trim().toLowerCase();
  const display = (item.display_name ?? "").trim().toLowerCase();
  const blob = `${name} ${display}`.trim();
  if (name === query) return 100;
  if (name.startsWith(query)) return 90;
  if (display.startsWith(query)) return 80;
  if (name.includes(query) || display.includes(query)) return 70;
  const tokens = query.split(/\s+/).filter((t) => t.length >= 2);
  if (tokens.length > 1 && tokens.every((t) => blob.includes(t))) return 65;
  const hay = `${item.primary_city ?? ""} ${item.region ?? ""} ${item.address_string ?? ""}`.toLowerCase();
  if (hay.includes(query)) return 15;
  if (tokens.length > 1 && tokens.every((t) => hay.includes(t))) return 12;
  return 0;
}

function rankGeoHits(
  items: MetaGeoLocation[],
  q: string,
  countryQuery: boolean,
): MetaGeoLocation[] {
  const scored = items.map((item, index) => ({
    item,
    score: geoNameScore(item, q),
    typeRank: GEO_TYPE_PRIORITY[item.type] ?? 70,
    index,
  }));
  const kept = countryQuery
    ? scored
    : scored.filter((row) => row.score > 0 || row.item.type === "place" || row.item.type === "landmark");
  kept.sort(
    (a, b) =>
      b.score - a.score || a.typeRank - b.typeRank || a.index - b.index,
  );
  return kept.map((row) => row.item);
}

type PostalPlaceHint = {
  names: string[];
  /** Best local name for ZIP row, e.g. Kapuk Muara */
  primaryName: string | null;
  detailLine: string | null;
};

const COUNTRY_BIAS_CENTER: Record<string, { lat: number; lng: number; distanceM: number }> = {
  ID: { lat: -6.2088, lng: 106.8456, distanceM: 250_000 },
  MY: { lat: 3.139, lng: 101.6869, distanceM: 250_000 },
  SG: { lat: 1.3521, lng: 103.8198, distanceM: 80_000 },
  TH: { lat: 13.7563, lng: 100.5018, distanceM: 250_000 },
  PH: { lat: 14.5995, lng: 120.9842, distanceM: 250_000 },
  VN: { lat: 10.8231, lng: 106.6297, distanceM: 250_000 },
  US: { lat: 40.7128, lng: -74.006, distanceM: 400_000 },
  GB: { lat: 51.5074, lng: -0.1278, distanceM: 250_000 },
  AU: { lat: -33.8688, lng: 151.2093, distanceM: 300_000 },
};

const COUNTRY_CODE_BY_NAME: Record<string, string> = {
  indonesia: "ID",
  malaysia: "MY",
  singapore: "SG",
  thailand: "TH",
  vietnam: "VN",
  philippines: "PH",
  india: "IN",
  japan: "JP",
  australia: "AU",
  "united states": "US",
  usa: "US",
  "united kingdom": "GB",
  uk: "GB",
  germany: "DE",
  france: "FR",
  china: "CN",
};

function normalizeCountryCode(raw: unknown, fallback: string | null): string | null {
  const s = String(raw ?? "").trim();
  if (/^[a-z]{2}$/i.test(s)) return s.toUpperCase();
  const mapped = COUNTRY_CODE_BY_NAME[s.toLowerCase()];
  if (mapped) return mapped;
  return fallback;
}

function mapGraphPlaceRow(
  row: Record<string, unknown>,
  fallbackCountry: string | null,
): MetaGeoLocation | null {
  const id = String(row.id ?? "").trim();
  const name = String(row.name ?? "").trim();
  if (!id || !name) return null;
  const loc = (row.location ?? {}) as Record<string, unknown>;
  const address =
    typeof row.single_line_address === "string" && row.single_line_address.trim()
      ? row.single_line_address.trim()
      : loc.street != null
      ? String(loc.street)
      : null;
  const city = loc.city != null ? String(loc.city) : null;
  const region = loc.region != null ? String(loc.region) : city;
  const countryCode = normalizeCountryCode(
    loc.country_code ?? loc.country,
    fallbackCountry,
  );
  const display = [name, city, region, loc.country ?? countryCode].filter(Boolean).join(", ");
  return {
    key: id,
    name,
    type: "place",
    country_code: countryCode,
    country_name: loc.country != null ? String(loc.country) : null,
    region,
    primary_city: city,
    address_string: address ?? (isAddress ? name : null),
    latitude: numOrNull(loc.latitude),
    longitude: numOrNull(loc.longitude),
    selectable: true,
    display_name: display || name,
  };
}

function parseGeoRows(
  data: unknown,
  fallbackCountry: string | null,
): MetaGeoLocation[] {
  const rows = (data as { data?: Array<Record<string, unknown>> }).data ?? [];
  const out: MetaGeoLocation[] = [];
  for (const row of rows) {
    const item =
      mapGraphPlaceRow(row, fallbackCountry) ??
      normalizeMetaGeoLocation(
        row.type ? row : { ...row, type: "place", key: row.key ?? row.id },
      );
    if (item) out.push(item);
  }
  return out;
}

const PLACE_SEARCH_CENTERS: Array<{ lat: number; lng: number; distanceM: number }> = [
  { lat: -6.1083, lng: 106.7408, distanceM: 25_000 }, // PIK / Kapuk Muara
  { lat: -6.1754, lng: 106.8272, distanceM: 40_000 }, // Jakarta
];

/** Graph Place search — Ads Manager Place/Address. Distance max is 50 km. */
async function searchGraphPlaces(
  accessToken: string,
  args: {
    q: string;
    countryCode?: string | null;
    limit?: number;
    center?: { lat: number; lng: number; distanceM: number } | null;
  },
): Promise<MetaGeoLocation[]> {
  const params = new URLSearchParams({
    type: "place",
    q: args.q,
    fields: "id,name,location,single_line_address",
    limit: String(Math.min(25, Math.max(5, args.limit ?? 20))),
  });
  if (args.center) {
    params.set("center", `${args.center.lat},${args.center.lng}`);
    params.set("distance", String(Math.min(50_000, args.center.distanceM)));
  }
  for (const version of [undefined, "v18.0"]) {
    try {
      const data = await graphGetJson(
        graphUrl(`search?${params.toString()}`, accessToken, version),
      );
      const rows = parseGeoRows(data, args.countryCode ?? null);
      if (rows.length) return rows;
    } catch {
      /* Graph type=place is often empty or deprecated on newer versions */
    }
  }
  return [];
}

/** Pages with a location — same Place IDs Ads Manager uses in targeting. */
async function searchGraphPagesAsPlaces(
  accessToken: string,
  args: { q: string; countryCode?: string | null; limit?: number },
): Promise<MetaGeoLocation[]> {
  const limit = String(Math.min(25, Math.max(5, args.limit ?? 20)));
  const fields = "id,name,location,single_line_address";
  const tries = [
    graphUrl(
      `search?type=page&q=${encodeURIComponent(args.q)}&fields=${fields}&limit=${limit}`,
      accessToken,
    ),
    graphUrl(
      `pages/search?q=${encodeURIComponent(args.q)}&fields=${fields}&limit=${limit}`,
      accessToken,
    ),
  ];
  for (const url of tries) {
    try {
      const data = await graphGetJson(url);
      const rows = parseGeoRows(data, args.countryCode ?? null);
      if (rows.length) return rows;
    } catch {
      /* try next Graph place endpoint */
    }
  }
  return [];
}

/** Account-scoped typeahead — can return Place keys Ads Manager uses. */
async function searchAccountTargetingPlaces(
  accessToken: string,
  args: { q: string; adAccountId?: string | null; countryCode?: string | null; limit?: number },
): Promise<MetaGeoLocation[]> {
  const act = String(args.adAccountId ?? "").replace(/^act_/i, "").trim();
  if (!act) return [];
  const params = new URLSearchParams({
    q: args.q,
    limit: String(Math.min(25, Math.max(5, args.limit ?? 20))),
    locale: "id_ID",
  });
  try {
    const data = await graphGetJson(
      graphUrl(`act_${act}/targetingsearch?${params.toString()}`, accessToken),
    );
    const rows = (data as { data?: Array<Record<string, unknown>> }).data ?? [];
    const out: MetaGeoLocation[] = [];
    for (const row of rows) {
      const type = String(row.type ?? "").trim().toLowerCase();
      if (type.includes("interest") || type.includes("behavior") || type.includes("education")) {
        continue;
      }
      const key = String(row.key ?? row.id ?? "").trim();
      const hierarchy = String(row.geo_hierarchy_name ?? "").trim().toLowerCase();
      const isPlaceType = type === "place" || type === "landmark" || hierarchy === "place";
      if (!isPlaceType) continue;
      const item = normalizeMetaGeoLocation({
        ...row,
        key,
        type: "place",
      });
      if (item) out.push(item);
    }
    return out;
  } catch {
    return [];
  }
}

function photonToGeo(row: {
  geometry?: { coordinates?: number[] };
  properties?: Record<string, unknown>;
}, countryCode: string | null): MetaGeoLocation | null {
  const coords = row.geometry?.coordinates;
  const lng = Array.isArray(coords) ? numOrNull(coords[0]) : null;
  const lat = Array.isArray(coords) ? numOrNull(coords[1]) : null;
  if (lat == null || lng == null) return null;
  const p = row.properties ?? {};
  const name = String(p.name ?? p.street ?? p.district ?? "").trim();
  if (!name) return null;
  const cc = p.countrycode != null
    ? String(p.countrycode).toUpperCase()
    : countryCode;
  const city = p.city != null ? String(p.city) : p.county != null ? String(p.county) : null;
  const street = p.street != null ? String(p.street) : null;
  const district = p.district != null ? String(p.district) : null;
  const osmId = p.osm_id != null ? String(p.osm_id) : `${lat},${lng}`;
  const looksAddress = Boolean(street);
  const osmValue = String(p.osm_value ?? p.type ?? "").toLowerCase();
  const isCountry = osmValue === "country" || COUNTRY_NAME_ALIASES.has(name.toLowerCase());
  const detail = [street && street !== name ? street : null, district, city, p.country]
    .filter(Boolean)
    .join(", ");
  if (isCountry && cc) {
    return {
      key: cc,
      name: p.country != null ? String(p.country) : name,
      type: "country",
      country_code: cc,
      country_name: p.country != null ? String(p.country) : name,
      selectable: true,
    };
  }
  return {
    key: `osm:${osmId}`,
    name,
    type: looksAddress ? "address" : "place",
    country_code: cc,
    country_name: p.country != null ? String(p.country) : null,
    region: district || city,
    primary_city: city,
    address_string: detail || null,
    latitude: lat,
    longitude: lng,
    selectable: true,
    display_name: detail ? `${name} · ${detail}` : name,
  };
}

/** Photon (Komoot) — more reliable from cloud IPs than Nominatim. */
async function searchPhotonPlaces(
  q: string,
  countryCode: string | null,
): Promise<MetaGeoLocation[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const params = new URLSearchParams({ q, limit: "15", lang: "en" });
    const cc = countryCode?.trim().toUpperCase() ?? "";
    const center = COUNTRY_BIAS_CENTER[cc];
    if (center) {
      params.set("lat", String(center.lat));
      params.set("lon", String(center.lng));
    }
    const res = await fetch(`https://photon.komoot.io/api/?${params.toString()}`, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "Synckerja-InterestResearch/1.0 (meta-ads geo places)",
      },
    });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      features?: Array<{
        geometry?: { coordinates?: number[] };
        properties?: Record<string, unknown>;
      }>;
    };
    const out: MetaGeoLocation[] = [];
    for (const f of json.features ?? []) {
      const item = photonToGeo(f, countryCode);
      if (item) out.push(item);
    }
    return out;
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

async function searchNominatimPlaces(
  q: string,
  countryCode: string | null,
): Promise<MetaGeoLocation[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const params = new URLSearchParams({
      q,
      format: "json",
      addressdetails: "1",
      limit: "12",
    });
    if (countryCode) params.set("countrycodes", countryCode.toLowerCase());
    const cc = countryCode?.trim().toUpperCase() ?? "";
    const center = COUNTRY_BIAS_CENTER[cc];
    if (center) {
      const d = 1.8;
      params.set(
        "viewbox",
        `${center.lng - d},${center.lat + d},${center.lng + d},${center.lat - d}`,
      );
      params.set("bounded", "0");
    }
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?${params.toString()}`,
      {
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "User-Agent": "SynckerjaInterestResearch/1.0 (office.synckerja.com)",
        },
      },
    );
    if (!res.ok) return [];
    const rows = (await res.json()) as Array<{
      place_id?: number;
      osm_id?: number;
      display_name?: string;
      lat?: string;
      lon?: string;
      address?: Record<string, string>;
    }>;
    const out: MetaGeoLocation[] = [];
    for (const row of rows) {
      const lat = numOrNull(row.lat);
      const lng = numOrNull(row.lon);
      if (lat == null || lng == null) continue;
      const a = row.address ?? {};
      const name =
        a.road ||
        a.suburb ||
        a.neighbourhood ||
        a.village ||
        a.amenity ||
        a.building ||
        row.display_name?.split(",")[0]?.trim() ||
        q;
      const detail = [a.suburb, a.city_district, a.city || a.state, a.country]
        .filter(Boolean)
        .join(", ");
      const key = `osm:${row.osm_id ?? row.place_id ?? `${lat},${lng}`}`;
      out.push({
        key,
        name,
        type: a.road ? "address" : "place",
        country_code: a.country_code?.toUpperCase() ?? countryCode,
        country_name: a.country ?? null,
        region: a.state || a.city_district || null,
        primary_city: a.city || a.town || null,
        address_string: row.display_name ?? null,
        latitude: lat,
        longitude: lng,
        selectable: true,
        display_name: detail ? `${name} · ${detail}` : name,
      });
    }
    return out;
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

function preferCountryHits(
  hits: MetaGeoLocation[],
  countryCode: string | null,
): MetaGeoLocation[] {
  const cc = countryCode?.trim().toUpperCase();
  if (!cc || hits.length === 0) return hits;
  const matched = hits.filter((h) => {
    const hcc = (h.country_code ?? "").toUpperCase();
    if (!hcc) return h.latitude != null && h.longitude != null;
    return hcc === cc || hcc === cc.slice(0, 2);
  });
  return matched.length ? matched : hits;
}

/**
 * Resolve postal-code place names (kelurahan/kecamatan) via OpenStreetMap.
 * Used only to seed Meta adgeolocation search + ZIP display labels — targeting keys stay Meta.
 */
async function resolvePostalPlaceHints(
  postal: string,
  countryCode: string,
): Promise<PostalPlaceHint> {
  const empty: PostalPlaceHint = { names: [], primaryName: null, detailLine: null };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4500);
  try {
    const url =
      `https://nominatim.openstreetmap.org/search?` +
      `postalcode=${encodeURIComponent(postal)}` +
      `&countrycodes=${encodeURIComponent(countryCode.toLowerCase())}` +
      `&format=json&addressdetails=1&limit=8`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "Synckerja-InterestResearch/1.0 (meta-ads geo enrich)",
      },
    });
    if (!res.ok) return empty;
    const rows = (await res.json()) as Array<{
      display_name?: string;
      address?: Record<string, string>;
    }>;
    const names = new Set<string>();
    let primaryName: string | null = null;
    let detailLine: string | null = null;
    for (const row of rows) {
      const a = row.address ?? {};
      const local =
        a.suburb ||
        a.village ||
        a.neighbourhood ||
        a.quarter ||
        a.hamlet ||
        a.city_district ||
        null;
      const district = a.city_district || a.municipality || a.county || a.town || null;
      const city = a.city || a.state || null;
      if (local) {
        names.add(local);
        if (!primaryName) primaryName = local;
      }
      if (district) names.add(district);
      if (city) names.add(city);
      if (a.suburb && a.city_district) names.add(`${a.suburb} ${a.city_district}`);
      if (!detailLine && (local || district || city)) {
        detailLine = [local, district, city].filter(Boolean).join(", ");
      }
      if (row.display_name) {
        // First comma segment often has the place name
        const head = row.display_name.split(",")[0]?.trim();
        if (head && !/^\d+$/.test(head)) names.add(head);
      }
    }
    return {
      names: [...names].filter((n) => n.length >= 3).slice(0, 8),
      primaryName,
      detailLine,
    };
  } catch {
    return empty;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Targeting Search `type=adgeolocation` with official `location_types`
 * (country, country_group, region, city, zip, geo_market, electoral_district)
 * plus `place` — the same Place keys Ads Manager puts in `geo_locations.places`.
 * Graph Place / Pages search uses those Facebook Place IDs.
 */
export async function searchAdGeoLocations(
  accessToken: string,
  args: { q: string; countryCode?: string | null; limit?: number; adAccountId?: string | null },
): Promise<MetaGeoLocation[]> {
  const q = args.q.trim();
  if (q.length < 2) return [];
  const country = args.countryCode?.trim().toUpperCase() || null;
  const per = Math.min(40, Math.max(8, args.limit ?? 25));
  const looksLikeZip = /^\d{4,10}$/.test(q.replace(/\s/g, ""));
  const countryQuery = isCountryNameQuery(q);

  const postalHintsPromise = looksLikeZip && country
    ? resolvePostalPlaceHints(q.replace(/\s/g, ""), country)
    : Promise.resolve({ names: [] as string[], primaryName: null, detailLine: null });

  const settled = await Promise.allSettled([
    fetchAdGeoBatch(accessToken, { q, locationTypes: ["country"], limit: 10 }),
    fetchAdGeoBatch(accessToken, { q, locationTypes: ["country_group"], limit: 8 }),
    fetchAdGeoBatch(accessToken, {
      q,
      countryCode: countryQuery ? null : country,
      locationTypes: ["region"],
      limit: 20,
    }),
    fetchAdGeoBatch(accessToken, { q, locationTypes: ["city"], limit: per }),
    country && !countryQuery
      ? fetchAdGeoBatch(accessToken, {
          q,
          countryCode: country,
          locationTypes: ["city"],
          limit: per,
        })
      : Promise.resolve([] as MetaGeoLocation[]),
    fetchAdGeoBatch(accessToken, {
      q,
      countryCode: countryQuery ? null : country,
      locationTypes: ["zip"],
      limit: 15,
    }),
    fetchAdGeoBatch(accessToken, { q, locationTypes: ["geo_market"], limit: 8 }),
    fetchAdGeoBatch(accessToken, { q, locationTypes: ["electoral_district"], limit: 8 }),
    fetchAdGeoBatch(accessToken, { q, limit: per }),
    countryQuery
      ? Promise.resolve([] as MetaGeoLocation[])
      : searchMetaAdsPlaces(accessToken, { q, countryCode: country, limit: per }),
    countryQuery
      ? Promise.resolve([] as MetaGeoLocation[])
      : searchAccountTargetingPlaces(accessToken, {
          q,
          adAccountId: args.adAccountId,
          countryCode: country,
          limit: per,
        }),
    postalHintsPromise,
  ]);

  const batches: MetaGeoLocation[][] = [];
  let postalHints: PostalPlaceHint = { names: [], primaryName: null, detailLine: null };
  for (const r of settled) {
    if (r.status !== "fulfilled") continue;
    if (Array.isArray(r.value)) batches.push(r.value);
    else if (r.value && typeof r.value === "object" && "names" in r.value) {
      postalHints = r.value as PostalPlaceHint;
    }
  }
  let merged = dropPlacesThatDuplicatePolygons(dropCountryPlaceDupes(mergeGeoHits(batches)));

  if (postalHints.primaryName || postalHints.detailLine) {
    merged = merged.map((hit) => {
      if (hit.type !== "zip") return hit;
      const label = postalHints.primaryName
        ? `${hit.name} · ${postalHints.primaryName}`
        : hit.name;
      return {
        ...hit,
        display_name: label,
        name: label,
        region: postalHints.detailLine ?? hit.region,
      };
    });
  }

  if (looksLikeZip && postalHints.names.length) {
    const expandList = postalHints.names
      .filter((s) => s.trim().length >= 3 && s.toLowerCase() !== q.toLowerCase())
      .slice(0, 6);
    const expandSettled = await Promise.allSettled(
      expandList.map((eq) =>
        fetchAdGeoBatch(accessToken, {
          q: eq,
          countryCode: country,
          locationTypes: ["city"],
          limit: 12,
        }),
      ),
    );
    const expandBatches = expandSettled
      .filter((r): r is PromiseFulfilledResult<MetaGeoLocation[]> => r.status === "fulfilled")
      .map((r) => r.value);
    merged = dropPlacesThatDuplicatePolygons(mergeGeoHits([merged, ...expandBatches]));
  }

  const ranked = rankGeoHits(merged, q, countryQuery);
  const facebookPlaces = ranked.filter(
    (item) =>
      isFacebookPlaceKey(item.key) &&
      (item.type === "place" || item.type === "landmark"),
  );
  const rest = ranked.filter(
    (item) =>
      !(
        isFacebookPlaceKey(item.key) &&
        (item.type === "place" || item.type === "landmark")
      ),
  );
  return [...facebookPlaces, ...rest].slice(0, 40);
}

/**
 * Only Meta targeting keys are estimated:
 * village/city/zip/region/country, or Graph Place IDs (`places[]`).
 * OSM/Photon pins are dropped — they are not Meta geo keys.
 */
export async function resolveLocationsForEstimate(
  accessToken: string,
  selected: MetaGeoLocation[] | null | undefined,
): Promise<MetaGeoLocation[]> {
  const list = selected ?? [];
  const out: MetaGeoLocation[] = [];
  for (const loc of list) {
    if (isCoordinatePinKey(String(loc.key))) {
      const radius = loc.radius_km != null && Number.isFinite(Number(loc.radius_km))
        ? Number(loc.radius_km)
        : 2;
      out.push({ ...loc, radius_km: radius });
      continue;
    }
    if (String(loc.key).startsWith("osm:")) {
      const q = loc.name.trim();
      if (q.length < 2) continue;
      const hits = await fetchAdGeoBatch(accessToken, {
        q,
        countryCode: loc.country_code,
        locationTypes: ["city"],
        limit: 20,
      });
      const qn = q.toLowerCase();
      const exact = rankGeoHits(hits, q, false).find(
        (h) => META_POLYGON_TYPES.has(h.type) && h.name.trim().toLowerCase() === qn,
      );
      if (exact) out.push({ ...exact, radius_km: null });
      continue;
    }
    if (isOsmOrPin(loc)) {
      const wantsRadius = loc.radius_km != null && Number.isFinite(Number(loc.radius_km));
      out.push(wantsRadius ? loc : { ...loc, radius_km: 2 });
      continue;
    }
    out.push(loc);
  }
  return out;
}

/** Build Meta geo_locations from selected search hits. Empty → fallback country. */
export function buildGeoLocations(
  selected: MetaGeoLocation[] | null | undefined,
  fallbackCountryCode = "ID",
): Record<string, unknown> {
  const list = (selected ?? []).filter((l) => l && l.key && l.selectable !== false);
  if (!list.length) {
    return { countries: [fallbackCountryCode || "ID"] };
  }

  const countries: string[] = [];
  const regions: Array<{ key: string }> = [];
  const cities: Array<{ key: string; radius?: number; distance_unit?: string }> = [];
  const zips: Array<{ key: string }> = [];
  const places: Array<{
    key: string;
    name?: string;
    radius: number;
    distance_unit: string;
  }> = [];
  const customLocations: Array<Record<string, unknown>> = [];
  const geoMarkets: Array<{ key: string; name?: string }> = [];

  for (const loc of list) {
    if (isCoordinatePinKey(String(loc.key))) {
      const radiusKm = loc.radius_km != null && Number.isFinite(Number(loc.radius_km))
        ? Number(loc.radius_km)
        : 2;
      if (loc.latitude != null && loc.longitude != null) {
        customLocations.push({
          latitude: loc.latitude,
          longitude: loc.longitude,
          ...customLocationRadiusPayload(radiusKm),
        });
      }
      continue;
    }
    const bucket = geoBucketForType(loc.type);
    if (bucket === "countries") {
      if (!countries.includes(loc.key)) countries.push(loc.key);
      continue;
    }
    if (bucket === "regions") {
      if (!regions.some((r) => r.key === loc.key)) regions.push({ key: loc.key });
      continue;
    }
    if (bucket === "cities") {
      const requested = loc.radius_km;
      if (
        requested != null &&
        requested < CITY_RADIUS_MIN_KM &&
        loc.latitude != null &&
        loc.longitude != null &&
        pushCustomRadius(loc, requested, customLocations)
      ) {
        continue;
      }
      if (!cities.some((c) => c.key === loc.key)) cities.push(cityTargetEntry(loc));
      continue;
    }
    if (bucket === "zips") {
      if (!zips.some((z) => z.key === loc.key)) zips.push({ key: loc.key });
      continue;
    }
    if (bucket === "places") {
      if (isCoordinatePinKey(String(loc.key))) continue;
      const placeRadius = loc.radius_km != null && Number.isFinite(Number(loc.radius_km))
        ? Number(loc.radius_km)
        : 2;
      if (!places.some((p) => String(p.key) === String(loc.key))) {
        places.push({
          key: String(loc.key),
          radius: clampPinRadiusKm(placeRadius),
          distance_unit: "kilometer",
        });
      }
      continue;
    }
    if (bucket === "geo_markets") {
      if (!geoMarkets.some((g) => g.key === loc.key)) {
        geoMarkets.push({ key: loc.key, name: loc.name });
      }
      continue;
    }
    if (
      bucket === "custom_locations" ||
      String(loc.key).startsWith("pin:") ||
      loc.address_string ||
      (loc.latitude != null && loc.longitude != null)
    ) {
      const radiusKm = loc.radius_km != null && Number.isFinite(Number(loc.radius_km))
        ? Number(loc.radius_km)
        : 2;
      if (loc.latitude != null && loc.longitude != null) {
        customLocations.push({
          latitude: loc.latitude,
          longitude: loc.longitude,
          ...customLocationRadiusPayload(radiusKm),
        });
        continue;
      }
      if (loc.key && !String(loc.key).startsWith("osm:") && !String(loc.key).startsWith("pin:") && META_POLYGON_TYPES.has(String(loc.type ?? "").toLowerCase())) {
        if (!cities.some((c) => c.key === loc.key)) cities.push(cityTargetEntry(loc));
      }
    }
  }

  const geo: Record<string, unknown> = {};
  const hasPinCircle = customLocations.length > 0 || places.length > 0;
  // Pin/place circle is specific; OR-ing the parent country (ID) inflates reach to national scale.
  if (countries.length && !hasPinCircle) geo.countries = countries;
  if (regions.length) geo.regions = regions;
  if (cities.length) geo.cities = cities;
  if (zips.length) geo.zips = zips;
  if (places.length) geo.places = places;
  if (customLocations.length) geo.custom_locations = customLocations;
  if (geoMarkets.length) geo.geo_markets = geoMarkets;
  // Ads Manager pin/place estimate uses people living in the radius (home).
  // Country/city polygons keep Meta default home + recently in.
  if (Object.keys(geo).length) {
    // Marketing API only accepts ['home','recent'] for location_types.
    geo.location_types = ["home", "recent"];
  }

  if (!Object.keys(geo).length) {
    return { countries: [fallbackCountryCode || "ID"] };
  }
  return geo;
}

export function parseMetaGeoLocations(raw: unknown): MetaGeoLocation[] {
  if (!Array.isArray(raw)) return [];
  const out: MetaGeoLocation[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const item = normalizeMetaGeoLocation(row as Record<string, unknown>);
    if (item && item.selectable !== false) out.push(item);
  }
  return out.slice(0, 10);
}

export function locationsFingerprint(locations: MetaGeoLocation[]): string {
  return locations
    .map((l) => `${l.type}:${l.key}:${l.radius_km ?? ""}:${l.latitude ?? ""}:${l.longitude ?? ""}`)
    .sort()
    .join(",");
}

export function buildInterestTargetingSpec(args: {
  countryCodes: string[];
  interests?: Array<{ id: string; name?: string }>;
  behaviors?: Array<{ id: string; name?: string }>;
  lifeEvents?: Array<{ id: string; name?: string }>;
  industries?: Array<{ id: string; name?: string }>;
  income?: Array<{ id: string; name?: string }>;
  familyStatuses?: Array<{ id: string; name?: string }>;
  workEmployers?: Array<{ id: string; name?: string }>;
  items?: TargetingSpecEntry[];
  ageMin?: number;
  ageMax?: number;
  /** Meta genders: 1=male, 2=female. Empty/omit = all. */
  genders?: number[];
  /** Automatic = omit publisher_platforms (Advantage+ default). */
  placement?: TargetingPlacementMode | string | null;
  /** Prefer over countryCodes when non-empty. */
  selectedLocations?: MetaGeoLocation[] | null;
  geoLocations?: Record<string, unknown> | null;
  /** Meta reachestimate is picky; prefer id-only targeting entries. */
  idsOnly?: boolean;
}): Record<string, unknown> {
  const idsOnly = args.idsOnly !== false;
  const flexible: Record<string, unknown> = {};
  const push = (key: string, entry: { id: string; name?: string }) => {
    const list = (flexible[key] as Array<{ id: string; name?: string }> | undefined) ?? [];
    if (list.some((x) => x.id === entry.id)) return;
    list.push(idsOnly ? { id: entry.id } : entry.name ? { id: entry.id, name: entry.name } : { id: entry.id });
    flexible[key] = list;
  };

  if (args.interests?.length) for (const i of args.interests) push("interests", i);
  if (args.behaviors?.length) for (const i of args.behaviors) push("behaviors", i);
  if (args.lifeEvents?.length) for (const i of args.lifeEvents) push("life_events", i);
  if (args.industries?.length) for (const i of args.industries) push("industries", i);
  if (args.income?.length) for (const i of args.income) push("income", i);
  if (args.familyStatuses?.length) for (const i of args.familyStatuses) push("family_statuses", i);
  if (args.workEmployers?.length) for (const i of args.workEmployers) push("work_employers", i);

  for (const item of args.items ?? []) {
    const key = flexibleSpecKeyForItem(item);
    if (!key || !item.id) continue;
    if (key === "relationship_statuses") {
      const code = relationshipStatusCode(item);
      if (code == null) continue;
      push(key, { id: String(code), name: item.name });
      continue;
    }
    push(key, { id: item.id, name: item.name });
  }

  const genders = (args.genders ?? []).filter((g) => g === 1 || g === 2);
  const placement = String(args.placement ?? "automatic").trim().toLowerCase();
  const publisherPlatforms =
    placement === "facebook"
      ? ["facebook"]
      : placement === "instagram"
      ? ["instagram"]
      : placement === "audience_network"
      ? ["audience_network"]
      : placement === "messenger"
      ? ["messenger"]
      : null;

  const fallbackCountry = args.countryCodes.length ? args.countryCodes[0] : "ID";
  const geoLocations =
    args.geoLocations && Object.keys(args.geoLocations).length > 0
      ? args.geoLocations
      : buildGeoLocations(args.selectedLocations, fallbackCountry);

  return {
    geo_locations: geoLocations,
    age_min: args.ageMin ?? 18,
    age_max: args.ageMax ?? 65,
    ...(genders.length ? { genders } : {}),
    ...(publisherPlatforms ? { publisher_platforms: publisherPlatforms } : {}),
    ...(Object.keys(flexible).length ? { flexible_spec: [flexible] } : {}),
  };
}

/** OR-union of two targeting specs for reachestimate (separate flexible_spec rows = OR). */
export function buildUnionTargetingSpec(
  specA: Record<string, unknown>,
  specB: Record<string, unknown>,
): Record<string, unknown> {
  const flexA = ((specA.flexible_spec as Array<Record<string, unknown>> | undefined) ?? []).map(
    (row) => stripNamesFromFlexibleRow(row),
  );
  const flexB = ((specB.flexible_spec as Array<Record<string, unknown>> | undefined) ?? []).map(
    (row) => stripNamesFromFlexibleRow(row),
  );

  // Same single key on both sides → merge IDs into one OR list (cleaner for Meta).
  if (flexA.length === 1 && flexB.length === 1) {
    const keysA = Object.keys(flexA[0]);
    const keysB = Object.keys(flexB[0]);
    if (keysA.length === 1 && keysB.length === 1 && keysA[0] === keysB[0]) {
      const key = keysA[0];
      const left = (flexA[0][key] as Array<{ id: string }>) ?? [];
      const right = (flexB[0][key] as Array<{ id: string }>) ?? [];
      const seen = new Set<string>();
      const merged: Array<{ id: string }> = [];
      for (const e of [...left, ...right]) {
        if (!e?.id || seen.has(e.id)) continue;
        seen.add(e.id);
        merged.push({ id: e.id });
      }
      return {
        geo_locations: specA.geo_locations,
        age_min: specA.age_min ?? 18,
        age_max: specA.age_max ?? 65,
        ...(specA.genders ? { genders: specA.genders } : {}),
        ...(specA.publisher_platforms
          ? { publisher_platforms: specA.publisher_platforms }
          : {}),
        flexible_spec: [{ [key]: merged }],
      };
    }
  }

  // Different keys/classes → OR via multiple flexible_spec objects (AND inside each object).
  return {
    geo_locations: specA.geo_locations,
    age_min: specA.age_min ?? 18,
    age_max: specA.age_max ?? 65,
    ...(specA.genders ? { genders: specA.genders } : {}),
    ...(specA.publisher_platforms
      ? { publisher_platforms: specA.publisher_platforms }
      : {}),
    flexible_spec: [...flexA, ...flexB],
  };
}

/** OR-union of many targeting items (Interest Group). Same-key IDs merge; mixed keys stay separate flexible_spec rows. */
export function buildUnionInterestTargetingSpec(
  args: Omit<Parameters<typeof buildInterestTargetingSpec>[0], "interests" | "behaviors" | "lifeEvents" | "industries" | "income" | "familyStatuses" | "workEmployers"> & {
    items: TargetingSpecEntry[];
  },
): Record<string, unknown> {
  const items = (args.items ?? []).filter((item) => item?.id);
  if (!items.length) {
    return buildInterestTargetingSpec({ ...args, items: [] });
  }
  let spec = buildInterestTargetingSpec({ ...args, items: [items[0]] });
  for (let i = 1; i < items.length; i++) {
    spec = buildUnionTargetingSpec(
      spec,
      buildInterestTargetingSpec({ ...args, items: [items[i]] }),
    );
  }
  return spec;
}

function stripNamesFromFlexibleRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(row)) {
    if (!Array.isArray(val)) {
      out[key] = val;
      continue;
    }
    out[key] = val
      .map((entry) => {
        if (entry && typeof entry === "object" && "id" in entry) {
          return { id: String((entry as { id: unknown }).id) };
        }
        return entry;
      })
      .filter(Boolean);
  }
  return out;
}

/**
 * AND (narrow) of two targeting specs for reachestimate.
 * Separate flexible_spec rows = Ads Manager "Narrow further".
 * Never merge same-key IDs into one array — that is OR.
 */
export function buildIntersectionTargetingSpec(
  specA: Record<string, unknown>,
  specB: Record<string, unknown>,
): Record<string, unknown> {
  const flexA = ((specA.flexible_spec as Array<Record<string, unknown>> | undefined) ?? []).map(
    (row) => stripNamesFromFlexibleRow(row),
  );
  const flexB = ((specB.flexible_spec as Array<Record<string, unknown>> | undefined) ?? []).map(
    (row) => stripNamesFromFlexibleRow(row),
  );
  return {
    geo_locations: specA.geo_locations,
    age_min: specA.age_min ?? 18,
    age_max: specA.age_max ?? 65,
    ...(specA.genders ? { genders: specA.genders } : {}),
    ...(specA.publisher_platforms ? { publisher_platforms: specA.publisher_platforms } : {}),
    flexible_spec: [...flexA, ...flexB],
  };
}

/** Each nonempty group is OR (union). Groups are AND (stacked flexible_spec / Narrow). */
export function buildGroupedInterestTargetingSpec(
  args: Omit<Parameters<typeof buildUnionInterestTargetingSpec>[0], "items"> & {
    groups: TargetingSpecEntry[][];
  },
): Record<string, unknown> {
  const { groups: rawGroups, ...shared } = args;
  const groups = (rawGroups ?? []).filter((group) =>
    group.some((item) => String(item?.id ?? "").trim()),
  );
  if (!groups.length) {
    return buildInterestTargetingSpec({ ...shared, items: [] });
  }
  let spec = buildUnionInterestTargetingSpec({ ...shared, items: groups[0] });
  for (let i = 1; i < groups.length; i++) {
    spec = buildIntersectionTargetingSpec(
      spec,
      buildUnionInterestTargetingSpec({ ...shared, items: groups[i] }),
    );
  }
  return spec;
}

/** Approximate overlap from reach A, B, A∪B: max(0, a+b-union). Prefer AND reachestimate. */
export function approxOverlap(a: number, b: number, unionAb: number): {
  overlap: number;
  overlap_pct_of_smaller: number | null;
} {
  const overlap = Math.max(0, a + b - unionAb);
  const smaller = Math.min(a, b);
  return {
    overlap,
    overlap_pct_of_smaller: smaller > 0 ? Math.min(100, (overlap / smaller) * 100) : null,
  };
}

export type TargetingSpikeReport = {
  ok: boolean;
  pages_targeting_go: boolean;
  /** True only when Meta still returns official DAU bounds on reach or delivery. */
  daily_reach_available: boolean;
  checks: Array<{ name: string; ok: boolean; detail: string; sample?: unknown }>;
};

export async function runTargetingSpike(
  accessToken: string,
  actId: string,
  countryCode = "ID",
): Promise<TargetingSpikeReport> {
  const checks: TargetingSpikeReport["checks"] = [];
  let sampleInterest: MetaTargetingItem | null = null;

  try {
    const interests = await searchAdInterests(accessToken, "sate", 10);
    sampleInterest = interests[0] ?? null;
    checks.push({
      name: "adinterest",
      ok: interests.length > 0,
      detail: `${interests.length} results`,
      sample: interests.slice(0, 3).map((i) => ({ id: i.id, name: i.name, size: i.audience_size_lower })),
    });
  } catch (e) {
    checks.push({ name: "adinterest", ok: false, detail: e instanceof Error ? e.message : String(e) });
  }

  try {
    const seed = sampleInterest?.name ? [sampleInterest.name] : ["Cooking"];
    const suggested = await suggestAdInterests(accessToken, seed);
    checks.push({
      name: "adinterestsuggestion",
      ok: suggested.length > 0,
      detail: `${suggested.length} suggestions for ${seed.join(",")}`,
      sample: suggested.slice(0, 3).map((i) => ({ id: i.id, name: i.name })),
    });
  } catch (e) {
    checks.push({
      name: "adinterestsuggestion",
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    });
  }

  if (sampleInterest) {
    try {
      const validated = await validateAdInterests(accessToken, [sampleInterest.id]);
      checks.push({
        name: "adinterestvalid",
        ok: validated.some((v) => v.valid),
        detail: JSON.stringify(validated),
      });
    } catch (e) {
      checks.push({
        name: "adinterestvalid",
        ok: false,
        detail: e instanceof Error ? e.message : String(e),
      });
    }
  }

  try {
    const actSearch = await searchActTargeting(accessToken, actId, "sate", undefined, 15);
    checks.push({
      name: "targetingsearch",
      ok: actSearch.length > 0,
      detail: `${actSearch.length} results`,
      sample: actSearch.slice(0, 3).map((i) => ({ id: i.id, name: i.name, type: i.type })),
    });
  } catch (e) {
    checks.push({
      name: "targetingsearch",
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    });
  }

  try {
    const behaviors = await searchTargetingCategory(accessToken, "behaviors");
    checks.push({
      name: "adTargetingCategory_behaviors",
      ok: behaviors.length > 0,
      detail: `${behaviors.length} behaviors`,
    });
  } catch (e) {
    checks.push({
      name: "adTargetingCategory_behaviors",
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    });
  }

  try {
    const demos = await searchTargetingCategory(accessToken, "demographics");
    checks.push({
      name: "adTargetingCategory_demographics",
      ok: demos.length > 0,
      detail: `${demos.length} demographics`,
    });
  } catch (e) {
    checks.push({
      name: "adTargetingCategory_demographics",
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    });
  }

  let dailyReachAvailable = false;
  let spikeSpec: Record<string, unknown> | null = null;
  let spikeReach: MetaReachEstimate | null = null;

  try {
    spikeSpec = buildInterestTargetingSpec({
      countryCodes: [countryCode],
      interests: sampleInterest
        ? [{ id: sampleInterest.id, name: sampleInterest.name }]
        : undefined,
      idsOnly: true,
    });
    spikeReach = await reachEstimate(accessToken, actId, spikeSpec);
    const reachDaily = extractDailyReachBounds({ reach: spikeReach });
    if (reachDaily.source) dailyReachAvailable = true;
    checks.push({
      name: "reachestimate",
      ok: spikeReach.estimate_ready &&
        (spikeReach.users_lower != null || spikeReach.users_upper != null),
      detail: `ready=${spikeReach.estimate_ready} users=${spikeReach.users_lower}-${spikeReach.users_upper} dau=${reachDaily.lower}-${reachDaily.upper}`,
      sample: {
        users_lower: spikeReach.users_lower,
        users_upper: spikeReach.users_upper,
        dau_lower: spikeReach.estimate_dau_lower,
        dau_upper: spikeReach.estimate_dau_upper,
        daily_source: reachDaily.source,
        raw_keys: spikeReach.raw && typeof spikeReach.raw === "object"
          ? Object.keys(
            ((spikeReach.raw as { data?: Record<string, unknown> }).data ??
              spikeReach.raw) as Record<string, unknown>,
          )
          : [],
      },
    });
  } catch (e) {
    checks.push({
      name: "reachestimate",
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    });
  }

  if (spikeSpec) {
    try {
      const delivery = await deliveryEstimate(accessToken, actId, spikeSpec, "REACH");
      const row = firstDeliveryRow(delivery);
      const deliveryDaily = extractDailyReachBounds({
        reach: spikeReach,
        deliveryRow: row,
      });
      if (deliveryDaily.source?.startsWith("delivery_estimate")) dailyReachAvailable = true;
      const summary = summarizeDeliveryRow(row);
      checks.push({
        name: "delivery_estimate_reach",
        ok: row != null,
        detail: `mau=${summary.mau_lower}-${summary.mau_upper} dau=${deliveryDaily.lower}-${deliveryDaily.upper} daily_source=${deliveryDaily.source ?? "none"}`,
        sample: {
          keys: row ? Object.keys(row) : [],
          mau_lower: summary.mau_lower,
          mau_upper: summary.mau_upper,
          daily: deliveryDaily,
        },
      });
    } catch (e) {
      checks.push({
        name: "delivery_estimate_reach",
        ok: false,
        detail: e instanceof Error ? e.message : String(e),
      });
    }

    try {
      const deliveryConv = await deliveryEstimate(
        accessToken,
        actId,
        spikeSpec,
        "OFFSITE_CONVERSIONS",
      );
      const row = firstDeliveryRow(deliveryConv);
      checks.push({
        name: "delivery_estimate_conversions",
        ok: row != null,
        detail: row
          ? `keys=${Object.keys(row).join(",")}`
          : "empty",
        sample: row ? { keys: Object.keys(row) } : null,
      });
    } catch (e) {
      checks.push({
        name: "delivery_estimate_conversions",
        ok: false,
        detail: e instanceof Error ? e.message : String(e),
      });
    }
  }

  checks.push({
    name: "daily_reach_available",
    ok: dailyReachAvailable,
    detail: dailyReachAvailable
      ? "Meta still returns estimate_dau bounds"
      : "Meta does not return estimate_dau (removed Oct 2026) — UI must show —",
  });

  // Granular geo spike (adgeolocation + city vs country reachestimate)
  let jakartaHits: MetaGeoLocation[] = [];
  try {
    jakartaHits = await searchAdGeoLocations(accessToken, {
      q: "jakarta",
      countryCode,
      limit: 15,
    });
    const types = [...new Set(jakartaHits.map((h) => h.type))];
    checks.push({
      name: "adgeolocation_jakarta",
      ok: jakartaHits.length > 0,
      detail: `${jakartaHits.length} hits types=[${types.join(",")}]`,
      sample: jakartaHits.slice(0, 5).map((h) => ({
        key: h.key,
        name: h.name,
        type: h.type,
        selectable: h.selectable,
      })),
    });
  } catch (e) {
    checks.push({
      name: "adgeolocation_jakarta",
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    });
  }

  try {
    const placeHits = await searchAdGeoLocations(accessToken, {
      q: "elang laut",
      countryCode,
      limit: 15,
    });
    const types = [...new Set(placeHits.map((h) => h.type))];
    const hasPlaceOrAddress = placeHits.some((h) =>
      ["place", "landmark", "address"].includes(h.type)
    );
    checks.push({
      name: "adgeolocation_elang_laut",
      ok: placeHits.length > 0,
      detail: `${placeHits.length} hits types=[${types.join(",")}] place_or_address=${hasPlaceOrAddress}`,
      sample: placeHits.slice(0, 5).map((h) => ({
        key: h.key,
        name: h.name,
        type: h.type,
        selectable: h.selectable,
      })),
    });
  } catch (e) {
    checks.push({
      name: "adgeolocation_elang_laut",
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    });
  }

  try {
    const zipHits = await searchAdGeoLocations(accessToken, {
      q: "10110",
      countryCode,
      limit: 10,
    });
    const types = [...new Set(zipHits.map((h) => h.type))];
    checks.push({
      name: "adgeolocation_zip",
      ok: zipHits.some((h) => h.type === "zip") || zipHits.length > 0,
      detail: `${zipHits.length} hits types=[${types.join(",")}]`,
      sample: zipHits.slice(0, 3).map((h) => ({ key: h.key, name: h.name, type: h.type })),
    });
  } catch (e) {
    checks.push({
      name: "adgeolocation_zip",
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    });
  }

  const cityHit =
    jakartaHits.find((h) => geoBucketForType(h.type) === "cities") ?? null;
  if (cityHit && sampleInterest) {
    try {
      const citySpec = buildInterestTargetingSpec({
        countryCodes: [countryCode],
        interests: [{ id: sampleInterest.id, name: sampleInterest.name }],
        selectedLocations: [cityHit],
        idsOnly: true,
      });
      const cityReach = await reachEstimate(accessToken, actId, citySpec);
      const countryUsers = spikeReach?.users_upper ?? spikeReach?.users_lower;
      const cityUsers = cityReach.users_upper ?? cityReach.users_lower;
      const changed =
        countryUsers != null && cityUsers != null && countryUsers !== cityUsers;
      checks.push({
        name: "reachestimate_city_vs_country",
        ok: cityReach.estimate_ready && (cityReach.users_lower != null || cityReach.users_upper != null),
        detail: `city=${cityReach.users_lower}-${cityReach.users_upper} country=${spikeReach?.users_lower}-${spikeReach?.users_upper} changed=${changed}`,
        sample: { city: cityHit, geo: citySpec.geo_locations },
      });
    } catch (e) {
      checks.push({
        name: "reachestimate_city_vs_country",
        ok: false,
        detail: e instanceof Error ? e.message : String(e),
      });
    }

    const city2 = jakartaHits.filter((h) => geoBucketForType(h.type) === "cities").slice(0, 2);
    if (city2.length === 2 && sampleInterest) {
      try {
        const multiSpec = buildInterestTargetingSpec({
          countryCodes: [countryCode],
          interests: [{ id: sampleInterest.id, name: sampleInterest.name }],
          selectedLocations: city2,
          idsOnly: true,
        });
        const multiReach = await reachEstimate(accessToken, actId, multiSpec);
        checks.push({
          name: "reachestimate_multi_city",
          ok: multiReach.estimate_ready &&
            (multiReach.users_lower != null || multiReach.users_upper != null),
          detail: `users=${multiReach.users_lower}-${multiReach.users_upper}`,
          sample: { geo: multiSpec.geo_locations },
        });
      } catch (e) {
        checks.push({
          name: "reachestimate_multi_city",
          ok: false,
          detail: e instanceof Error ? e.message : String(e),
        });
      }
    }
  }

  if (sampleInterest) {
    try {
      const status = await targetingOptionStatus(accessToken, [sampleInterest.id]);
      checks.push({
        name: "targetingoptionstatus",
        ok: status.length > 0,
        detail: status.map((s) => `${s.id}:${s.current_status}`).join(", "),
      });
    } catch (e) {
      checks.push({
        name: "targetingoptionstatus",
        ok: false,
        detail: e instanceof Error ? e.message : String(e),
      });
    }
  }

  let pagesGo = false;
  try {
    const pageProbe = await searchActTargeting(accessToken, actId, "facebook page", "interests", 10);
    const pageLike = pageProbe.filter(
      (p) =>
        /page/i.test(p.name) ||
        p.path.some((x) => /page/i.test(x)) ||
        p.type === "interest",
    );
    pagesGo = pageProbe.length > 0;
    checks.push({
      name: "pages_targeting_probe",
      ok: pagesGo,
      detail: pagesGo
        ? `Partial: ${pageProbe.length} targetingsearch hits (not a dedicated Pages API). Dedicated Adsumo-style Pages tool = conditional.`
        : "No page-style targeting results",
      sample: pageLike.slice(0, 3),
    });
  } catch (e) {
    checks.push({
      name: "pages_targeting_probe",
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    });
  }

  const coreOk = ["adinterest", "adinterestsuggestion", "reachestimate"].every((name) =>
    checks.find((c) => c.name === name)?.ok,
  );

  return {
    ok: coreOk,
    pages_targeting_go: pagesGo,
    daily_reach_available: dailyReachAvailable,
    checks,
  };
}
