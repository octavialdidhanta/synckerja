import { describe, expect, it } from "vitest";
import {
  aggregateMetaProductPurchases,
  buildServiceConvertedChartPoints,
} from "@/6-0-digital-marketing-shared/reportMonthlyLeadsByService";
import { serviceDataKeyForChart } from "@/6-0-digital-marketing-shared/reportMonthlySpendByService";
import type { ReportServiceSpendSeries } from "@/6-0-digital-marketing-shared/reportMonthlySpendByService";

function adService(id: string, label: string): ReportServiceSpendSeries {
  return {
    dataKey: serviceDataKeyForChart(id),
    serviceId: id,
    label,
    color: "hsl(204 70% 42%)",
    totalSpend: 1,
  };
}

describe("buildServiceConvertedChartPoints", () => {
  it("keeps products from the report table when none were converted in the range", () => {
    const points = buildServiceConvertedChartPoints({
      adServices: [
        adService("96433e18-e4ac-4ada-b0cc-ba4f01cd5679", "Powerbank"),
        adService("4f7bf0ba-9341-45bc-887c-6f8b17a437e6", "Tempered glass"),
      ],
      catalog: [],
      leadServiceValues: [],
      noServiceLabel: "No service",
    });

    expect(points.map((point) => [point.serviceLabel, point.leads])).toEqual([
      ["Powerbank", 0],
      ["Tempered glass", 0],
    ]);
  });

  it("counts converted leads by the service written on the lead", () => {
    const points = buildServiceConvertedChartPoints({
      adServices: [adService("96433e18-e4ac-4ada-b0cc-ba4f01cd5679", "Powerbank")],
      catalog: [{ id: "ee6d5643-3763-4641-9eaf-15a42ced1ef1", name: "Vialdi Wedding" }],
      leadServiceValues: ["powerbank", "Powerbank", "Vialdi Wedding", "", "Instagram Comment"],
      noServiceLabel: "No service",
    });

    expect(Object.fromEntries(points.map((point) => [point.serviceLabel, point.leads]))).toEqual({
      Powerbank: 2,
      "Vialdi Wedding": 1,
      "Instagram Comment": 1,
      "No service": 1,
    });
  });

  it("puts Meta purchases on the mapped product without adding them to service leads", () => {
    const powerbankId = "96433e18-e4ac-4ada-b0cc-ba4f01cd5679";
    const purchases = aggregateMetaProductPurchases([
      { service_id: powerbankId, service_name: "Powerbank", purchases: 33, purchase_conversion_value: 1000 },
      { service_id: powerbankId, service_name: "Powerbank", purchases: 4, purchase_conversion_value: 200 },
      { service_id: "", service_name: "", purchases: 0, purchase_conversion_value: 0 },
    ]);
    const points = buildServiceConvertedChartPoints({
      adServices: [adService(powerbankId, "Powerbank")],
      catalog: [],
      leadServiceValues: [],
      productPurchases: purchases,
      noServiceLabel: "No service",
    });

    expect(points).toEqual([
      expect.objectContaining({
        serviceLabel: "Powerbank",
        productPurchases: 37,
        productPurchaseValue: 1200,
        leads: 0,
      }),
    ]);
  });
});
