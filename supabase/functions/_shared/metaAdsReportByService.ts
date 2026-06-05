export type MetaReportByServiceAggregate = {
  service_id: string | null;
  service_name: string;
  amount: number;
  impressions: number;
  clicks: number;
  converted_leads: number | null;
  cost_per_lead: number | null;
};

const UNMAPPED_KEY = "__unmapped__";

function readMetric(row: Record<string, unknown>, key: string): number {
  const v = row[key];
  const n = parseFloat(String(v ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function readServiceNumber(raw: unknown): number | null {
  if (raw == null || !Number.isFinite(Number(raw))) return null;
  return Number(raw);
}

export function aggregateMetaRowsByService(
  rows: Record<string, unknown>[],
  unmappedLabel: string,
): MetaReportByServiceAggregate[] {
  const buckets = new Map<string, MetaReportByServiceAggregate>();

  for (const row of rows) {
    const serviceId = String(row.service_id ?? "").trim();
    const key = serviceId || UNMAPPED_KEY;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        service_id: serviceId || null,
        service_name: serviceId
          ? String(row.service_name ?? "").trim() || serviceId
          : unmappedLabel,
        amount: 0,
        impressions: 0,
        clicks: 0,
        converted_leads: serviceId ? 0 : null,
        cost_per_lead: null,
      };
      buckets.set(key, bucket);
    }

    bucket.amount += readMetric(row, "spend");
    bucket.impressions += readMetric(row, "impressions");
    bucket.clicks += readMetric(row, "clicks");

    if (serviceId) {
      const cl = readServiceNumber(row.service_converted_leads);
      if (cl != null) bucket.converted_leads = (bucket.converted_leads ?? 0) + cl;
    }
  }

  const result = [...buckets.values()];
  for (const bucket of result) {
    if (bucket.service_id && bucket.converted_leads != null && bucket.converted_leads > 0) {
      bucket.cost_per_lead = bucket.amount / bucket.converted_leads;
    }
    if (!bucket.service_id && bucket.amount > 0 && bucket.converted_leads == null) {
      bucket.converted_leads = 0;
    }
  }

  return result.sort((a, b) => b.amount - a.amount);
}
