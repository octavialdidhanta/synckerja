export type MetricEntity = "campaign" | "ad_group" | "ad";

export type MetricCategory =
  | "performance"
  | "conversions"
  | "viewability"
  | "competitive"
  | "gmail";

export type MetricValueKind = "micros" | "rate" | "count" | "fraction";

export type MetricDef = {
  key: string;
  label: string;
  category: MetricCategory;
  gaqlField: string;
  valueKind: MetricValueKind;
  entities: MetricEntity[];
  sortable: boolean;
  description: string;
};

export const DEFAULT_METRIC_KEYS = ["impressions", "clicks", "ctr", "spent"] as const;

export const MAX_METRICS_PER_REQUEST = 30;

const ALL_ENTITIES: MetricEntity[] = ["campaign", "ad_group", "ad"];

const METRIC_CATALOG: MetricDef[] = [
  // PERFORMANCE
  {
    key: "impressions",
    label: "Impr.",
    category: "performance",
    gaqlField: "metrics.impressions",
    valueKind: "count",
    entities: ALL_ENTITIES,
    sortable: true,
    description: "Jumlah tayangan iklan.",
  },
  {
    key: "clicks",
    label: "Clicks",
    category: "performance",
    gaqlField: "metrics.clicks",
    valueKind: "count",
    entities: ALL_ENTITIES,
    sortable: true,
    description: "Jumlah klik.",
  },
  {
    key: "ctr",
    label: "CTR",
    category: "performance",
    gaqlField: "metrics.ctr",
    valueKind: "rate",
    entities: ALL_ENTITIES,
    sortable: true,
    description: "Click-through rate (klik / tayangan).",
  },
  {
    key: "spent",
    label: "Cost",
    category: "performance",
    gaqlField: "metrics.cost_micros",
    valueKind: "micros",
    entities: ALL_ENTITIES,
    sortable: true,
    description: "Biaya iklan (dari cost_micros).",
  },
  {
    key: "avg_cpc",
    label: "Avg. CPC",
    category: "performance",
    gaqlField: "metrics.average_cpc",
    valueKind: "micros",
    entities: ALL_ENTITIES,
    sortable: true,
    description: "Biaya rata-rata per klik.",
  },
  {
    key: "avg_cpm",
    label: "Avg. CPM",
    category: "performance",
    gaqlField: "metrics.average_cpm",
    valueKind: "micros",
    entities: ALL_ENTITIES,
    sortable: true,
    description: "Biaya rata-rata per 1000 tayangan.",
  },
  {
    key: "avg_cpv",
    label: "Avg. CPV",
    category: "performance",
    gaqlField: "metrics.average_cpv",
    valueKind: "micros",
    entities: ALL_ENTITIES,
    sortable: false,
    description: "Biaya rata-rata per view.",
  },
  {
    key: "avg_cost",
    label: "Avg. cost",
    category: "performance",
    gaqlField: "metrics.average_cost",
    valueKind: "micros",
    entities: ALL_ENTITIES,
    sortable: false,
    description: "Biaya rata-rata per interaksi.",
  },
  {
    key: "engagements",
    label: "Engagements",
    category: "performance",
    gaqlField: "metrics.engagements",
    valueKind: "count",
    entities: ALL_ENTITIES,
    sortable: true,
    description: "Jumlah engagement.",
  },
  {
    key: "engagement_rate",
    label: "Engagement rate",
    category: "performance",
    gaqlField: "metrics.engagement_rate",
    valueKind: "rate",
    entities: ALL_ENTITIES,
    sortable: true,
    description: "Tingkat engagement.",
  },
  {
    key: "interactions",
    label: "Interactions",
    category: "performance",
    gaqlField: "metrics.interactions",
    valueKind: "count",
    entities: ALL_ENTITIES,
    sortable: true,
    description: "Jumlah interaksi.",
  },
  {
    key: "interaction_rate",
    label: "Interaction rate",
    category: "performance",
    gaqlField: "metrics.interaction_rate",
    valueKind: "rate",
    entities: ALL_ENTITIES,
    sortable: true,
    description: "Tingkat interaksi.",
  },
  {
    key: "invalid_clicks",
    label: "Invalid clicks",
    category: "performance",
    gaqlField: "metrics.invalid_clicks",
    valueKind: "count",
    entities: ALL_ENTITIES,
    sortable: true,
    description: "Klik tidak valid.",
  },
  {
    key: "invalid_click_rate",
    label: "Invalid click rate",
    category: "performance",
    gaqlField: "metrics.invalid_click_rate",
    valueKind: "rate",
    entities: ALL_ENTITIES,
    sortable: false,
    description: "Persentase klik tidak valid.",
  },
  // CONVERSIONS
  {
    key: "conversions",
    label: "Conversions",
    category: "conversions",
    gaqlField: "metrics.conversions",
    valueKind: "count",
    entities: ALL_ENTITIES,
    sortable: true,
    description: "Jumlah konversi.",
  },
  {
    key: "conv_rate",
    label: "Conv. rate",
    category: "conversions",
    gaqlField: "metrics.conversions_from_interactions_rate",
    valueKind: "rate",
    entities: ALL_ENTITIES,
    sortable: true,
    description: "Tingkat konversi dari interaksi.",
  },
  {
    key: "conv_value",
    label: "Conv. value",
    category: "conversions",
    gaqlField: "metrics.conversions_value",
    valueKind: "count",
    entities: ALL_ENTITIES,
    sortable: true,
    description: "Nilai konversi.",
  },
  {
    key: "cost_per_conv",
    label: "Cost / conv.",
    category: "conversions",
    gaqlField: "metrics.cost_per_conversion",
    valueKind: "micros",
    entities: ALL_ENTITIES,
    sortable: true,
    description: "Biaya per konversi.",
  },
  {
    key: "value_per_conv",
    label: "Value / conv.",
    category: "conversions",
    gaqlField: "metrics.value_per_conversion",
    valueKind: "count",
    entities: ALL_ENTITIES,
    sortable: false,
    description: "Nilai per konversi.",
  },
  {
    key: "all_conversions",
    label: "All conv.",
    category: "conversions",
    gaqlField: "metrics.all_conversions",
    valueKind: "count",
    entities: ALL_ENTITIES,
    sortable: true,
    description: "Semua konversi (termasuk view-through).",
  },
  {
    key: "all_conv_rate",
    label: "All conv. rate",
    category: "conversions",
    gaqlField: "metrics.all_conversions_from_interactions_rate",
    valueKind: "rate",
    entities: ALL_ENTITIES,
    sortable: false,
    description: "Tingkat semua konversi.",
  },
  {
    key: "all_conv_value",
    label: "All conv. value",
    category: "conversions",
    gaqlField: "metrics.all_conversions_value",
    valueKind: "count",
    entities: ALL_ENTITIES,
    sortable: true,
    description: "Nilai semua konversi.",
  },
  {
    key: "cost_per_all_conv",
    label: "Cost / all conv.",
    category: "conversions",
    gaqlField: "metrics.cost_per_all_conversions",
    valueKind: "micros",
    entities: ALL_ENTITIES,
    sortable: true,
    description: "Biaya per semua konversi.",
  },
  // VIEWABILITY
  {
    key: "measurable_impressions",
    label: "Measurable impr.",
    category: "viewability",
    gaqlField: "metrics.measurable_impressions",
    valueKind: "count",
    entities: ALL_ENTITIES,
    sortable: true,
    description: "Tayangan yang terukur.",
  },
  {
    key: "measurable_rate",
    label: "Measurable rate",
    category: "viewability",
    gaqlField: "metrics.measurable_rate",
    valueKind: "rate",
    entities: ALL_ENTITIES,
    sortable: false,
    description: "Tingkat tayangan terukur.",
  },
  {
    key: "measurable_cost",
    label: "Measurable cost",
    category: "viewability",
    gaqlField: "metrics.measurable_cost_micros",
    valueKind: "micros",
    entities: ALL_ENTITIES,
    sortable: false,
    description: "Biaya tayangan terukur.",
  },
  // COMPETITIVE (Search / auction — campaign & ad group)
  {
    key: "search_impression_share",
    label: "Search impr. share",
    category: "competitive",
    gaqlField: "metrics.search_impression_share",
    valueKind: "fraction",
    entities: ["campaign", "ad_group"],
    sortable: true,
    description: "Bagian tayangan di jaringan Search.",
  },
  {
    key: "search_budget_lost_is",
    label: "Search lost IS (budget)",
    category: "competitive",
    gaqlField: "metrics.search_budget_lost_impression_share",
    valueKind: "fraction",
    entities: ["campaign", "ad_group"],
    sortable: true,
    description: "Tayangan Search hilang karena anggaran.",
  },
  {
    key: "search_rank_lost_is",
    label: "Search lost IS (rank)",
    category: "competitive",
    gaqlField: "metrics.search_rank_lost_impression_share",
    valueKind: "fraction",
    entities: ["campaign", "ad_group"],
    sortable: true,
    description: "Tayangan Search hilang karena peringkat iklan.",
  },
  {
    key: "search_click_share",
    label: "Search click share",
    category: "competitive",
    gaqlField: "metrics.search_click_share",
    valueKind: "fraction",
    entities: ["campaign", "ad_group"],
    sortable: true,
    description: "Bagian klik di jaringan Search.",
  },
  {
    key: "search_exact_match_is",
    label: "Exact match impr. share",
    category: "competitive",
    gaqlField: "metrics.search_exact_match_impression_share",
    valueKind: "fraction",
    entities: ["campaign", "ad_group"],
    sortable: false,
    description: "Impression share untuk exact match.",
  },
  {
    key: "content_impression_share",
    label: "Display impr. share",
    category: "competitive",
    gaqlField: "metrics.content_impression_share",
    valueKind: "fraction",
    entities: ["campaign", "ad_group"],
    sortable: true,
    description: "Bagian tayangan di jaringan Display.",
  },
  {
    key: "absolute_top_impr_pct",
    label: "Abs. top impr. %",
    category: "competitive",
    gaqlField: "metrics.absolute_top_impression_percentage",
    valueKind: "fraction",
    entities: ["campaign", "ad_group"],
    sortable: true,
    description: "Persentase tayangan di posisi paling atas.",
  },
  {
    key: "top_impr_pct",
    label: "Top impr. %",
    category: "competitive",
    gaqlField: "metrics.top_impression_percentage",
    valueKind: "fraction",
    entities: ["campaign", "ad_group"],
    sortable: true,
    description: "Persentase tayangan di atas hasil organik.",
  },
  // GMAIL (campaign-level engagement)
  {
    key: "gmail_forwards",
    label: "Gmail forwards",
    category: "gmail",
    gaqlField: "metrics.gmail_forwards",
    valueKind: "count",
    entities: ["campaign", "ad_group"],
    sortable: true,
    description: "Jumlah forward di Gmail.",
  },
  {
    key: "gmail_saves",
    label: "Gmail saves",
    category: "gmail",
    gaqlField: "metrics.gmail_saves",
    valueKind: "count",
    entities: ["campaign", "ad_group"],
    sortable: true,
    description: "Jumlah save di Gmail.",
  },
  {
    key: "gmail_secondary_clicks",
    label: "Gmail secondary clicks",
    category: "gmail",
    gaqlField: "metrics.gmail_secondary_clicks",
    valueKind: "count",
    entities: ["campaign", "ad_group"],
    sortable: true,
    description: "Klik sekunder di Gmail (expand, dll.).",
  },
];

