import { describe, expect, it } from "vitest";
import { buildCpaByServiceChartPointsFromReportRows } from "@/6-0-digital-marketing-shared/reportMonthlyCpaByService";

describe("buildCpaByServiceChartPointsFromReportRows", () => {
  it("uses the same Meta spend and purchases as the table CPA", () => {
    const points = buildCpaByServiceChartPointsFromReportRows({
      googleRows: [],
      tiktokRows: [],
      channelFilter: "all",
      unmappedLabel: "Unmapped",
      metaRows: [
        {
          serviceId: "powerbank",
          serviceName: "Powerbank",
          amount: 8_077_559,
          convertedLeads: 466,
          costPerLead: 8_077_559 / 466,
        },
        {
          serviceId: "glass",
          serviceName: "Tempered glass",
          amount: 2_037_479,
          convertedLeads: 343,
          costPerLead: 2_037_479 / 343,
        },
        {
          serviceId: null,
          serviceName: "Unmapped",
          amount: 1_203_755,
          convertedLeads: 25,
          costPerLead: 1_203_755 / 25,
        },
        {
          serviceId: "charger",
          serviceName: "Charger",
          amount: 269_367,
          convertedLeads: 14,
          costPerLead: 269_367 / 14,
        },
      ],
    });

    const byName = new Map(points.map((row) => [row.serviceLabel, row]));
    expect(byName.get("Powerbank")?.productCpa).toBeCloseTo(8_077_559 / 466, 6);
    expect(byName.get("Tempered glass")?.productCpa).toBeCloseTo(2_037_479 / 343, 6);
    expect(byName.get("Unmapped")?.productCpa).toBeCloseTo(1_203_755 / 25, 6);
    expect(byName.get("Charger")?.productCpa).toBeCloseTo(269_367 / 14, 6);
    expect(points.every((row) => row.serviceCpa === 0)).toBe(true);
    expect(points.map((row) => row.serviceLabel)).toEqual([
      "Powerbank",
      "Tempered glass",
      "Unmapped",
      "Charger",
    ]);
  });

  it("keeps Google converted-lead CPA off the product series", () => {
    const points = buildCpaByServiceChartPointsFromReportRows({
      metaRows: [
        {
          serviceId: "powerbank",
          serviceName: "Powerbank",
          amount: 1000,
          convertedLeads: 4,
          costPerLead: 250,
        },
      ],
      googleRows: [
        {
          serviceId: "powerbank",
          serviceName: "Powerbank",
          amount: 900,
          convertedLeads: 3,
          costPerLead: 300,
        },
      ],
      tiktokRows: [],
      channelFilter: "all",
      unmappedLabel: "Unmapped",
    });

    expect(points).toHaveLength(1);
    expect(points[0]?.productCpa).toBe(250);
    expect(points[0]?.serviceCpa).toBe(300);
  });
});
