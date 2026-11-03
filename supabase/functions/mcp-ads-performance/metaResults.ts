/**
 * Meta "Results" for the MCP ads summary.
 *
 * Ads Manager shows Results by what the campaign is set up to get, not always purchases.
 * The campaign objective decides which action counts as a result.
 * Purchase objectives keep the CPAS purchase count and value the dashboard already uses.
 */

export type MetaResult = {
  results: number;
  results_label: string;
  /** Only purchases carry a value, so ROAS stays empty for every other result. */
  result_value: number | null;
};

type ResultRule = {
  label: string;
  actionTypes: string[];
};

const MESSAGING: ResultRule = {
  label: "messaging conversations started",
  actionTypes: ["onsite_conversion.messaging_conversation_started_7d"],
};

const POST_ENGAGEMENT: ResultRule = {
  label: "post engagements",
  actionTypes: ["post_engagement"],
};

const LINK_CLICKS: ResultRule = {
  label: "link clicks",
  actionTypes: ["link_click"],
};

const LEADS: ResultRule = {
  label: "leads",
  actionTypes: ["onsite_conversion.lead_grouped", "lead", "offsite_conversion.fb_pixel_lead"],
};

const VIDEO_VIEWS: ResultRule = {
  label: "video views",
  actionTypes: ["video_view"],
};

const APP_INSTALLS: ResultRule = {
  label: "app installs",
  actionTypes: ["mobile_app_install", "app_install"],
};

const PAGE_LIKES: ResultRule = {
  label: "page likes",
  actionTypes: ["like"],
};

const PURCHASE_OBJECTIVES = new Set([
  "OUTCOME_SALES",
  "CONVERSIONS",
  "PRODUCT_CATALOG_SALES",
]);

const REACH_OBJECTIVES = new Set(["OUTCOME_AWARENESS", "REACH", "BRAND_AWARENESS"]);

function toNumber(value: unknown): number {
  const number = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(number) ? number : 0;
}

/** Map of action_type to count from the Insights `actions` field. */
export function actionCounts(actions: unknown): Map<string, number> {
  const counts = new Map<string, number>();
  if (!Array.isArray(actions)) return counts;
  for (const item of actions) {
    if (!item || typeof item !== "object") continue;
    const type = String((item as { action_type?: unknown }).action_type ?? "").trim();
    if (!type) continue;
    counts.set(type, (counts.get(type) ?? 0) + toNumber((item as { value?: unknown }).value));
  }
  return counts;
}

/** First listed action type that Meta reported, so aliases are not counted twice. */
function countFor(counts: Map<string, number>, rule: ResultRule): number {
  for (const type of rule.actionTypes) {
    if (counts.has(type)) return counts.get(type) ?? 0;
  }
  return 0;
}

function fromRule(counts: Map<string, number>, rule: ResultRule): MetaResult {
  return { results: countFor(counts, rule), results_label: rule.label, result_value: null };
}

function hasAny(counts: Map<string, number>, rule: ResultRule): boolean {
  return rule.actionTypes.some((type) => (counts.get(type) ?? 0) > 0);
}

const LANDING_PAGE_VIEWS: ResultRule = {
  label: "landing page views",
  actionTypes: ["landing_page_view"],
};

/** The single optimization goal of the campaign's ad sets, or null when there is none or several. */
function singleGoal(value: unknown): string | null {
  if (!Array.isArray(value)) return null;
  const goals = [...new Set(value.map((item) => String(item ?? "").trim().toUpperCase()).filter(Boolean))];
  return goals.length === 1 ? goals[0] : null;
}