const METRIC_BY_KEY = new Map(METRIC_CATALOG.map((m) => [m.key, m]));

export function getMetricCatalog(entity?: MetricEntity): MetricDef[] {
  if (!entity) return [...METRIC_CATALOG];
  return METRIC_CATALOG.filter((m) => m.entities.includes(entity));
}

export function getMetricCatalogForApi(entity?: MetricEntity): {
  categories: Array<{
    id: MetricCategory;
    label: string;
    metrics: Array<{
      key: string;
      label: string;
      description: string;
      entities: MetricEntity[];
      valueKind: MetricValueKind;
      defaultSelected: boolean;
      sortable: boolean;
    }>;
  }>;
} {
  const defs = getMetricCatalog(entity);
  const categoryOrder: MetricCategory[] = [
    "performance",
    "conversions",
    "viewability",
    "competitive",
    "gmail",
  ];
  const categoryLabels: Record<MetricCategory, string> = {
    performance: "PERFORMANCE",
    conversions: "CONVERSIONS",
    viewability: "VIEWABILITY",
    competitive: "COMPETITIVE",
    gmail: "GMAIL",
  };
  const defaultSet = new Set<string>(DEFAULT_METRIC_KEYS);

  return {
    categories: categoryOrder
      .map((id) => ({
        id,
        label: categoryLabels[id],
        metrics: defs
          .filter((m) => m.category === id)
          .map((m) => ({
            key: m.key,
            label: m.label,
            description: m.description,
            entities: m.entities,
            valueKind: m.valueKind,
            defaultSelected: defaultSet.has(m.key),
            sortable: m.sortable,
          })),
      }))
      .filter((c) => c.metrics.length > 0),
  };
}

