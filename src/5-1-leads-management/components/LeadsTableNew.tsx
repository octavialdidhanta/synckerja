
import { useState, useEffect } from 'react';
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { History, Clock } from "lucide-react";
import { format } from "date-fns";
import { NewLead } from '@/shared/types/leads';
import { LeadActionsDropdown } from './LeadActionsDropdown';
import { LeadFollowUpForm } from './LeadFollowUpForm';
import { EditLeadDialog } from './EditLeadDialog';
import { ViewLeadDialog } from './ViewLeadDialog';
import { ClientProfilePopup } from '@/5-3-sales-consultant/components/dialogs/ClientProfilePopup';
import { LeadStatusHistoryDialog } from './LeadStatusHistoryDialog';
import { LeadStatusSelect } from './LeadStatusSelect';
import { useClientProfileStatus } from '@/shared/hooks/organized/sales';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { Check, X, Minus } from 'lucide-react';
import { supabase } from "@/shared/lib/supabaseClient";

interface LeadStatus {
  id: string;
  name: string;
  color: string;
}

interface LeadsTableNewProps {
  leads: NewLead[];
  onUpdateLead: (lead: NewLead) => void;
  onDeleteLead: (leadId: string) => void;
  onRefreshLeads?: () => void;
}

export default function LeadsTableNew({ leads, onUpdateLead, onDeleteLead, onRefreshLeads }: LeadsTableNewProps) {
  const { t } = useAppTranslation();
  const [selectedLead, setSelectedLead] = useState<NewLead | null>(null);
  const [isFollowUpOpen, setIsFollowUpOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [leadToEdit, setLeadToEdit] = useState<NewLead | null>(null);
  const [leadToView, setLeadToView] = useState<NewLead | null>(null);
  const [isClientProfileOpen, setIsClientProfileOpen] = useState(false);
  const [selectedClientLead, setSelectedClientLead] = useState<NewLead | null>(null);
  const [organizationId, setOrganizationId] = useState<string>('');
  const [leadStatuses, setLeadStatuses] = useState<LeadStatus[]>([]);
  const [isStatusHistoryOpen, setIsStatusHistoryOpen] = useState(false);
  const [statusHistoryLead, setStatusHistoryLead] = useState<NewLead | null>(null);

  // Fetch lead statuses from database (filter by org when available, so dropdown sync with leads)
  useEffect(() => {
    const fetchLeadStatuses = async () => {
      let query = supabase
        .from('lead_statuses')
        .select('id, name, color')
        .eq('is_active', true)
        .order('sort_order');
      if (organizationId) {
        query = query.eq('organization_id', organizationId);
      }
      const { data, error } = await query;
      if (!error && data) {
        setLeadStatuses(data);
      }
    };

    fetchLeadStatuses();
  }, [organizationId]);

  const handleFieldUpdate = (leadId: string, field: string, value: string) => {
    const lead = leads.find(l => l.id === leadId);
    if (lead) {
      let updatedLead: NewLead;
      
      // Special handling for status updates to use status_id
      if (field === 'status_id') {
        const selectedStatus = leadStatuses.find(s => s.id === value);
        // Block changing to Unread (Open) when current status is not Open
        if (selectedStatus?.name?.trim().toLowerCase() === 'open') {
          const currentName = (lead.lead_status?.name ?? leadStatuses.find(s => s.id === lead.status_id)?.name ?? '').trim().toLowerCase();
          if (currentName && currentName !== 'open') return;
        }
        if (selectedStatus?.name?.trim().toLowerCase() === 'closed') {
          const confirmed = window.confirm(t('leadsManagement.confirmResolve', 'Yakin ingin mengubah status menjadi Resolve? Chat outbound akan diblokir sampai ada pesan masuk baru dari customer.'));
          if (!confirmed) return;
        }
        updatedLead = { 
          ...lead, 
          status_id: value,
          // Update the joined data if it exists
          lead_status: selectedStatus ? {
            id: selectedStatus.id,
            name: selectedStatus.name,
            color: selectedStatus.color
          } : lead.lead_status
        };
      } else {
        updatedLead = { ...lead, [field]: value };
      }
      
      onUpdateLead(updatedLead);
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
    await onDeleteLead(leadId);
  };

  const handleStatusHistoryClick = (lead: NewLead) => {
    setStatusHistoryLead(lead);
    setIsStatusHistoryOpen(true);
  };

  const handleClientClick = async (lead: NewLead) => {
    // Get organization ID from leads if we have one, or from user profile
    if (leads.length > 0 && leads[0].organization_id) {
      setOrganizationId(leads[0].organization_id);
    } else {
      // Fallback: get organization from user profile
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('active_organization_id')
            .eq('user_id', user.id)
            .single();
          if (profile?.active_organization_id) {
            setOrganizationId(profile.active_organization_id);
          }
        }
      } catch (error) {
        console.error('Error getting organization ID:', error);
      }
    }
    
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

  const isResolvedLead = (l: NewLead) => (l.lead_status?.name ?? leadStatuses.find(s => s.id === l.status_id)?.name ?? '').trim().toLowerCase() === 'closed';

  // Untuk guard di handleFieldUpdate dan currentStatusName di LeadStatusSelect (kode status = livechat)
  const getCurrentLeadStatusName = (l: NewLead) =>
    (l.lead_status?.name ?? leadStatuses.find(s => s.id === l.status_id)?.name ?? '').trim();

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

  return (
    <div className="w-full">
      <ScrollArea className="w-full h-[calc(100vh-280px)]">
        <div className="min-w-[1400px]">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[100px] font-semibold">Created</TableHead>
                <TableHead className="w-[120px] font-semibold">Ticket ID</TableHead>
                <TableHead className="w-[150px] font-semibold">Client</TableHead>
                <TableHead className="w-[200px] font-semibold">Title</TableHead>
                <TableHead className="w-[120px] font-semibold">Services</TableHead>
                <TableHead className="w-[120px] font-semibold">Category</TableHead>
                <TableHead className="w-[120px] font-semibold">Created By</TableHead>
                <TableHead className="w-[100px] font-semibold">Source</TableHead>
                <TableHead className="w-[120px] font-semibold">Assignee</TableHead>
                <TableHead className="w-[100px] font-semibold">Follow Up</TableHead>
                <TableHead className="w-[120px] font-semibold">FU Priority</TableHead>
                <TableHead className="w-[120px] font-semibold">Status</TableHead>
                <TableHead className="w-[100px] font-semibold text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.map((lead, index) => {
                return (
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
                    {/* Source Column - Fixed width rectangular style */}
                    <TableCell className="whitespace-nowrap">
                      <Badge className={`${getSourceColor(lead.source)} text-xs px-3 py-1 rounded-sm font-medium border w-32 justify-center`}>
                        {lead.source || 'Website'}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Select
                        value={lead.assignee}
                        onValueChange={(value) => handleFieldUpdate(lead.id, 'assignee', value)}
                      >
                        <SelectTrigger className="w-full h-8 text-xs" disabled={isResolvedLead(lead)}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ADEL">ADEL</SelectItem>
                          <SelectItem value="INDRI">INDRI</SelectItem>
                          <SelectItem value="NADA">NADA</SelectItem>
                          <SelectItem value="RYAN">RYAN</SelectItem>
                          <SelectItem value="SINTA">SINTA</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    {/* Follow Up Column with History Icon and Number */}
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
                        <span className="text-sm font-medium">{lead.followup || 0}</span>
                      </div>
                    </TableCell>
                    {/* FU Priority Column - Fixed width rectangular style */}
                    <TableCell className="whitespace-nowrap">
                      <Badge className={`${getFUPriorityColor((lead.followup === 0) ? 'Please Follow Up' : lead.fu_priority)} text-xs px-3 py-1 rounded-sm font-medium border w-32 justify-center`}>
                        {(lead.followup === 0) ? 'Please Follow Up' : (lead.fu_priority || 'Medium')}
                      </Badge>
                    </TableCell>
                     {/* Status Column - kode sama dengan sidebar livechat (LeadStatusSelect) */}
                     <TableCell className="whitespace-nowrap">
                       <div className="flex items-center gap-2">
                         <LeadStatusSelect
                           value={lead.status_id || (lead.lead_status?.id ?? leadStatuses[0]?.id ?? '')}
                           onValueChange={(value) => handleFieldUpdate(lead.id, 'status_id', value)}
                           leadStatuses={leadStatuses}
                           currentStatusName={getCurrentLeadStatusName(lead)}
                           disabled={isResolvedLead(lead)}
                           triggerClassName="w-28 h-7 text-xs border rounded-sm font-medium justify-between px-2"
                         />
                         <Button
                           variant="ghost"
                           size="sm"
                           className="h-7 w-7 p-0 hover:bg-muted"
                           onClick={() => handleStatusHistoryClick(lead)}
                           title="View status history"
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
                );
              })}
            </TableBody>
          </Table>
        </div>
      </ScrollArea>
      
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
      
      {/* Client Profile Popup */}
      {selectedClientLead && (
        <ClientProfilePopup
          open={isClientProfileOpen}
          onClose={() => {
            setIsClientProfileOpen(false);
            setSelectedClientLead(null);
          }}
          leadId={selectedClientLead.id}
          clientName={selectedClientLead.client}
          organizationId={organizationId}
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
