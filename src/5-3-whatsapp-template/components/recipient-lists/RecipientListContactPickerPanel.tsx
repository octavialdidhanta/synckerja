import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { Info, Loader2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import type { RecipientPickerCandidate } from "@/5-3-whatsapp-template/utils/buildRecipientPickerCandidates";
import { RECIPIENT_PICKER_MAX_SELECT } from "@/5-3-whatsapp-template/utils/buildRecipientPickerCandidates";
import { LeadsFilters, type LeadsFilters as LeadsFiltersState } from "@/5-3-dashboard/components/leads/filters/LeadsFilters";
import {
  FU_PRIORITY_FILTER_CHOICES,
  buildAssigneeFilterOptions,
  buildLeadSourceFilterOptions,
  buildServicesFilterOptions,
  buildUniqueLeadStatusFilterOptions,
  useLeadsManagementFilterQueries,
} from "@/5-3-dashboard/hooks/useLeadsManagementFilterQueries";
import { distinctLeadAttributionValues } from "@/shared/lib/leadAttribution";
import { useOmnichannelRosterAssignees } from "@/shared/hooks/useOrganizationOmnichannelStaff";
import {
  useRecipientPickerFilterOptions,
  useRecipientPickerSearch,
} from "@/5-3-whatsapp-template/hooks/useWhatsappRecipientLists";
import { leadsFiltersStateToJson, type RecipientPickerFiltersJson } from "@/5-3-whatsapp-template/utils/recipientPickerFilterSpec";
import {
  parseRecipientPickerSearchPayload,
  rpcItemToRecipientPickerCandidate,
  surveyFromRpcItem,
  type RecipientPickerRpcItem,
} from "@/5-3-whatsapp-template/utils/recipientPickerRpc";
import LeadsTableNew, {
  type ResolveColumnFilterValue,
  type SurveyRatingColumnFilterValue,
} from "@/5-3-dashboard/components/leads/table/LeadsTableNew";
import { isResolvedLeadStatusName } from "@/5-1-leads-management/utils/leadStatusDisplay";
import { supabase } from "@/shared/lib/supabaseClient";
import type { NewLead } from "@/shared/types/leads";
import {
  defaultLeadAttributionSortState,
  type LeadAttributionSortColumn,
  type LeadAttributionSortState,
} from "@/shared/lib/leadAttribution";

export type RecipientListContactPickerPanelProps = {
  organizationId: string | null | undefined;
  onCancel: () => void;
  onSubmit: (args: { name: string; picks: RecipientPickerCandidate[] }) => Promise<void>;
  isSubmitting: boolean;
};

const defaultFilters = (): LeadsFiltersState => ({
  dataCompleteness: "all",
  services: "all",
  category: "all",
  createdBy: "all",
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

export function RecipientListContactPickerPanel({
  organizationId,
  onCancel,
  onSubmit,
  isSubmitting,
}: RecipientListContactPickerPanelProps) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [filters, setFilters] = useState<LeadsFiltersState>(defaultFilters);
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const [selectedByRowId, setSelectedByRowId] = useState<Map<string, RecipientPickerCandidate>>(() => new Map());
  const [selectAllBanner, setSelectAllBanner] = useState<string | null>(null);
  const [selectAllLoading, setSelectAllLoading] = useState(false);
  const [attributionSort, setAttributionSort] = useState<LeadAttributionSortState>(defaultLeadAttributionSortState);
  const [isResolveFilter, setIsResolveFilter] = useState<ResolveColumnFilterValue>("all");

  const handleAttributionSort = useCallback((column: LeadAttributionSortColumn) => {
    setAttributionSort((prev) => {
      if (prev.column !== column) return { column, direction: "asc" };
      return { column, direction: prev.direction === "asc" ? "desc" : "asc" };
    });
  }, []);

  const deferredSearch = useDeferredValue((filters.search ?? "").trim());
  const filtersForRpc = useMemo((): RecipientPickerFiltersJson => {
    const base = leadsFiltersStateToJson({ ...filters, search: deferredSearch });
    if (!attributionSort.column) return base;
    return {
      ...base,
      sortColumn: attributionSort.column,
      sortDir: attributionSort.direction,
    };
  }, [filters, deferredSearch, attributionSort.column, attributionSort.direction]);

  const { data: filterOptions } = useRecipientPickerFilterOptions(organizationId, true);
  const { data: employees = [] } = useOmnichannelRosterAssignees();
  const { subServices, leadSources, leadStatuses } = useLeadsManagementFilterQueries();

  const {
    data: searchData,
    isFetching: searchLoading,
    isError: searchError,
    error: searchErrObj,
  } = useRecipientPickerSearch(organizationId, true, filtersForRpc, page, pageSize);

  const total = searchData?.total ?? 0;
  const tableRows = searchData?.items ?? [];

  const tableRowsForDisplay = useMemo(() => {
    if (isResolveFilter === "all") return tableRows;
    return tableRows.filter((row) => {
      const rawStatus = (
        row.lead_status && typeof row.lead_status === "object" && "name" in row.lead_status
          ? String((row.lead_status as { name?: string | null }).name ?? "")
          : ""
      ).trim();
      const resolved = isResolvedLeadStatusName(rawStatus);
      return isResolveFilter === "true" ? resolved : !resolved;
    });
  }, [tableRows, isResolveFilter]);

  useEffect(() => {
    setPage(1);
  }, [filtersForRpc]);

  const handleSurveyRatingColumnFilterChange = useCallback((v: SurveyRatingColumnFilterValue) => {
    setFilters((f) => ({ ...f, surveyRating: v }));
  }, []);

  const searchErrorMessage = searchError
    ? searchErrObj instanceof Error
      ? searchErrObj.message
      : String(searchErrObj ?? "Error")
    : null;

  const statusFilterOptions = useMemo(
    () => buildUniqueLeadStatusFilterOptions(leadStatuses),
    [leadStatuses],
  );

  const sourceFilterOptions = useMemo(() => {
    const rowSources = tableRows.map((r) => ({
      source: (r as RecipientPickerRpcItem).source,
    }));
    const fromMaster = buildLeadSourceFilterOptions(rowSources, leadSources);
    const byName = new Map(fromMaster.map((o) => [o.name.toLowerCase(), o]));
    let seq = 0;
    for (const s of filterOptions?.sources ?? []) {
      const n = (s ?? "").trim();
      if (!n) continue;
      const key = n.toLowerCase();
      if (!byName.has(key)) {
        byName.set(key, { id: `__recipient_src__${seq++}`, name: n });
      }
    }
    return [...byName.values()].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    );
  }, [tableRows, leadSources, filterOptions?.sources]);

  const assigneeFilterOptions = useMemo(
    () =>
      buildAssigneeFilterOptions(
        tableRows.map((r) => ({ assignee: (r as RecipientPickerRpcItem).assignee })),
        employees,
      ),
    [tableRows, employees],
  );

  const createdByFilterOptions = useMemo(
    () => filterOptions?.createdByNames ?? [],
    [filterOptions?.createdByNames],
  );

  const utmSourceFilterOptions = useMemo(() => filterOptions?.utmSources ?? [], [filterOptions?.utmSources]);
  const utmCampaignFilterOptions = useMemo(() => filterOptions?.utmCampaigns ?? [], [filterOptions?.utmCampaigns]);
  const utmMediumFilterOptions = useMemo(() => filterOptions?.utmMediums ?? [], [filterOptions?.utmMediums]);
  const utmContentFilterOptions = useMemo(() => filterOptions?.utmContents ?? [], [filterOptions?.utmContents]);
  const utmTermFilterOptions = useMemo(() => filterOptions?.utmTerms ?? [], [filterOptions?.utmTerms]);
  const attributionLabelOptionsEmbedded = useMemo(
    () => filterOptions?.attributionLabels ?? [],
    [filterOptions?.attributionLabels],
  );

  const servicesFilterOptions = useMemo(() => {
    const fromMaster = buildServicesFilterOptions(
      tableRows.map((r) => ({ services: (r as RecipientPickerRpcItem).services })),
      subServices,
    );
    const byName = new Map(fromMaster.map((o) => [o.name.toLowerCase(), o]));
    for (const name of filterOptions?.serviceNames ?? []) {
      const n = (name ?? "").trim();
      if (!n) continue;
      const key = n.toLowerCase();
      if (!byName.has(key)) {
        byName.set(key, { id: `__recipient_svc__${byName.size}`, name: n });
      }
    }
    return [...byName.values()].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    );
  }, [tableRows, subServices, filterOptions?.serviceNames]);

  const gclidFilterOptions = useMemo(() => {
    const fromRows = distinctLeadAttributionValues(
      tableRows as unknown as Array<Record<string, string | null | undefined>>,
      "gclid",
    );
    const set = new Set<string>(fromRows);
    for (const g of filterOptions?.gclids ?? []) {
      const n = (g ?? "").trim();
      if (n) set.add(n);
    }
    return [...set].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  }, [tableRows, filterOptions?.gclids]);

  const selectedRowIds = useMemo(() => new Set(selectedByRowId.keys()), [selectedByRowId]);

  const onToggleRow = useCallback(
    (rowId: string, checked: boolean) => {
      setSelectedByRowId((prev) => {
        const next = new Map(prev);
        if (!checked) {
          next.delete(rowId);
          return next;
        }
        const row = tableRows.find((r) => String(r.id) === rowId);
        if (!row) return prev;
        if (next.size >= RECIPIENT_PICKER_MAX_SELECT) return prev;
        next.set(rowId, rpcItemToRecipientPickerCandidate(row));
        return next;
      });
    },
    [tableRows],
  );

  const onTogglePage = useCallback(
    (rowIds: string[], checked: boolean) => {
      setSelectedByRowId((prev) => {
        const next = new Map(prev);
        if (!checked) {
          for (const k of rowIds) next.delete(k);
          return next;
        }
        for (const k of rowIds) {
          if (next.size >= RECIPIENT_PICKER_MAX_SELECT) break;
          const row = tableRows.find((r) => String(r.id) === k);
          if (row) next.set(k, rpcItemToRecipientPickerCandidate(row));
        }
        return next;
      });
    },
    [tableRows],
  );

  const handleSelectAllFiltered = useCallback(async () => {
    if (!organizationId) return;
    setSelectAllLoading(true);
    setSelectAllBanner(null);
    try {
      const first = await supabase.rpc("search_whatsapp_recipient_picker", {
        p_organization_id: organizationId,
        p_filters: filtersForRpc as unknown as Record<string, unknown>,
        p_limit: 1,
        p_offset: 0,
      });
      if (first.error) throw first.error;
      const { total: t0 } = parseRecipientPickerSearchPayload(first.data);
      const cap = Math.min(t0, RECIPIENT_PICKER_MAX_SELECT);
      if (t0 > RECIPIENT_PICKER_MAX_SELECT) {
        setSelectAllBanner(
          t("whatsappTemplates.recipientLists.addContactsModal.selectAllCappedBanner", {
            total: t0,
            max: RECIPIENT_PICKER_MAX_SELECT,
          }),
        );
      }
      const batch = 500;
      const merged = new Map<string, RecipientPickerCandidate>();
      for (let offset = 0; offset < cap; offset += batch) {
        const lim = Math.min(batch, cap - offset);
        const { data, error } = await supabase.rpc("search_whatsapp_recipient_picker", {
          p_organization_id: organizationId,
          p_filters: filtersForRpc as unknown as Record<string, unknown>,
          p_limit: lim,
          p_offset: offset,
        });
        if (error) throw error;
        const { items } = parseRecipientPickerSearchPayload(data);
        for (const it of items) {
          merged.set(String(it.id), rpcItemToRecipientPickerCandidate(it));
          if (merged.size >= cap) break;
        }
        if (items.length < lim) break;
      }
      setSelectedByRowId(merged);
    } catch (e) {
      setSelectAllBanner(e instanceof Error ? e.message : String(e));
    } finally {
      setSelectAllLoading(false);
    }
  }, [organizationId, filtersForRpc, t]);

  const picks = useMemo(() => [...selectedByRowId.values()], [selectedByRowId]);

  const handleAdd = async () => {
    const trimmed = name.trim();
    if (!trimmed || picks.length === 0) return;
    if (picks.length > RECIPIENT_PICKER_MAX_SELECT) return;
    try {
      await onSubmit({ name: trimmed.slice(0, 60), picks });
    } catch {
      /* parent toast */
    }
  };

  const nameLen = name.length;
  const addDisabled =
    isSubmitting ||
    !name.trim() ||
    picks.length === 0 ||
    picks.length > RECIPIENT_PICKER_MAX_SELECT ||
    searchLoading;

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="flex min-h-[560px] min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm [@media(max-height:900px)]:min-h-[620px] [@media(max-height:760px)]:min-h-[680px]">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h2 className="text-base font-semibold text-foreground">
          {t("whatsappTemplates.recipientLists.addContactsModal.title")}
        </h2>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          disabled={isSubmitting}
          onClick={onCancel}
          aria-label={t("whatsappTemplates.recipientLists.addContactsModal.cancel")}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="scrollbar-hide flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overflow-x-hidden px-4 py-3">
        <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
          <div className="min-w-0 flex-1 space-y-1.5">
            <label className="text-xs font-medium text-foreground" htmlFor="recipient-list-name-inline">
              {t("whatsappTemplates.recipientLists.addContactsModal.listNameLabel")}
              <span className="text-destructive"> *</span>
            </label>
            <div className="relative max-w-md">
              <Input
                id="recipient-list-name-inline"
                maxLength={60}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("whatsappTemplates.recipientLists.addContactsModal.listNamePlaceholder")}
                className="pr-16"
                disabled={isSubmitting}
              />
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                {nameLen}/60
              </span>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 sm:pb-0.5">
            <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
              {t("whatsappTemplates.recipientLists.addContactsModal.cancel")}
            </Button>
            <Button type="button" onClick={() => void handleAdd()} disabled={addDisabled}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("whatsappTemplates.recipientLists.addContactsModal.saving")}
                </>
              ) : (
                t("whatsappTemplates.recipientLists.addContactsModal.add")
              )}
            </Button>
          </div>
        </div>

        <Alert className="shrink-0 border-blue-200 bg-blue-50/90 text-blue-950 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-50">
          <Info className="h-4 w-4 text-blue-600 dark:text-blue-300" />
          <AlertDescription className="text-sm">
            {t("whatsappTemplates.recipientLists.addContactsModal.infoBanner")}
          </AlertDescription>
        </Alert>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border bg-background">
          <div className="shrink-0 border-b border-border px-2 py-2">
            <LeadsFilters
              variant="embedded"
              embeddedSingleRow
              filters={filters}
              onFiltersChange={setFilters}
              filteredLeads={tableRows as unknown as NewLead[]}
            />
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            {searchErrorMessage ? (
              <Alert variant="destructive" className="m-2">
                <AlertDescription>{searchErrorMessage}</AlertDescription>
              </Alert>
            ) : (
              <div className="relative flex h-full min-h-[240px] flex-col">
                {searchLoading && !tableRows.length ? (
                  <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 bg-background/60 text-sm">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("whatsappTemplates.recipientLists.addContactsModal.loading")}
                  </div>
                ) : null}
                <LeadsTableNew
                  leads={tableRowsForDisplay as unknown as NewLead[]}
                  onUpdateLead={async () => {}}
                  onDeleteLead={async () => {}}
                  attributionSort={attributionSort}
                  onAttributionSort={handleAttributionSort}
                  pickerSelection={{
                    selectedPhoneKeys: selectedRowIds,
                    onTogglePhone: onToggleRow,
                    onTogglePage,
                    getPhoneKey: (lead) => String(lead.id),
                    replaceTitleColumnWithPhone: true,
                    showEmailColumn: true,
                  }}
                  categoryColumnFilter={{
                    value: filters.category,
                    onChange: (v) => setFilters((f) => ({ ...f, category: v })),
                    options: subServices,
                  }}
                  servicesColumnFilter={{
                    value: filters.services,
                    onChange: (v) => setFilters((f) => ({ ...f, services: v })),
                    options: servicesFilterOptions,
                  }}
                  sourceColumnFilter={{
                    value: filters.source,
                    onChange: (v) => setFilters((f) => ({ ...f, source: v })),
                    options: sourceFilterOptions,
                  }}
                  createdByColumnFilter={{
                    value: filters.createdBy,
                    onChange: (v) => setFilters((f) => ({ ...f, createdBy: v })),
                    options: createdByFilterOptions,
                  }}
                  assigneeColumnFilter={{
                    value: filters.assignee,
                    onChange: (v) => setFilters((f) => ({ ...f, assignee: v })),
                    options: assigneeFilterOptions,
                  }}
                  fuPriorityColumnFilter={{
                    value: filters.fuPriority,
                    onChange: (v) => setFilters((f) => ({ ...f, fuPriority: v })),
                    options: FU_PRIORITY_FILTER_CHOICES,
                  }}
                  statusColumnFilter={{
                    value: filters.status,
                    onChange: (v) => setFilters((f) => ({ ...f, status: v })),
                    options: statusFilterOptions,
                  }}
                  utmSourceColumnFilter={{
                    value: filters.utmSource,
                    onChange: (v) => setFilters((f) => ({ ...f, utmSource: v })),
                    options: utmSourceFilterOptions,
                  }}
                  utmCampaignColumnFilter={{
                    value: filters.utmCampaign,
                    onChange: (v) => setFilters((f) => ({ ...f, utmCampaign: v })),
                    options: utmCampaignFilterOptions,
                  }}
                  utmMediumColumnFilter={{
                    value: filters.utmMedium,
                    onChange: (v) => setFilters((f) => ({ ...f, utmMedium: v })),
                    options: utmMediumFilterOptions,
                  }}
                  utmContentColumnFilter={{
                    value: filters.utmContent,
                    onChange: (v) => setFilters((f) => ({ ...f, utmContent: v })),
                    options: utmContentFilterOptions,
                  }}
                  utmTermColumnFilter={{
                    value: filters.utmTerm,
                    onChange: (v) => setFilters((f) => ({ ...f, utmTerm: v })),
                    options: utmTermFilterOptions,
                  }}
                  attributionLabelColumnFilter={{
                    value: filters.attributionLabel,
                    onChange: (v) => setFilters((f) => ({ ...f, attributionLabel: v })),
                    options: attributionLabelOptionsEmbedded,
                  }}
                  gclidColumnFilter={{
                    value: filters.gclid ?? "all",
                    onChange: (v) => setFilters((f) => ({ ...f, gclid: v })),
                    options: gclidFilterOptions,
                  }}
                  landingUrlContainsColumnFilter={{
                    value: filters.landingUrlContains,
                    onChange: (v) => setFilters((f) => ({ ...f, landingUrlContains: v })),
                  }}
                  getSurveyForLead={(lead) => surveyFromRpcItem(lead as RecipientPickerRpcItem)}
                  surveyColumnFilter={{
                    value: (filters.surveyRating ?? "all") as SurveyRatingColumnFilterValue,
                    onChange: handleSurveyRatingColumnFilterChange,
                  }}
                  resolveColumnFilter={{
                    value: isResolveFilter,
                    onChange: setIsResolveFilter,
                  }}
                />
              </div>
            )}
          </div>
          <div className="shrink-0 border-t border-border bg-muted/20">
            {selectAllBanner ? (
              <div className="border-b border-amber-200/80 bg-amber-50 px-2 py-1.5 text-xs text-amber-900">
                {selectAllBanner}
              </div>
            ) : null}
            <div className="flex min-w-0 flex-nowrap items-center gap-x-2 gap-y-0 overflow-x-auto px-2 py-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="shrink-0 text-xs text-muted-foreground">
                {t("whatsappTemplates.recipientLists.addContactsModal.filteredCount", { total })}
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">
                {t("whatsappTemplates.recipientLists.addContactsModal.selectedCount", {
                  count: picks.length,
                  max: RECIPIENT_PICKER_MAX_SELECT,
                })}
              </span>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-8 shrink-0"
                disabled={selectAllLoading || total === 0 || !organizationId}
                onClick={() => void handleSelectAllFiltered()}
              >
                {selectAllLoading ? (
                  <>
                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                    {t("whatsappTemplates.recipientLists.addContactsModal.selectAllLoading")}
                  </>
                ) : (
                  t("whatsappTemplates.recipientLists.addContactsModal.selectAllFiltered", {
                    max: RECIPIENT_PICKER_MAX_SELECT,
                  })
                )}
              </Button>
              <div className="ml-auto flex shrink-0 items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  {t("whatsappTemplates.recipientLists.addContactsModal.prevPage")}
                </Button>
                <span className="whitespace-nowrap text-xs text-muted-foreground">
                  {t("whatsappTemplates.recipientLists.addContactsModal.pageIndicator", {
                    page,
                    totalPages,
                  })}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  {t("whatsappTemplates.recipientLists.addContactsModal.nextPage")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
