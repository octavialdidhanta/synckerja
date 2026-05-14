import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Button } from '@/shared/components/ui/button';
import { Textarea } from '@/shared/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { useLeads } from '@/shared/hooks/organized/sales';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useOmnichannelRosterAssignees } from '@/shared/hooks/useOrganizationOmnichannelStaff';
import { LeadStatusSelect } from '@/5-1-leads-management/components/LeadStatusSelect';
import { useServices } from '@/6-1-product-knowledge/hooks/useServices';
import { useSubServices } from '@/6-1-product-knowledge/hooks/useSubServices';
import { supabase } from '@/shared/lib/supabaseClient';
import { devLog } from '@/shared/lib/logger';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { Plus, User, Clock, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import type { LiveChatConversation } from '../../types';
import { LivechatSlaTargetPanel } from '@/5-3-whatsapp/components/inbox/LivechatSlaTargetPanel';
import { isResolvedStatus, isOutside24hWindow } from '../../constants/leadStatus';
import { computeFollowUpAndPriority } from '@/5-1-leads-management/utils/fuPriorityFromUpdates';

/** Ticket ID for lead lookup: WA-xxx, IG-xxx, EMAIL-xxx. */
function getTicketIdForConversation(conv: LiveChatConversation): string {
  if (conv.source === 'email') {
    return 'EMAIL-' + String(conv.id).replace(/-/g, '').slice(0, 8).toUpperCase();
  }
  if (conv.source === 'instagram') {
    const c = conv as { ticket_id?: string; id: string };
    if (c.ticket_id) return c.ticket_id;
    return 'IG-' + String(conv.id).replace(/-/g, '').slice(0, 8).toUpperCase();
  }
  const c = conv as { ticket_id?: string; id: string };
  if (c.ticket_id) return c.ticket_id;
  return 'WA-' + String(conv.id).replace(/-/g, '').slice(0, 8).toUpperCase();
}

const PROSPECT_STATUS_OPTIONS = ['Hot Prospect', 'Warm Prospect', 'Cold Prospect'] as const;

function maskPhoneLast4(phone: string | null | undefined): string {
  if (phone == null || phone === '') return '';
  const s = String(phone).trim();
  if (s.length <= 4) return '****';
  return s.slice(0, -4) + '****';
}

/** Fallback when from_display_name is NULL: humanize local part of email. */
function emailToDisplayLabel(email: string | null | undefined): string {
  if (!email || typeof email !== 'string') return '';
  const local = email.split('@')[0]?.trim() || email;
  if (!local) return email;
  const withSpaces = local.replace(/[._-]+/g, ' ');
  const titleCase = withSpaces.replace(/\b\w/g, (c) => c.toUpperCase());
  return titleCase.trim() || email;
}

function getLeadTitle(conv: LiveChatConversation, t: (key: string, fallback?: string) => string): string {
  if (conv.source === 'email') {
    return conv.from_display_name || emailToDisplayLabel(conv.from_email) || conv.from_email || conv.email_connection_display || 'Email';
  }
  if (conv.source === 'instagram' && !conv.customer_name?.trim()) {
    return t('whatsappInbox.instagramContact', 'Kontak Instagram');
  }
  const customerId = conv.source === 'instagram' ? (conv as { customer_ig_id?: string }).customer_ig_id : (conv as { customer_wa_id?: string }).customer_wa_id;
  return conv.customer_name || (customerId ? maskPhoneLast4(customerId) : '') || 'Unknown';
}

/** Created By display name for auto-created leads: account name or fallback by channel. */
function createdByDisplayName(conv: LiveChatConversation | null): string {
  if (!conv) return 'WhatsApp';
  if (conv.source === 'email') {
    const s = (conv as { email_connection_display?: string }).email_connection_display?.trim();
    return s || 'Email';
  }
  if (conv.source === 'instagram') {
    const s = (conv as { instagram_account_display_name?: string }).instagram_account_display_name?.trim();
    return s || 'Instagram';
  }
  const s = (conv as { whatsapp_account_display_name?: string }).whatsapp_account_display_name?.trim();
  return s || 'WhatsApp';
}

interface LeadStatus {
  id: string;
  name: string;
  color: string;
}

interface LivechatQuickActionPanelProps {
  conversation: LiveChatConversation | null;
  /** When true, hide the lead/customer name row (e.g. when shown in mobile sheet header). */
  hideLeadTitle?: boolean;
}

/** Unified row for display: from email_conversation_follow_up_updates or lead_follow_up_updates (WA, by conversation_id). */
interface FollowUpUpdateRow {
  id: string;
  update_details: string;
  status: string | null;
  created_by_name: string | null;
  created_at: string;
}

export function LivechatQuickActionPanel({ conversation, hideLeadTitle = false }: LivechatQuickActionPanelProps) {
  const { t } = useAppTranslation();
  const queryClient = useQueryClient();
  const { organizationId } = useCurrentOrg();
  const { updateLead, deleteLead } = useLeads();
  const [updateDetails, setUpdateDetails] = useState('');
  const [prospectStatus, setProspectStatus] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFollowUpExpanded, setIsFollowUpExpanded] = useState(true);
  const [isSlaTargetExpanded, setIsSlaTargetExpanded] = useState(true);
  const [selectedServiceName, setSelectedServiceName] = useState<string>('');
  const [selectedCategoryName, setSelectedCategoryName] = useState<string>('');
  const [isUpdatingLead, setIsUpdatingLead] = useState(false);
  const [serviceCategoryDialogOpen, setServiceCategoryDialogOpen] = useState(false);
  const [pendingStatusId, setPendingStatusId] = useState<string | null>(null);
  const [dialogServiceName, setDialogServiceName] = useState<string>('');
  const [dialogCategoryName, setDialogCategoryName] = useState<string>('');
  const [dialogDescription, setDialogDescription] = useState<string>('');
  const { data: rosterAssignees = [] } = useOmnichannelRosterAssignees();

  const { data: servicesList = [] } = useServices();
  const { data: subServicesList = [] } = useSubServices();
  const categoriesForService = selectedServiceName
    ? (() => {
        const svc = servicesList.find((s) => s.name === selectedServiceName);
        return svc ? subServicesList.filter((ss) => ss.service_id === svc.id) : [];
      })()
    : [];
  const dialogCategoriesForService = dialogServiceName
    ? (() => {
        const svc = servicesList.find((s) => s.name === dialogServiceName);
        return svc ? subServicesList.filter((ss) => ss.service_id === svc.id) : [];
      })()
    : [];

  const ticketId = conversation ? getTicketIdForConversation(conversation) : '';
  const { data: leadRow } = useQuery({
    queryKey: ['lead-by-ticket', organizationId, ticketId],
    queryFn: async () => {
      if (!organizationId || !ticketId) return null;
      const { data, error } = await supabase
        .from('leads')
        .select('id, services, category')
        .eq('organization_id', organizationId)
        .ilike('ticket_id', ticketId)
        .maybeSingle();
      if (error) throw error;
      return data as { id: string; services: string | null; category: string | null } | null;
    },
    enabled: !!organizationId && !!ticketId && !!conversation,
  });

  useEffect(() => {
    if (!leadRow) return;
    if (leadRow.services != null && leadRow.services !== '') setSelectedServiceName(leadRow.services);
    else setSelectedServiceName('');
    if (leadRow.category != null && leadRow.category !== '' && leadRow.category !== '-') setSelectedCategoryName(leadRow.category);
    else setSelectedCategoryName('');
  }, [leadRow?.id, leadRow?.services, leadRow?.category]);

  const updateLeadServicesCategory = useCallback(
    async (serviceName: string, categoryName: string) => {
      if (!organizationId || !ticketId) return;
      setIsUpdatingLead(true);
      try {
        if (!leadRow?.id) {
          const clientName = conversation?.source === 'email'
            ? (conversation as { from_display_name?: string; from_email?: string }).from_display_name
              || (conversation as { from_email?: string }).from_email
              || 'Email'
            : conversation?.source === 'instagram'
              ? ((conversation as { customer_name?: string; customer_ig_id?: string }).customer_name
                || (conversation as { customer_ig_id?: string }).customer_ig_id
                || 'Instagram')
              : ((conversation as { customer_name?: string; customer_wa_id?: string }).customer_name
                || (conversation as { customer_wa_id?: string }).customer_wa_id
                || 'WhatsApp');
          const title = (conversation as { last_message_body?: string }).last_message_body?.slice(0, 100) || 'Lead';
          const source = conversation?.source === 'email' ? 'Email' : conversation?.source === 'instagram' ? 'Instagram' : 'WhatsApp';
          // Same as Status dropdown: no organization_id so RLS / shared statuses apply
          const { data: defaultStatusRows } = await supabase
            .from('lead_statuses')
            .select('id')
            .eq('is_active', true)
            .order('sort_order')
            .limit(1);
          const defaultStatusId = defaultStatusRows?.[0]?.id ?? null;
          if (!defaultStatusId) {
            toast.error(t('whatsappInbox.noOpenStatus', 'No lead status found'));
            return;
          }
          const createdByName = createdByDisplayName(conversation);
          const { error: insertErr } = await supabase.from('leads').insert({
            ticket_id: ticketId,
            client: clientName,
            title,
            category: categoryName || '',
            created_by: '00000000-0000-0000-0000-000000000000',
            created_by_name: createdByName,
            assignee: '',
            status_id: defaultStatusId,
            organization_id: organizationId,
            source,
            services: serviceName || null,
            followup: 0,
          });
          if (insertErr) throw insertErr;
        } else {
          const { error: updateErr } = await supabase
            .from('leads')
            .update({
              services: serviceName || null,
              category: categoryName || '',
              updated_at: new Date().toISOString(),
            })
            .eq('id', leadRow.id);
          if (updateErr) throw updateErr;
        }
        queryClient.invalidateQueries({ queryKey: ['leads'] });
        queryClient.invalidateQueries({ queryKey: ['lead-by-ticket', organizationId, ticketId] });
        toast.success(t('whatsappInbox.serviceCategorySaved', 'Service and category saved'));
      } catch (err) {
        devLog.error('Update lead services/category:', err);
        toast.error(t('whatsappInbox.serviceCategorySaveFailed', 'Failed to save service and category'));
      } finally {
        setIsUpdatingLead(false);
      }
    },
    [organizationId, ticketId, leadRow?.id, conversation, queryClient, t]
  );

  const handleServiceChange = (value: string) => {
    setSelectedServiceName(value);
    setSelectedCategoryName('');
  };

  const handleCategoryChange = (value: string) => {
    setSelectedCategoryName(value);
    // For email without a lead, do not create lead on category pick; only when user clicks "Mark as lead"
    const isEmailNoLead = conversation?.source === 'email' && !leadRow?.id;
    if (value && selectedServiceName && !isEmailNoLead) {
      updateLeadServicesCategory(selectedServiceName, value);
    }
  };

  const handleMarkAsLead = useCallback(async () => {
    if (!organizationId || !ticketId || !conversation || conversation.source !== 'email') return;
    if (!selectedServiceName?.trim() || !selectedCategoryName?.trim()) return;
    setIsMarkUnmarkLeadLoading(true);
    try {
      const clientName = (conversation as { from_display_name?: string; from_email?: string }).from_display_name
        || (conversation as { from_email?: string }).from_email
        || 'Email';
      const title = (conversation as { last_message_body?: string }).last_message_body?.slice(0, 100) || 'Email';
      // Same query as Status dropdown: no organization_id so RLS / shared statuses apply
      const { data: defaultStatusRows } = await supabase
        .from('lead_statuses')
        .select('id')
        .eq('is_active', true)
        .order('sort_order')
        .limit(1);
      const defaultStatusId = defaultStatusRows?.[0]?.id ?? null;
      if (!defaultStatusId) {
        toast.error(t('whatsappInbox.noOpenStatus', 'No lead status found'));
        return;
      }
      const createdByName = createdByDisplayName(conversation);
      const { error: insertErr } = await supabase.from('leads').insert({
        ticket_id: ticketId,
        client: clientName,
        title,
        category: selectedCategoryName || '',
        created_by: '00000000-0000-0000-0000-000000000000',
        created_by_name: createdByName,
        assignee: '',
        status_id: defaultStatusId,
        organization_id: organizationId,
        source: 'Email',
        services: selectedServiceName || null,
        followup: 0,
      });
      if (insertErr) throw insertErr;
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['lead-by-ticket', organizationId, ticketId] });
      toast.success(t('whatsappInbox.serviceCategorySaved', 'Service and category saved'));
    } catch (err) {
      devLog.error('Mark as lead:', err);
      toast.error(t('whatsappInbox.serviceCategorySaveFailed', 'Failed to save service and category'));
    } finally {
      setIsMarkUnmarkLeadLoading(false);
    }
  }, [organizationId, ticketId, conversation, selectedServiceName, selectedCategoryName, queryClient, t]);

  const handleUnmarkAsLead = useCallback(async () => {
    if (!leadRow?.id) return;
    setIsMarkUnmarkLeadLoading(true);
    try {
      await deleteLead(leadRow.id);
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['lead-by-ticket', organizationId, ticketId] });
      toast.success(t('whatsappInbox.serviceCategorySaved', 'Service and category saved'));
    } catch (err) {
      devLog.error('Unmark as lead:', err);
      toast.error(t('whatsappInbox.serviceCategorySaveFailed', 'Failed to save service and category'));
    } finally {
      setIsMarkUnmarkLeadLoading(false);
    }
  }, [leadRow?.id, organizationId, ticketId, deleteLead, queryClient, t]);

  // Query org-scoped (sesuai referensi), lalu fallback ke query global livechat saat org belum siap.
  const { data: orgScopedLeadStatuses = [] } = useQuery({
    queryKey: ['lead-statuses', organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const q = supabase
        .from('lead_statuses')
        .select('id, name, color')
        .eq('is_active', true)
        .order('sort_order');
      // Filter by current org so dropdown only shows this org's statuses (and value from conversation matches)
      if (organizationId) {
        q.or(`organization_id.eq.${organizationId},organization_id.is.null`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as LeadStatus[];
    },
  });
  const { data: globalLeadStatuses = [] } = useQuery({
    queryKey: ['lead-statuses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lead_statuses')
        .select('id, name, color')
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      return (data ?? []) as LeadStatus[];
    },
    staleTime: 60_000,
  });
  const leadStatuses = useMemo(
    () => (orgScopedLeadStatuses.length > 0 ? orgScopedLeadStatuses : globalLeadStatuses),
    [orgScopedLeadStatuses, globalLeadStatuses]
  );

  const isEmail = conversation?.source === 'email';
  const isInstagram = conversation?.source === 'instagram';
  const isWhatsApp = conversation?.source === 'whatsapp';
  const statusTable = isEmail ? 'email_conversations' : isInstagram ? 'instagram_conversations' : 'whatsapp_conversations';
  const statusQueryKeyBase = isEmail ? 'email-conversation-status' : isInstagram ? 'instagram-conversation-status' : 'whatsapp-conversation-status';
  const { data: conversationStatusRow, isLoading: statusLoading } = useQuery({
    queryKey: [statusQueryKeyBase, conversation?.id],
    queryFn: async () => {
      if (!conversation?.id) return null;
      const { data, error } = await supabase
        .from(statusTable)
        .select('lead_status_id, last_inbound_at, created_at, assignee_id')
        .eq('id', conversation.id)
        .maybeSingle();
      if (error) throw error;
      return data as { lead_status_id?: string; last_inbound_at?: string | null; created_at?: string; assignee_id?: string | null } | null;
    },
    enabled: !!conversation?.id,
    refetchInterval: 5000,
  });
  const conversationStatusId = conversationStatusRow?.lead_status_id ?? null;
  const lastInboundAt = conversationStatusRow?.last_inbound_at ?? null;
  const conversationCreatedAt = conversationStatusRow?.created_at ?? null;
  const conversationAssigneeId =
    (conversationStatusRow as { assignee_id?: string | null } | null)?.assignee_id ?? null;

  const { data: followUpUpdates = [], refetch: refetchFollowUps } = useQuery({
    queryKey: [isEmail ? 'email-conversation-follow-ups' : 'wa-lead-follow-up-updates', conversation?.id],
    queryFn: async (): Promise<FollowUpUpdateRow[]> => {
      if (!conversation?.id) return [];
      if (isEmail) {
        const { data, error } = await supabase
          .from('email_conversation_follow_up_updates')
          .select('id, update_details, status, created_by_name, created_at')
          .eq('conversation_id', conversation.id)
          .order('created_at', { ascending: false });
        if (error) throw error;
        return (data ?? []).map((r) => ({
          id: r.id,
          update_details: r.update_details ?? '',
          status: r.status ?? null,
          created_by_name: r.created_by_name ?? null,
          created_at: r.created_at ?? '',
        }));
      }
      const { data, error } = await supabase
        .from('lead_follow_up_updates')
        .select('id, update_details, status, created_by_name, created_at')
        .eq('conversation_id', conversation.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        id: r.id,
        update_details: r.update_details ?? '',
        status: r.status ?? null,
        created_by_name: r.created_by_name ?? null,
        created_at: r.created_at ?? '',
      }));
    },
    enabled: !!conversation?.id,
  });


  const syncFollowUpCountAndPriority = useCallback(async () => {
    if (!conversation?.id || !organizationId) return;
    let allUpdates: Array<{ status?: string | null }> = [];
    if (isEmail) {
      const { data, error: fetchError } = await supabase
        .from('email_conversation_follow_up_updates')
        .select('status')
        .eq('conversation_id', conversation.id);
      if (fetchError) return;
      allUpdates = data ?? [];
    } else {
      const { data, error: fetchError } = await supabase
        .from('lead_follow_up_updates')
        .select('status')
        .eq('conversation_id', conversation.id);
      if (fetchError) return;
      allUpdates = data ?? [];
    }
    const { followupCount, fuPriority } = computeFollowUpAndPriority(allUpdates);
    await supabase
      .from(statusTable)
      .update({ followup: followupCount, fu_priority: fuPriority, updated_at: new Date().toISOString() })
      .eq('id', conversation.id);
    queryClient.invalidateQueries({ queryKey: ['leads', organizationId] });
  }, [conversation?.id, organizationId, queryClient, statusTable, isEmail]);

  // Derived values used by hooks below — must be before any conditional return so hook order is stable
  const leadId = conversation ? (conversation.source === 'email' ? `email-${conversation.id}` : `wa-${conversation.id}`) : '';
  const leadTitle = conversation ? getLeadTitle(conversation, t) : '';
  // Only use a status id that exists in leadStatuses so Select stays controlled and we never send invalid FK
  const currentStatusId = (() => {
    const fromConv = conversationStatusId ?? '';
    if (fromConv && leadStatuses.some((s) => s.id === fromConv)) return fromConv;
    return leadStatuses.length > 0 ? leadStatuses[0].id : '';
  })();
  const currentStatus = leadStatuses.find((s) => s.id === currentStatusId);
  const isResolved = isResolvedStatus(currentStatus?.name ?? null);
  const outside24h =
    (isWhatsApp || isInstagram) &&
    isOutside24hWindow(lastInboundAt, conversationCreatedAt);
  const effectiveResolved = isResolved || outside24h;
  const closedStatus = leadStatuses.find((s) => isResolvedStatus(s.name));
  const displayStatusId = effectiveResolved && closedStatus ? closedStatus.id : currentStatusId;
  const statusQueryKey = statusQueryKeyBase;

  const handleAddUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!conversation?.id || !updateDetails.trim() || !prospectStatus) return;
    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      const { data: profile } = await supabase
        .from('profiles')
        .select('active_organization_id, full_name')
        .eq('user_id', user.id)
        .single();
      const orgId = profile?.active_organization_id;
      if (!orgId) throw new Error('No active organization');
      if (isEmail) {
        const { error } = await supabase.from('email_conversation_follow_up_updates').insert({
          conversation_id: conversation.id,
          update_details: updateDetails.trim(),
          status: prospectStatus || null,
          created_by: user.id,
          created_by_name: profile?.full_name || user.email || 'Unknown',
          organization_id: orgId,
        });
        if (error) throw error;
      } else {
        let leadUuid = leadRow?.id;
        if (!leadUuid) {
          const { data: leadByTicket } = await supabase
            .from('leads')
            .select('id')
            .eq('ticket_id', ticketId)
            .eq('organization_id', orgId)
            .maybeSingle();
          leadUuid = leadByTicket?.id ?? null;
        }
        if (!leadUuid) {
          toast.error(t('whatsappInbox.saveServiceCategoryFirst', 'Save service and category first to link this conversation to a lead.'));
          return;
        }
        const { error } = await supabase.from('lead_follow_up_updates').insert({
          lead_id: leadUuid,
          conversation_id: conversation.id,
          update_details: updateDetails.trim(),
          status: prospectStatus || null,
          created_by: user.id,
          created_by_name: profile?.full_name || user.email || 'Unknown',
          organization_id: orgId,
        });
        if (error) throw error;
      }
      await syncFollowUpCountAndPriority();
      await refetchFollowUps();
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success(t('whatsappInbox.followUpAdded', 'Follow-up update added successfully'));
      setUpdateDetails('');
      setProspectStatus('');
    } catch (err) {
      devLog.error('Error adding follow-up update:', err);
      toast.error(t('whatsappInbox.followUpAddFailed', 'Failed to add follow-up update'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!conversation) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <p className="text-sm text-gray-500">
          {t('whatsappInbox.quickActionSelectConversation', 'Select a conversation to see quick actions')}
        </p>
      </div>
    );
  }

  const applyStatusChange = async (newStatusId: string, conversionDescription?: string) => {
    const newStatus = leadStatuses.find((s) => s.id === newStatusId);
    const isResolve = isResolvedStatus(newStatus?.name ?? null);
    if (isResolve) {
      const confirmed = window.confirm(t('leadsManagement.confirmResolve', 'Yakin ingin mengubah status menjadi Resolve? Chat outbound akan diblokir sampai ada pesan masuk baru dari customer.'));
      if (!confirmed) return;
    }
    const oldStatusName = currentStatus?.name ?? null;
    try {
      // Use real lead UUID when available so mutation updates the correct row; pass conversation id to sync conversation status
      const idToUse = leadRow?.id ?? leadId;
      await updateLead({
        id: idToUse,
        status_id: newStatusId,
        organization_id: conversation.organization_id,
        lead_status: oldStatusName ? { name: oldStatusName } : undefined,
        conversionDescription,
        ...(leadRow?.id && { whatsapp_conversation_id: conversation.id }),
      });
      queryClient.setQueryData([statusQueryKeyBase, conversation.id], (prev: unknown) => {
        const base =
          prev &&
          typeof prev === 'object' &&
          prev !== null &&
          'lead_status_id' in (prev as Record<string, unknown>)
            ? (prev as {
                lead_status_id?: string | null;
                last_inbound_at?: string | null;
                created_at?: string | null;
                assignee_id?: string | null;
              })
            : {};
        return {
          ...base,
          lead_status_id: newStatusId,
          last_inbound_at: lastInboundAt,
          created_at: conversationCreatedAt,
        };
      });
      await queryClient.invalidateQueries({ queryKey: [statusQueryKey, conversation.id] });
      await queryClient.invalidateQueries({ queryKey: ['leads'], refetchType: 'active' });
      await queryClient.invalidateQueries({ queryKey: ['lead-by-ticket', organizationId, ticketId] });
      await queryClient.invalidateQueries({ queryKey: ['crm-first-response-per-room', organizationId] });
      await queryClient.invalidateQueries({ queryKey: ['crm-sla-conversation', organizationId] });
      toast.success(t('whatsappInbox.statusUpdated', 'Status updated'));
    } catch (err) {
      devLog.error('Failed to update lead status:', err);
      toast.error(t('whatsappInbox.statusUpdateFailed', 'Failed to update status'));
    }
  };

  const handleStatusChange = async (newStatusId: string) => {
    const newStatus = leadStatuses.find((s) => s.id === newStatusId);
    const newStatusNameNorm = (newStatus?.name ?? '').trim().toLowerCase();
    const isConverted = newStatusNameNorm === 'converted';
    const isResolve = isResolvedStatus(newStatus?.name ?? null);

    if (isConverted) {
      setPendingStatusId(newStatusId);
      setDialogServiceName(selectedServiceName || '');
      setDialogCategoryName(selectedCategoryName || '');
      setDialogDescription('');
      setServiceCategoryDialogOpen(true);
      return;
    }
    if (isResolve) {
      const hasService = !!selectedServiceName?.trim();
      const hasCategory = !!selectedCategoryName?.trim();
      if (!hasService || !hasCategory) {
        setPendingStatusId(newStatusId);
        setDialogServiceName(selectedServiceName || '');
        setDialogCategoryName(selectedCategoryName || '');
        setDialogDescription('');
        setServiceCategoryDialogOpen(true);
        return;
      }
    }

    await applyStatusChange(newStatusId);
  };

  const isPendingConverted = pendingStatusId != null && (leadStatuses.find((s) => s.id === pendingStatusId)?.name ?? '').trim().toLowerCase() === 'converted';

  const handleServiceCategoryDialogSave = async () => {
    const svc = dialogServiceName?.trim();
    const cat = dialogCategoryName?.trim();
    if (!svc || !cat) {
      toast.error(t('whatsappInbox.fillServiceAndCategoryFirst', 'Pilih Layanan dan Kategori terlebih dahulu sebelum mengubah status ke Converted atau Resolve.'));
      return;
    }
    if (isPendingConverted && !dialogDescription.trim()) {
      toast.error(t('whatsappInbox.fillDescriptionFirst', 'Please fill Description before continuing.'));
      return;
    }
    const idToApply = pendingStatusId;
    const descriptionToPass = isPendingConverted ? dialogDescription.trim() : undefined;
    setServiceCategoryDialogOpen(false);
    setPendingStatusId(null);
    setDialogDescription('');
    await updateLeadServicesCategory(svc, cat);
    setSelectedServiceName(svc);
    setSelectedCategoryName(cat);
    if (idToApply) await applyStatusChange(idToApply, descriptionToPass);
  };

  return (
    <div className="space-y-3">
      {!hideLeadTitle && (
        <p className="text-xs text-gray-500 truncate" title={leadTitle}>
          {leadTitle}
        </p>
      )}

      {/* Popup: Pilih Layanan dan Kategori sebelum Converted/Resolve */}
      <Dialog open={serviceCategoryDialogOpen} onOpenChange={(open) => { setServiceCategoryDialogOpen(open); if (!open) { setPendingStatusId(null); setDialogDescription(''); } }}>
        <DialogContent className="sm:max-w-md" hideCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                <AlertCircle className="h-4 w-4" />
              </span>
              {t('whatsappInbox.selectServiceAndCategory', 'Pilih Layanan dan Kategori')}
            </DialogTitle>
            <DialogDescription>
              {t('whatsappInbox.fillServiceAndCategoryFirst', 'Pilih Layanan dan Kategori terlebih dahulu sebelum mengubah status ke Converted atau Resolve.')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                {t('whatsappInbox.service', 'Layanan')}
              </label>
              <Select
                value={dialogServiceName || undefined}
                onValueChange={(v) => { setDialogServiceName(v); setDialogCategoryName(''); }}
              >
                <SelectTrigger className="w-full bg-white border-gray-200">
                  <SelectValue placeholder={t('whatsappInbox.selectService', 'Pilih layanan')} />
                </SelectTrigger>
                <SelectContent>
                  {servicesList.map((s) => (
                    <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                {t('whatsappInbox.category', 'Kategori')}
              </label>
              <Select
                value={dialogCategoryName || undefined}
                onValueChange={setDialogCategoryName}
                disabled={!dialogServiceName}
              >
                <SelectTrigger className="w-full bg-white border-gray-200">
                  <SelectValue
                    placeholder={
                      dialogServiceName
                        ? t('whatsappInbox.selectCategory', 'Select category')
                        : t('whatsappInbox.selectServiceFirst', 'Select service first')
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {dialogCategoriesForService.map((ss) => (
                    <SelectItem key={ss.id} value={ss.name}>{ss.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {isPendingConverted && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  {t('whatsappInbox.description', 'Description')} <span className="text-red-500">*</span>
                </label>
                <Textarea
                  value={dialogDescription}
                  onChange={(e) => setDialogDescription(e.target.value)}
                  placeholder={t('whatsappInbox.descriptionPlaceholder', 'Activity / order description...')}
                  className="min-h-[80px] resize-none text-sm bg-white border-gray-200"
                  required
                />
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => { setServiceCategoryDialogOpen(false); setPendingStatusId(null); setDialogDescription(''); }}
            >
              {t('whatsappInbox.cancel', 'Batal')}
            </Button>
            <Button
              type="button"
              onClick={handleServiceCategoryDialogSave}
              disabled={!dialogServiceName?.trim() || !dialogCategoryName?.trim() || (isPendingConverted && !dialogDescription.trim())}
            >
              {t('whatsappInbox.saveAndContinue', 'Simpan dan lanjutkan')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Service and Category dropdowns */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-gray-600 block">
          {t('whatsappInbox.service', 'Service')}
        </label>
        <Select value={selectedServiceName || undefined} onValueChange={handleServiceChange} disabled={isUpdatingLead}>
          <SelectTrigger className="w-full text-sm bg-white border-gray-200 h-9">
            <SelectValue placeholder={t('whatsappInbox.selectService', 'Select service')} />
          </SelectTrigger>
          <SelectContent>
            {servicesList.map((s) => (
              <SelectItem key={s.id} value={s.name}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="text-xs font-medium text-gray-600 block">
          {t('whatsappInbox.category', 'Category')}
        </label>
        <Select
          value={selectedCategoryName || undefined}
          onValueChange={handleCategoryChange}
          disabled={!selectedServiceName || isUpdatingLead}
        >
          <SelectTrigger className="w-full text-sm bg-white border-gray-200 h-9">
            <SelectValue
              placeholder={
                selectedServiceName
                  ? t('whatsappInbox.selectCategory', 'Select category')
                  : t('whatsappInbox.selectServiceFirst', 'Select service first')
              }
            />
          </SelectTrigger>
          <SelectContent>
            {categoriesForService.map((ss) => (
              <SelectItem key={ss.id} value={ss.name}>
                {ss.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Email only: Mark as lead / Unmark as lead in Quick Action */}
      {isEmail && (
        <div className="space-y-2">
          {leadRow?.id ? (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={isMarkUnmarkLeadLoading}
              onClick={handleUnmarkAsLead}
            >
              {isMarkUnmarkLeadLoading ? '...' : t('whatsappInbox.unmarkAsLead', 'Unmark as lead')}
            </Button>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="block w-full">
                  <Button
                    type="button"
                    className="w-full"
                    disabled={!selectedServiceName?.trim() || !selectedCategoryName?.trim() || isMarkUnmarkLeadLoading}
                    onClick={handleMarkAsLead}
                  >
                    {isMarkUnmarkLeadLoading ? '...' : t('whatsappInbox.markAsLead', 'Mark as lead')}
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t('whatsappInbox.markAsLeadRequireServiceCategory', 'Select Service and Category first.')}</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      )}

      {/* Update Follow Up - expand/collapse */}
      <div className="rounded-lg border border-gray-200 bg-slate-50/80 shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => !effectiveResolved && setIsFollowUpExpanded((v) => !v)}
          disabled={effectiveResolved}
          className="w-full flex items-center justify-between gap-2 p-3 text-left hover:bg-slate-100/80 transition-colors rounded-t-lg disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-slate-50/80"
          aria-expanded={isFollowUpExpanded}
          title={effectiveResolved ? t('whatsappInbox.chatResolvedNoActions', 'Chat sudah di-resolve') : (isFollowUpExpanded ? t('whatsappInbox.clickToCollapse', 'Click to collapse') : t('whatsappInbox.clickToExpand', 'Click to expand'))}
        >
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
              <Plus className="w-3 h-3 text-white" />
            </div>
            <span className="text-sm font-medium text-gray-800">{t('whatsappInbox.addProgressUpdate', 'Add Progress Update')}</span>
          </div>
          {isFollowUpExpanded ? (
            <ChevronUp className="w-4 h-4 text-gray-500 shrink-0" aria-hidden />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-500 shrink-0" aria-hidden />
          )}
        </button>
        {isFollowUpExpanded && (
        <div className="p-3 pt-0 space-y-3 border-t border-gray-200">
          <form onSubmit={handleAddUpdate} className="space-y-2">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">
                {t('whatsappInbox.updateDetails', 'Update Details')}
              </label>
              <Textarea
                value={updateDetails}
                onChange={(e) => setUpdateDetails(e.target.value)}
                placeholder={t('whatsappInbox.updateDetailsPlaceholder', '')}
                className="min-h-[72px] resize-none text-sm bg-white border-gray-200"
                required
                disabled={effectiveResolved}
              />
            </div>
            <div className="flex gap-2 items-end">
              <div className="flex-1 min-w-0">
                <label className="text-xs font-medium text-gray-600 block mb-1">
                  {t('whatsappInbox.prospectStatus', 'Prospect Status')} <span className="text-red-500">*</span>
                </label>
                <Select value={prospectStatus} onValueChange={setProspectStatus} required>
                  <SelectTrigger className="w-full text-sm bg-white border-gray-200" disabled={effectiveResolved}>
                    <SelectValue placeholder={t('whatsappInbox.selectProspectStatus', 'Select prospect status...')} />
                  </SelectTrigger>
                  <SelectContent>
                    {PROSPECT_STATUS_OPTIONS.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="submit"
                size="sm"
                disabled={effectiveResolved || isSubmitting || !updateDetails.trim() || !prospectStatus}
                className="shrink-0 h-10"
              >
                {isSubmitting ? t('whatsappInbox.adding', 'Adding...') : t('whatsappInbox.addUpdate', 'Add Update')}
              </Button>
            </div>
          </form>

          {/* Update History - bagian dari wrapper yang sama */}
          <div className="pt-2 border-t border-gray-200">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Clock className="w-3.5 h-3.5 text-gray-500" />
              <span className="text-xs font-medium text-gray-600">
                {t('whatsappInbox.updateHistory', 'Update History')} ({followUpUpdates.length})
              </span>
            </div>
            <div
              className="scrollbar-hide seamless-scroll nested-scroll-touch-chain h-[140px] overflow-y-auto overflow-x-hidden rounded border border-gray-200 bg-white/80 p-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {followUpUpdates.length === 0 ? (
                <div className="text-center py-4 text-gray-500 text-xs">
                  <p>{t('whatsappInbox.noUpdatesYet', 'No updates yet.')}</p>
                  <p className="mt-0.5">{t('whatsappInbox.initialDiscussionCreated', 'Initial discussion point created')}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {followUpUpdates.map((u) => (
                    <div
                      key={u.id}
                      className="flex gap-2 text-xs rounded-md border border-gray-200 bg-white/60 p-2"
                    >
                      <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                        <User className="w-3 h-3 text-gray-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-medium text-gray-800">{u.created_by_name || '—'}</span>
                          {u.status && (
                            <span className="px-1.5 py-0.5 rounded border border-gray-200 bg-white text-gray-600">
                              {u.status}
                            </span>
                          )}
                          <span className="text-gray-400">{format(new Date(u.created_at), 'MMM dd, HH:mm')}</span>
                        </div>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <p
                              className="text-gray-700 whitespace-pre-wrap mt-0.5 line-clamp-2 break-words cursor-help"
                              title=""
                            >
                              {u.update_details}
                            </p>
                          </TooltipTrigger>
                          <TooltipContent
                            side="top"
                            className="scrollbar-hide seamless-scroll nested-scroll-touch-chain max-h-[200px] max-w-[280px] overflow-y-auto overflow-x-hidden whitespace-pre-wrap text-left [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                          >
                            {u.update_details}
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        )}
      </div>

      {/* Assignee: read-only; ubah assignee hanya dari Leads Management */}
      <div className="space-y-1.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="w-full">
              <label className="text-xs font-medium text-gray-600">
                {t('whatsappInbox.assignee', 'Assignee')}
              </label>
              <Select
                value={conversationAssigneeId ?? 'none'}
                onValueChange={() => {}}
                disabled
              >
                <SelectTrigger
                  className="w-full text-sm bg-muted/50 border-gray-200 h-9 cursor-not-allowed opacity-90"
                  aria-disabled
                >
                  <SelectValue placeholder={t('whatsappInbox.assignee', 'Assignee')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('whatsappInbox.assigneeNone', 'Unassigned')}</SelectItem>
                  {rosterAssignees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.full_name || e.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[220px] text-xs">
            {t('whatsappInbox.assigneeReadOnlyHint', 'Assignee is managed in Leads Management.')}
          </TooltipContent>
        </Tooltip>
      </div>

      {/* SLA Target — informasi; hitung mundur SLA mengikuti kebijakan org setelah assignee */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <button
          type="button"
          onClick={() => setIsSlaTargetExpanded((v) => !v)}
          className="flex w-full items-center justify-between gap-2 p-3 text-left transition-colors hover:bg-gray-50/80"
          aria-expanded={isSlaTargetExpanded}
          title={
            isSlaTargetExpanded
              ? t('whatsappInbox.clickToCollapse', 'Click to collapse')
              : t('whatsappInbox.clickToExpand', 'Click to expand')
          }
        >
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {isSlaTargetExpanded ? (
              <ChevronUp className="h-4 w-4 shrink-0 text-gray-500" aria-hidden />
            ) : (
              <ChevronDown className="h-4 w-4 shrink-0 text-gray-500" aria-hidden />
            )}
            <span className="text-sm font-semibold text-gray-900">
              {t('whatsappInbox.slaTargetTitle', 'SLA Target')}
            </span>
          </div>
        </button>
        {isSlaTargetExpanded ? (
          <LivechatSlaTargetPanel
            organizationId={organizationId}
            conversation={conversation}
            chatResolved={effectiveResolved}
          />
        ) : null}
      </div>

      {/* Status - kode sama dengan leads-management (LeadStatusSelect); when outside 24h show Resolve and disable */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-gray-600">
          {t('whatsappInbox.status', 'Status')}
        </label>
        <LeadStatusSelect
          value={displayStatusId || undefined}
          onValueChange={handleStatusChange}
          leadStatuses={leadStatuses}
          currentStatusName={effectiveResolved ? (closedStatus?.name ?? '') : (currentStatus?.name ?? '')}
          disabled={effectiveResolved}
          triggerClassName="w-full text-sm border rounded-lg font-medium"
          isLoading={statusLoading}
        />
      </div>
    </div>
  );
}