export function buildMetricsKey(keys: string[]): string {
  return [...keys].sort().join("|");
}

export function resolveMetrics(
  keys: string[],
  entity: MetricEntity,
): { defs: MetricDef[]; invalid: string[] } {
  const invalid: string[] = [];
  const defs: MetricDef[] = [];
  const seen = new Set<string>();

  for (const raw of keys) {
    const key = String(raw).trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const def = METRIC_BY_KEY.get(key);
    if (!def) {
      invalid.push(key);
      continue;
    }
    if (!def.entities.includes(entity)) {
      invalid.push(key);
      continue;
    }
    defs.push(def);
  }

  if (defs.length === 0) {
    for (const key of DEFAULT_METRIC_KEYS) {
      const def = METRIC_BY_KEY.get(key);
      if (def && def.entities.includes(entity)) defs.push(def);
    }
  }

  return { defs, invalid };
}

export function validateMetricsCount(keys: string[]): string | null {
  const unique = [...new Set(keys.map((k) => String(k).trim()).filter(Boolean))];
  if (unique.length > MAX_METRICS_PER_REQUEST) {
    return `Maximum ${MAX_METRICS_PER_REQUEST} metrics per request`;
  }
  return null;
}

const IDENTITY_SELECT: Record<MetricEntity, string[]> = {
  campaign: [
    "campaign.id",
    "campaign.name",
    "campaign.status",
    "campaign.advertising_channel_type",
  ],
  ad_group: [
    "ad_group.id",
    "ad_group.name",
    "ad_group.status",
    "campaign.id",
    "campaign.name",
  ],
  ad: [
    "ad_group_ad.ad.id",
    "ad_group_ad.status",
    "ad_group_ad.ad.type",
    "ad_group_ad.ad.name",
    "ad_group_ad.ad.expanded_text_ad.headline_part1",
    "ad_group_ad.ad.expanded_text_ad.headline_part2",
    "ad_group_ad.ad.expanded_text_ad.headline_part3",
    "ad_group.name",
    "campaign.name",
  ],
};

