
import React, { useState, useEffect } from 'react';
import { Input } from '@/shared/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Button } from '@/shared/components/ui/button';
import { Search, Plus, MoreVertical, Download } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';
import { StatusManagement } from '@/5-3-sales-consultant/components/filters/StatusManagement';
import { DateRangeFilter } from '@/5-3-sales-consultant/components/filters/DateRangeFilter';
import { EmployeeDropdown } from '@/shared/components/ui/employee-dropdown';
import { supabase } from '@/shared/lib/supabaseClient';
import { DateRange } from 'react-day-picker';
import { generateLeadsPDF } from './LeadsPDFGenerator';
import { getLeadStatusDisplayName } from '../utils/leadStatusDisplay';
import { NewLead } from '@/shared/types/leads';

interface LeadStatus {
  id: string;
  name: string;
  description: string;
  color: string;
}

interface LeadSource {
  id: string;
  name: string;
  description?: string;
}

interface Service {
  id: string;
  name: string;
}

interface SubService {
  id: string;
  name: string;
  service_id: string;
}

export interface LeadsFilters {
  dataCompleteness: 'all' | 'full' | 'partial' | 'empty';
  services: string;
  category: string;
  assignee: string;
  fuPriority: string;
  status: string;
  source: string;
  dateRange: DateRange | null;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent: string;
  utmTerm: string;
  attributionLabel: string;
  landingUrlContains: string;
}

interface LeadsFiltersProps {
  onNewLeadClick: () => void;
  onFiltersChange: (filters: LeadsFilters) => void;
  filteredLeads?: NewLead[];
}

