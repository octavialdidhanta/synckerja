import type { ReportLeadsByServiceChartPoint } from "@/6-0-digital-marketing-shared/reportMonthlyLeadsByService";
import type { ReportSpendByServiceChartPoint } from "@/6-0-digital-marketing-shared/reportMonthlySpendByService";

/** One bar per service — CPA (spend ÷ converted leads) for the selected date range. */
export type ReportCpaByServiceChartPoint = {
  dataKey: string;
  serviceLabel: string;
  cpa: number;
  color: string;
};

export function buildCpaByServiceTotalsChartPoints(
  spendData: ReportSpendByServiceChartPoint[],
  leadsData: ReportLeadsByServiceChartPoint[],
): ReportCpaByServiceChartPoint[] {
  const leadsByKey = new Map(leadsData.map((r) => [r.dataKey, r.leads]));

  return spendData
    .map((spendRow) => {
      const leads = leadsByKey.get(spendRow.dataKey) ?? 0;
      if (leads <= 0 || spendRow.spend <= 0) return null;
      return {
        dataKey: spendRow.dataKey,
        serviceLabel: spendRow.serviceLabel,
        cpa: spendRow.spend / leads,
        color: spendRow.color,
      };
    })
    .filter((row): row is ReportCpaByServiceChartPoint => row != null);
}
