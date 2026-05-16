import type { DateRange } from "react-day-picker";
import type { LeadsFilters } from "@/5-3-dashboard/components/leads/filters/LeadsFilters";

/**
 * JSON sent to `search_whatsapp_recipient_picker` / `recipient_picker_filter_options` (Postgres jsonb).
 * Mirrors [`ConsultantsPageContent`](src/5-3-dashboard/components/consultants/ConsultantsPageContent.tsx)
 * filter state: top bar [`LeadsFilters`](src/5-3-dashboard/components/leads/filters/LeadsFilters.tsx) + header-only fields.
 *
 * Date range: ISO date strings `YYYY-MM-DD` (UTC date portion) to match `DateRange` serialization in RPC.
 * Optional `sortColumn` / `sortDir`: server-side table ordering (whitelist in RPC; default client asc).
 */
export type RecipientPickerFiltersJson = {
  dataCompleteness: LeadsFilters["dataCompleteness"];
  services: string;
  category: string;
  createdBy: string;
  assignee: string;
  fuPriority: string;
  status: string;
  source: string;
  search: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent: string;
  utmTerm: string;
  attributionLabel: string;
  landingUrlContains: string;
  dateRangeFrom: string | null;
  dateRangeTo: string | null;
  sortColumn?: string;
  sortDir?: "asc" | "desc";
  surveyRating: LeadsFilters["surveyRating"];
};

export const defaultRecipientPickerFiltersJson = (): RecipientPickerFiltersJson => ({
  dataCompleteness: "all",
  services: "all",
  category: "all",
  createdBy: "all",
  assignee: "all",
  fuPriority: "all",
  status: "all",
  source: "all",
  search: "",
  utmSource: "all",
  utmMedium: "all",
  utmCampaign: "all",
  utmContent: "all",
  utmTerm: "all",
  attributionLabel: "all",
  landingUrlContains: "",
  dateRangeFrom: null,
  dateRangeTo: null,
  surveyRating: "all",
});

export function leadsFiltersStateToJson(filters: LeadsFilters): RecipientPickerFiltersJson {
  const dr = filters.dateRange;
  const from =
    dr?.from instanceof Date
      ? dr.from.toISOString().slice(0, 10)
      : dr?.from
        ? new Date(dr.from as unknown as string).toISOString().slice(0, 10)
        : null;
  const to =
    dr?.to instanceof Date
      ? dr.to.toISOString().slice(0, 10)
      : dr?.to
        ? new Date(dr.to as unknown as string).toISOString().slice(0, 10)
        : null;
  return {
    dataCompleteness: filters.dataCompleteness,
    services: filters.services,
    category: filters.category,
    createdBy: filters.createdBy,
    assignee: filters.assignee,
    fuPriority: filters.fuPriority,
    status: filters.status,
    source: filters.source,
    search: (filters.search ?? "").trim(),
    utmSource: filters.utmSource,
    utmMedium: filters.utmMedium,
    utmCampaign: filters.utmCampaign,
    utmContent: filters.utmContent,
    utmTerm: filters.utmTerm,
    attributionLabel: filters.attributionLabel,
    landingUrlContains: (filters.landingUrlContains ?? "").trim(),
    dateRangeFrom: from,
    dateRangeTo: to,
    surveyRating: filters.surveyRating ?? "all",
  };
}

export function jsonToLeadsFiltersState(j: RecipientPickerFiltersJson, prev: LeadsFilters): LeadsFilters {
  let dateRange: DateRange | null = null;
  if (j.dateRangeFrom && j.dateRangeTo) {
    dateRange = { from: new Date(j.dateRangeFrom + "T00:00:00"), to: new Date(j.dateRangeTo + "T23:59:59.999") };
  }
  return {
    ...prev,
    dataCompleteness: j.dataCompleteness,
    services: j.services,
    category: j.category,
    createdBy: j.createdBy,
    assignee: j.assignee,
    fuPriority: j.fuPriority,
    status: j.status,
    source: j.source,
    search: j.search,
    utmSource: j.utmSource,
    utmMedium: j.utmMedium,
    utmCampaign: j.utmCampaign,
    utmContent: j.utmContent,
    utmTerm: j.utmTerm,
    attributionLabel: j.attributionLabel,
    landingUrlContains: j.landingUrlContains,
    dateRange,
    surveyRating: j.surveyRating ?? "all",
  };
}