/** Scalar-only identity (no nested ad-type fields) — GAQL fallback when creative fields fail. */
const AD_IDENTITY_MINIMAL: string[] = [
  "ad_group_ad.ad.id",
  "ad_group_ad.status",
  "ad_group_ad.ad.type",
  "ad_group_ad.ad.name",
  "ad_group.name",
  "campaign.name",
];

function extractAdPreview(ad: Record<string, unknown> | undefined): string {
  if (!ad) return "";

  const rsa = (ad.responsiveSearchAd ?? ad.responsive_search_ad) as
    | Record<string, unknown>
    | undefined;
  const headlines = rsa?.headlines;
  if (Array.isArray(headlines) && headlines.length > 0) {
    const texts = headlines
      .map((h) => {
        const item = h as Record<string, unknown>;
        const text = item.text ?? (item.asset as Record<string, unknown> | undefined)?.text;
        return text != null ? String(text).trim() : "";
      })
      .filter(Boolean);
    if (texts.length > 0) return texts.slice(0, 3).join(" · ");
  }

  const eta = (ad.expandedTextAd ?? ad.expanded_text_ad) as Record<string, unknown> | undefined;
  if (eta) {
    const parts = [
      eta.headlinePart1,
      eta.headline_part1,
      eta.headlinePart2,
      eta.headline_part2,
      eta.headlinePart3,
      eta.headline_part3,
    ]
      .map((p) => (p != null ? String(p).trim() : ""))
      .filter(Boolean);
    if (parts.length > 0) return parts.join(" | ");
  }

  const name = ad.name;
  if (name != null && String(name).trim()) return String(name).trim();
  return "";
}

