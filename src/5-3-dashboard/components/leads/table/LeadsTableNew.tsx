
import { useState, memo, useMemo } from 'react';
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { History, Clock } from "lucide-react";
import { format } from "date-fns";
import { NewLead } from '@/shared/types/leads';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { LeadActionsDropdown } from "@/5-3-dashboard/components/leads/actions/LeadActionsDropdown";
import { LeadFollowUpForm } from "@/5-3-dashboard/components/leads/forms/LeadFollowUpForm";
import { EditLeadDialog } from "@/5-3-dashboard/components/leads/dialogs/EditLeadDialog";
import { ViewLeadDialog } from "@/5-3-dashboard/components/leads/dialogs/ViewLeadDialog";
import { ClientProfilePopup } from "@/5-3-dashboard/components/leads/dialogs/ClientProfilePopup";
import { LeadStatusHistoryDialog } from "@/5-3-dashboard/components/leads/dialogs/LeadStatusHistoryDialog";
import { getLeadStatusDisplayName } from '@/5-1-leads-management/utils/leadStatusDisplay';
import { useClientProfileStatus } from '@/shared/hooks/organized/sales';
import { useAvailableEmployees } from '@/shared/hooks/useAvailableEmployees';
import { useLeadStatusesActiveFull } from "@/5-3-dashboard/hooks/useLeadsManagementFilterQueries";
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useToast } from '@/shared/components/ui/use-toast';

interface LeadsTableNewProps {
  leads: NewLead[];
  onUpdateLead: (lead: NewLead) => void;
  onDeleteLead: (leadId: string) => void;
  onRefreshLeads?: () => void;
}

