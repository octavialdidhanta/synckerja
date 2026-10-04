import type { MonthlySpendBucket, ReportChartSpanMode } from "@/6-0-digital-marketing-shared/hooks/useDigitalMarketingReportMonthlySpend";
import type { ReportGoogleServiceRow } from "@/6-0-digital-marketing-shared/hooks/useDigitalMarketingReportCosts";
import type { ReportMetaServiceRow } from "@/6-0-digital-marketing-shared/hooks/useDigitalMarketingReportCosts";
import type { MonthlyChartChannelFilter } from "@/6-0-digital-marketing-shared/dmPaidAdsFiltersStorage";
import {
  buildReportServiceSpendSeriesList,
  serviceDataKeyForChart,
  type ReportServiceSpendSeries,
} from "@/6-0-digital-marketing-shared/reportMonthlySpendByService";
import { REPORT_UNMAPPED_SERVICE_KEY } from "@/google-ads/metrics/aggregateCampaignMetricsByService";

export type ReportServiceLeadsSeries = ReportServiceSpendSeries & {
  totalLeads: number;
};

/** One category per product or service. Purchases and leads stay separate. */
export type ReportLeadsByServiceChartPoint = {
  dataKey: string;
  serviceLabel: string;
  /** Converted leads from Leads Management (service / jasa sales). */
  leads: number;
  /** Meta CPAS purchases (product sales). */
  productPurchases: number;
  productPurchaseValue: number;
  color: string;
};

export type MetaProductPurchaseRow = {
  serviceId: string | null;
  serviceName: string;
  purchases: number;
  purchaseValue: number;
};

function monthLookupKey(year: number, month: number): string {
  return `${year}-${month}`;
}

export function buildReportServiceLeadsSeriesList(
  googleRows: ReportGoogleServiceRow[],
  metaRows: ReportMetaServiceRow[],
  unmappedLabel: string,
): ReportServiceLeadsSeries[] {
  const spendSeries = buildReportServiceSpendSeriesList(googleRows, metaRows, unmappedLabel);
  const leadTotals = new Map<string, number>();

  const add = (serviceId: string | null, leads: number | null) => {
    const key = serviceId ?? REPORT_UNMAPPED_SERVICE_KEY;
    const n = leads != null && Number.isFinite(leads) ? leads : 0;
    leadTotals.set(key, (leadTotals.get(key) ?? 0) + n);
  };

  for (const r of googleRows) add(r.serviceId, r.convertedLeads);
  for (const r of metaRows) add(r.serviceId, r.convertedLeads);

  return spendSeries
    .map((svc) => {
      const key = svc.serviceId ?? REPORT_UNMAPPED_SERVICE_KEY;
      return {
        ...svc,
        dataKey: serviceDataKeyForChart(svc.serviceId),
        totalLeads: leadTotals.get(key) ?? 0,
      };
    })
    .sort((a, b) => b.totalLeads - a.totalLeads);
}

export function aggregateServiceLeadsByCalendarMonth(
  rows: MonthlySpendBucket[],
): MonthlySpendBucket[] {
  const sums = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    spend: 0,
    converted_leads: 0,
  }));
  for (const r of rows) {
    if (r.month < 1 || r.month > 12) continue;
    const slot = sums[r.month - 1]!;
    slot.converted_leads += Number.isFinite(r.converted_leads) ? r.converted_leads! : 0;
  }
  return sums.map((b) => ({
    month: b.month,
    spend: 0,
    converted_leads: b.converted_leads,
  }));
}

export function sumMonthlyLeadsForChannelFilter(
  google: MonthlySpendBucket[],
  meta: MonthlySpendBucket[],
  fallbackYear: number,
  channelFilter: MonthlyChartChannelFilter,
  spanMode: ReportChartSpanMode = "calendar_year",
): Map<string, number> {
  const out = new Map<string, number>();
  const addRows = (rows: MonthlySpendBucket[]) => {
    for (const r of rows) {
      const key =
        spanMode === "all_time"
          ? String(r.month)
          : monthLookupKey(r.year ?? fallbackYear, r.month);
      const leads = Number.isFinite(r.converted_leads) ? r.converted_leads! : 0;
      out.set(key, (out.get(key) ?? 0) + leads);
    }
  };
  if (channelFilter === "google") addRows(google);
  else if (channelFilter === "meta") addRows(meta);
  else {
    addRows(google);
    addRows(meta);
  }
  return out;
}

