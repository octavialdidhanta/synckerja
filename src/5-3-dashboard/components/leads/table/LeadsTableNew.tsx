
import { useState, useMemo } from 'react';
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Input } from "@/shared/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { History, Clock, ChevronDown, ChevronUp, ArrowUpDown, ListFilter } from "lucide-react";
import { format } from "date-fns";
import { NewLead } from '@/shared/types/leads';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { LeadActionsDropdown } from "@/5-3-dashboard/components/leads/actions/LeadActionsDropdown";
import { LeadFollowUpForm } from "@/5-3-dashboard/components/leads/forms/LeadFollowUpForm";
import { LeadTemplateFollowUpDialog } from "@/5-3-dashboard/components/leads/dialogs/LeadTemplateFollowUpDialog";
import { EditLeadDialog } from "@/5-3-dashboard/components/leads/dialogs/EditLeadDialog";
import { ViewLeadDialog } from "@/5-3-dashboard/components/leads/dialogs/ViewLeadDialog";
import { ClientProfilePopup } from "@/5-3-dashboard/components/leads/dialogs/ClientProfilePopup";
import { LeadStatusHistoryDialog } from "@/5-3-dashboard/components/leads/dialogs/LeadStatusHistoryDialog";
import {
  getLeadTableStatusPresentation,
  isResolvedLeadStatusName,
} from '@/5-1-leads-management/utils/leadStatusDisplay';
import {
  formatLeadWebPropertyDisplay,
  normalizeApiLeadCreatedByDisplay,
  normalizeApiLeadSourceDisplay,
  resolveApiLeadSourceColorKey,
} from "@/5-3-dashboard/lib/apiLeadDisplayLabels";

/** Hijau pekat untuk badge Converted & Resolve di tabel leads */
const LEAD_SOLID_GREEN_BADGE = 'bg-green-700 text-white border-green-800';
import { useClientProfileStatus } from '@/shared/hooks/organized/sales';
import { useOmnichannelRosterAssignees } from '@/shared/hooks/useOrganizationOmnichannelStaff';
import { useLeadStatusesActiveFull } from "@/5-3-dashboard/hooks/useLeadsManagementFilterQueries";
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useToast } from '@/shared/components/ui/use-toast';
import { cn } from "@/shared/lib/utils";
import type { LeadAttributionSortColumn, LeadAttributionSortState } from '@/shared/lib/leadAttribution';
import { defaultLeadAttributionSortState } from '@/shared/lib/leadAttribution';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import type { LatestCustomerSurvey } from "@/features/customer-survey/hooks/useCustomerSurveyForLeads";
import { SURVEY_RATING_FILTER_OPTIONS } from "@/features/customer-survey/core/surveyRatingFilter";
import {
  LeadSurveyCommentCell,
  LeadSurveyHistoryCell,
  LeadSurveyRatingCell,
} from "@/5-3-dashboard/components/leads/table/LeadSurveyTableCells";
import { LeadGoogleAdsSyncCell } from "@/5-3-dashboard/components/leads/table/LeadGoogleAdsSyncCell";
import { LeadMetaAdsSyncCell } from "@/5-3-dashboard/components/leads/table/LeadMetaAdsSyncCell";
import type { GoogleAdsSyncUploadRecord } from "@/5-3-dashboard/hooks/useGoogleAdsConversionUploadsMap";
import type { MetaAdsSyncUploadRecord } from "@/5-3-dashboard/hooks/useMetaAdsConversionUploadsMap";

type CategoryColumnFilterConfig = {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ id: string; name: string }>;
};

type SourceColumnFilterConfig = {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ id: string; name: string }>;
};

type CreatedByColumnFilterConfig = {
  value: string;
  onChange: (value: string) => void;
  /** Nilai = `created_by_name` (trim), dari distinct leads. */
  options: string[];
};

type WebPropertyColumnFilterConfig = {
  value: string;
  onChange: (value: string) => void;
  /** value = raw web_id, label = humanized display */
  options: Array<{ id: string; value: string; label: string }>;
};

type AssigneeColumnFilterConfig = {
  value: string;
  onChange: (value: string) => void;
  /** Nilai filter = label assignee (`full_name || email`), selaras filter bar lama. */
  options: Array<{ id: string; name: string }>;
};

type FuPriorityColumnFilterConfig = {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ id: string; name: string }>;
};

type StatusColumnFilterConfig = {
  value: string;
  onChange: (value: string) => void;
  /** Nilai filter = `lead_status.name` (raw), label = nama tampilan. */
  options: Array<{ id: string; name: string; label: string }>;
};

export type { SurveyRatingFilterValue as SurveyRatingColumnFilterValue } from "@/features/customer-survey/core/surveyRatingFilter";

export type ResolveColumnFilterValue = "all" | "true" | "false";

type SurveyColumnFilterConfig = {
  value: SurveyRatingColumnFilterValue;
  onChange: (value: SurveyRatingColumnFilterValue) => void;
};

type ResolveColumnFilterConfig = {
  value: ResolveColumnFilterValue;
  onChange: (value: ResolveColumnFilterValue) => void;
};

/** UTM / string attribution: nilai filter = string field lead (sama seperti bar filter lama). */
type UtmStringColumnFilterConfig = {
  value: string;
  onChange: (value: string) => void;
  options: string[];
};

type LandingUrlContainsColumnFilterConfig = {
  value: string;
  onChange: (value: string) => void;
};

type TableHeadCol = {
  key: string;
  label: string;
  width: string;
  sortKey?: LeadAttributionSortColumn;
};

interface LeadsTableNewProps {
  leads: NewLead[];
  onUpdateLead: (lead: NewLead) => void;
  onDeleteLead: (leadId: string) => void;
  onRefreshLeads?: () => void;
  attributionSort?: LeadAttributionSortState;
  onAttributionSort?: (column: LeadAttributionSortColumn) => void;
  /** Filter kategori di header kolom (filter bar atas tidak memakai Select category). */
  categoryColumnFilter?: CategoryColumnFilterConfig | null;
  servicesColumnFilter?: CategoryColumnFilterConfig | null;
  sourceColumnFilter?: SourceColumnFilterConfig | null;
  createdByColumnFilter?: CreatedByColumnFilterConfig | null;
  webPropertyColumnFilter?: WebPropertyColumnFilterConfig | null;
  assigneeColumnFilter?: AssigneeColumnFilterConfig | null;
  fuPriorityColumnFilter?: FuPriorityColumnFilterConfig | null;
  statusColumnFilter?: StatusColumnFilterConfig | null;
  utmSourceColumnFilter?: UtmStringColumnFilterConfig | null;
  utmCampaignColumnFilter?: UtmStringColumnFilterConfig | null;
  utmMediumColumnFilter?: UtmStringColumnFilterConfig | null;
  utmContentColumnFilter?: UtmStringColumnFilterConfig | null;
  utmTermColumnFilter?: UtmStringColumnFilterConfig | null;
  attributionLabelColumnFilter?: UtmStringColumnFilterConfig | null;
  gclidColumnFilter?: UtmStringColumnFilterConfig | null;
  fbclidColumnFilter?: UtmStringColumnFilterConfig | null;
  landingUrlContainsColumnFilter?: LandingUrlContainsColumnFilterConfig | null;
  /** Latest customer survey per WhatsApp conversation (leads page hook or RPC fields in picker). */
  getSurveyForLead?: (lead: NewLead) => LatestCustomerSurvey | null;
  onOpenSurveyHistory?: (lead: NewLead) => void;
  surveyColumnFilter?: SurveyColumnFilterConfig | null;
  resolveColumnFilter?: ResolveColumnFilterConfig | null;
  /** Campaign recipient picker: checkbox column + read-only cells (no CRM mutations). */
  pickerSelection?: {
    selectedPhoneKeys: ReadonlySet<string>;
    onTogglePhone: (phoneKey: string, selected: boolean) => void;
    onTogglePage: (phoneKeys: string[], selected: boolean) => void;
    getPhoneKey: (lead: NewLead) => string;
    /** Recipient list contact picker: reuse Title column slot for WhatsApp display phone (`_display_phone`). */
    replaceTitleColumnWithPhone?: boolean;
    /** Recipient list contact picker: show Email column immediately after phone (`_display_email`). */
    showEmailColumn?: boolean;
  } | null;
  /** Google Ads offline conversion sync status (omnichannel leads table). */
  showGoogleAdsSyncColumn?: boolean;
  getGoogleAdsSyncForLead?: (lead: NewLead) => GoogleAdsSyncUploadRecord | null;
  googleAdsSyncLoading?: boolean;
  googleAdsUploadsEnabled?: boolean;
  showMetaAdsSyncColumn?: boolean;
  getMetaAdsSyncForLead?: (lead: NewLead) => MetaAdsSyncUploadRecord | null;
  metaAdsSyncLoading?: boolean;
  metaAdsUploadsEnabled?: boolean;
}

