import { describe, expect, it } from "vitest";
import {
  defaultRecipientPickerFiltersJson,
  leadsFiltersStateToJson,
} from "@/5-3-whatsapp-template/utils/recipientPickerFilterSpec";
import type { LeadsFilters } from "@/5-3-dashboard/components/leads/filters/LeadsFilters";

const baseFilters = (): LeadsFilters => ({
  dataCompleteness: "all",
  services: "all",
  category: "all",
  createdBy: "all",
  webProperty: "all",
  assignee: "all",
  fuPriority: "all",
  status: "all",
  source: "all",
  dateRange: null,
  search: "",
  utmSource: "all",
  utmMedium: "all",
  utmCampaign: "all",
  utmContent: "all",
  utmTerm: "all",
  attributionLabel: "all",
  gclid: "all",
  gclidPresence: "all",
  emailPresence: "all",
  landingUrlContains: "",
  surveyRating: "all",
});

describe("recipientPickerFilterSpec", () => {
  it("defaults lead magnet filters to all", () => {
    const defaults = defaultRecipientPickerFiltersJson();
    expect(defaults.leadMagnetCampaign).toBe("all");
    expect(defaults.leadMagnetTargetMarket).toBe("all");
  });

  it("maps lead magnet filters from LeadsFilters state", () => {
    const json = leadsFiltersStateToJson({
      ...baseFilters(),
      leadMagnetCampaign: "Campaign1",
      leadMagnetTargetMarket: "Digital Marketing Manager",
    });
    expect(json.leadMagnetCampaign).toBe("Campaign1");
    expect(json.leadMagnetTargetMarket).toBe("Digital Marketing Manager");
  });

  it("falls back lead magnet filters to all when omitted", () => {
    const json = leadsFiltersStateToJson(baseFilters());
    expect(json.leadMagnetCampaign).toBe("all");
    expect(json.leadMagnetTargetMarket).toBe("all");
  });
});