export function buildLeadsByServiceTotalsChartPoints(
  services: ReportServiceLeadsSeries[],
  leadsByServiceKey: Map<string, Map<string, number>>,
): ReportLeadsByServiceChartPoint[] {
  return services
    .map((svc) => {
      const periodMap = leadsByServiceKey.get(svc.dataKey);
      let leads = 0;
      if (periodMap) {
        for (const value of periodMap.values()) {
          leads += value;
        }
      }
      return {
        dataKey: svc.dataKey,
        serviceLabel: svc.label,
        leads,
        productPurchases: 0,
        productPurchaseValue: 0,
        color: svc.color,
      };
    })
    .filter((row) => row.leads > 0)
    .sort((a, b) => b.leads - a.leads);
}

const NO_SERVICE_DATA_KEY = "svc_no_service";

const EXTRA_SERVICE_COLORS = [
  "hsl(204 70% 42%)",
  "hsl(262 55% 52%)",
  "hsl(160 52% 36%)",
  "hsl(24 75% 48%)",
  "hsl(280 45% 48%)",
  "hsl(340 55% 48%)",
  "hsl(45 85% 42%)",
  "hsl(190 60% 42%)",
];

export function normalizeServiceLabel(value: string): string {
  return value.trim().toLowerCase();
}

function textServiceDataKey(label: string): string {
  const slug = normalizeServiceLabel(label).replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  return `svc_text_${slug || "other"}`;
}

/**
 * Bars for Service Converted: ad services in the report table (including 0)
 * plus converted leads grouped by the service written on the lead.
 */