const ASSIGNEE_SELECT_UNASSIGNED = "__lead_assignee_unassigned__";

/** Extra horizontal room between Attribution label ↔ Assignee ↔ Follow Up (header + body). */
const ATTRIBUTION_ASSIGNEE_FU_HEAD_KEYS = new Set([
  "attribution_label",
  "gclid",
  "fbclid",
  "assignee",
  "followup",
]);

export default function LeadsTableNew({
  leads,
  onUpdateLead,
  onDeleteLead,
  onRefreshLeads,
  attributionSort = defaultLeadAttributionSortState,
  onAttributionSort,
  categoryColumnFilter,
  servicesColumnFilter,
  sourceColumnFilter,
  createdByColumnFilter,
  webPropertyColumnFilter,
  assigneeColumnFilter,
  fuPriorityColumnFilter,
  statusColumnFilter,
  utmSourceColumnFilter,
  utmCampaignColumnFilter,
  utmMediumColumnFilter,
  utmContentColumnFilter,
  utmTermColumnFilter,
  attributionLabelColumnFilter,
  gclidColumnFilter,
  fbclidColumnFilter,
  landingUrlContainsColumnFilter,
  getSurveyForLead,
  onOpenSurveyHistory,
  surveyColumnFilter,
  resolveColumnFilter,
  pickerSelection = null,
  showGoogleAdsSyncColumn = false,
  getGoogleAdsSyncForLead,
  googleAdsSyncLoading = false,
  googleAdsUploadsEnabled = true,
  showMetaAdsSyncColumn = false,
  getMetaAdsSyncForLead,
  metaAdsSyncLoading = false,
  metaAdsUploadsEnabled = true,
}: LeadsTableNewProps) {
  const { t } = useAppTranslation();
  const { toast } = useToast();
  const { organizationId } = useCurrentOrg();

  const [selectedLead, setSelectedLead] = useState<NewLead | null>(null);
  const [isFollowUpOpen, setIsFollowUpOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [leadToEdit, setLeadToEdit] = useState<NewLead | null>(null);
  const [leadToView, setLeadToView] = useState<NewLead | null>(null);
  const [isClientProfileOpen, setIsClientProfileOpen] = useState(false);
  const [selectedClientLead, setSelectedClientLead] = useState<NewLead | null>(null);
  const [isStatusHistoryOpen, setIsStatusHistoryOpen] = useState(false);
  const [statusHistoryLead, setStatusHistoryLead] = useState<NewLead | null>(null);
  const [templateFollowUpLead, setTemplateFollowUpLead] = useState<NewLead | null>(null);
  const [isTemplateFollowUpOpen, setIsTemplateFollowUpOpen] = useState(false);

  const { data: statusRows = [] } = useLeadStatusesActiveFull();
  const leadStatuses = useMemo(
    () =>
      statusRows.map((s) => ({
        id: s.id,
        name: s.name,
        color: s.color,
      })),
    [statusRows],
  );

  const { data: employees = [] } = useOmnichannelRosterAssignees();

  const handleFieldUpdate = async (leadId: string, field: string, value: string) => {
    const lead = leads.find(l => l.id === leadId);
    if (!lead) return;
    let updatedLead: NewLead & { assignee_id?: string | null };

    if (field === 'status_id') {
      const selectedStatus = leadStatuses.find(s => s.id === value);
      if (selectedStatus?.name?.trim().toLowerCase() === 'open') {
        const cur = (lead.lead_status?.name ?? leadStatuses.find(s => s.id === lead.status_id)?.name ?? '').trim().toLowerCase();
        if (cur && cur !== 'open' && cur !== 'expired') return;
      }
      if (selectedStatus?.name?.trim().toLowerCase() === 'closed') {
        const confirmed = window.confirm(t('leadsManagement.confirmResolve', 'Yakin ingin mengubah status menjadi Resolve? Chat outbound akan diblokir sampai ada pesan masuk baru dari customer.'));
        if (!confirmed) return;
      }
      updatedLead = {
        ...lead,
        status_id: value,
        lead_status: selectedStatus ? { id: selectedStatus.id, name: selectedStatus.name, color: selectedStatus.color } : lead.lead_status,
      };
    } else if (field === 'assignee_id') {
      const assigneeId = value === ASSIGNEE_SELECT_UNASSIGNED ? null : value;
      const emp = assigneeId ? employees.find((e) => e.id === assigneeId) : undefined;
      updatedLead = {
        ...lead,
        assignee_id: assigneeId,
        assignee: emp ? (emp.full_name || emp.email) : "",
        _onlyAssigneeUpdate: true,
      } as NewLead & { assignee_id?: string | null; _onlyAssigneeUpdate?: boolean };
    } else {
      updatedLead = { ...lead, [field]: value };
    }

    try {
      await onUpdateLead(updatedLead as NewLead);
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Gagal memperbarui lead',
        description: (e as Error)?.message ?? 'Silakan coba lagi.',
      });
    }
  };

  const handleFollowUpClick = (lead: NewLead) => {
    setSelectedLead(lead);
    setIsFollowUpOpen(true);
  };

  const handleEdit = (lead: NewLead) => {
    setLeadToEdit(lead);
    setIsEditDialogOpen(true);
  };

  const handleViewDetail = (lead: NewLead) => {
    setLeadToView(lead);
    setIsViewDialogOpen(true);
  };

  const handleDelete = async (leadId: string) => {
    try {
      await onDeleteLead(leadId);
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Gagal menghapus lead',
        description: (e as Error)?.message ?? 'Silakan coba lagi.',
      });
    }
  };

  const handleStatusHistoryClick = (lead: NewLead) => {
    setStatusHistoryLead(lead);
    setIsStatusHistoryOpen(true);
  };

  const handleClientClick = (lead: NewLead) => {
    setSelectedClientLead(lead);
    setIsClientProfileOpen(true);
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'dd MMM yyyy');
    } catch {
      return dateString;
    }
  };

  const formatConvertedAt = (dateString: string) => {
    try {
      return format(new Date(dateString), 'dd MMM yyyy, HH:mm');
    } catch {
      return dateString;
    }
  };

  // Get FU Priority with soft rectangular colors
  const getFUPriorityColor = (priority?: string) => {
    const colors = {
      'High': 'bg-red-50 text-red-700 border-red-200',
      'Medium': 'bg-yellow-50 text-yellow-700 border-yellow-200',
      'Low': 'bg-green-50 text-green-700 border-green-200',
      'Please Follow Up': 'bg-red-100 text-red-800 border-red-400',
      'Set Status': 'bg-slate-100 text-slate-700 border-slate-300',
      'No Respon': 'bg-amber-50 text-amber-800 border-amber-200',
    };
    return colors[priority as keyof typeof colors] || colors.Medium;
  };

  const renderFuPriorityBadge = (lead: NewLead) => {
    if (lead.template_followup_awaiting_reply) {
      const noResponseLabel = t('leadsManagement.fuPriority.noResponse', 'No Respon');
      return (
        <Badge
          className={`${getFUPriorityColor('No Respon')} text-xs px-3 py-1 rounded-sm font-medium border w-32 justify-center`}
          title={t(
            'leadsManagement.fuPriority.noResponseHint',
            'Template follow-up terkirim; menunggu balasan customer.',
          )}
        >
          {noResponseLabel}
        </Badge>
      );
    }
    const followupCount = lead.followup ?? 0;
    if (lead.fu_priority === 'Set Status') {
      return (
        <Badge
          className={`${getFUPriorityColor('Set Status')} text-xs px-3 py-1 rounded-sm font-medium border w-32 justify-center`}
        >
          {t('leadsManagement.fuPriority.setStatus', 'Set Status')}
        </Badge>
      );
    }
    const displayPriority = followupCount === 0 ? 'Please Follow Up' : (lead.fu_priority || 'Medium');
    return (
      <Badge
        className={`${getFUPriorityColor(displayPriority)} text-xs px-3 py-1 rounded-sm font-medium border w-32 justify-center`}
      >
        {displayPriority}
      </Badge>
    );
  };

  // Status names that are "final" — once set, lead cannot go back to Open
  const TERMINAL_STATUS_NAMES = ['Lost', 'Closed', 'Converted'];
  const getCurrentLeadStatusName = (lead: NewLead) =>
    (lead.lead_status?.name ?? leadStatuses.find(s => s.id === lead.status_id)?.name ?? '').trim();
  const isOpenDisabledForLead = (lead: NewLead) =>
    TERMINAL_STATUS_NAMES.some(
      (name) => getCurrentLeadStatusName(lead).toLowerCase() === name.toLowerCase()
    );

  /** Assignee tidak boleh diubah setelah chat di-resolve (selaras livechat / Option A). */
  const isAssigneeSelectDisabled = (l: NewLead) =>
    isResolvedLeadStatusName(getCurrentLeadStatusName(l));

  // Get Status with soft colors - rectangular style
  const getStatusColor = (lead: NewLead) => {
    // First try to use lead_status from joined data, then find by status_id
    const statusData = lead.lead_status || leadStatuses.find(s => s.id === lead.status_id);
    if (statusData?.color) {
      // Convert hex color to background and text color classes
      const colorMap: { [key: string]: string } = {
        '#F59E0B': 'bg-yellow-50 text-yellow-700 border-yellow-200',
        '#10B981': 'bg-green-50 text-green-700 border-green-200', 
        '#059669': 'bg-emerald-50 text-emerald-700 border-emerald-200',
        '#EF4444': 'bg-red-50 text-red-700 border-red-200',
        '#6B7280': 'bg-gray-50 text-gray-700 border-gray-200',
        '#78716C': 'bg-stone-50 text-stone-700 border-stone-200',
        '#3B82F6': 'bg-blue-50 text-blue-700 border-blue-200'
      };
      return colorMap[statusData.color] || 'bg-gray-50 text-gray-700 border-gray-200';
    }
    return 'bg-gray-50 text-gray-700 border-gray-200';
  };

  // Get Source with soft rectangular colors
  const getSourceColor = (source?: string) => {
    const colors = {
      'Email': 'bg-blue-50 text-blue-700 border-blue-200',
      'Phone': 'bg-purple-50 text-purple-700 border-purple-200',
      'Chat': 'bg-pink-50 text-pink-700 border-pink-200',
      'Website': 'bg-green-50 text-green-700 border-green-200',
      'Website form': 'bg-green-50 text-green-700 border-green-200',
      'WhatsApp': 'bg-emerald-50 text-emerald-700 border-emerald-200',
      'WhatsApp button': 'bg-emerald-50 text-emerald-700 border-emerald-200',
      'WhatsApp floating click': 'bg-emerald-50 text-emerald-700 border-emerald-200',
      'Instagram': 'bg-amber-50 text-amber-700 border-amber-200'
    };
    const key = resolveApiLeadSourceColorKey(source);
    return colors[key as keyof typeof colors] || colors['Website form'];
  };

  const getCreatedByColor = (createdByName?: string | null) => {
    const name = normalizeApiLeadCreatedByDisplay(createdByName);
    if (/whatsapp/i.test(name)) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (/email/i.test(name)) return 'bg-blue-50 text-blue-700 border-blue-200';
    if (/instagram/i.test(name)) return 'bg-amber-50 text-amber-700 border-amber-200';
    const customPalette = [
      'bg-violet-50 text-violet-700 border-violet-200',
      'bg-rose-50 text-rose-700 border-rose-200',
      'bg-teal-50 text-teal-700 border-teal-200',
      'bg-indigo-50 text-indigo-700 border-indigo-200',
      'bg-cyan-50 text-cyan-700 border-cyan-200',
      'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200',
      'bg-sky-50 text-sky-700 border-sky-200',
      'bg-orange-50 text-orange-700 border-orange-200',
    ] as const;
    if (!name) return 'bg-slate-50 text-slate-700 border-slate-200';
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = ((hash << 5) - hash) + name.charCodeAt(i);
    const idx = Math.abs(hash) % customPalette.length;
    return customPalette[idx];
  };

  // Client Status Icon Component with better aesthetics
  const ClientStatusIcon = ({ leadId }: { leadId: string }) => {
    const { status, loading } = useClientProfileStatus(leadId);
    
    if (loading) return null;
    
    if (status === 'full') {
      return (
        <div className="w-2 h-2 bg-green-500 rounded-full ml-2 ring-2 ring-green-200 ring-offset-1"></div>
      );
    } else if (status === 'empty') {
      return (
        <div className="w-2 h-2 bg-red-500 rounded-full ml-2 ring-2 ring-red-200 ring-offset-1"></div>
      );
    } else {
      return (
        <div className="w-2 h-2 bg-yellow-500 rounded-full ml-2 ring-2 ring-yellow-200 ring-offset-1"></div>
      );
    }
  };

  const tableHeaders = useMemo((): TableHeadCol[] => {
    const pick: TableHeadCol[] = pickerSelection
      ? [{ key: "pick", label: "", width: "w-11" }]
      : [];
    const titleLabel =
      pickerSelection?.replaceTitleColumnWithPhone === true
        ? t("whatsappTemplates.recipientLists.addContactsModal.colPhone", "Phone number")
        : "Title";
    const contactEmailCol: TableHeadCol[] =
      pickerSelection?.showEmailColumn === true
        ? [
            {
              key: "contact_email",
              label: t("whatsappTemplates.recipientLists.addContactsModal.colEmail", "Email"),
              width: "w-[200px] max-w-[220px]",
            },
          ]
        : [];
    return [
      ...pick,
      { key: "created", label: "Created", width: "w-[100px]", sortKey: "created_at" },
      { key: "ticket", label: "Ticket ID", width: "w-[120px]", sortKey: "ticket_id" },
      { key: "client", label: "Client", width: "w-[150px]", sortKey: "client" },
      { key: "title", label: titleLabel, width: "w-[200px]", sortKey: "title" },
      ...contactEmailCol,
      { key: "services", label: "Services", width: "w-[280px] max-w-[280px]", sortKey: "services" },
      { key: "category", label: "Category", width: "w-[200px] max-w-[200px]", sortKey: "category" },
      { key: "created_by", label: "Created By", width: "w-[120px]", sortKey: "created_by_name" },
      {
        key: "web_property",
        label: t("leadsManagement.table.webProperty", "Web / Property"),
        width: "w-[140px]",
        sortKey: "web_id",
      },
      { key: "source", label: "Source", width: "w-[100px]", sortKey: "source" },
      { key: "utm_campaign", label: "UTM Campaign", width: "w-[250px] max-w-[250px]", sortKey: "utm_campaign" },
      { key: "utm_source", label: "UTM Source", width: "w-[110px]", sortKey: "utm_source" },
      { key: "utm_medium", label: "UTM Medium", width: "w-[120px]", sortKey: "utm_medium" },
      { key: "utm_content", label: "UTM Content", width: "w-[250px] max-w-[250px]", sortKey: "utm_content" },
      { key: "utm_term", label: "UTM Term", width: "w-[250px] max-w-[250px]", sortKey: "utm_term" },
      { key: "landing_url", label: "Landing URL", width: "w-[200px] max-w-[220px]", sortKey: "landing_url" },
      { key: "attribution_label", label: "Attribution label", width: "min-w-[200px] max-w-[260px]", sortKey: "attribution_label" },
      { key: "gclid", label: "gclid", width: "min-w-[160px] max-w-[220px]", sortKey: "gclid" },
      { key: "fbclid", label: "fbclid", width: "min-w-[160px] max-w-[220px]", sortKey: "fbclid" },
      { key: "assignee", label: "Assignee", width: "min-w-[168px] w-[168px]", sortKey: "assignee" },
      { key: "followup", label: "Follow Up", width: "min-w-[124px] w-[124px]", sortKey: "followup" },
      { key: "fu_priority", label: "FU Priority", width: "w-[120px]", sortKey: "fu_priority" },
      { key: "status", label: "Status", width: "w-[120px]", sortKey: "status" },
      {
        key: "converted_at",
        label: t("leadsManagement.table.convertedAt", "Converted at"),
        width: "w-[130px]",
        sortKey: "converted_at",
      },
      ...(showGoogleAdsSyncColumn && !pickerSelection
        ? [
            {
              key: "google_ads_sync",
              label: t("leadsManagement.table.googleAdsSync", "Sync Google Ads"),
              width: "w-[110px]",
            },
          ]
        : []),
      ...(showMetaAdsSyncColumn && !pickerSelection
        ? [
            {
              key: "meta_ads_sync",
              label: t("leadsManagement.table.metaAdsSync", "Sync Meta Ads"),
              width: "w-[110px]",
            },
          ]
        : []),
      {
        key: "resolve_outcome",
        label: t("leadsManagement.table.isResolve", "Is Resolve?"),
        width: "w-[148px]",
      },
      {
        key: "survey_rating",
        label: t("leadsManagement.table.surveyRating", "Rating"),
        width: "w-[100px]",
        sortKey: "survey_rating",
      },
      { key: "survey_history", label: "", width: "w-10" },
      { key: "survey_comment", label: t("leadsManagement.table.surveyComment", "Keterangan"), width: "w-[160px] max-w-[200px]" },
      ...(pickerSelection ? [] : [{ key: "actions" as const, label: "Actions", width: "w-[100px]" }]),
    ];
  }, [pickerSelection, showGoogleAdsSyncColumn, showMetaAdsSyncColumn, t]);

  const tableColCount = tableHeaders.length;

  const surveyRatingFilterOptions = useMemo(
    () =>
      SURVEY_RATING_FILTER_OPTIONS.map((v) => ({
        key: `survey-rating-${v}`,
        value: v,
        label:
          v === "none"
            ? t("leadsManagement.filters.noSurveyRating", "No rating")
            : t("leadsManagement.filters.surveyRatingStars", "{{count}} star", { count: Number(v) }),
      })),
    [t],
  );

  const resolveIsFilterOptions = useMemo(
    () => [
      { key: "resolve-true", value: "true" as const, label: t("leadsManagement.filters.resolveTrue", "True") },
      { key: "resolve-false", value: "false" as const, label: t("leadsManagement.filters.resolveFalse", "False") },
    ],
    [t],
  );

  const getStatusColorByName = (statusName: string) => {
    if (statusName.trim().toLowerCase() === 'converted') {
      return LEAD_SOLID_GREEN_BADGE;
    }
    const statusData = leadStatuses.find((s) => (s.name ?? "").trim().toLowerCase() === statusName.trim().toLowerCase());
    if (statusData?.color) {
      const colorMap: Record<string, string> = {
        '#F59E0B': 'bg-yellow-50 text-yellow-700 border-yellow-200',
        '#10B981': LEAD_SOLID_GREEN_BADGE,
        '#059669': LEAD_SOLID_GREEN_BADGE,
        '#EF4444': 'bg-red-50 text-red-700 border-red-200',
        '#6B7280': 'bg-gray-50 text-gray-700 border-gray-200',
        '#78716C': 'bg-stone-50 text-stone-700 border-stone-200',
        '#3B82F6': 'bg-blue-50 text-blue-700 border-blue-200',
      };
      return colorMap[statusData.color] ?? 'bg-gray-50 text-gray-700 border-gray-200';
    }
    return 'bg-gray-50 text-gray-700 border-gray-200';
  };

  const renderAttributionSortHead = (header: TableHeadCol) => {
    const sk = header.sortKey;
    if (!sk) return header.label;
    const active = attributionSort.column === sk;
    const Icon = !active ? ArrowUpDown : attributionSort.direction === "asc" ? ChevronUp : ChevronDown;
    return (
      <button
        type="button"
        className={cn(
          "inline-flex max-w-full items-center gap-0.5 text-left font-medium text-gray-700 hover:text-gray-900",
          !onAttributionSort && "cursor-default opacity-70",
        )}
        disabled={!onAttributionSort}
        onClick={() => onAttributionSort?.(sk)}
        aria-sort={active ? (attributionSort.direction === "asc" ? "ascending" : "descending") : "none"}
      >
        <span className="min-w-0 truncate">{header.label}</span>
        <Icon className={cn("h-3.5 w-3.5 shrink-0", active ? "text-gray-900" : "text-gray-400")} aria-hidden />
      </button>
    );
  };

  const renderResolveColumnFilterDropdown = (
    filterValue: ResolveColumnFilterValue,
    onFilterChange: (v: ResolveColumnFilterValue) => void,
    allLabel: string,
    entries: Array<{ key: string; value: "true" | "false"; label: string }>,
    ariaLabel: string,
  ) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 text-gray-500 hover:text-gray-900"
          aria-label={ariaLabel}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <ListFilter
            className={cn("h-3.5 w-3.5", filterValue !== "all" && "text-primary")}
            aria-hidden
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem
          onSelect={() => onFilterChange("all")}
          className={cn(filterValue === "all" && "bg-accent")}
        >
          {allLabel}
        </DropdownMenuItem>
        {entries.map((e) => (
          <DropdownMenuItem
            key={e.key}
            onSelect={() => onFilterChange(e.value)}
            className={cn(filterValue === e.value && "bg-accent")}
          >
            {e.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const renderLeadColumnFilterDropdown = (
    filterValue: string,
    onFilterChange: (v: string) => void,
    allLabel: string,
    entries: Array<{ key: string; value: string; label: string }>,
    ariaLabel: string,
  ) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 text-gray-500 hover:text-gray-900"
          aria-label={ariaLabel}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <ListFilter
            className={cn("h-3.5 w-3.5", filterValue !== "all" && "text-primary")}
            aria-hidden
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-72 overflow-y-auto">
        <DropdownMenuItem
          onSelect={() => onFilterChange("all")}
          className={cn(filterValue === "all" && "bg-accent")}
        >
          {allLabel}
        </DropdownMenuItem>
        {entries.map((e) => (
          <DropdownMenuItem
            key={e.key}
            onSelect={() => onFilterChange(e.value)}
            className={cn(filterValue === e.value && "bg-accent")}
          >
            {e.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const renderTableHeadContent = (header: TableHeadCol) => {
    if (header.key === "pick" && pickerSelection) {
      const keys = leads.map((l) => pickerSelection.getPhoneKey(l));
      const allOnPage = keys.length > 0 && keys.every((k) => pickerSelection.selectedPhoneKeys.has(k));
      const someOnPage = keys.some((k) => pickerSelection.selectedPhoneKeys.has(k));
      return (
        <Checkbox
          checked={allOnPage ? true : someOnPage ? "indeterminate" : false}
          onCheckedChange={(v) => pickerSelection.onTogglePage(keys, v === true)}
          aria-label={t("whatsappTemplates.recipientLists.addContactsModal.selectAllAria")}
          className="translate-y-0.5"
        />
      );
    }
    if (header.key === "services" && servicesColumnFilter) {
      return (
        <div className="inline-flex max-w-full min-w-0 items-center gap-0.5">
          {renderAttributionSortHead(header)}
          {renderLeadColumnFilterDropdown(
            servicesColumnFilter.value,
            servicesColumnFilter.onChange,
            t("leadsManagement.filters.allServices", "All Services"),
            servicesColumnFilter.options.map((o) => ({ key: o.id, value: o.name, label: o.name })),
            t("leadsManagement.table.filterServices", "Filter services"),
          )}
        </div>
      );
    }
    if (header.key === "category" && categoryColumnFilter) {
      return (
        <div className="inline-flex max-w-full min-w-0 items-center gap-0.5">
          {renderAttributionSortHead(header)}
          {renderLeadColumnFilterDropdown(
            categoryColumnFilter.value,
            categoryColumnFilter.onChange,
            t("leadsManagement.filters.allCategories", "All Categories"),
            categoryColumnFilter.options.map((o) => ({ key: o.id, value: o.name, label: o.name })),
            t("leadsManagement.table.filterCategory", "Filter category"),
          )}
        </div>
      );
    }
    if (header.key === "created_by" && createdByColumnFilter) {
      return (
        <div className="inline-flex max-w-full min-w-0 items-center gap-0.5">
          {renderAttributionSortHead(header)}
          {renderLeadColumnFilterDropdown(
            createdByColumnFilter.value,
            createdByColumnFilter.onChange,
            t("leadsManagement.filters.allCreatedBy", "All creators"),
            createdByColumnFilter.options.map((name, i) => ({
              key: `cb-${i}-${name}`,
              value: name,
              label: name,
            })),
            t("leadsManagement.table.filterCreatedBy", "Filter by creator"),
          )}
        </div>
      );
    }
    if (header.key === "web_property" && webPropertyColumnFilter) {
      return (
        <div className="inline-flex max-w-full min-w-0 items-center gap-0.5">
          {renderAttributionSortHead(header)}
          {renderLeadColumnFilterDropdown(
            webPropertyColumnFilter.value,
            webPropertyColumnFilter.onChange,
            t("leadsManagement.filters.allWebProperties", "All properties"),
            webPropertyColumnFilter.options.map((o) => ({
              key: o.id,
              value: o.value,
              label: o.label,
            })),
            t("leadsManagement.table.filterWebProperty", "Filter web / property"),
          )}
        </div>
      );
    }
    if (header.key === "source" && sourceColumnFilter) {
      return (
        <div className="inline-flex max-w-full min-w-0 items-center gap-0.5">
          {renderAttributionSortHead(header)}
          {renderLeadColumnFilterDropdown(
            sourceColumnFilter.value,
            sourceColumnFilter.onChange,
            t("leadsManagement.filters.allSources", "All Sources"),
            sourceColumnFilter.options.map((o) => ({ key: o.id, value: o.name, label: o.name })),
            t("leadsManagement.table.filterSource", "Filter source"),
          )}
        </div>
      );
    }
    if (header.key === "assignee" && assigneeColumnFilter) {
      return (
        <div className="inline-flex max-w-full min-w-0 items-center gap-0.5">
          {renderAttributionSortHead(header)}
          {renderLeadColumnFilterDropdown(
            assigneeColumnFilter.value,
            assigneeColumnFilter.onChange,
            t("leadsManagement.filters.allAssignees", "All Assignees"),
            assigneeColumnFilter.options.map((o) => ({ key: o.id, value: o.name, label: o.name })),
            t("leadsManagement.table.filterAssignee", "Filter assignee"),
          )}
        </div>
      );
    }
    if (header.key === "fu_priority" && fuPriorityColumnFilter) {
      return (
        <div className="inline-flex max-w-full min-w-0 items-center gap-0.5">
          {renderAttributionSortHead(header)}
          {renderLeadColumnFilterDropdown(
            fuPriorityColumnFilter.value,
            fuPriorityColumnFilter.onChange,
            t("leadsManagement.filters.allPriorities", "All Priorities"),
            fuPriorityColumnFilter.options.map((o) => ({ key: o.id, value: o.name, label: o.name })),
            t("leadsManagement.table.filterFuPriority", "Filter FU priority"),
          )}
        </div>
      );
    }
    if (header.key === "status" && statusColumnFilter) {
      return (
        <div className="inline-flex max-w-full min-w-0 items-center gap-0.5">
          {renderAttributionSortHead(header)}
          {renderLeadColumnFilterDropdown(
            statusColumnFilter.value,
            statusColumnFilter.onChange,
            t("leadsManagement.filters.allStatus", "All Status"),
            statusColumnFilter.options.map((o) => ({ key: o.id, value: o.name, label: o.label })),
            t("leadsManagement.table.filterStatus", "Filter status"),
          )}
        </div>
      );
    }
    if (header.key === "google_ads_sync") {
      return (
        <span className="min-w-0 truncate font-medium text-gray-700" title={header.label}>
          {header.label}
        </span>
      );
    }
    if (header.key === "resolve_outcome") {
      return (
        <div className="inline-flex max-w-full min-w-0 items-center gap-0.5">
          <span className="min-w-0 truncate font-medium text-gray-700">{header.label}</span>
          {resolveColumnFilter
            ? renderResolveColumnFilterDropdown(
                resolveColumnFilter.value,
                resolveColumnFilter.onChange,
                t("leadsManagement.filters.allIsResolve", "All status"),
                resolveIsFilterOptions,
                t("leadsManagement.table.filterIsResolve", "Filter is resolve"),
              )
            : null}
        </div>
      );
    }
    if (header.key === "survey_rating") {
      if (surveyColumnFilter) {
        return (
          <div className="inline-flex max-w-full min-w-0 items-center gap-0.5">
            {renderAttributionSortHead(header)}
            {renderLeadColumnFilterDropdown(
              surveyColumnFilter.value,
              (v) => surveyColumnFilter.onChange(v as SurveyRatingColumnFilterValue),
              t("leadsManagement.filters.allSurveyRatings", "All ratings"),
              surveyRatingFilterOptions,
              t("leadsManagement.table.filterSurveyRating", "Filter rating"),
            )}
          </div>
        );
      }
      return renderAttributionSortHead(header);
    }
    if (header.key === "survey_history") {
      return (
        <span className="sr-only">{t("leadsManagement.table.surveyHistoryColumn", "Riwayat survei")}</span>
      );
    }
    if (header.key === "utm_source" && utmSourceColumnFilter) {
      return (
        <div className="inline-flex max-w-full min-w-0 items-center gap-0.5">
          {renderAttributionSortHead(header)}
          {renderLeadColumnFilterDropdown(
            utmSourceColumnFilter.value,
            utmSourceColumnFilter.onChange,
            t("leadsManagement.filters.allUtmSources", "All UTM sources"),
            utmSourceColumnFilter.options.map((name, i) => ({
              key: `utm-src-${i}-${name}`,
              value: name,
              label: name,
            })),
            t("leadsManagement.table.filterUtmSource", "Filter UTM source"),
          )}
        </div>
      );
    }
    if (header.key === "utm_campaign" && utmCampaignColumnFilter) {
      return (
        <div className="inline-flex max-w-full min-w-0 items-center gap-0.5">
          {renderAttributionSortHead(header)}
          {renderLeadColumnFilterDropdown(
            utmCampaignColumnFilter.value,
            utmCampaignColumnFilter.onChange,
            t("leadsManagement.filters.allUtmCampaigns", "All UTM campaigns"),
            utmCampaignColumnFilter.options.map((name, i) => ({
              key: `utm-cmp-${i}-${name}`,
              value: name,
              label: name,
            })),
            t("leadsManagement.table.filterUtmCampaign", "Filter UTM campaign"),
          )}
        </div>
      );
    }
    if (header.key === "utm_medium" && utmMediumColumnFilter) {
      return (
        <div className="inline-flex max-w-full min-w-0 items-center gap-0.5">
          {renderAttributionSortHead(header)}
          {renderLeadColumnFilterDropdown(
            utmMediumColumnFilter.value,
            utmMediumColumnFilter.onChange,
            t("leadsManagement.filters.allUtmMedia", "All UTM media"),
            utmMediumColumnFilter.options.map((name, i) => ({
              key: `utm-med-${i}-${name}`,
              value: name,
              label: name,
            })),
            t("leadsManagement.table.filterUtmMedium", "Filter UTM medium"),
          )}
        </div>
      );
    }
    if (header.key === "utm_content" && utmContentColumnFilter) {
      return (
        <div className="inline-flex max-w-full min-w-0 items-center gap-0.5">
          {renderAttributionSortHead(header)}
          {renderLeadColumnFilterDropdown(
            utmContentColumnFilter.value,
            utmContentColumnFilter.onChange,
            t("leadsManagement.filters.allUtmContent", "All UTM content"),
            utmContentColumnFilter.options.map((name, i) => ({
              key: `utm-cnt-${i}-${name}`,
              value: name,
              label: name,
            })),
            t("leadsManagement.table.filterUtmContent", "Filter UTM content"),
          )}
        </div>
      );
    }
    if (header.key === "utm_term" && utmTermColumnFilter) {
      return (
        <div className="inline-flex max-w-full min-w-0 items-center gap-0.5">
          {renderAttributionSortHead(header)}
          {renderLeadColumnFilterDropdown(
            utmTermColumnFilter.value,
            utmTermColumnFilter.onChange,
            t("leadsManagement.filters.allUtmTerms", "All UTM terms"),
            utmTermColumnFilter.options.map((name, i) => ({
              key: `utm-trm-${i}-${name}`,
              value: name,
              label: name,
            })),
            t("leadsManagement.table.filterUtmTerm", "Filter UTM term"),
          )}
        </div>
      );
    }
    if (header.key === "landing_url" && landingUrlContainsColumnFilter) {
      const hasLandingFilter = (landingUrlContainsColumnFilter.value ?? "").trim() !== "";
      return (
        <div className="inline-flex max-w-full min-w-0 items-center gap-0.5">
          {renderAttributionSortHead(header)}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 text-gray-500 hover:text-gray-900"
                aria-label={t("leadsManagement.table.filterLandingUrl", "Filter landing URL")}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <ListFilter
                  className={cn("h-3.5 w-3.5", hasLandingFilter && "text-primary")}
                  aria-hidden
                />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              className="w-80 p-3"
              onPointerDown={(e) => e.stopPropagation()}
            >
              <p className="mb-2 text-xs text-muted-foreground">
                {t(
                  "leadsManagement.table.landingUrlContainsHint",
                  "Show leads whose landing URL contains this text (case-insensitive).",
                )}
              </p>
              <Input
                type="text"
                className="h-9 text-sm"
                placeholder={t(
                  "leadsManagement.table.landingUrlContainsPlaceholder",
                  "Landing URL contains…",
                )}
                value={landingUrlContainsColumnFilter.value}
                onChange={(e) => landingUrlContainsColumnFilter.onChange(e.target.value)}
              />
              <div className="mt-2 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => landingUrlContainsColumnFilter.onChange("")}
                >
                  {t("leadsManagement.table.clearLandingUrlFilter", "Clear")}
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      );
    }
    if (header.key === "attribution_label" && attributionLabelColumnFilter) {
      return (
        <div className="inline-flex max-w-full min-w-0 items-center gap-0.5">
          {renderAttributionSortHead(header)}
          {renderLeadColumnFilterDropdown(
            attributionLabelColumnFilter.value,
            attributionLabelColumnFilter.onChange,
            t("leadsManagement.filters.allAttributionLabels", "All attribution labels"),
            attributionLabelColumnFilter.options.map((name, i) => ({
              key: `attr-lbl-${i}-${name}`,
              value: name,
              label: name,
            })),
            t("leadsManagement.table.filterAttributionLabel", "Filter attribution label"),
          )}
        </div>
      );
    }
    if (header.key === "gclid" && gclidColumnFilter) {
      return (
        <div className="inline-flex max-w-full min-w-0 items-center gap-0.5">
          {renderAttributionSortHead(header)}
          {renderLeadColumnFilterDropdown(
            gclidColumnFilter.value,
            gclidColumnFilter.onChange,
            t("leadsManagement.filters.allGclids", "All gclids"),
            gclidColumnFilter.options.map((name, i) => ({
              key: `gclid-${i}-${name.slice(0, 24)}`,
              value: name,
              label: name.length > 48 ? `${name.slice(0, 45)}…` : name,
            })),
            t("leadsManagement.table.filterGclid", "Filter gclid"),
          )}
        </div>
      );
    }
    if (header.key === "fbclid" && fbclidColumnFilter) {
      return (
        <div className="inline-flex max-w-full min-w-0 items-center gap-0.5">
          {renderAttributionSortHead(header)}
          {renderLeadColumnFilterDropdown(
            fbclidColumnFilter.value,
            fbclidColumnFilter.onChange,
            t("leadsManagement.filters.allFbclids", "All fbclids"),
            fbclidColumnFilter.options.map((name, i) => ({
              key: `fbclid-${i}-${name.slice(0, 24)}`,
              value: name,
              label: name.length > 48 ? `${name.slice(0, 45)}…` : name,
            })),
            t("leadsManagement.table.filterFbclid", "Filter fbclid"),
          )}
        </div>
      );
    }
    return renderAttributionSortHead(header);
  };

  return (
    <div className="h-full flex flex-col">
      {/* rule 3.1: satu scroll container untuk tabel, nested-scroll-touch-chain */}
      <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 flex-1 overflow-x-auto overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <table className="w-full min-w-max caption-bottom text-sm">
          <TableHeader className="bg-gray-50 sticky top-0 z-20 shadow-sm">
            <TableRow className="hover:bg-transparent">
              {tableHeaders.map((header) => (
                <TableHead
                  key={header.key}
                  className={cn(
                    "bg-gray-50 text-xs font-medium text-gray-700 whitespace-nowrap",
                    header.width,
                    ATTRIBUTION_ASSIGNEE_FU_HEAD_KEYS.has(header.key) ? "px-5" : "px-3",
                  )}
                >
                  {renderTableHeadContent(header)}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.length === 0 ? (
              <TableRow>
                <TableCell colSpan={tableColCount} className="text-center py-8 text-gray-500 text-sm">
                  <div className="flex flex-col items-center space-y-2">
                    <div className="text-lg">📊</div>
                    <div>No leads found</div>
                    <div className="text-xs text-gray-400">Try adjusting your filters or search terms</div>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              leads.map((lead) => {
                const phoneKey = pickerSelection ? pickerSelection.getPhoneKey(lead) : "";
                const showPhoneInsteadOfTitle = pickerSelection?.replaceTitleColumnWithPhone === true;
                const showEmailColumn = pickerSelection?.showEmailColumn === true;
                const rowDisplayPhone = showPhoneInsteadOfTitle
                  ? (lead as NewLead & { _display_phone?: string | null })._display_phone
                  : undefined;
                const rowDisplayEmail = showEmailColumn
                  ? (lead as NewLead & { _display_email?: string | null; email?: string | null })
                      ._display_email ?? (lead as NewLead & { email?: string | null }).email
                  : undefined;
                return (
                <TableRow key={lead.id} className="hover:bg-muted/30">
                  {pickerSelection ? (
                    <TableCell className="w-11 px-2 py-1 align-middle">
                      <Checkbox
                        checked={pickerSelection.selectedPhoneKeys.has(phoneKey)}
                        onCheckedChange={(v) => pickerSelection.onTogglePhone(phoneKey, v === true)}
                        aria-label={lead.client}
                      />
                    </TableCell>
                  ) : null}
                  <TableCell className="font-medium text-sm whitespace-nowrap">
                    {formatDate(lead.created_at)}
                  </TableCell>
                  <TableCell className="font-mono text-sm whitespace-nowrap">
                    {lead.ticket_id}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <div className="flex items-center">
                      {pickerSelection ? (
                        <span className="font-medium text-sm">{lead.client}</span>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => handleClientClick(lead)}
                            className="font-medium text-sm text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                          >
                            {lead.client}
                          </button>
                          {/^[0-9a-f-]{36}$/i.test(String(lead.id)) ? (
                            <ClientStatusIcon leadId={lead.id} />
                          ) : null}
                        </>
                      )}
                    </div>
                  </TableCell>
                  <TableCell
                    className={cn(
                      "w-[200px] max-w-[200px] min-w-0 overflow-hidden align-middle",
                      showPhoneInsteadOfTitle && "font-mono text-sm",
                    )}
                  >
                    {showPhoneInsteadOfTitle ? (
                      <span
                        className="block truncate text-sm leading-normal"
                        title={rowDisplayPhone?.trim() ? rowDisplayPhone : undefined}
                      >
                        {rowDisplayPhone?.trim() ? rowDisplayPhone : "—"}
                      </span>
                    ) : (
                      <span className="block truncate text-sm leading-normal" title={lead.title ?? ""}>
                        {lead.title}
                      </span>
                    )}
                  </TableCell>
                  {showEmailColumn ? (
                    <TableCell
                      className="w-[200px] max-w-[220px] min-w-0 overflow-hidden align-middle text-sm"
                    >
                      <span
                        className="block truncate leading-normal"
                        title={rowDisplayEmail?.trim() ? rowDisplayEmail : undefined}
                      >
                        {rowDisplayEmail?.trim() ? rowDisplayEmail : "—"}
                      </span>
                    </TableCell>
                  ) : null}
                  <TableCell className="w-[280px] max-w-[280px] min-w-0 overflow-hidden align-middle">
                    <span className="text-sm leading-normal block truncate" title={(lead.services ?? '').trim() || undefined}>
                      {lead.services?.trim() ? lead.services : '-'}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-[200px] min-w-0 align-middle whitespace-nowrap">
                    <span className="text-sm leading-normal block truncate" title={lead.category ?? ''}>{lead.category}</span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Badge
                      className={`${getCreatedByColor(lead.created_by_name)} text-xs px-3 py-1 rounded-sm font-medium border max-w-[140px] inline-flex items-center justify-center`}
                      title={normalizeApiLeadCreatedByDisplay(lead.created_by_name) || ''}
                    >
                      <span className="whitespace-nowrap truncate block min-w-0">
                        {normalizeApiLeadCreatedByDisplay(lead.created_by_name) || '—'}
                      </span>
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap max-w-[160px]">
                    {(() => {
                      const webLabel = formatLeadWebPropertyDisplay(lead.web_id);
                      return webLabel ? (
                        <Badge
                          className="bg-slate-50 text-slate-700 border-slate-200 text-xs px-3 py-1 rounded-sm font-medium border max-w-[150px] inline-flex items-center justify-center"
                          title={lead.web_id ?? undefined}
                        >
                          <span className="whitespace-nowrap truncate block min-w-0">{webLabel}</span>
                        </Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      );
                    })()}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Badge className={`${getSourceColor(lead.source)} text-xs px-3 py-1 rounded-sm font-medium border w-32 justify-center`}>
                      {normalizeApiLeadSourceDisplay(lead.source)}
                    </Badge>
                  </TableCell>
                  <TableCell className="min-w-0 max-w-[250px] text-xs text-gray-800">
                    {lead.utm_campaign?.trim() ? (
                      <span className="block truncate" title={lead.utm_campaign}>
                        {lead.utm_campaign}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-gray-800">
                    {lead.utm_source?.trim() ? <span title={lead.utm_source}>{lead.utm_source}</span> : null}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-gray-800">
                    {lead.utm_medium?.trim() ? <span title={lead.utm_medium}>{lead.utm_medium}</span> : null}
                  </TableCell>
                  <TableCell className="min-w-0 max-w-[250px] text-xs text-gray-800">
                    {lead.utm_content?.trim() ? (
                      <span className="block truncate" title={lead.utm_content}>
                        {lead.utm_content}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="min-w-0 max-w-[250px] text-xs text-gray-800">
                    {lead.utm_term?.trim() ? (
                      <span className="block truncate" title={lead.utm_term}>
                        {lead.utm_term}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="min-w-0 max-w-[220px] text-xs text-gray-800">
                    {lead.landing_url?.trim() ? (
                      <span className="block truncate" title={lead.landing_url}>
                        {lead.landing_url}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="min-w-0 max-w-[260px] px-5 text-xs text-gray-800 align-middle">
                    {lead.attribution_label?.trim() ? (
                      <span className="block truncate" title={lead.attribution_label}>
                        {lead.attribution_label}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="min-w-0 max-w-[220px] px-5 text-xs text-gray-800 align-middle">
                    {lead.gclid?.trim() ? (
                      <span className="block truncate font-mono" title={lead.gclid}>
                        {lead.gclid}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="min-w-0 max-w-[220px] px-5 text-xs text-gray-800 align-middle">
                    {lead.fbclid?.trim() ? (
                      <span className="block truncate font-mono" title={lead.fbclid}>
                        {lead.fbclid}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="min-w-[168px] whitespace-nowrap px-5">
                    {pickerSelection ? (
                      <span className="text-sm text-gray-800">{lead.assignee?.trim() ? lead.assignee : "—"}</span>
                    ) : (
                    <Select
                      value={
                        (lead as NewLead & { assignee_id?: string | null }).assignee_id != null &&
                        String((lead as NewLead & { assignee_id?: string | null }).assignee_id).trim() !== ''
                          ? String((lead as NewLead & { assignee_id?: string | null }).assignee_id)
                          : ASSIGNEE_SELECT_UNASSIGNED
                      }
                      onValueChange={(value) => handleFieldUpdate(lead.id, "assignee_id", value)}
                    >
                      <SelectTrigger
                        className="w-full h-8 text-xs"
                        disabled={isAssigneeSelectDisabled(lead)}
                        title={
                          isAssigneeSelectDisabled(lead)
                            ? t(
                                'leadsManagement.table.assigneeDisabledWhenResolved',
                                'Assignee cannot be changed after the chat is resolved.',
                              )
                            : undefined
                        }
                      >
                        <SelectValue placeholder={t("leadsManagement.table.assigneePlaceholder", "Select assignee")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ASSIGNEE_SELECT_UNASSIGNED}>
                          {t("leadsManagement.table.assigneeUnassigned", "Unassigned")}
                        </SelectItem>
                        {employees.length === 0 ? (
                          <SelectItem value="no-employees" disabled>
                            {t("leadsManagement.table.noRosterStaff", "No staff on omnichannel roster")}
                          </SelectItem>
                        ) : (
                          employees.map((emp) => (
                            <SelectItem key={emp.id} value={emp.id}>
                              {emp.full_name || emp.email}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    )}
                  </TableCell>
                  {/* Follow Up Column with History Icon and Number (same for regular + WhatsApp) */}
                  <TableCell className="min-w-[124px] whitespace-nowrap px-5">
                    {pickerSelection ? (
                      <span className="text-sm font-medium">{lead.followup ?? 0}</span>
                    ) : (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 hover:bg-muted"
                        onClick={() => handleFollowUpClick(lead)}
                      >
                        <History className="h-4 w-4 text-gray-600" />
                      </Button>
                      <span className="text-sm font-medium">{lead.followup ?? 0}</span>
                    </div>
                    )}
                  </TableCell>
                  {/* FU Priority Column (same for regular + WhatsApp) */}
                  <TableCell className="whitespace-nowrap">{renderFuPriorityBadge(lead)}</TableCell>
                  {/* Status — Unread / In Progress / Converted / Expired (bukan label Resolve) */}
                  <TableCell className="whitespace-nowrap">
                    {(() => {
                      const { displayName: statusLabel, colorStatusName } = getLeadTableStatusPresentation(lead);
                      const statusBadgeClass = getStatusColorByName(colorStatusName);
                      if (pickerSelection) {
                        return (
                          <Badge
                            className={`${statusBadgeClass} text-xs px-3 py-1 rounded-sm font-medium border w-28 justify-center`}
                          >
                            {statusLabel}
                          </Badge>
                        );
                      }
                      return (
                        <div className="flex items-center gap-2">
                          <Badge
                            className={`${statusBadgeClass} text-xs px-3 py-1 rounded-sm font-medium border w-28 justify-center`}
                          >
                            {statusLabel}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 hover:bg-muted"
                            onClick={() => handleStatusHistoryClick(lead)}
                            title={t("leadsManagement.viewStatusHistory", "Lihat riwayat status")}
                          >
                            <Clock className="h-3 w-3 text-gray-600" />
                          </Button>
                        </div>
                      );
                    })()}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-gray-700">
                    {lead.converted_at ? (
                      <span title={lead.converted_at}>{formatConvertedAt(lead.converted_at)}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  {showGoogleAdsSyncColumn && !pickerSelection ? (
                    <TableCell className="whitespace-nowrap px-1">
                      <LeadGoogleAdsSyncCell
                        isConverted={
                          getCurrentLeadStatusName(lead).trim().toLowerCase() === 'converted'
                        }
                        sync={getGoogleAdsSyncForLead?.(lead) ?? null}
                        loading={googleAdsSyncLoading}
                        uploadsEnabled={googleAdsUploadsEnabled}
                      />
                    </TableCell>
                  ) : null}
                  {showMetaAdsSyncColumn && !pickerSelection ? (
                    <TableCell className="whitespace-nowrap px-1">
                      <LeadMetaAdsSyncCell
                        isConverted={
                          getCurrentLeadStatusName(lead).trim().toLowerCase() === 'converted'
                        }
                        sync={getMetaAdsSyncForLead?.(lead) ?? null}
                        loading={metaAdsSyncLoading}
                        uploadsEnabled={metaAdsUploadsEnabled}
                      />
                    </TableCell>
                  ) : null}
                  <TableCell className="whitespace-nowrap px-1">
                    {(() => {
                      const rawStatus = (lead.lead_status?.name ?? leadStatuses.find((s) => s.id === lead.status_id)?.name ?? "").trim();
                      if (!isResolvedLeadStatusName(rawStatus)) {
                        return <span className="inline-flex w-[132px] justify-center text-sm text-muted-foreground">—</span>;
                      }
                      return (
                        <Badge
                          className={`${LEAD_SOLID_GREEN_BADGE} text-xs px-2.5 py-1 rounded-sm font-medium border w-[132px] justify-center`}
                        >
                          {t("leadsManagement.resolve.badge", "Resolve")}
                        </Badge>
                      );
                    })()}
                  </TableCell>
                  <TableCell className="whitespace-nowrap px-2 py-1 align-middle">
                    <LeadSurveyRatingCell
                      lead={lead}
                      survey={getSurveyForLead?.(lead) ?? null}
                    />
                  </TableCell>
                  <TableCell className="w-10 px-1 py-1 text-center align-middle">
                    <LeadSurveyHistoryCell
                      lead={lead}
                      survey={getSurveyForLead?.(lead) ?? null}
                      onOpenHistory={onOpenSurveyHistory}
                    />
                  </TableCell>
                  <TableCell className="max-w-[200px] min-w-0 px-2 py-1 align-middle">
                    <LeadSurveyCommentCell
                      lead={lead}
                      survey={getSurveyForLead?.(lead) ?? null}
                    />
                  </TableCell>
                  {!pickerSelection ? (
                    <TableCell className="text-center">
                      <LeadActionsDropdown
                        lead={lead}
                        onEdit={handleEdit}
                        onViewDetail={handleViewDetail}
                        onDelete={handleDelete}
                        onTemplateFollowUp={(l) => {
                          setTemplateFollowUpLead(l);
                          setIsTemplateFollowUpOpen(true);
                        }}
                      />
                    </TableCell>
                  ) : null}
                </TableRow>
                );
              })
            )}
          </TableBody>
        </table>
      </div>
      
      <LeadTemplateFollowUpDialog
        open={isTemplateFollowUpOpen}
        onOpenChange={setIsTemplateFollowUpOpen}
        lead={templateFollowUpLead}
        onSent={() => {
          if (onRefreshLeads) onRefreshLeads();
          setTemplateFollowUpLead(null);
        }}
      />

      {/* Follow Up Update Form */}
      {selectedLead && (
        <LeadFollowUpForm
          open={isFollowUpOpen}
          onClose={() => setIsFollowUpOpen(false)}
          leadId={selectedLead.id}
          leadTitle={selectedLead.title}
      onUpdateAdded={async () => {
        // Refresh the leads data efficiently
        if (onRefreshLeads) {
          onRefreshLeads();
        }
        setIsFollowUpOpen(false);
      }}
        />
      )}
      
      {/* Edit Lead Dialog */}
      <EditLeadDialog
        open={isEditDialogOpen}
        onClose={() => {
          setIsEditDialogOpen(false);
          setLeadToEdit(null);
        }}
        lead={leadToEdit}
        onUpdateLead={onUpdateLead}
      />
      
      {/* View Lead Dialog */}
      <ViewLeadDialog
        open={isViewDialogOpen}
        onClose={() => {
          setIsViewDialogOpen(false);
          setLeadToView(null);
        }}
        lead={leadToView}
      />
      
      {/* Client Profile Popup - only when organizationId is available */}
      {selectedClientLead && organizationId && (
        <ClientProfilePopup
          open={isClientProfileOpen}
          onClose={() => {
            setIsClientProfileOpen(false);
            setSelectedClientLead(null);
          }}
          leadId={selectedClientLead.id}
          clientName={selectedClientLead.client}
          organizationId={organizationId}
          initialPhoneNumber={(selectedClientLead as { _customerWaId?: string })._customerWaId ?? ''}
          onSave={() => {
            // Optional: refresh data if needed
            if (onRefreshLeads) {
              onRefreshLeads();
            }
          }}
        />
      )}

      {/* Status History Dialog */}
      {statusHistoryLead && (
        <LeadStatusHistoryDialog
          open={isStatusHistoryOpen}
          onClose={() => {
            setIsStatusHistoryOpen(false);
            setStatusHistoryLead(null);
          }}
          leadId={statusHistoryLead.id}
          leadTitle={statusHistoryLead.title}
        />
      )}
    </div>
  );
}
