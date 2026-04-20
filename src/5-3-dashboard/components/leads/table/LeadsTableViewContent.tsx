
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { LeadsFilters, LeadsFilters as LeadsFiltersType } from "@/5-3-dashboard/components/leads/filters/LeadsFilters";
import { LeadsMetricsCards } from "@/5-3-dashboard/components/leads/metrics/LeadsMetricsCards";
import LeadsTableNew from "@/5-3-dashboard/components/leads/table/LeadsTableNew";
import { LeadsInsights } from "@/5-3-dashboard/components/leads/metrics/LeadsInsights";
import { NewLeadForm } from "@/5-3-dashboard/components/leads/forms/NewLeadForm";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import { Button } from "@/shared/components/ui/button";
import { useLeads, LeadsScope } from '@/shared/hooks/organized/sales';
import { NewLead } from '@/shared/types/leads';
import { useClientProfileStatus } from '@/shared/hooks/organized/sales';
import { supabase } from '@/shared/lib/supabaseClient';
import type { LeadAttributionSortColumn } from '@/shared/lib/leadAttribution';
import { defaultLeadAttributionSortState, sortLeadsByAttributionColumn } from '@/shared/lib/leadAttribution';

interface LeadsTableViewContentProps {
  // No props needed now, using the hook
}