export const LeadsFilters = ({ onNewLeadClick, onFiltersChange, filteredLeads = [] }: LeadsFiltersProps) => {
  const [statusManagementOpen, setStatusManagementOpen] = useState(false);
  const [leadStatuses, setLeadStatuses] = useState<LeadStatus[]>([]);
  const [leadSources, setLeadSources] = useState<LeadSource[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [subServices, setSubServices] = useState<SubService[]>([]);
  const [filters, setFilters] = useState<LeadsFilters>({
    dataCompleteness: 'all',
    services: 'all',
    category: 'all',
    assignee: 'all',
    fuPriority: 'all',
    status: 'all',
    source: 'all',
    dateRange: null,
    utmSource: 'all',
    utmMedium: 'all',
    utmCampaign: 'all',
    utmContent: 'all',
    utmTerm: 'all',
    attributionLabel: 'all',
    landingUrlContains: '',
  });

  const fetchLeadStatuses = async () => {
    const { data, error } = await supabase
      .from('lead_statuses')
      .select('*')
      .eq('is_active', true)
      .order('sort_order');

    if (!error && data) {
      setLeadStatuses(data);
    }
  };

  const fetchLeadSources = async () => {
    const { data, error } = await supabase
      .from('lead_sources')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (!error && data) {
      setLeadSources(data);
    }
  };

  const fetchServices = async () => {
    const { data, error } = await supabase
      .from('services')
      .select('id, name')
      .eq('is_active', true)
      .order('name');

    if (!error && data) {
      setServices(data);
    }
  };

  const fetchSubServices = async () => {
    const { data, error } = await supabase
      .from('sub_services')
      .select('id, name, service_id')
      .eq('is_active', true)
      .order('name');

    if (!error && data) {
      setSubServices(data);
    }
  };

  const updateFilters = (key: keyof LeadsFilters, value: string | DateRange | null) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFiltersChange(newFilters);
  };

  useEffect(() => {
    fetchLeadStatuses();
    fetchLeadSources();
    fetchServices();
    fetchSubServices();
  }, []);

  return (
    <div className="bg-white/95 backdrop-blur-sm rounded-md border border-slate-200/60 shadow-sm mb-2 p-3">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 flex-1 overflow-x-auto scrollbar-hide">
          {/* Date Range Filter */}
          <div className="min-w-[180px] relative mr-3">
            <DateRangeFilter
              onDateRangeChange={(range) => updateFilters('dateRange', range)}
              className="h-8 text-xs"
            />
            {filters.dateRange && (
              <div className="absolute bottom-[-4px] left-0 right-0 h-0.5 bg-brand-blue rounded-full mx-1"></div>
            )}
          </div>

          {/* Source - moved between date and data completeness */}
          <div className="min-w-[120px] relative mr-3">
            <Select value={filters.source} onValueChange={(value) => updateFilters('source', value)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                {leadSources.map((source) => (
                  <SelectItem key={source.id} value={source.name}>
                    {source.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {filters.source !== 'all' && (
              <div className="absolute bottom-[-4px] left-0 right-0 h-0.5 bg-brand-blue rounded-full mx-1"></div>
            )}
          </div>

          {/* Filter Data Completeness */}
          <div className="min-w-[140px] relative mr-3">
            <Select value={filters.dataCompleteness} onValueChange={(value) => updateFilters('dataCompleteness', value)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Data Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Data</SelectItem>
                <SelectItem value="full">Complete Data</SelectItem>
                <SelectItem value="partial">Incomplete Data</SelectItem>
                <SelectItem value="empty">No Data Filled</SelectItem>
              </SelectContent>
            </Select>
            {filters.dataCompleteness !== 'all' && (
              <div className="absolute bottom-[-4px] left-0 right-0 h-0.5 bg-brand-blue rounded-full mx-1"></div>
            )}
          </div>

          {/* Services */}
          <div className="min-w-[120px] relative mr-3">
            <Select value={filters.services} onValueChange={(value) => updateFilters('services', value)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Services" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Services</SelectItem>
                {services.map((service) => (
                  <SelectItem key={service.id} value={service.name}>
                    {service.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {filters.services !== 'all' && (
              <div className="absolute bottom-[-4px] left-0 right-0 h-0.5 bg-brand-blue rounded-full mx-1"></div>
            )}
          </div>

          {/* Category */}
          <div className="min-w-[120px] relative mr-3">
            <Select value={filters.category} onValueChange={(value) => updateFilters('category', value)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {subServices.map((subService) => (
                  <SelectItem key={subService.id} value={subService.name}>
                    {subService.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {filters.category !== 'all' && (
              <div className="absolute bottom-[-4px] left-0 right-0 h-0.5 bg-brand-blue rounded-full mx-1"></div>
            )}
          </div>

          {/* Assignee */}
          <div className="min-w-[120px] relative mr-3">
            <EmployeeDropdown
              value={filters.assignee}
              onValueChange={(value) => updateFilters('assignee', value)}
              placeholder="Assignee"
              triggerClassName="h-8 text-xs"
              allOptionLabel="All Assignees"
              includeAllOption={true}
            />
            {filters.assignee !== 'all' && (
              <div className="absolute bottom-[-4px] left-0 right-0 h-0.5 bg-brand-blue rounded-full mx-1"></div>
            )}
          </div>

          {/* FU Priority */}
          <div className="min-w-[120px] relative mr-3">
            <Select value={filters.fuPriority} onValueChange={(value) => updateFilters('fuPriority', value)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="FU Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="Please Follow Up">Please Follow Up</SelectItem>
                <SelectItem value="High">High</SelectItem>
                <SelectItem value="Medium">Medium</SelectItem>
                <SelectItem value="Low">Low</SelectItem>
              </SelectContent>
            </Select>
            {filters.fuPriority !== 'all' && (
              <div className="absolute bottom-[-4px] left-0 right-0 h-0.5 bg-brand-blue rounded-full mx-1"></div>
            )}
          </div>

          {/* Status with CRUD */}
          <div className="min-w-[120px] relative">
            <div className="flex items-center gap-1">
              <div className="relative flex-1">
                <Select value={filters.status} onValueChange={(value) => updateFilters('status', value)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    {leadStatuses.map((status) => (
                      <SelectItem key={status.id} value={status.name}>
                        {getLeadStatusDisplayName(status.name)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {filters.status !== 'all' && (
                  <div className="absolute bottom-[-4px] left-0 right-0 h-0.5 bg-brand-blue rounded-full mx-1"></div>
                )}
              </div>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <MoreVertical className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setStatusManagementOpen(true)}>
                    Manage Status
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 ml-2">
          <Button 
            onClick={() => generateLeadsPDF({ leads: filteredLeads, filters })}
            variant="outline"
            className="h-8 px-3 text-xs"
          >
            <Download className="h-3 w-3 mr-1" />
            Download PDF
          </Button>
          <Button 
            onClick={onNewLeadClick}
            className="h-8 px-3 text-xs"
          >
            <Plus className="h-3 w-3 mr-1" />
            New Lead
          </Button>
        </div>
      </div>

      <StatusManagement 
        open={statusManagementOpen} 
        onOpenChange={setStatusManagementOpen} 
      />
    </div>
  );
};
