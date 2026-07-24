import React, { useState, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LeadsFilters, LeadsFilters as LeadsFiltersType } from "@/5-3-dashboard/components/leads/filters/LeadsFilters";
import { LeadsMetricsCards } from "@/5-3-dashboard/components/leads/metrics/LeadsMetricsCards";
import LeadsTableNew from "@/5-3-dashboard/components/leads/table/LeadsTableNew";
import { LeadsInsights } from "@/5-3-dashboard/components/leads/metrics/LeadsInsights";
import { NewLeadForm } from "@/5-3-dashboard/components/leads/forms/NewLeadForm";
import { LeadsTableFooter } from "@/5-3-dashboard/components/leads/table/LeadsTableFooter";
import { LeadsSidebarFooter } from "@/5-3-dashboard/components/leads/table/LeadsSidebarFooter";
import { useLeads } from '@/shared/hooks/organized/sales';
import type { CreateLeadData } from '@/shared/types/leads';
import { useOmnichannelRosterAssignees } from '@/shared/hooks/useOrganizationOmnichannelStaff';
import { useLeadsReportIdleAccess } from '@/5-3-dashboard/leads-report';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useLeadClientStatuses } from "@/5-3-dashboard/hooks/useLeadClientStatuses";
import { Button } from '@/shared/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import { generateLeadsPDF } from "@/5-3-dashboard/lib/LeadsPDFGenerator";
import { useToast } from '@/shared/components/ui/use-toast';
import type { LeadAttributionSortColumn } from '@/shared/lib/leadAttribution';
import {
  defaultLeadAttributionSortState,
  distinctLeadAttributionValues,
  sortLeadsByAttributionColumn,
} from '@/shared/lib/leadAttribution';
import {
  FU_PRIORITY_FILTER_CHOICES,
  buildAssigneeFilterOptions,
  buildLeadSourceFilterOptions,
  buildWebPropertyFilterOptions,
  buildUniqueLeadStatusFilterOptions,
  useLeadsManagementFilterQueries,
} from '@/5-3-dashboard/hooks/useLeadsManagementFilterQueries';
import { useLeadsTableSurveyIntegration } from '@/5-3-dashboard/hooks/useLeadsTableSurveyIntegration';
import { useGoogleAdsConversionUploadsMap } from '@/5-3-dashboard/hooks/useGoogleAdsConversionUploadsMap';
import { useMetaAdsConversionUploadsMap } from '@/5-3-dashboard/hooks/useMetaAdsConversionUploadsMap';
import { useGoogleAdsConnected } from '@/google-ads/hooks/useGoogleAdsConnected';
import { useGoogleAdsIntegrationEnabled } from '@/google-ads/hooks/useGoogleAdsIntegrationEnabled';
import { useMetaAdsConnected } from '@/meta-ads/hooks/useMetaAdsConnected';
import { useMetaAdsIntegrationEnabled } from '@/meta-ads/hooks/useMetaAdsIntegrationEnabled';
import { useGoogleContactsConnected } from '@/google-contacts/hooks/useGoogleContactsConnected';
import { useGoogleContactsSyncLinksMap } from '@/5-3-dashboard/hooks/useGoogleContactsSyncLinksMap';
import { CustomerSurveyHistoryDialog } from '@/5-3-dashboard/components/leads/dialogs/CustomerSurveyHistoryDialog';