export const LeadsTableViewContent = ({}: LeadsTableViewContentProps) => {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [scope, setScope] = useState<LeadsScope>('mine');
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
  const { leads, loading, createLead, updateLead, deleteLead, refetch } = useLeads({ scope });

  const handleAttributionSort = useCallback((column: LeadAttributionSortColumn) => {
    setAttributionSort((prev) => {
      if (prev.column !== column) return { column, direction: 'asc' };
      return { column, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
    });
  }, []);

  const handleNewLeadClick = () => {
    setIsCreateDialogOpen(true);
  };

  const handleCreateLead = async (leadData: any) => {
    setIsSubmitting(true);
    try {
      await createLead(leadData);
    } finally {
      setIsSubmitting(false);
    }
  };

  // State to manage client profile statuses and data
  const [clientStatuses, setClientStatuses] = useState<Record<string, 'full' | 'partial' | 'empty'>>({});
  const [clientProfiles, setClientProfiles] = useState<Record<string, any>>({});

  // Fetch client profile statuses (leads + WhatsApp conversations)
  useEffect(() => {
    const fetchStatuses = async () => {
      if (leads.length === 0) return;

      const statusMap: Record<string, 'full' | 'partial' | 'empty'> = {};
      const profileMap: Record<string, any> = {};

      for (const lead of leads) {
        try {
          const isWhatsApp = String(lead.id).startsWith('wa-');
          const isEmail = String(lead.id).startsWith('email-');
          const conversationId = isWhatsApp ? String(lead.id).replace(/^wa-/, '') : null;

          if (isEmail) {
            statusMap[lead.id] = 'empty';
            profileMap[lead.id] = null;
            continue;
          }

          const { data } = isWhatsApp && conversationId
            ? await supabase
                .from('whatsapp_conversation_client_profiles')
                .select('*')
                .eq('conversation_id', conversationId)
                .maybeSingle()
            : await supabase
                .from('lead_client_profiles')
                .select('*')
                .eq('lead_id', lead.id)
                .maybeSingle();

          if (!data) {
            statusMap[lead.id] = 'empty';
            profileMap[lead.id] = null;
          } else {
            profileMap[lead.id] = data;
            const fields = [data.name, (data as any).code, data.gender, data.age, data.occupation, data.location, (data as any).phone_number, (data as any).email];
            const filledFields = fields.filter(field => field !== null && field !== undefined && field !== '').length;

            if (filledFields === 0) {
              statusMap[lead.id] = 'empty';
            } else if (filledFields === fields.length) {
              statusMap[lead.id] = 'full';
            } else {
              statusMap[lead.id] = 'partial';
            }
          }
        } catch {
          statusMap[lead.id] = 'empty';
          profileMap[lead.id] = null;
        }
      }

      setClientStatuses(statusMap);
      setClientProfiles(profileMap);
    };

    fetchStatuses();
  }, [leads]);

  // Filter leads based on selected filters
  const filteredLeads = useMemo(() => {
    const filtered = leads.filter(lead => {
      if (filters.search && filters.search.trim()) {
        const q = filters.search.trim().toLowerCase();
        if (
          !(lead.client ?? '').toLowerCase().includes(q) &&
          !(lead.title ?? '').toLowerCase().includes(q) &&
          !lead.ticket_id?.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      // Data completeness filter
      if (filters.dataCompleteness !== 'all') {
        const clientStatus = clientStatuses[lead.id] || 'empty';
        if (clientStatus !== filters.dataCompleteness) {
          return false;
        }
      }

      // Services filter
      if (filters.services !== 'all' && lead.services !== filters.services) {
        return false;
      }

      // Category filter
      if (filters.category !== 'all' && lead.category !== filters.category) {
        return false;
      }

      // Assignee filter
      if (filters.assignee !== 'all' && lead.assignee !== filters.assignee) {
        return false;
      }

      // FU Priority filter
      if (filters.fuPriority !== 'all') {
        if (filters.fuPriority === 'Please Follow Up') {
          // Filter for leads that need follow up (either no follow up count or low follow up count)
          if (lead.followup > 0) {
            return false;
          }
        } else if (lead.fu_priority !== filters.fuPriority) {
          return false;
        }
      }

      // Status filter
      if (filters.status !== 'all' && lead.lead_status?.name !== filters.status) {
        return false;
      }

      // Source filter
      if (filters.source !== 'all' && lead.source !== filters.source) {
        return false;
      }

      if (filters.utmSource !== 'all' && filters.utmSource && (lead.utm_source ?? '') !== filters.utmSource) {
        return false;
      }
      if (filters.utmMedium !== 'all' && filters.utmMedium && (lead.utm_medium ?? '') !== filters.utmMedium) {
        return false;
      }
      if (filters.utmCampaign !== 'all' && filters.utmCampaign && (lead.utm_campaign ?? '') !== filters.utmCampaign) {
        return false;
      }
      if (filters.utmContent !== 'all' && filters.utmContent && (lead.utm_content ?? '') !== filters.utmContent) {
        return false;
      }
      if (filters.utmTerm !== 'all' && filters.utmTerm && (lead.utm_term ?? '') !== filters.utmTerm) {
        return false;
      }
      if (
        filters.attributionLabel !== 'all' &&
        filters.attributionLabel &&
        (lead.attribution_label ?? '') !== filters.attributionLabel
      ) {
        return false;
      }
      const landingQ = (filters.landingUrlContains ?? '').trim().toLowerCase();
      if (landingQ && !(lead.landing_url ?? '').toLowerCase().includes(landingQ)) {
        return false;
      }

      // Date range filter - include leads created OR converted in the date range
      if (filters.dateRange && filters.dateRange.from && filters.dateRange.to) {
        const fromDate = new Date(filters.dateRange.from);
        const toDate = new Date(filters.dateRange.to);
        
        // Set time to start/end of day for proper comparison
        fromDate.setHours(0, 0, 0, 0);
        toDate.setHours(23, 59, 59, 999);
        
        // Check if lead was created in the date range
        const leadCreatedDate = new Date(lead.created_at);
        const createdInRange = leadCreatedDate >= fromDate && leadCreatedDate <= toDate;
        
        // Check if lead was converted in the date range (if applicable)
        let convertedInRange = false;
        if (lead.converted_at) {
          const leadConvertedDate = new Date(lead.converted_at);
          convertedInRange = leadConvertedDate >= fromDate && leadConvertedDate <= toDate;
        }
        
        // Include lead if it was either created OR converted in the date range
        if (!createdInRange && !convertedInRange) {
          return false;
        }
      }

      return true;
    });
    return filtered;
  }, [leads, filters, clientStatuses]);

  const sortedLeads = useMemo(
    () => sortLeadsByAttributionColumn(filteredLeads, attributionSort),
    [filteredLeads, attributionSort],
  );

  return (
    <>
      <div className="p-2 flex flex-col xl:flex-row gap-2 bg-gradient-to-br from-slate-50 via-white to-blue-50/30 min-h-[calc(100vh-120px)] max-h-[calc(100vh-120px)] overflow-hidden">
        {/* Main Content - Responsive layout */}
        <div className="flex-1 min-w-0" style={{ flex: '1.8' }}>
          {/* Scope: My Room = only my assigned leads; Unassigned = pool to assign; All = all leads */}
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-medium text-slate-600">Room:</span>
            <div className="flex rounded-md border border-slate-200 bg-white p-0.5">
              <Button type="button" variant={scope === 'mine' ? 'default' : 'ghost'} size="sm" className="h-7 text-xs px-3" onClick={() => setScope('mine')}>
                My Room
              </Button>
              <Button type="button" variant={scope === 'unassigned' ? 'default' : 'ghost'} size="sm" className="h-7 text-xs px-3" onClick={() => setScope('unassigned')}>
                Unassigned
              </Button>
              <Button type="button" variant={scope === 'all' ? 'default' : 'ghost'} size="sm" className="h-7 text-xs px-3" onClick={() => setScope('all')}>
                All
              </Button>
            </div>
          </div>
          {/* Compact Filter Section */}
          <LeadsFilters
            onNewLeadClick={handleNewLeadClick}
            onFiltersChange={setFilters}
            filteredLeads={filteredLeads}
            leadsForAttributionOptions={leads}
          />
          
          {/* Loading state */}
          {loading ? (
            <div className="bg-white/95 backdrop-blur-sm rounded-md border border-slate-200/60 shadow-sm p-8 text-center">
              <p className="text-slate-500">Loading leads...</p>
            </div>
          ) : (
            <>
              {/* Metrics Section - Matching Employee Style */}
              <div className="mb-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                  <LeadsMetricsCards leads={filteredLeads as any} />
                </div>
              </div>
              
              {/* Leads Table */}
              <div className="bg-white/95 backdrop-blur-sm rounded-md border border-slate-200/60 shadow-sm overflow-hidden relative flex-1 min-h-0">
                {/* Modern accent line */}
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500/60 via-indigo-500/40 to-purple-500/30"></div>
                
                <LeadsTableNew
                  leads={sortedLeads}
                  onUpdateLead={updateLead}
                  onDeleteLead={deleteLead}
                  onRefreshLeads={refetch}
                  attributionSort={attributionSort}
                  onAttributionSort={handleAttributionSort}
                />
              </div>
            </>
          )}
        </div>
        
        {/* Sidebar - Responsive width with vertical scroll */}
        <div className="w-full xl:w-96 bg-white/90 backdrop-blur-sm rounded-md border border-slate-200/60 shadow-sm overflow-hidden relative" style={{ flex: 'none', maxWidth: '480px' }}>
          {/* Subtle accent border */}
          <div className="absolute top-0 left-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-500/40 via-indigo-400/30 to-purple-400/20"></div>
          
          <div className="p-3 border-b border-slate-100/80 bg-gradient-to-r from-blue-50/30 to-white">
            <h3 className="text-base font-semibold text-slate-800 tracking-tight mb-1">Leads Management Insights</h3>
            <p className="text-xs text-slate-500">Performance metrics and conversion analysis</p>
          </div>
          
          <ScrollArea className="h-[calc(100vh-280px)] w-full">
            <div className="p-2">
              <LeadsInsights leads={filteredLeads as any} filters={filters} clientStatuses={clientStatuses} clientProfiles={clientProfiles} />
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Create Lead Dialog */}
      <NewLeadForm
        open={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        onSubmit={handleCreateLead}
        isSubmitting={isSubmitting}
      />
    </>
  );
};