export default function LeadsTableNew({ leads, onUpdateLead, onDeleteLead, onRefreshLeads }: LeadsTableNewProps) {
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

  const { data: employees = [] } = useAvailableEmployees();

  const handleFieldUpdate = async (leadId: string, field: string, value: string) => {
    const lead = leads.find(l => l.id === leadId);
    if (!lead) return;
    let updatedLead: NewLead & { assignee_id?: string | null };

    if (field === 'status_id') {
      const selectedStatus = leadStatuses.find(s => s.id === value);
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
      const emp = employees.find((e) => e.id === value);
      updatedLead = {
        ...lead,
        assignee_id: value || null,
        assignee: emp ? (emp.full_name || emp.email) : (lead.assignee ?? ''),
      };
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

  // Get FU Priority with soft rectangular colors
  const getFUPriorityColor = (priority?: string) => {
    const colors = {
      'High': 'bg-red-50 text-red-700 border-red-200',
      'Medium': 'bg-yellow-50 text-yellow-700 border-yellow-200', 
      'Low': 'bg-green-50 text-green-700 border-green-200',
      'Please Follow Up': 'bg-red-100 text-red-800 border-red-400' // Darker red for follow up warning
    };
    return colors[priority as keyof typeof colors] || colors.Medium;
  };

  // Status names that are "final" — once set, lead cannot go back to Open
  const TERMINAL_STATUS_NAMES = ['Lost', 'Closed', 'Converted'];
  const getCurrentLeadStatusName = (lead: NewLead) =>
    (lead.lead_status?.name ?? leadStatuses.find(s => s.id === lead.status_id)?.name ?? '').trim();
  const isOpenDisabledForLead = (lead: NewLead) =>
    TERMINAL_STATUS_NAMES.some(
      (name) => getCurrentLeadStatusName(lead).toLowerCase() === name.toLowerCase()
    );

  const isResolvedLead = (l: NewLead) => (l.lead_status?.name ?? leadStatuses.find(s => s.id === l.status_id)?.name ?? '').trim().toLowerCase() === 'closed';

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
      'WhatsApp': 'bg-emerald-50 text-emerald-700 border-emerald-200',
      'Instagram': 'bg-amber-50 text-amber-700 border-amber-200'
    };
  return colors[source as keyof typeof colors] || colors.Website;
  };

  // Created By: channel colors for known sources; distinct colors for custom names (e.g. account/org names)
  const getCreatedByColor = (createdByName?: string | null) => {
    const name = (createdByName ?? '').trim();
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

  const tableHeaders = useMemo(() => [
    { key: 'created', label: 'Created', width: 'w-[100px]' },
    { key: 'ticket', label: 'Ticket ID', width: 'w-[120px]' },
    { key: 'client', label: 'Client', width: 'w-[150px]' },
    { key: 'title', label: 'Title', width: 'w-[200px]' },
    { key: 'services', label: 'Services', width: 'w-[120px]' },
    { key: 'category', label: 'Category', width: 'w-[120px]' },
    { key: 'created_by', label: 'Created By', width: 'w-[120px]' },
    { key: 'source', label: 'Source', width: 'w-[100px]' },
    { key: 'assignee', label: 'Assignee', width: 'w-[120px]' },
    { key: 'followup', label: 'Follow Up', width: 'w-[100px]' },
    { key: 'fu_priority', label: 'FU Priority', width: 'w-[120px]' },
    { key: 'status', label: 'Status', width: 'w-[120px]' },
    { key: 'actions', label: 'Actions', width: 'w-[100px]' },
  ], []);

  return (
    <div className="h-full flex flex-col">
      {/* rule 3.1: satu scroll container untuk tabel, nested-scroll-touch-chain */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto seamless-scroll nested-scroll-touch-chain">
        <table className="w-full min-w-max caption-bottom text-sm">
          <TableHeader className="bg-gray-50 sticky top-0 z-20 shadow-sm">
            <TableRow className="hover:bg-transparent">
              {tableHeaders.map((header) => (
                <TableHead key={header.key} className={`text-xs font-medium text-gray-700 ${header.width} px-3 bg-gray-50 whitespace-nowrap`}>
                  {header.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.length === 0 ? (
              <TableRow>
                <TableCell colSpan={13} className="text-center py-8 text-gray-500 text-sm">
                  <div className="flex flex-col items-center space-y-2">
                    <div className="text-lg">📊</div>
                    <div>No leads found</div>
                    <div className="text-xs text-gray-400">Try adjusting your filters or search terms</div>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              leads.map((lead, index) => (
                <TableRow key={lead.id} className="hover:bg-muted/30">
                  <TableCell className="font-medium text-sm whitespace-nowrap">
                    {formatDate(lead.created_at)}
                  </TableCell>
                  <TableCell className="font-mono text-sm whitespace-nowrap">
                    {lead.ticket_id}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <div className="flex items-center">
                      <button
                        onClick={() => handleClientClick(lead)}
                        className="font-medium text-sm text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                      >
                        {lead.client}
                      </button>
                      <ClientStatusIcon leadId={lead.id} />
                    </div>
                  </TableCell>
                  <TableCell className="w-[200px] max-w-[200px] min-w-0 overflow-hidden">
                    <span className="text-sm truncate block" title={lead.title ?? ''}>{lead.title}</span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <span className="text-sm">{lead.services || '-'}</span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <span className="text-sm">{lead.category}</span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Badge
                      className={`${getCreatedByColor(lead.created_by_name)} text-xs px-3 py-1 rounded-sm font-medium border max-w-[140px] inline-flex items-center justify-center`}
                      title={lead.created_by_name ?? ''}
                    >
                      <span className="whitespace-nowrap truncate block min-w-0">{lead.created_by_name || '—'}</span>
                    </Badge>
                  </TableCell>
                  {/* Source Column - right after Created By */}
                  <TableCell className="whitespace-nowrap">
                    <Badge className={`${getSourceColor(lead.source)} text-xs px-3 py-1 rounded-sm font-medium border w-32 justify-center`}>
                      {lead.source || 'Website'}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Select
                      value={(lead as NewLead & { assignee_id?: string | null }).assignee_id ?? (employees.find((e) => (e.full_name || e.email) === lead.assignee)?.id) ?? ''}
                      onValueChange={(value) => handleFieldUpdate(lead.id, 'assignee_id', value)}
                    >
                      <SelectTrigger className="w-full h-8 text-xs" disabled={isResolvedLead(lead)}>
                        <SelectValue placeholder="Select assignee" />
                      </SelectTrigger>
                      <SelectContent>
                        {employees.length === 0 ? (
                          <SelectItem value="no-employees" disabled>No employees</SelectItem>
                        ) : (
                          employees.map((emp) => (
                            <SelectItem key={emp.id} value={emp.id}>
                              {emp.full_name || emp.email}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  {/* Follow Up Column with History Icon and Number (same for regular + WhatsApp) */}
                  <TableCell className="whitespace-nowrap">
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
                  </TableCell>
                  {/* FU Priority Column (same for regular + WhatsApp) */}
                  <TableCell className="whitespace-nowrap">
                    {(() => {
                      const followupCount = lead.followup ?? 0;
                      const displayPriority = followupCount === 0 ? 'Please Follow Up' : (lead.fu_priority || 'Medium');
                      return (
                        <Badge className={`${getFUPriorityColor(displayPriority)} text-xs px-3 py-1 rounded-sm font-medium border w-32 justify-center`}>
                          {displayPriority}
                        </Badge>
                      );
                    })()}
                  </TableCell>
                  {/* Status Column - Read-only badge from lead_statuses; no dropdown. Change status via Edit lead or View detail. */}
                  <TableCell className="whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Badge className={`${getStatusColor(lead)} text-xs px-3 py-1 rounded-sm font-medium border w-28 justify-center`}>
                        {getLeadStatusDisplayName(
                          lead.lead_status?.name ||
                          leadStatuses.find(s => s.id === lead.status_id)?.name ||
                          (leadStatuses.length > 0 ? leadStatuses[0].name : 'Open')
                        )}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 hover:bg-muted"
                        onClick={() => handleStatusHistoryClick(lead)}
                        title={t('leadsManagement.viewStatusHistory', 'Lihat riwayat status')}
                      >
                        <Clock className="h-3 w-3 text-gray-600" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <LeadActionsDropdown
                      lead={lead}
                      onEdit={handleEdit}
                      onViewDetail={handleViewDetail}
                      onDelete={handleDelete}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </table>
      </div>
      
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
