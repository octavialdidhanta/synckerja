import { describe, expect, it } from "vitest";
import { buildSpendByServiceChartPointsFromReportRows } from "@/6-0-digital-marketing-shared/reportMonthlySpendByService";

const powerbankId = "96433e18-e4ac-4ada-b0cc-ba4f01cd5679";

describe("spend by product chart", () => {
  it("uses the same Meta campaign spend as the table", () => {
    const points = buildSpendByServiceChartPointsFromReportRows({
      googleRows: [],
      tiktokRows: [],
      metaRows: [
        { serviceId: powerbankId, serviceName: "Powerbank", amount: 537_062 },
        { serviceId: powerbankId, serviceName: "Powerbank", amount: 466_613 },
        { serviceId: powerbankId, serviceName: "Powerbank", amount: 219_001 },
        { serviceId: powerbankId, serviceName: "Powerbank", amount: 133_844 },
        { serviceId: powerbankId, serviceName: "Powerbank", amount: 131_068 },
        { serviceId: powerbankId, serviceName: "Powerbank", amount: 120_014 },
      ],
      channelFilter: "meta",
      unmappedLabel: "Belum di-map",
    });

    expect(points).toHaveLength(1);
    expect(points[0]?.spend).toBe(1_607_602);
  });

  it("keeps Google spend out of the Meta filter", () => {
    const points = buildSpendByServiceChartPointsFromReportRows({
      googleRows: [{ serviceId: powerbankId, serviceName: "Powerbank", amount: 50_000 }],
      metaRows: [{ serviceId: powerbankId, serviceName: "Powerbank", amount: 1_607_602 }],
      tiktokRows: [],
      channelFilter: "meta",
      unmappedLabel: "Belum di-map",
    });

    expect(points[0]?.spend).toBe(1_607_602);
  });
});
