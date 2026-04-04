
import React, { useState, useMemo, useEffect } from 'react';
import { LeadsFilters, LeadsFilters as LeadsFiltersType } from './LeadsFilters';
import { LeadsMetricsCards } from './LeadsMetricsCards';
import LeadsTableNew from './LeadsTableNew';
import { LeadsInsights } from './LeadsInsights';
import { NewLeadForm } from './NewLeadForm';
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import { useLeads } from '@/shared/hooks/organized/sales';
import { NewLead } from '@/shared/types/leads';
import { useClientProfileStatus } from '@/shared/hooks/organized/sales';
import { supabase } from '@/shared/lib/supabaseClient';

interface LeadsTableViewContentProps {
  // No props needed now, using the hook
}

export const LeadsTableViewContent = ({}: LeadsTableViewContentProps) => {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filters, setFilters] = useState<LeadsFiltersType>({
    dataCompleteness: 'all',
    services: 'all',
    category: 'all',
    assignee: 'all',
    fuPriority: 'all',
    status: 'all',
    source: 'all',
    dateRange: null
  });
  const { leads, loading, createLead, updateLead, deleteLead, refetch } = useLeads();

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

  // Fetch client profile statuses
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

          // Synthetic IDs (wa-*, email-*) must not query lead_client_profiles (UUID column)
          if (isEmail) {
            statusMap[lead.id] = 'empty';
            profileMap[lead.id] = null;
            continue;
          }
          if (isWhatsApp && conversationId) {
            const { data: waData } = await supabase
              .from('whatsapp_conversation_client_profiles')
              .select('*')
              .eq('conversation_id', conversationId)
              .maybeSingle();
            if (!waData) {
              statusMap[lead.id] = 'empty';
              profileMap[lead.id] = null;
            } else {
              profileMap[lead.id] = waData;
              const fields = [waData.name, (waData as any).code, waData.gender, waData.age, waData.occupation, waData.location, (waData as any).phone_number, (waData as any).email];
              const filledFields = fields.filter(field => field !== null && field !== undefined && field !== '').length;
              statusMap[lead.id] = filledFields === 0 ? 'empty' : filledFields === fields.length ? 'full' : 'partial';
            }
            continue;
          }

          const { data } = await supabase
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
        } catch (error) {
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

  return (
    <>
      <div className="p-2 flex flex-col xl:flex-row gap-2 bg-gradient-to-br from-slate-50 via-white to-blue-50/30 min-h-[calc(100vh-120px)] max-h-[calc(100vh-120px)] overflow-hidden">
        {/* Main Content - Responsive layout */}
        <div className="flex-1 min-w-0" style={{ flex: '1.8' }}>
          {/* Compact Filter Section */}
          <LeadsFilters onNewLeadClick={handleNewLeadClick} onFiltersChange={setFilters} filteredLeads={filteredLeads} />
          
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
                
                <LeadsTableNew leads={filteredLeads} onUpdateLead={updateLead} onDeleteLead={deleteLead} onRefreshLeads={refetch} />
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
