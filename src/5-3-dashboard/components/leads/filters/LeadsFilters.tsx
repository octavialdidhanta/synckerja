import React, { useState, useEffect, useMemo } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Button } from '@/shared/components/ui/button';
import { Search, Plus, MoreVertical, Download, RefreshCw, Loader2 } from 'lucide-react';
import { Input } from '@/shared/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';
import { StatusManagement } from "@/5-3-dashboard/components/leads/filters/StatusManagement";
import { DateRangeFilter } from "@/5-3-dashboard/components/leads/filters/DateRangeFilter";
import { useAvailableEmployees } from '@/shared/hooks/useAvailableEmployees';
import { DateRange } from 'react-day-picker';
import { useLeadsManagementFilterQueries } from "@/5-3-dashboard/hooks/useLeadsManagementFilterQueries";
import { generateLeadsPDF } from "@/5-3-dashboard/lib/LeadsPDFGenerator";
import { getLeadStatusDisplayName } from '@/5-1-leads-management/utils/leadStatusDisplay';
import { NewLead } from '@/shared/types/leads';
import { useToast } from '@/shared/components/ui/use-toast';
import { distinctLeadAttributionValues } from '@/shared/lib/leadAttribution';

export interface LeadsFilters {
  dataCompleteness: 'all' | 'full' | 'partial' | 'empty';
  services: string;
  category: string;
  assignee: string;
  fuPriority: string;
  status: string;
  source: string;
  dateRange: DateRange | null;
  search?: string;
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
  filters?: LeadsFilters;
  /** Prefer full `useLeads()` list so attribution dropdowns are not limited by other filters. */
  leadsForAttributionOptions?: NewLead[];
}