/** Result picked from the ad set optimization goal, which is what Ads Manager Results follow. */
function resultFromGoal(goal: string, raw: Record<string, unknown>, counts: Map<string, number>): MetaResult | null {
  if (goal === "CONVERSATIONS") return fromRule(counts, MESSAGING);
  if (goal === "LINK_CLICKS") return fromRule(counts, LINK_CLICKS);
  if (goal === "LANDING_PAGE_VIEWS") return fromRule(counts, LANDING_PAGE_VIEWS);
  if (goal === "LEAD_GENERATION" || goal === "QUALITY_LEAD") return fromRule(counts, LEADS);
  if (goal === "POST_ENGAGEMENT") return fromRule(counts, POST_ENGAGEMENT);
  if (goal === "PAGE_LIKES") return fromRule(counts, PAGE_LIKES);
  if (goal === "APP_INSTALLS") return fromRule(counts, APP_INSTALLS);
  if (goal === "REACH") return { results: toNumber(raw.reach), results_label: "reach", result_value: null };
  if (goal === "IMPRESSIONS") {
    return { results: toNumber(raw.impressions), results_label: "impressions", result_value: null };
  }
  // Conversion and value goals depend on the chosen event, so the objective decides.
  return null;
}

/**
 * Pick the result for one Meta campaign row from the dashboard.
 * The ad set optimization goal comes first, then the campaign objective.
 * Unknown or missing goal and objective keep purchases, the previous behavior.
 */
export function metaCampaignResult(raw: Record<string, unknown>): MetaResult {
  const objective = String(raw.objective ?? "").trim().toUpperCase();
  const counts = actionCounts(raw.actions);
  const purchases: MetaResult = {
    results: toNumber(raw.purchases),
    results_label: "purchases",
    result_value: toNumber(raw.purchase_conversion_value) > 0 ? toNumber(raw.purchase_conversion_value) : null,
  };

  const goal = singleGoal(raw.optimization_goals);
  if (goal) {
    const byGoal = resultFromGoal(goal, raw, counts);
    if (byGoal) return byGoal;
  }

  if (!objective || PURCHASE_OBJECTIVES.has(objective)) return purchases;
  if (objective === "MESSAGES") return fromRule(counts, MESSAGING);
  if (objective === "OUTCOME_ENGAGEMENT") {
    // Engagement campaigns can be set up for conversations or for post engagement.
    return hasAny(counts, MESSAGING) ? fromRule(counts, MESSAGING) : fromRule(counts, POST_ENGAGEMENT);
  }
  if (objective === "POST_ENGAGEMENT" || objective === "EVENT_RESPONSES") return fromRule(counts, POST_ENGAGEMENT);
  if (objective === "PAGE_LIKES") return fromRule(counts, PAGE_LIKES);
  if (objective === "OUTCOME_TRAFFIC" || objective === "LINK_CLICKS") return fromRule(counts, LINK_CLICKS);
  if (objective === "OUTCOME_LEADS" || objective === "LEAD_GENERATION") return fromRule(counts, LEADS);
  if (objective === "VIDEO_VIEWS") return fromRule(counts, VIDEO_VIEWS);
  if (objective === "OUTCOME_APP_PROMOTION" || objective === "APP_INSTALLS") return fromRule(counts, APP_INSTALLS);
  if (REACH_OBJECTIVES.has(objective)) {
    return { results: toNumber(raw.reach), results_label: "reach", result_value: null };
  }
  return purchases;
}

/**
 * Account results are the sum of campaign results only when every campaign counts the same thing
 * and no campaign was left out. Reach is never summed because people overlap across campaigns.
 */
export function metaAccountResult(
  campaigns: MetaResult[],
  complete: boolean,
): { result: MetaResult | null; note: string | null } {
  if (campaigns.length === 0) return { result: null, note: null };
  const labels = new Set(campaigns.map((row) => row.results_label));
  if (labels.size > 1) {
    return {
      result: null,
      note: "Campaigns count different results, so the account has no single result total. Read results on each campaign.",
    };
  }
  const label = campaigns[0].results_label;
  if (label === "reach") {
    return { result: null, note: "Reach is not added across campaigns. Use the account reach field." };
  }
  if (!complete) {
    return {
      result: null,
      note: "Not every campaign was loaded, so the account result total is left empty. Read results on each campaign.",
    };
  }
  return {
    result: {
      results: campaigns.reduce((sum, row) => sum + row.results, 0),
      results_label: label,
      result_value: null,
    },
    note: null,
  };
}