export const ConsultantsPageContent = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const isReportView = searchParams.get('view') === 'report';
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [filters, setFilters] = useState<LeadsFiltersType>({
    dataCompleteness: 'all',
    services: 'all',
    category: 'all',
    createdBy: 'all',
    webProperty: 'all',
    assignee: 'all',
    fuPriority: 'all',
    status: 'all',
    source: 'all',
    dateRange: null,
    search: '',
    utmSource: 'all',
    utmMedium: 'all',
    utmCampaign: 'all',
    utmContent: 'all',
    utmTerm: 'all',
    attributionLabel: 'all',
    landingUrlContains: '',
    surveyRating: 'all',
  });
  const [attributionSort, setAttributionSort] = useState(defaultLeadAttributionSortState);
  const { leads, createLead, updateLead, deleteLead, refetch } = useLeads({ scope: 'all' });
  const { organizationId } = useCurrentOrg();
  const { data: googleAdsConnected = false } = useGoogleAdsConnected(organizationId);
  const { data: googleAdsIntegrationEnabled = false } = useGoogleAdsIntegrationEnabled(organizationId);
  const { data: metaAdsConnected = false } = useMetaAdsConnected(organizationId);
  const { data: metaAdsIntegrationEnabled = false } = useMetaAdsIntegrationEnabled(organizationId);
  const { data: googleContactsConnected = false } = useGoogleContactsConnected(organizationId);
  const { getSyncForLead, isLoading: googleAdsSyncLoading } = useGoogleAdsConversionUploadsMap(
    organizationId,
    leads,
  );
  const { getSyncForLead: getMetaSyncForLead, isLoading: metaAdsSyncLoading } =
    useMetaAdsConversionUploadsMap(organizationId, leads);
  const { getSyncForLead: getGoogleContactsSyncForLead, isLoading: googleContactsSyncLoading } =
    useGoogleContactsSyncLinksMap(organizationId, leads);

  const handleAttributionSort = useCallback((column: LeadAttributionSortColumn) => {
    setAttributionSort((prev) => {
      if (prev.column !== column) return { column, direction: 'asc' };
      return { column, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
    });
  }, []);
  const { data: employees = [] } = useOmnichannelRosterAssignees();
  const {
    canViewIdleAgents,
    omnichannelRoster,
    omnichannelRosterLoading,
  } = useLeadsReportIdleAccess();
  const {
    surveyTableProps,
    matchesSurveyRatingFilter,
    surveyHistoryDialogProps,
    refreshSurveyData,
    surveyRatingByLeadId,
  } = useLeadsTableSurveyIntegration(organizationId, leads);
  const { clientStatuses, clientProfiles } = useLeadClientStatuses(leads);

  const handleRefreshLeads = useCallback(() => {
    refetch();
    refreshSurveyData();
  }, [refetch, refreshSurveyData]);
  const { subServices, leadSources, leadStatuses } = useLeadsManagementFilterQueries();

  const handleCategoryFilterChange = useCallback((value: string) => {
    setFilters((prev) => ({ ...prev, category: value }));
  }, []);

  const handleSourceFilterChange = useCallback((value: string) => {
    setFilters((prev) => ({ ...prev, source: value }));
  }, []);

  const handleCreatedByFilterChange = useCallback((value: string) => {
    setFilters((prev) => ({ ...prev, createdBy: value }));
  }, []);

  const handleWebPropertyFilterChange = useCallback((value: string) => {
    setFilters((prev) => ({ ...prev, webProperty: value }));
  }, []);

  const handleAssigneeFilterChange = useCallback((value: string) => {
    setFilters((prev) => ({ ...prev, assignee: value }));
  }, []);

  const handleFuPriorityFilterChange = useCallback((value: string) => {
    setFilters((prev) => ({ ...prev, fuPriority: value }));
  }, []);

  const handleStatusFilterChange = useCallback((value: string) => {
    setFilters((prev) => ({ ...prev, status: value }));
  }, []);

  const statusFilterOptions = useMemo(
    () => buildUniqueLeadStatusFilterOptions(leadStatuses),
    [leadStatuses],
  );

  const createdByFilterOptions = useMemo(() => {
    const set = new Set<string>();
    const skip = new Set(["Website form", "Synckerja API"]);
    for (const l of leads) {
      const n = (l.created_by_name ?? "").trim();
      if (n && !skip.has(n)) set.add(n);
    }
    return [...set].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  }, [leads]);

  const webPropertyFilterOptions = useMemo(
    () => buildWebPropertyFilterOptions(leads),
    [leads],
  );

  const sourceFilterOptions = useMemo(
    () => buildLeadSourceFilterOptions(leads, leadSources),
    [leads, leadSources],
  );

  const assigneeFilterOptions = useMemo(
    () => buildAssigneeFilterOptions(leads, employees),
    [leads, employees],
  );

  const handleUtmSourceFilterChange = useCallback((value: string) => {
    setFilters((prev) => ({ ...prev, utmSource: value }));
  }, []);
  const handleUtmCampaignFilterChange = useCallback((value: string) => {
    setFilters((prev) => ({ ...prev, utmCampaign: value }));
  }, []);
  const handleUtmMediumFilterChange = useCallback((value: string) => {
    setFilters((prev) => ({ ...prev, utmMedium: value }));
  }, []);
  const handleUtmContentFilterChange = useCallback((value: string) => {
    setFilters((prev) => ({ ...prev, utmContent: value }));
  }, []);
  const handleUtmTermFilterChange = useCallback((value: string) => {
    setFilters((prev) => ({ ...prev, utmTerm: value }));
  }, []);

  const utmSourceFilterOptions = useMemo(
    () => distinctLeadAttributionValues(leads, "utm_source"),
    [leads],
  );
  const utmCampaignFilterOptions = useMemo(
    () => distinctLeadAttributionValues(leads, "utm_campaign"),
    [leads],
  );
  const utmMediumFilterOptions = useMemo(
    () => distinctLeadAttributionValues(leads, "utm_medium"),
    [leads],
  );
  const utmContentFilterOptions = useMemo(
    () => distinctLeadAttributionValues(leads, "utm_content"),
    [leads],
  );
  const utmTermFilterOptions = useMemo(
    () => distinctLeadAttributionValues(leads, "utm_term"),
    [leads],
  );

  const handleAttributionLabelFilterChange = useCallback((value: string) => {
    setFilters((prev) => ({ ...prev, attributionLabel: value }));
  }, []);

  const handleLandingUrlContainsChange = useCallback((value: string) => {
    setFilters((prev) => ({ ...prev, landingUrlContains: value }));
  }, []);

  const attributionLabelFilterOptions = useMemo(
    () => distinctLeadAttributionValues(leads, "attribution_label"),
    [leads],
  );

  const handleNewLeadClick = () => {
    setIsCreateDialogOpen(true);
  };

  const handleCreateLead = async (leadData: CreateLeadData) => {
    setIsSubmitting(true);
    try {
      await createLead(leadData);
      setIsCreateDialogOpen(false);
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Gagal membuat lead',
        description: (e as Error)?.message ?? 'Silakan coba lagi.',
      });
      throw e;
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter leads based on selected filters
  const filteredLeads = useMemo(() => {
    let filtered = leads;

    // Search filter
    if (filters.search && filters.search.trim()) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(lead => 
        (lead.client ?? '').toLowerCase().includes(searchLower) ||
        (lead.title ?? '').toLowerCase().includes(searchLower) ||
        lead.ticket_id?.toLowerCase().includes(searchLower)
      );
    }

    // Data completeness filter
    if (filters.dataCompleteness !== 'all') {
      filtered = filtered.filter(lead => {
        const clientStatus = clientStatuses[lead.id] || 'empty';
        return clientStatus === filters.dataCompleteness;
      });
    }

    // Services filter
    if (filters.services !== 'all' && filters.services) {
      filtered = filtered.filter(lead => lead.services === filters.services);
    }

    // Category filter
    if (filters.category !== 'all' && filters.category) {
      filtered = filtered.filter(lead => lead.category === filters.category);
    }

    // Assignee filter
    if (filters.assignee !== 'all' && filters.assignee) {
      filtered = filtered.filter(lead => lead.assignee === filters.assignee);
    }

    // Created-by (creator name) filter
    if (filters.createdBy !== 'all' && filters.createdBy) {
      filtered = filtered.filter(
        (lead) => (lead.created_by_name ?? '').trim() === filters.createdBy,
      );
    }

    if (filters.webProperty !== 'all' && filters.webProperty) {
      filtered = filtered.filter(
        (lead) => (lead.web_id ?? '').trim() === filters.webProperty,
      );
    }

    // FU Priority filter
    if (filters.fuPriority !== 'all') {
      if (filters.fuPriority === 'Please Follow Up') {
        filtered = filtered.filter(
          (lead) => (lead.followup ?? 0) === 0 && !lead.template_followup_awaiting_reply,
        );
      } else if (filters.fuPriority === 'No Respon') {
        filtered = filtered.filter((lead) => Boolean(lead.template_followup_awaiting_reply));
      } else if (filters.fuPriority) {
        filtered = filtered.filter((lead) => lead.fu_priority === filters.fuPriority);
      }
    }

    // Status filter
    if (filters.status !== 'all' && filters.status) {
      const statusNorm = (filters.status as string).trim().toLowerCase();
      filtered = filtered.filter(lead => (lead.lead_status?.name?.trim().toLowerCase() ?? '') === statusNorm);
    }

    // Source filter
    if (filters.source !== 'all' && filters.source) {
      filtered = filtered.filter(lead => lead.source === filters.source);
    }

    if (filters.utmSource !== 'all' && filters.utmSource) {
      filtered = filtered.filter((lead) => (lead.utm_source ?? '') === filters.utmSource);
    }
    if (filters.utmMedium !== 'all' && filters.utmMedium) {
      filtered = filtered.filter((lead) => (lead.utm_medium ?? '') === filters.utmMedium);
    }
    if (filters.utmCampaign !== 'all' && filters.utmCampaign) {
      filtered = filtered.filter((lead) => (lead.utm_campaign ?? '') === filters.utmCampaign);
    }
    if (filters.utmContent !== 'all' && filters.utmContent) {
      filtered = filtered.filter((lead) => (lead.utm_content ?? '') === filters.utmContent);
    }
    if (filters.utmTerm !== 'all' && filters.utmTerm) {
      filtered = filtered.filter((lead) => (lead.utm_term ?? '') === filters.utmTerm);
    }
    if (filters.attributionLabel !== 'all' && filters.attributionLabel) {
      filtered = filtered.filter((lead) => (lead.attribution_label ?? '') === filters.attributionLabel);
    }
    const landingQ = (filters.landingUrlContains ?? '').trim().toLowerCase();
    if (landingQ) {
      filtered = filtered.filter((lead) => (lead.landing_url ?? '').toLowerCase().includes(landingQ));
    }

    filtered = filtered.filter(matchesSurveyRatingFilter);

    // Date range filter
    if (filters.dateRange && filters.dateRange.from && filters.dateRange.to) {
      const fromDate = new Date(filters.dateRange.from);
      const toDate = new Date(filters.dateRange.to);
      fromDate.setHours(0, 0, 0, 0);
      toDate.setHours(23, 59, 59, 999);
      
      filtered = filtered.filter(lead => {
        const leadDate = new Date(lead.created_at);
        return leadDate >= fromDate && leadDate <= toDate;
      });
    }

    return filtered;
  }, [leads, filters, clientStatuses, matchesSurveyRatingFilter]);

  const sortedLeads = useMemo(
    () =>
      sortLeadsByAttributionColumn(filteredLeads, attributionSort, {
        getSurveyRating: (lead) => surveyRatingByLeadId.get(String(lead.id ?? "")) ?? null,
      }),
    [filteredLeads, attributionSort, surveyRatingByLeadId],
  );

  const convertedLeads = filteredLeads.filter(lead => (lead.lead_status?.name?.trim().toLowerCase() ?? '') === 'converted').length;

  // Generate PDF Report
  const generatePDFReport = async () => {
    try {
      setIsGeneratingPDF(true);

      // Validate data before generating PDF
      if (!filteredLeads || filteredLeads.length === 0) {
        alert('Tidak ada data lead untuk dibuat laporan PDF');
        return;
      }

      // Prepare comprehensive data for PDF
      const pdfData = {
        leads: filteredLeads,
        filters: filters || {},
        clientStatuses,
        clientProfiles
      };

      // Call the PDF generator
      await generateLeadsPDF(pdfData);
    } catch (error) {
      console.error('❌ Error generating PDF:', error);
      alert('Terjadi kesalahan saat membuat laporan PDF. Silakan coba lagi.');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  return (
    <>
      {/* Create Lead Dialog */}
      <NewLeadForm
        open={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        onSubmit={handleCreateLead}
        isSubmitting={isSubmitting}
      />

      {isReportView ? (
        <div className="flex min-h-0 h-full min-w-0 w-full flex-1 flex-col gap-2 overflow-hidden">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="flex-shrink-0 border-b p-2">
              <LeadsFilters
                filters={filters}
                onFiltersChange={setFilters}
                onNewLeadClick={handleNewLeadClick}
                filteredLeads={filteredLeads}
                attributionBarLeads={leads}
              />
            </div>
            <div className="flex-shrink-0 px-2 pb-2">
              <LeadsMetricsCards leads={filteredLeads} />
            </div>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-t border-gray-100">
              <div className="flex flex-shrink-0 items-center justify-between gap-2 border-b px-4 py-2">
                <div>
                  <h3 className="text-lg font-semibold text-slate-800">
                    {t('leadsManagement.reportSummary.title', 'Report Summary')}
                  </h3>
                  <p className="text-sm text-slate-500">
                    {t('leadsManagement.reportSummary.subtitle', 'Data summary based on filters')}
                  </p>
                </div>
                <Button
                  onClick={generatePDFReport}
                  disabled={isGeneratingPDF}
                  size="sm"
                  className="bg-blue-600 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isGeneratingPDF ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('leadsManagement.reportSummary.generating', 'Generating...')}
                    </>
                  ) : (
                    <>
                      <Download className="mr-2 h-4 w-4" />
                      {t('leadsManagement.reportSummary.downloadPdf', 'Download PDF')}
                    </>
                  )}
                </Button>
              </div>
              <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <LeadsInsights
                  leads={filteredLeads}
                  filters={filters}
                  clientStatuses={clientStatuses}
                  clientProfiles={clientProfiles}
                  allEmployees={employees}
                  organizationId={organizationId ?? undefined}
                  denserSections
                />
              </div>
              <LeadsSidebarFooter totalLeads={filteredLeads.length} convertedLeads={convertedLeads} />
            </div>
          </div>
        </div>
      ) : (
      <div className="grid min-h-0 h-full min-w-0 w-full flex-1 grid-cols-12 gap-2 overflow-hidden">
        {/* Section utama - 9 columns, full height memenuhi area grid */}
        <div className="col-span-9 flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
          <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
            <div className="mb-2 flex-shrink-0">
              <div className="rounded-md border bg-white p-2">
                <LeadsFilters 
                  filters={filters}
                  onFiltersChange={setFilters}
                  onNewLeadClick={handleNewLeadClick}
                  filteredLeads={filteredLeads}
                />
              </div>
            </div>
            <div className="mb-2 flex-shrink-0">
              <LeadsMetricsCards leads={filteredLeads} />
            </div>
            <div className="min-h-0 flex-1 overflow-hidden">
              <div className="flex h-full flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                {/* Area tabel saja yang scroll; footer tetap di bawah dan selalu terlihat */}
                <div className="min-h-0 flex-1 overflow-hidden">
                  <LeadsTableNew
                    leads={sortedLeads}
                    onUpdateLead={updateLead}
                    onDeleteLead={deleteLead}
                    onRefreshLeads={handleRefreshLeads}
                    attributionSort={attributionSort}
                    onAttributionSort={handleAttributionSort}
                    categoryColumnFilter={{
                      value: filters.category,
                      onChange: handleCategoryFilterChange,
                      options: subServices,
                    }}
                    sourceColumnFilter={{
                      value: filters.source,
                      onChange: handleSourceFilterChange,
                      options: sourceFilterOptions,
                    }}
                    createdByColumnFilter={{
                      value: filters.createdBy,
                      onChange: handleCreatedByFilterChange,
                      options: createdByFilterOptions,
                    }}
                    webPropertyColumnFilter={{
                      value: filters.webProperty,
                      onChange: handleWebPropertyFilterChange,
                      options: webPropertyFilterOptions,
                    }}
                    assigneeColumnFilter={{
                      value: filters.assignee,
                      onChange: handleAssigneeFilterChange,
                      options: assigneeFilterOptions,
                    }}
                    fuPriorityColumnFilter={{
                      value: filters.fuPriority,
                      onChange: handleFuPriorityFilterChange,
                      options: FU_PRIORITY_FILTER_CHOICES,
                    }}
                    statusColumnFilter={{
                      value: filters.status,
                      onChange: handleStatusFilterChange,
                      options: statusFilterOptions,
                    }}
                    utmSourceColumnFilter={{
                      value: filters.utmSource,
                      onChange: handleUtmSourceFilterChange,
                      options: utmSourceFilterOptions,
                    }}
                    utmCampaignColumnFilter={{
                      value: filters.utmCampaign,
                      onChange: handleUtmCampaignFilterChange,
                      options: utmCampaignFilterOptions,
                    }}
                    utmMediumColumnFilter={{
                      value: filters.utmMedium,
                      onChange: handleUtmMediumFilterChange,
                      options: utmMediumFilterOptions,
                    }}
                    utmContentColumnFilter={{
                      value: filters.utmContent,
                      onChange: handleUtmContentFilterChange,
                      options: utmContentFilterOptions,
                    }}
                    utmTermColumnFilter={{
                      value: filters.utmTerm,
                      onChange: handleUtmTermFilterChange,
                      options: utmTermFilterOptions,
                    }}
                    attributionLabelColumnFilter={{
                      value: filters.attributionLabel,
                      onChange: handleAttributionLabelFilterChange,
                      options: attributionLabelFilterOptions,
                    }}
                    landingUrlContainsColumnFilter={{
                      value: filters.landingUrlContains,
                      onChange: handleLandingUrlContainsChange,
                    }}
                    showGoogleAdsSyncColumn={googleAdsConnected}
                    getGoogleAdsSyncForLead={getSyncForLead}
                    googleAdsSyncLoading={googleAdsSyncLoading}
                    googleAdsUploadsEnabled={googleAdsIntegrationEnabled}
                    showMetaAdsSyncColumn={metaAdsConnected}
                    getMetaAdsSyncForLead={getMetaSyncForLead}
                    metaAdsSyncLoading={metaAdsSyncLoading}
                    metaAdsUploadsEnabled={metaAdsIntegrationEnabled}
                    showGoogleContactsSyncColumn={googleContactsConnected}
                    getGoogleContactsSyncForLead={getGoogleContactsSyncForLead}
                    googleContactsSyncLoading={googleContactsSyncLoading}
                    {...surveyTableProps}
                  />
                </div>
                <LeadsTableFooter 
                  totalLeads={leads.length}
                  convertedLeads={convertedLeads}
                  filteredLeads={filteredLeads.length}
                  selectedStatus={filters.status}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar Report Summary - full height memenuhi area grid, scroll di dalam */}
        <div className="col-span-3 flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
          <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="px-4 py-1.5 border-b flex-shrink-0">
              <div>
                <h3 className="text-lg font-semibold text-slate-800">Report Summary</h3>
                <p className="text-sm text-slate-500">Data summary based on filters</p>
              </div>
            </div>
            <div className="scrollbar-hide flex-1 min-h-0 overflow-y-auto overflow-x-hidden seamless-scroll nested-scroll-touch-chain p-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <LeadsInsights 
                leads={filteredLeads}
                allLeads={leads}
                filters={filters} 
                clientStatuses={clientStatuses} 
                clientProfiles={clientProfiles}
                allEmployees={employees}
                organizationId={organizationId ?? undefined}
                canViewIdleAgents={canViewIdleAgents}
                omnichannelRoster={omnichannelRoster}
                omnichannelRosterLoading={omnichannelRosterLoading}
              />
            </div>
            <LeadsSidebarFooter 
              totalLeads={filteredLeads.length}
              convertedLeads={convertedLeads}
            />
          </div>
        </div>
      </div>
      )}

      {surveyHistoryDialogProps ? (
        <CustomerSurveyHistoryDialog {...surveyHistoryDialogProps} />
      ) : null}
    </>
  );
};

