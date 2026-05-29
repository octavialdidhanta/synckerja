import type {
  GoogleAdsMetricCatalogResponse,
  GoogleAdsMetricEntity,
  GoogleAdsSummaryMetricOption,
  MetricValueKind,
} from "@/google-ads/metrics/types";

const GROUP_ORDER: { id: string; label: string }[] = [
  { id: "performance", label: "Performance" },
  { id: "conversions", label: "Conversions" },
  { id: "conversion_value", label: "Conversion value" },
  { id: "attribution", label: "Attribution" },
  { id: "competitive", label: "Competitive metrics" },
  { id: "call_details", label: "Call details" },
  { id: "conversion_actions", label: "Conversion actions" },
];

const PERFORMANCE_KEYS = new Set([
  "clicks",
  "impressions",
  "ctr",
  "avg_cpc",
  "spent",
  "interactions",
  "interaction_rate",
]);

const CONVERSIONS_KEYS = new Set(["conversions", "cost_per_conv", "conv_rate"]);

const CONVERSION_VALUE_KEYS = new Set([
  "conv_value",
  "conv_value_per_cost",
  "all_conv_value",
]);

const COMPETITIVE_KEYS = new Set(["search_impression_share", "impression_share"]);

const CALL_KEYS = new Set(["phone_calls"]);

function mapCatalogGroup(categoryId: string, categoryLabel: string): string {
  if (categoryId === "performance") return "performance";
  if (categoryId === "conversions") return "conversions";
  if (categoryId === "competitive") return "competitive";
  if (categoryId === "call_details") return "call_details";
  return categoryId;
}

export function buildSummaryMetricOptions(
  entity: GoogleAdsMetricEntity,
  catalog: GoogleAdsMetricCatalogResponse | undefined,
  conversionActions: Array<{ key: string; label: string }>,
): GoogleAdsSummaryMetricOption[] {
  const byKey = new Map<string, GoogleAdsSummaryMetricOption>();

  const add = (opt: GoogleAdsSummaryMetricOption) => {
    if (!byKey.has(opt.key)) byKey.set(opt.key, opt);
  };

  const addFromCatalog = (m: {
    key: string;
    label: string;
    valueKind: MetricValueKind;
    entities: GoogleAdsMetricEntity[];
  }, groupId: string, groupLabel: string) => {
    if (!m.entities.includes(entity)) return;
    add({ key: m.key, label: m.label, valueKind: m.valueKind, groupId, groupLabel });
  };

  for (const m of catalog?.recommended.metrics ?? []) {
    let groupId = mapCatalogGroup("performance", "Performance");
    let groupLabel = "Performance";
    if (PERFORMANCE_KEYS.has(m.key)) {
      groupId = "performance";
      groupLabel = "Performance";
    } else if (CONVERSIONS_KEYS.has(m.key)) {
      groupId = "conversions";
      groupLabel = "Conversions";
    } else if (CONVERSION_VALUE_KEYS.has(m.key)) {
      groupId = "conversion_value";
      groupLabel = "Conversion value";
    } else if (COMPETITIVE_KEYS.has(m.key)) {
      groupId = "competitive";
      groupLabel = "Competitive metrics";
    } else if (CALL_KEYS.has(m.key)) {
      groupId = "call_details";
      groupLabel = "Call details";
    }
    addFromCatalog(m, groupId, groupLabel);
  }

  for (const cat of catalog?.categories ?? []) {
    const groupId = mapCatalogGroup(cat.id, cat.label);
    for (const m of cat.metrics) {
      addFromCatalog(m, groupId, cat.label);
    }
  }

  for (const col of conversionActions) {
    add({
      key: col.key,
      label: col.label,
      valueKind: "count",
      groupId: "conversion_actions",
      groupLabel: "Conversion actions",
    });
  }

  const orderIndex = new Map(GROUP_ORDER.map((g, i) => [g.id, i]));
  return [...byKey.values()].sort((a, b) => {
    const ga = orderIndex.get(a.groupId) ?? 99;
    const gb = orderIndex.get(b.groupId) ?? 99;
    if (ga !== gb) return ga - gb;
    return a.label.localeCompare(b.label);
  });
}

export function summaryMetricGroups(
  options: GoogleAdsSummaryMetricOption[],
): Array<{ id: string; label: string; options: GoogleAdsSummaryMetricOption[] }> {
  const map = new Map<string, GoogleAdsSummaryMetricOption[]>();
  const labels = new Map<string, string>();
  for (const opt of options) {
    if (!map.has(opt.groupId)) map.set(opt.groupId, []);
    map.get(opt.groupId)!.push(opt);
    labels.set(opt.groupId, opt.groupLabel);
  }
  const ordered: Array<{ id: string; label: string; options: GoogleAdsSummaryMetricOption[] }> = [];
  for (const g of GROUP_ORDER) {
    const opts = map.get(g.id);
    if (!opts?.length) continue;
    ordered.push({ id: g.id, label: g.label, options: opts });
    map.delete(g.id);
  }
  for (const [id, opts] of map) {
    ordered.push({ id, label: labels.get(id) ?? id, options: opts });
  }
  return ordered;
}

export function findSummaryMetricOption(
  options: GoogleAdsSummaryMetricOption[],
  key: string,
): GoogleAdsSummaryMetricOption | undefined {
  return options.find((o) => o.key === key);
}

export const SUMMARY_SLOT_COUNT = 5;

export const DEFAULT_SUMMARY_SLOT_KEYS: readonly string[] = [
  "impressions",
  "clicks",
  "ctr",
  "conversions",
  "interactions",
];

const STORAGE_PREFIX = "google-ads-summary-slot-metrics:";
const LEGACY_STORAGE_PREFIX = "google-ads-summary-primary-metric:";

export function loadSummarySlotMetrics(entity: GoogleAdsMetricEntity): string[] {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${entity}`);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed) && parsed.length === SUMMARY_SLOT_COUNT) {
        return parsed.map((k, i) => {
          const key = String(k).trim();
          if (key === "spent") return DEFAULT_SUMMARY_SLOT_KEYS[i] ?? "impressions";
          return key || (DEFAULT_SUMMARY_SLOT_KEYS[i] ?? "impressions");
        });
      }
    }
    const legacy = localStorage.getItem(`${LEGACY_STORAGE_PREFIX}${entity}`);
    if (legacy?.trim()) {
      const legacyKey = legacy.trim();
      const slots = [...DEFAULT_SUMMARY_SLOT_KEYS];
      if (legacyKey !== "spent") {
        slots[0] = legacyKey;
      }
      return slots;
    }
  } catch {
    /* ignore */
  }
  return [...DEFAULT_SUMMARY_SLOT_KEYS];
}

export function saveSummarySlotMetrics(entity: GoogleAdsMetricEntity, keys: string[]): void {
  try {
    localStorage.setItem(
      `${STORAGE_PREFIX}${entity}`,
      JSON.stringify(keys.slice(0, SUMMARY_SLOT_COUNT)),
    );
  } catch {
    /* ignore */
  }
}

/** @deprecated Use loadSummarySlotMetrics — first slot only. */
export function loadPrimarySummaryMetric(entity: GoogleAdsMetricEntity): string {
  return loadSummarySlotMetrics(entity)[0] ?? "spent";
}
