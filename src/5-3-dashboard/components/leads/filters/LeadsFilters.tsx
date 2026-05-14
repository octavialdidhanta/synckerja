import { useState, useEffect, useMemo } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Button } from '@/shared/components/ui/button';
import { Search, Plus, MoreVertical, Download, RefreshCw, Loader2 } from 'lucide-react';
import { Input } from '@/shared/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';
import { StatusManagement } from "@/5-3-dashboard/components/leads/filters/StatusManagement";
import { DateRangeFilter } from "@/5-3-dashboard/components/leads/filters/DateRangeFilter";
import { DateRange } from 'react-day-picker';
import { useLeadsManagementFilterQueries } from "@/5-3-dashboard/hooks/useLeadsManagementFilterQueries";
import { generateLeadsPDF } from "@/5-3-dashboard/lib/LeadsPDFGenerator";
import { NewLead } from '@/shared/types/leads';
import { useToast } from '@/shared/components/ui/use-toast';
import { distinctLeadAttributionValues } from '@/shared/lib/leadAttribution';

export interface LeadsFilters {
  dataCompleteness: 'all' | 'full' | 'partial' | 'empty';
  services: string;
  category: string;
  createdBy: string;
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
  /**
   * Jika diset, tampilkan bar kedua (attribution label + landing URL contains).
   * Dipakai pada layout report tanpa `LeadsTableNew`; di view utama filter ada di header kolom.
   */
  attributionBarLeads?: NewLead[];
}

export const LeadsFilters = ({
  onNewLeadClick,
  onFiltersChange,
  filteredLeads = [],
  filters: externalFilters,
  attributionBarLeads,
}: LeadsFiltersProps) => {
  const { services, filtersLoadError } = useLeadsManagementFilterQueries();
  const { toast } = useToast();
  const [statusManagementOpen, setStatusManagementOpen] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [filters, setFilters] = useState<LeadsFilters>(externalFilters || {
    dataCompleteness: 'all',
    services: 'all',
    category: 'all',
    createdBy: 'all',
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

  const showAttributionLandingBar = attributionBarLeads != null;
  const attributionLabelOptions = useMemo(
    () =>
      showAttributionLandingBar
        ? distinctLeadAttributionValues(attributionBarLeads ?? [], "attribution_label")
        : [],
    [attributionBarLeads, showAttributionLandingBar],
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
      createdBy: 'all',
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

        {/* Data Completeness Filter */}
        <Select value={filters.dataCompleteness} onValueChange={(value) => updateFilters('dataCompleteness', value as LeadsFilters['dataCompleteness'])}>
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

        {/* FU Priority / Status: filter di header kolom tabel; tetap akses kelola status master */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 w-9 shrink-0 p-0"
              title="Manage lead statuses"
              aria-label="Manage lead statuses"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setStatusManagementOpen(true)}>Manage Status</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

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

      {showAttributionLandingBar && (
        <div className="flex flex-wrap gap-1.5 items-center">
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
      )}
      </div>

      <StatusManagement 
        open={statusManagementOpen} 
        onOpenChange={setStatusManagementOpen} 
      />
    </>
  );
};