export const LeadsFilters = ({
  onNewLeadClick,
  onFiltersChange,
  filteredLeads = [],
  filters: externalFilters,
  leadsForAttributionOptions,
}: LeadsFiltersProps) => {
  const { data: employees = [] } = useAvailableEmployees();
  const {
    leadStatuses,
    leadSources,
    services,
    subServices,
    filtersLoadError,
  } = useLeadsManagementFilterQueries();
  const { toast } = useToast();
  const [statusManagementOpen, setStatusManagementOpen] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [filters, setFilters] = useState<LeadsFilters>(externalFilters || {
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

  const attributionOptionLeads = leadsForAttributionOptions ?? filteredLeads;
  const utmSourceOptions = useMemo(
    () => distinctLeadAttributionValues(attributionOptionLeads, 'utm_source'),
    [attributionOptionLeads],
  );
  const utmMediumOptions = useMemo(
    () => distinctLeadAttributionValues(attributionOptionLeads, 'utm_medium'),
    [attributionOptionLeads],
  );
  const utmCampaignOptions = useMemo(
    () => distinctLeadAttributionValues(attributionOptionLeads, 'utm_campaign'),
    [attributionOptionLeads],
  );
  const utmContentOptions = useMemo(
    () => distinctLeadAttributionValues(attributionOptionLeads, 'utm_content'),
    [attributionOptionLeads],
  );
  const utmTermOptions = useMemo(
    () => distinctLeadAttributionValues(attributionOptionLeads, 'utm_term'),
    [attributionOptionLeads],
  );
  const attributionLabelOptions = useMemo(
    () => distinctLeadAttributionValues(attributionOptionLeads, 'attribution_label'),
    [attributionOptionLeads],
  );

  const updateFilters = (key: keyof LeadsFilters, value: string | DateRange | null) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const handleClear = () => {
    const clearedFilters: LeadsFilters = {
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
    };
    setFilters(clearedFilters);
    onFiltersChange(clearedFilters);
  };

  useEffect(() => {
    if (externalFilters) {
      setFilters(externalFilters);
    }
  }, [externalFilters]);

  // Satu opsi per label yang tampil (hindari duplikat: Open+Unread → satu "Unread", Closed+Resolve → satu "Resolve")
  const uniqueLeadStatuses = React.useMemo(() => {
    const excluded = leadStatuses.filter((s) => {
      const name = (s.name?.trim().toLowerCase() ?? '');
      return name !== 'lost' && name !== 'qualified';
    });
    // Urutkan agar nama kanonik (Open, Closed, In Progress) didahulukan, supaya value filter cocok dengan lead_status.name
    const canonical = ['Open', 'Unread', 'In Progress', 'Converted', 'Qualified', 'Closed', 'Resolve'];
    const byDisplay = (
      a: (typeof leadStatuses)[number],
      b: (typeof leadStatuses)[number],
    ) => {
      const da = getLeadStatusDisplayName(a.name);
      const db = getLeadStatusDisplayName(b.name);
      const ia = canonical.indexOf(a.name ?? '');
      const ib = canonical.indexOf(b.name ?? '');
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return (da || '').localeCompare(db || '');
    };
    const sorted = [...excluded].sort(byDisplay);
    const seen = new Set<string>();
    return sorted.filter((s) => {
      const displayName = getLeadStatusDisplayName(s.name);
      if (seen.has(displayName)) return false;
      seen.add(displayName);
      return true;
    });
  }, [leadStatuses]);

  return (
    <>
      {filtersLoadError && (
        <div className="w-full text-xs text-amber-600 mb-1.5">{filtersLoadError}</div>
      )}
      <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap gap-1.5 items-center">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[150px]">
          <Search className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 transform -translate-y-1/2 z-10" />
          <Input
            type="text"
            placeholder="Search leads..."
            value={filters.search || ''}
            onChange={(e) => updateFilters('search', e.target.value)}
            className="w-full pl-4 pr-10 h-9 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
          />
        </div>

        {/* Date Range Filter */}
        <div className="min-w-[180px]">
          <DateRangeFilter
            onDateRangeChange={(range) => updateFilters('dateRange', range)}
            className="h-9 text-sm"
          />
        </div>

        {/* Source Filter */}
        <Select value={filters.source} onValueChange={(value) => updateFilters('source', value)}>
          <SelectTrigger className="w-full sm:w-36 lg:w-40 h-9 text-sm text-primary placeholder:text-muted-foreground text-left">
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

        {/* Data Completeness Filter */}
        <Select value={filters.dataCompleteness} onValueChange={(value) => updateFilters('dataCompleteness', value as any)}>
          <SelectTrigger className="w-full sm:w-36 lg:w-40 h-9 text-sm text-primary placeholder:text-muted-foreground text-left">
            <SelectValue placeholder="Data Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Data</SelectItem>
            <SelectItem value="full">Complete Data</SelectItem>
            <SelectItem value="partial">Incomplete Data</SelectItem>
            <SelectItem value="empty">No Data Filled</SelectItem>
          </SelectContent>
        </Select>

        {/* Services Filter */}
        <Select value={filters.services} onValueChange={(value) => updateFilters('services', value)}>
          <SelectTrigger className="w-full sm:w-36 lg:w-40 h-9 text-sm text-primary placeholder:text-muted-foreground text-left">
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

        {/* Category Filter */}
        <Select value={filters.category} onValueChange={(value) => updateFilters('category', value)}>
          <SelectTrigger className="w-full sm:w-36 lg:w-40 h-9 text-sm text-primary placeholder:text-muted-foreground text-left">
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

        {/* Assignee Filter - from employees table */}
        <div className="min-w-[120px]">
          <Select
            value={filters.assignee}
            onValueChange={(value) => updateFilters('assignee', value)}
          >
            <SelectTrigger className="h-9 text-sm text-primary">
              <SelectValue placeholder="Assignee" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Assignees</SelectItem>
              {employees.map((emp) => (
                <SelectItem key={emp.id} value={emp.full_name || emp.email}>
                  {emp.full_name || emp.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* FU Priority Filter */}
        <Select value={filters.fuPriority} onValueChange={(value) => updateFilters('fuPriority', value)}>
          <SelectTrigger className="w-full sm:w-36 lg:w-40 h-9 text-sm text-primary placeholder:text-muted-foreground text-left">
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

        {/* Status Filter with CRUD */}
        <div className="flex items-center gap-1">
          <Select value={filters.status} onValueChange={(value) => updateFilters('status', value)}>
            <SelectTrigger className="w-full sm:w-36 lg:w-40 h-9 text-sm text-primary placeholder:text-muted-foreground text-left">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {uniqueLeadStatuses.map((status) => (
                <SelectItem key={status.id} value={status.name}>
                  {getLeadStatusDisplayName(status.name)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-9 w-9 p-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setStatusManagementOpen(true)}>
                Manage Status
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Clear Filters Button */}
        <button
          onClick={handleClear}
          className="h-9 px-3 hover:bg-gray-100 rounded-md transition-colors border border-gray-300 flex items-center justify-center"
          title="Clear all filters"
        >
          <RefreshCw className="w-4 h-4 text-gray-500" />
        </button>

        {/* Download PDF Button */}
        <Button 
          onClick={async () => {
            setIsGeneratingPDF(true);
            try {
              generateLeadsPDF({ leads: filteredLeads, filters });
            } catch (e) {
              toast({
                variant: 'destructive',
                title: 'Gagal membuat PDF',
                description: (e as Error)?.message ?? 'Silakan coba lagi.',
              });
            } finally {
              setIsGeneratingPDF(false);
            }
          }}
          disabled={isGeneratingPDF}
          className="h-9 px-3 text-sm"
        >
          {isGeneratingPDF ? (
            <>
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Download className="h-4 w-4 mr-1" />
              Download PDF
            </>
          )}
        </Button>

        {/* New Lead Button */}
        <Button 
          onClick={onNewLeadClick}
          className="h-9 px-3 text-sm"
        >
          <Plus className="h-4 w-4 mr-1" />
          New Lead
        </Button>
      </div>

      <div className="flex flex-wrap gap-1.5 items-center">
        <Select value={filters.utmSource} onValueChange={(value) => updateFilters('utmSource', value)}>
          <SelectTrigger className="h-9 w-full min-w-[7rem] max-w-[11rem] shrink-0 text-sm sm:w-36">
            <SelectValue placeholder="UTM Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All UTM sources</SelectItem>
            {utmSourceOptions.map((v) => (
              <SelectItem key={v} value={v}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filters.utmCampaign} onValueChange={(value) => updateFilters('utmCampaign', value)}>
          <SelectTrigger className="h-9 w-full min-w-[7rem] max-w-[11rem] shrink-0 text-sm sm:w-36">
            <SelectValue placeholder="UTM Campaign" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All UTM campaigns</SelectItem>
            {utmCampaignOptions.map((v) => (
              <SelectItem key={v} value={v}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filters.utmMedium} onValueChange={(value) => updateFilters('utmMedium', value)}>
          <SelectTrigger className="h-9 w-full min-w-[7rem] max-w-[11rem] shrink-0 text-sm sm:w-36">
            <SelectValue placeholder="UTM Medium" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All UTM media</SelectItem>
            {utmMediumOptions.map((v) => (
              <SelectItem key={v} value={v}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filters.utmContent} onValueChange={(value) => updateFilters('utmContent', value)}>
          <SelectTrigger className="h-9 w-full min-w-[7rem] max-w-[11rem] shrink-0 text-sm sm:w-36">
            <SelectValue placeholder="UTM Content" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All UTM content</SelectItem>
            {utmContentOptions.map((v) => (
              <SelectItem key={v} value={v}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filters.utmTerm} onValueChange={(value) => updateFilters('utmTerm', value)}>
          <SelectTrigger className="h-9 w-full min-w-[7rem] max-w-[11rem] shrink-0 text-sm sm:w-36">
            <SelectValue placeholder="UTM Term" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All UTM terms</SelectItem>
            {utmTermOptions.map((v) => (
              <SelectItem key={v} value={v}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filters.attributionLabel} onValueChange={(value) => updateFilters('attributionLabel', value)}>
          <SelectTrigger className="h-9 w-full min-w-[7rem] max-w-[11rem] shrink-0 text-sm sm:w-40">
            <SelectValue placeholder="Attribution label" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All attribution labels</SelectItem>
            {attributionLabelOptions.map((v) => (
              <SelectItem key={v} value={v}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="min-w-[10rem] flex-1">
          <Input
            type="text"
            placeholder="Landing URL contains…"
            value={filters.landingUrlContains}
            onChange={(e) => updateFilters('landingUrlContains', e.target.value)}
            className="h-9 border border-gray-300 text-sm"
          />
        </div>
      </div>
      </div>

      <StatusManagement 
        open={statusManagementOpen} 
        onOpenChange={setStatusManagementOpen} 
      />
    </>
  );
};
