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
import { useAvailableEmployees } from '@/shared/hooks/useAvailableEmployees';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useLeadClientStatuses } from "@/5-3-dashboard/hooks/useLeadClientStatuses";
import { Button } from '@/shared/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import { generateLeadsPDF } from "@/5-3-dashboard/lib/LeadsPDFGenerator";
import { useToast } from '@/shared/components/ui/use-toast';
import type { LeadAttributionSortColumn } from '@/shared/lib/leadAttribution';
import { defaultLeadAttributionSortState, sortLeadsByAttributionColumn } from '@/shared/lib/leadAttribution';

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
  });
  const [attributionSort, setAttributionSort] = useState(defaultLeadAttributionSortState);
  const { leads, createLead, updateLead, deleteLead, refetch } = useLeads({ scope: 'all' });

  const handleAttributionSort = useCallback((column: LeadAttributionSortColumn) => {
    setAttributionSort((prev) => {
      if (prev.column !== column) return { column, direction: 'asc' };
      return { column, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
    });
  }, []);
  const { data: employees = [] } = useAvailableEmployees();
  const { organizationId } = useCurrentOrg();
  const { clientStatuses, clientProfiles } = useLeadClientStatuses(leads);

  const handleNewLeadClick = () => {
    setIsCreateDialogOpen(true);
  };

  const handleCreateLead = async (leadData: any) => {
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

    // FU Priority filter
    if (filters.fuPriority !== 'all') {
      if (filters.fuPriority === 'Please Follow Up') {
        filtered = filtered.filter(lead => lead.followup === 0);
      } else if (filters.fuPriority) {
        filtered = filtered.filter(lead => lead.fu_priority === filters.fuPriority);
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
  }, [leads, filters, clientStatuses]);

  const sortedLeads = useMemo(
    () => sortLeadsByAttributionColumn(filteredLeads, attributionSort),
    [filteredLeads, attributionSort],
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
                leadsForAttributionOptions={leads}
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
              <div className="nested-scroll-touch-chain seamless-scroll min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-4">
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
                  leadsForAttributionOptions={leads}
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
                    onRefreshLeads={refetch}
                    attributionSort={attributionSort}
                    onAttributionSort={handleAttributionSort}
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
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-800">Report Summary</h3>
                  <p className="text-sm text-slate-500">Data summary based on filters</p>
                </div>
                <Button onClick={generatePDFReport} disabled={isGeneratingPDF} size="sm" className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed">
                  {isGeneratingPDF ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Download PDF
                    </>
                  )}
                </Button>
              </div>
            </div>
            <div className="scrollbar-hide flex-1 min-h-0 overflow-y-auto overflow-x-hidden seamless-scroll nested-scroll-touch-chain p-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <LeadsInsights 
                leads={filteredLeads} 
                filters={filters} 
                clientStatuses={clientStatuses} 
                clientProfiles={clientProfiles}
                allEmployees={employees}
                organizationId={organizationId ?? undefined}
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
    </>
  );
};