function readPositiveNumber(value: unknown): number {
  const n = typeof value === "number" ? value : Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Sum CPAS purchases by the service a Meta campaign is mapped to. */
export function aggregateMetaProductPurchases(
  rows: Array<Record<string, unknown>>,
): MetaProductPurchaseRow[] {
  const buckets = new Map<string, MetaProductPurchaseRow>();
  for (const row of rows) {
    const serviceId = String(row.service_id ?? "").trim() || null;
    const purchases = readPositiveNumber(row.purchases);
    const purchaseValue = readPositiveNumber(row.purchase_conversion_value);
    if (purchases <= 0 && purchaseValue <= 0) continue;
    const key = serviceId ?? REPORT_UNMAPPED_SERVICE_KEY;
    const prev = buckets.get(key);
    if (prev) {
      prev.purchases += purchases;
      prev.purchaseValue += purchaseValue;
      continue;
    }
    buckets.set(key, {
      serviceId,
      serviceName: serviceId ? String(row.service_name ?? "").trim() : "",
      purchases,
      purchaseValue,
    });
  }
  return [...buckets.values()];
}

export function buildServiceConvertedChartPoints(args: {
  adServices: ReportServiceSpendSeries[];
  catalog: Array<{ id: string; name: string }>;
  leadServiceValues: Array<string | null | undefined>;
  productPurchases?: MetaProductPurchaseRow[];
  noServiceLabel: string;
  unmappedLabel?: string;
}): ReportLeadsByServiceChartPoint[] {
  const adByName = new Map<string, ReportServiceSpendSeries>();
  for (const svc of args.adServices) {
    if (!svc.serviceId) continue;
    const key = normalizeServiceLabel(svc.label);
    if (key && !adByName.has(key)) adByName.set(key, svc);
  }

  const catalogByName = new Map<string, { id: string; name: string }>();
  for (const row of args.catalog) {
    const key = normalizeServiceLabel(row.name);
    if (key && !catalogByName.has(key)) catalogByName.set(key, row);
  }

  const counts = new Map<string, number>();
  const extras = new Map<string, { label: string; color: string }>();
  let extraIndex = 0;

  const addExtra = (dataKey: string, label: string) => {
    if (!extras.has(dataKey)) {
      extras.set(dataKey, {
        label,
        color: EXTRA_SERVICE_COLORS[extraIndex % EXTRA_SERVICE_COLORS.length]!,
      });
      extraIndex += 1;
    }
  };

  for (const raw of args.leadServiceValues) {
    const trimmed = String(raw ?? "").trim();
    if (!trimmed) {
      counts.set(NO_SERVICE_DATA_KEY, (counts.get(NO_SERVICE_DATA_KEY) ?? 0) + 1);
      continue;
    }
    const ad = adByName.get(normalizeServiceLabel(trimmed));
    if (ad) {
      counts.set(ad.dataKey, (counts.get(ad.dataKey) ?? 0) + 1);
      continue;
    }
    const catalogHit = catalogByName.get(normalizeServiceLabel(trimmed));
    if (catalogHit) {
      const dataKey = serviceDataKeyForChart(catalogHit.id);
      counts.set(dataKey, (counts.get(dataKey) ?? 0) + 1);
      addExtra(dataKey, catalogHit.name);
      continue;
    }
    const dataKey = textServiceDataKey(trimmed);
    counts.set(dataKey, (counts.get(dataKey) ?? 0) + 1);
    addExtra(dataKey, trimmed);
  }

  const points: ReportLeadsByServiceChartPoint[] = [];
  const used = new Set<string>();
  for (const svc of args.adServices) {
    if (!svc.serviceId || used.has(svc.dataKey)) continue;
    used.add(svc.dataKey);
    points.push({
      dataKey: svc.dataKey,
      serviceLabel: svc.label,
      leads: counts.get(svc.dataKey) ?? 0,
      productPurchases: 0,
      productPurchaseValue: 0,
      color: svc.color,
    });
  }

  for (const [dataKey, meta] of extras) {
    if (used.has(dataKey)) continue;
    const leads = counts.get(dataKey) ?? 0;
    if (leads <= 0) continue;
    used.add(dataKey);
    points.push({
      dataKey,
      serviceLabel: meta.label,
      leads,
      productPurchases: 0,
      productPurchaseValue: 0,
      color: meta.color,
    });
  }

  const noService = counts.get(NO_SERVICE_DATA_KEY) ?? 0;
  if (noService > 0) {
    points.push({
      dataKey: NO_SERVICE_DATA_KEY,
      serviceLabel: args.noServiceLabel,
      leads: noService,
      productPurchases: 0,
      productPurchaseValue: 0,
      color: "hsl(220 9% 46%)",
    });
  }

  const productByKey = new Map<string, { label: string; purchases: number; purchaseValue: number }>();
  for (const product of args.productPurchases ?? []) {
    const adMatch = product.serviceId
      ? args.adServices.find((svc) => svc.serviceId === product.serviceId)
      : args.adServices.find((svc) => !svc.serviceId);
    const catalogHit = product.serviceId
      ? args.catalog.find((row) => row.id === product.serviceId)
      : undefined;
    const dataKey = adMatch?.dataKey ?? serviceDataKeyForChart(product.serviceId);
    const label =
      adMatch?.label ||
      catalogHit?.name ||
      product.serviceName ||
      (product.serviceId ? product.serviceId : args.unmappedLabel || "Unmapped");
    const prev = productByKey.get(dataKey);
    if (prev) {
      prev.purchases += product.purchases;
      prev.purchaseValue += product.purchaseValue;
    } else {
      productByKey.set(dataKey, {
        label,
        purchases: product.purchases,
        purchaseValue: product.purchaseValue,
      });
    }
  }

  for (const [dataKey, product] of productByKey) {
    const existing = points.find((point) => point.dataKey === dataKey);
    if (existing) {
      existing.productPurchases += product.purchases;
      existing.productPurchaseValue += product.purchaseValue;
      continue;
    }
    if (product.purchases <= 0 && product.purchaseValue <= 0) continue;
    points.push({
      dataKey,
      serviceLabel: product.label,
      leads: 0,
      productPurchases: product.purchases,
      productPurchaseValue: product.purchaseValue,
      color: EXTRA_SERVICE_COLORS[points.length % EXTRA_SERVICE_COLORS.length]!,
    });
  }

  points.sort((a, b) => b.productPurchases + b.leads - (a.productPurchases + a.leads));
  return points;
}