const STATUS_WHERE: Record<MetricEntity, string> = {
  campaign: "campaign.status = 'ENABLED'",
  ad_group: "ad_group.status = 'ENABLED'",
  ad: "ad_group_ad.status = 'ENABLED'",
};

const FROM_RESOURCE: Record<MetricEntity, string> = {
  campaign: "campaign",
  ad_group: "ad_group",
  ad: "ad_group_ad",
};

export type GaqlBuildOptions = {
  /** When true, ad entity uses minimal identity fields only (no ETA nested fields). */
  adIdentityMinimal?: boolean;
};

export function buildSelectClause(
  entity: MetricEntity,
  metricDefs: MetricDef[],
  options?: GaqlBuildOptions,
): string {
  const identity =
    entity === "ad" && options?.adIdentityMinimal
      ? AD_IDENTITY_MINIMAL
      : IDENTITY_SELECT[entity];
  const fields = [
    ...identity,
    "customer.currency_code",
    ...metricDefs.map((m) => m.gaqlField),
  ];
  return [...new Set(fields)].join(", ");
}

export function buildSortField(sortKey: string, metricDefs: MetricDef[]): string {
  const [field] = sortKey.split(":");
  const def = METRIC_BY_KEY.get(field) ?? metricDefs.find((m) => m.key === field);
  if (def?.sortable) return def.gaqlField;
  const spent = METRIC_BY_KEY.get("spent");
  return spent?.gaqlField ?? "metrics.impressions";
}

export function buildGaqlQuery(opts: {
  entity: MetricEntity;
  metricDefs: MetricDef[];
  dateClause: string;
  statusFilter: "all" | "enabled_only";
  sortKey: string;
  pageSize: number;
  adIdentityMinimal?: boolean;
}): string {
  const select = buildSelectClause(opts.entity, opts.metricDefs, {
    adIdentityMinimal: opts.adIdentityMinimal,
  });
  const from = FROM_RESOURCE[opts.entity];
  const parts = [`SELECT ${select}`, `FROM ${from}`, `WHERE ${opts.dateClause}`];
  if (opts.statusFilter === "enabled_only") {
    parts.push(`AND ${STATUS_WHERE[opts.entity]}`);
  }
  const orderField = buildSortField(opts.sortKey, opts.metricDefs);
  const direction = opts.sortKey.endsWith(":asc") ? "ASC" : "DESC";
  parts.push(`ORDER BY ${orderField} ${direction}`);
  parts.push(`LIMIT ${opts.pageSize}`);
  return parts.join("\n");
}

function pickNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export type NormalizedMetricsRow = {
  id: string;
  identity: Record<string, unknown>;
  metrics: Record<string, number | null>;
};

export function normalizeGaqlRow(
  entity: MetricEntity,
  raw: Record<string, unknown>,
  metricDefs: MetricDef[],
): NormalizedMetricsRow {
  const campaign = raw.campaign as Record<string, unknown> | undefined;
  const adGroup = raw.adGroup as Record<string, unknown> | undefined;
  const adGroupAd = raw.adGroupAd as Record<string, unknown> | undefined;
  const ad = adGroupAd?.ad as Record<string, unknown> | undefined;
  const metricsRaw = (raw.metrics ?? {}) as Record<string, unknown>;

  const identity: Record<string, unknown> = {};
  let id = "";

  if (entity === "campaign" && campaign) {
    id = String(campaign.id ?? "");
    identity.name = campaign.name ?? "";
    identity.status = campaign.status ?? "";
    identity.channel_type = campaign.advertisingChannelType ?? campaign.advertising_channel_type ?? "";
  } else if (entity === "ad_group" && adGroup) {
    id = String(adGroup.id ?? "");
    identity.name = adGroup.name ?? "";
    identity.status = adGroup.status ?? "";
    identity.campaign_name = campaign?.name ?? "";
  } else if (entity === "ad" && adGroupAd) {
    id = String(ad?.id ?? "");
    identity.status = adGroupAd.status ?? "";
    identity.ad_type = ad?.type ?? "";
    identity.ad_group_name = adGroup?.name ?? "";
    identity.campaign_name = campaign?.name ?? "";
    const preview = extractAdPreview(ad);
    identity.ad_preview = preview || (id ? `Ad ${id}` : "");
  }

  const metrics: Record<string, number | null> = {};
  for (const def of metricDefs) {
    const fieldName = def.gaqlField.replace(/^metrics\./, "");
    const camel = fieldName.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    const val = metricsRaw[fieldName] ?? metricsRaw[camel];
    if (val == null) {
      metrics[def.key] = null;
      continue;
    }
    if (def.valueKind === "micros") {
      metrics[def.key] = pickNum(val) / 1_000_000;
    } else if (def.valueKind === "rate" || def.valueKind === "fraction") {
      const n = pickNum(val);
      metrics[def.key] = n;
      if (
        def.key === "ctr" ||
        def.key.endsWith("_rate") ||
        def.valueKind === "fraction" ||
        def.key.endsWith("_share") ||
        def.key.endsWith("_pct")
      ) {
        metrics[`${def.key}_percent`] = n * 100;
      }
    } else {
      metrics[def.key] = pickNum(val);
    }
  }

  return { id, identity, metrics };
}

export function rowPassesDeliveryFilter(
  metrics: Record<string, number | null>,
  onlyRunning: boolean,
): boolean {
  if (!onlyRunning) return true;
  const impr = pickNum(metrics.impressions);
  const spent = pickNum(metrics.spent);
  return impr > 0 || spent > 0;
}

/** GAQL errors that may be fixed by dropping nested ad creative fields from SELECT. */
export function isAdCreativeGaqlError(message: string): boolean {
  return /headline|expanded_text|responsive_search|prohibited|cannot be selected|unrecognized name|not allowed/i.test(
    message,
  );
}

export function parseUnsupportedMetricsFromError(message: string): string[] {
  const unsupported: string[] = [];
  for (const def of METRIC_CATALOG) {
    const short = def.gaqlField.replace("metrics.", "");
    if (message.includes(def.gaqlField) || message.includes(short)) {
      unsupported.push(def.key);
    }
  }
  return [...new Set(unsupported)];
}
