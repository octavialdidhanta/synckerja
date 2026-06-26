import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import { getLeadStatusDisplayName } from "@/5-1-leads-management/utils/leadStatusDisplay";

import { API_LEAD_KNOWN_SOURCES, formatLeadWebPropertyDisplay } from "@/5-3-dashboard/lib/apiLeadDisplayLabels";

/**
 * Opsi filter kolom Source: master `lead_sources` + nilai `lead.source` yang ada di data
 * (mis. default "Website") agar dropdown tidak hanya "All Sources" bila master DB kosong/tidak lengkap.
 */
export function buildLeadSourceFilterOptions(
  leads: Array<{ source?: string | null }>,
  masterSources: Array<{ id: string; name: string }>,
): Array<{ id: string; name: string }> {
  const byName = new Map<string, { id: string; name: string }>();
  for (const s of masterSources) {
    const n = (s.name ?? "").trim();
    if (n) byName.set(n, { id: s.id, name: n });
  }
  for (const canonical of API_LEAD_KNOWN_SOURCES) {
    if (!byName.has(canonical)) {
      byName.set(canonical, { id: `__api_canonical__${canonical}`, name: canonical });
    }
  }
  let seq = 0;
  for (const l of leads) {
    const n = (l.source ?? "").trim();
    if (!n) continue;
    if (!byName.has(n)) {
      byName.set(n, { id: `__from_lead__${seq++}`, name: n });
    }
  }
  return [...byName.values()].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );
}

/** Opsi filter kolom Web / Property: distinct `web_id` dari leads API. */
export function buildWebPropertyFilterOptions(
  leads: Array<{ web_id?: string | null }>,
): Array<{ id: string; value: string; label: string }> {
  const byWebId = new Map<string, { id: string; value: string; label: string }>();
  let seq = 0;
  for (const l of leads) {
    const raw = (l.web_id ?? "").trim();
    if (!raw) continue;
    if (!byWebId.has(raw)) {
      const label = formatLeadWebPropertyDisplay(raw) || raw;
      byWebId.set(raw, { id: `__web__${seq++}`, value: raw, label });
    }
  }
  return [...byWebId.values()].sort((a, b) =>
    a.label.localeCompare(b.label, undefined, { sensitivity: "base" }),
  );
}

/** Opsi filter Services: master sub-services + nilai `lead.services` yang ada di data. */
export function buildServicesFilterOptions(
  leads: Array<{ services?: string | null }>,
  masterServices: Array<{ id: string; name: string }>,
): Array<{ id: string; name: string }> {
  const byName = new Map<string, { id: string; name: string }>();
  for (const s of masterServices) {
    const n = (s.name ?? "").trim();
    if (n) byName.set(n, { id: s.id, name: n });
  }
  let seq = 0;
  for (const l of leads) {
    const n = (l.services ?? "").trim();
    if (!n) continue;
    if (!byName.has(n)) {
      byName.set(n, { id: `__services_lead__${seq++}`, name: n });
    }
  }
  return [...byName.values()].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );
}

/** Opsi filter Assignee: roster omnichannel + `lead.assignee` yang ada di data. */
export function buildAssigneeFilterOptions(
  leads: Array<{ assignee?: string | null }>,
  roster: Array<{ id: string; full_name?: string | null; email?: string | null }>,
): Array<{ id: string; name: string }> {
  const byName = new Map<string, { id: string; name: string }>();
  for (const e of roster) {
    const label = (e.full_name || e.email || "").trim();
    if (label) byName.set(label, { id: e.id, name: label });
  }
  let seq = 0;
  for (const l of leads) {
    const n = (l.assignee ?? "").trim();
    if (!n) continue;
    if (!byName.has(n)) {
      byName.set(n, { id: `__assignee_lead__${seq++}`, name: n });
    }
  }
  return [...byName.values()].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );
}

/** Sama logika dedupe/sort seperti `LeadsFilters` untuk filter status (nilai filter = `lead_status.name`). */
export function buildUniqueLeadStatusFilterOptions(
  leadStatuses: Array<{ id: string; name: string }>,
): Array<{ id: string; name: string; label: string }> {
  const excluded = leadStatuses.filter((s) => {
    const name = (s.name?.trim().toLowerCase() ?? "");
    return name !== "lost" && name !== "qualified" && name !== "closed" && name !== "resolve";
  });
  const canonical = ["Open", "Unread", "In Progress", "Converted", "Qualified", "Closed", "Resolve"];
  const byDisplay = (
    a: (typeof leadStatuses)[number],
    b: (typeof leadStatuses)[number],
  ) => {
    const da = getLeadStatusDisplayName(a.name);
    const db = getLeadStatusDisplayName(b.name);
    const ia = canonical.indexOf(a.name ?? "");
    const ib = canonical.indexOf(b.name ?? "");
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return (da || "").localeCompare(db || "");
  };
  const sorted = [...excluded].sort(byDisplay);
  const seen = new Set<string>();
  const out: Array<{ id: string; name: string; label: string }> = [];
  for (const s of sorted) {
    const displayName = getLeadStatusDisplayName(s.name);
    if (seen.has(displayName)) continue;
    seen.add(displayName);
    out.push({ id: s.id, name: s.name ?? "", label: displayName });
  }
  return out;
}

/** Pilihan filter kolom FU Priority (nilai = string yang dipakai `filters.fuPriority`). */
export const FU_PRIORITY_FILTER_CHOICES: Array<{ id: string; name: string }> = [
  { id: "fu-pfu", name: "Please Follow Up" },
  { id: "fu-no-respon", name: "No Respon" },
  { id: "fu-set-status", name: "Set Status" },
  { id: "fu-high", name: "High" },
  { id: "fu-medium", name: "Medium" },
  { id: "fu-low", name: "Low" },
];

/** Shared with LeadsFilters + LeadsTableNew; one network fetch via React Query. */
export const LEADS_MANAGEMENT_ACTIVE_STATUSES_QUERY_KEY = [
  "leads-management",
  "lead-statuses-active-full",
] as const;

export function useLeadStatusesActiveFull() {
  return useQuery({
    queryKey: LEADS_MANAGEMENT_ACTIVE_STATUSES_QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_statuses")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Filter metadata for Leads Management (same sources as former LeadsFilters useEffect).
 * Subscribes to the same queries from any caller — TanStack Query dedupes the fetch.
 */
export function useLeadsManagementFilterQueries() {
  const leadStatuses = useLeadStatusesActiveFull();
  const leadSources = useQuery({
    queryKey: ["leads-management", "lead-sources-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_sources")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });
  const services = useQuery({
    queryKey: ["leads-management", "services-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });
  const subServices = useQuery({
    queryKey: ["leads-management", "sub-services-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sub_services")
        .select("id, name, service_id")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const metadataPending =
    leadStatuses.isPending ||
    leadSources.isPending ||
    services.isPending ||
    subServices.isPending;

  const filtersLoadError =
    leadStatuses.isError || leadSources.isError || services.isError || subServices.isError
      ? "Gagal memuat data filter"
      : null;

  return {
    leadStatuses: (leadStatuses.data ?? []) as Array<{
      id: string;
      name: string;
      description?: string;
      color: string;
    }>,
    leadSources: (leadSources.data ?? []) as Array<{ id: string; name: string; description?: string }>,
    services: (services.data ?? []) as Array<{ id: string; name: string }>,
    subServices: (subServices.data ?? []) as Array<{ id: string; name: string; service_id: string }>,
    metadataPending,
    filtersLoadError,
  };
}
