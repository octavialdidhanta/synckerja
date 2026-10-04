import { describe, expect, it } from "vitest";
import { aggregateMetaCampaignMetricsByService } from "@/meta-ads/metrics/aggregateMetaCampaignMetricsByService";

describe("aggregateMetaCampaignMetricsByService", () => {
  it("uses Purchases for the result count and CPA, including unmapped campaigns", () => {
    const rows = aggregateMetaCampaignMetricsByService(
      [
        {
          service_id: "powerbank",
          service_name: "Powerbank",
          spend: "1000",
          impressions: "100",
          clicks: "10",
          purchases: "4",
          service_converted_leads: 99,
        },
        {
          service_id: "",
          service_name: "",
          spend: "500",
          impressions: "50",
          clicks: "5",
          purchases: "2",
        },
      ],
      "Unmapped",
    );

    const powerbank = rows.find((row) => row.serviceId === "powerbank");
    const unmapped = rows.find((row) => row.serviceId == null);
    expect(powerbank?.convertedLeads).toBe(4);
    expect(powerbank?.costPerLead).toBe(250);
    expect(unmapped?.convertedLeads).toBe(2);
    expect(unmapped?.costPerLead).toBe(250);
  });
});