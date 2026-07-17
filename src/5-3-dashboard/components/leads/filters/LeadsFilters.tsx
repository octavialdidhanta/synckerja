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
import { cn } from '@/shared/lib/utils';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';

export interface LeadsFilters {
  dataCompleteness: 'all' | 'full' | 'partial' | 'empty';
  services: string;
  category: string;
  createdBy: string;
  webProperty: string;
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
  /** Exact match on `leads.gclid` (recipient picker RPC + optional column filter). */
  gclid?: string;
  /** Recipient picker toolbar: rows with `leads.gclid`. */
  gclidPresence?: "all" | "has";
  /** Recipient picker toolbar: rows with `lead_submissions.email`. */
  emailPresence?: "all" | "has";
  landingUrlContains: string;
  /** Recipient picker / server RPC: exact latest survey rating 1–5, or all. */
  surveyRating: "all" | "none" | "1" | "2" | "3" | "4" | "5";
  /** Recipient picker only: Lead Magnet campaign snapshot filter. */
  leadMagnetCampaign?: string;
  /** Recipient picker only: Lead Magnet target market snapshot filter. */
  leadMagnetTargetMarket?: string;
}

interface LeadsFiltersProps {
  onNewLeadClick?: () => void;
  onFiltersChange: (filters: LeadsFilters) => void;
  filteredLeads?: NewLead[];
  filters?: LeadsFilters;
  /** Recipient picker: hide New lead / PDF / status management. Second filter row optional via embeddedSingleRow. */
  variant?: "default" | "embedded";
  /**
   * When variant=embedded and true: one toolbar row only (no attribution label / landing URL row;
   * use table column filters instead).
   */
  embeddedSingleRow?: boolean;
  /** When variant=embedded: options for attribution label dropdown (server distincts). */
  embeddedAttributionLabelOptions?: string[];
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
  variant = "default",
  embeddedSingleRow = false,
  embeddedAttributionLabelOptions = [],
}: LeadsFiltersProps) => {
  const { t } = useAppTranslation();
  const { services, filtersLoadError } = useLeadsManagementFilterQueries();
  const { toast } = useToast();
  const [statusManagementOpen, setStatusManagementOpen] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [filters, setFilters] = useState<LeadsFilters>(externalFilters || {
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
    gclid: 'all',
    gclidPresence: 'all',
    emailPresence: 'all',
    landingUrlContains: '',
    surveyRating: 'all',
  });

  const showAttributionLandingBar = attributionBarLeads != null;
  const embeddedSecondRow = variant === "embedded" && !embeddedSingleRow;
  const attributionLabelOptions = useMemo(
    () =>
      embeddedSecondRow
        ? embeddedAttributionLabelOptions
        : showAttributionLandingBar
          ? distinctLeadAttributionValues(attributionBarLeads ?? [], "attribution_label")
          : [],
    [
      embeddedSecondRow,
      embeddedAttributionLabelOptions,
      attributionBarLeads,
      showAttributionLandingBar,
    ],
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
      gclid: 'all',
      gclidPresence: 'all',
      emailPresence: 'all',
      landingUrlContains: '',
      surveyRating: 'all',
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
      <div
        className={cn(
          "flex gap-1.5 items-center",
          variant === "embedded" && embeddedSingleRow
            ? "flex-nowrap overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            : "flex-wrap",
        )}
      >
        {/* Search Input */}
        <div
          className={cn(
            "relative min-w-[150px]",
            variant === "embedded" && embeddedSingleRow ? "max-w-[min(24rem,45vw)] shrink-0" : "flex-1",
          )}
        >
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
        <div className={cn("min-w-[180px]", variant === "embedded" && embeddedSingleRow && "shrink-0")}>
          <DateRangeFilter
            onDateRangeChange={(range) => updateFilters('dateRange', range)}
            className="h-9 text-sm"
          />
        </div>

        {/* Data Completeness Filter */}
        <Select value={filters.dataCompleteness} onValueChange={(value) => updateFilters('dataCompleteness', value as LeadsFilters['dataCompleteness'])}>
          <SelectTrigger className={cn("w-full h-9 text-sm text-primary placeholder:text-muted-foreground text-left sm:w-36 lg:w-40 shrink-0")}>
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
          <SelectTrigger className={cn("w-full h-9 text-sm text-primary placeholder:text-muted-foreground text-left sm:w-36 lg:w-40 shrink-0")}>
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

        {variant === "embedded" ? (
          <>
            <Select
              value={filters.gclidPresence === "has" ? "has" : "all"}
              onValueChange={(value) =>
                updateFilters("gclidPresence", value === "has" ? "has" : "all")
              }
            >
              <SelectTrigger className="h-9 w-[9.5rem] shrink-0 text-sm">
                <SelectValue placeholder={t("whatsappTemplates.recipientLists.addContactsModal.filterGclid", "gclid")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {t("whatsappTemplates.recipientLists.addContactsModal.presenceAllGclid", "All data")}
                </SelectItem>
                <SelectItem value="has">
                  {t("whatsappTemplates.recipientLists.addContactsModal.presenceHasGclid", "With gclid only")}
                </SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={filters.emailPresence === "has" ? "has" : "all"}
              onValueChange={(value) =>
                updateFilters("emailPresence", value === "has" ? "has" : "all")
              }
            >
              <SelectTrigger className="h-9 w-[9.5rem] shrink-0 text-sm">
                <SelectValue placeholder={t("whatsappTemplates.recipientLists.addContactsModal.filterEmail", "Email")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {t("whatsappTemplates.recipientLists.addContactsModal.presenceAllEmail", "All data")}
                </SelectItem>
                <SelectItem value="has">
                  {t("whatsappTemplates.recipientLists.addContactsModal.presenceHasEmail", "With email only")}
                </SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={filters.surveyRating}
              onValueChange={(value) => updateFilters("surveyRating", value)}
            >
              <SelectTrigger className="h-9 w-[7.5rem] shrink-0 text-sm">
                <SelectValue placeholder={t("leadsManagement.table.surveyRating", "Rating")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("leadsManagement.filters.allSurveyRatings", "All ratings")}</SelectItem>
                <SelectItem value="none">{t("leadsManagement.filters.noSurveyRating", "No rating")}</SelectItem>
                {(["1", "2", "3", "4", "5"] as const).map((n) => (
                  <SelectItem key={n} value={n}>
                    {t("leadsManagement.filters.surveyRatingStars", "{{count}} star", { count: Number(n) })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        ) : null}

        {/* FU Priority / Status: filter di header kolom tabel; tetap akses kelola status master */}
        {variant !== "embedded" && (
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
        )}

        {/* Clear Filters Button */}
        <button
          onClick={handleClear}
          className="h-9 px-3 hover:bg-gray-100 rounded-md transition-colors border border-gray-300 flex items-center justify-center shrink-0"
          title="Clear all filters"
        >
          <RefreshCw className="w-4 h-4 text-gray-500" />
        </button>

        {/* Download PDF Button */}
        {variant !== "embedded" && (
        <Button 
          onClick={async () => {
            setIsGeneratingPDF(true);
            try {
              void generateLeadsPDF({ leads: filteredLeads, filters });
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
        )}

        {/* New Lead Button */}
        {variant !== "embedded" && onNewLeadClick && (
        <Button 
          onClick={onNewLeadClick}
          className="h-9 px-3 text-sm"
        >
          <Plus className="h-4 w-4 mr-1" />
          New Lead
        </Button>
        )}
      </div>

      {showAttributionLandingBar || embeddedSecondRow ? (
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
      ) : null}
      </div>

      <StatusManagement 
        open={statusManagementOpen} 
        onOpenChange={setStatusManagementOpen} 
      />
    </>
  );
};
