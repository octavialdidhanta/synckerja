import React, { useState, useCallback, useEffect, useMemo, useRef, lazy, Suspense } from 'react';
import { Capacitor } from '@capacitor/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Textarea } from '@/shared/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogFormScrollArea,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { useIsMobile } from '@/mobile/shared/hooks/use-mobile';
import { cn } from '@/shared/lib/utils';
import { useVisualViewport } from '@/shared/hooks/useVisualViewport';
import { useCapacitorKeyboardInset } from '@/shared/native/useCapacitorKeyboardInset';
import {
  getSalesActivityIdFromUpdateLeadResult,
  useLeadConversionSalesActivity,
  useLeads,
} from '@/shared/hooks/organized/sales';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useCurrentUser } from '@/shared/hooks/useCurrentUser';
import { useCentralizedUserData } from '@/shared/auth/contexts/CentralizedUserDataContext';
import {
  canSendAsActiveAssignee,
  getAssigneeActionBlockReason,
  isAssignedToOtherAgent,
  readConversationAssigneeIdFromQueryCache,
} from '../../utils/assigneeSendGate';
import { useOmnichannelRosterAssignees } from '@/shared/hooks/useOrganizationOmnichannelStaff';
import { LeadStatusSelect } from '@/5-1-leads-management/components/LeadStatusSelect';
import { getLeadStatusDisplayName } from '@/5-1-leads-management/utils/leadStatusDisplay';
import { useServices } from '@/6-1-product-knowledge/hooks/useServices';
import { useSubServices } from '@/6-1-product-knowledge/hooks/useSubServices';
import { supabase } from '@/shared/lib/supabaseClient';
import { LEAD_CONVERSION_CATALOG_KIND } from '@/8-2-1-default-prices/lib/catalogKind';
import { devLog } from '@/shared/lib/logger';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { Plus, User, Clock, ChevronDown, ChevronUp, AlertCircle, Receipt } from 'lucide-react';
import { format } from 'date-fns';
import type {
  EmailConversation,
  InstagramConversation,
  LiveChatConversation,
  WhatsAppConversation,
} from '../../types';
import { LivechatSlaTargetPanel } from '@/5-3-whatsapp/components/inbox/LivechatSlaTargetPanel';
import { useEnsureLivechatLeadStatuses } from '@/5-3-whatsapp/hooks/useEnsureLivechatLeadStatuses';
import { isOutboundBlockedForLivechat, isResolvedStatus, isUnreadLeadStatus } from '../../constants/leadStatus';
import { computeFollowUpAndPriority } from '@/5-1-leads-management/utils/fuPriorityFromUpdates';
import { kickSurveyDispatchAfterResolve } from '@/features/customer-survey/utils/kickSurveyDispatchAfterResolve';
import { usePublishLivechatResolveActions } from './livechatResolveBridge';
import type { LivechatResolveActionsSnapshot } from './livechatResolveBridge';
import { LivechatConversionDraftSection } from '@/5-3-whatsapp/components/inbox/LivechatConversionDraftSection';
import { LivechatConversionFinancialSection } from '@/5-3-whatsapp/components/inbox/LivechatConversionFinancialSection';
import {
  buildConversionItemsPayload,
  createEmptyConversionDraftLine,
  isConversionDraftValid,
  isConversionFinancialValid,
  isServiceCategoryPairValid,
  parseDownPaymentAmount,
  type ConversionDraftLine,
  type ConversionPaymentKindUi,
} from '@/5-3-whatsapp/utils/livechatConversionValidation';
import type { ConversionLeadPaymentPayload } from '@/shared/lib/leadConversionFinancial';
import {
  formatOmnichannelBankCopyText,
  formatOmnichannelBankLabel,
  useOmnichannelIncomeBankAccount,
} from '@/shared/hooks/finance/useOmnichannelIncomeBankAccount';
import {
  assertLeadSubmissionEmailSaved,
  fetchLeadSubmissionForProfile,
  getLeadSubmissionEmailForLead,
  isLeadSubmissionEmailPresent,
  isLeadSubmissionFormIdRequiredError,
  isLeadSubmissionProfileSaveError,
  isLeadSubmissionWebIdRequiredError,
  isResolveEmailRequiredError,
  isValidResolveEmailFormat,
  upsertLeadSubmissionEmailForResolve,
} from '@/shared/lib/leadSubmissionProfile';

const PaymentUpdateModal = lazy(() =>
  import('@/5-2-jadwal-kunjungan/components/PaymentUpdateModal').then((m) => ({
    default: m.PaymentUpdateModal,
  })),
);

const MobileLivechatPaymentHistoryModal = lazy(() =>
  import('@/mobile/4-livechat/components/MobileLivechatPaymentHistoryModal').then((m) => ({
    default: m.MobileLivechatPaymentHistoryModal,
  })),
);

type ApplyStatusChangeResult = { ok: boolean; salesActivityId?: string };

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
  if (conv.source === 'facebook') {
    const c = conv as { ticket_id?: string; id: string };
    if (c.ticket_id) return c.ticket_id;
    return 'FB-' + String(conv.id).replace(/-/g, '').slice(0, 8).toUpperCase();
  }
  const c = conv as { ticket_id?: string; id: string };
  if (c.ticket_id) return c.ticket_id;
  return 'WA-' + String(conv.id).replace(/-/g, '').slice(0, 8).toUpperCase();
}

const PROSPECT_STATUS_OPTIONS = ['Hot Prospect', 'Warm Prospect', 'Cold Prospect'] as const;

type ResolvePrerequisite = 'service' | 'category' | 'update' | 'prospect' | 'email';

function isProspectStatusValue(status: string | null | undefined): boolean {
  if (!status?.trim()) return false;
  return PROSPECT_STATUS_OPTIONS.some((opt) => opt === status.trim());
}

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
  if (conv.source === 'facebook' && !conv.customer_name?.trim()) {
    return t('livechat.messengerContact', 'Kontak Messenger');
  }
  const customerId =
    conv.source === 'instagram'
      ? (conv as { customer_ig_id?: string }).customer_ig_id
      : conv.source === 'facebook'
        ? (conv as { customer_psid?: string }).customer_psid
        : (conv as { customer_wa_id?: string }).customer_wa_id;
  return conv.customer_name || (customerId ? maskPhoneLast4(customerId) : '') || 'Unknown';
}

/** Subtitle under lead name in Quick Action header (masked phone / email). */
function getLeadSubtitle(conv: LiveChatConversation): string | null {
  if (conv.source === 'email') {
    const email = (conv as { from_email?: string }).from_email?.trim();
    return email || null;
  }
  const customerId =
    conv.source === 'instagram'
      ? (conv as { customer_ig_id?: string }).customer_ig_id
      : conv.source === 'facebook'
        ? (conv as { customer_psid?: string }).customer_psid
        : (conv as { customer_wa_id?: string }).customer_wa_id;
  if (!customerId) return null;
  return maskPhoneLast4(customerId);
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
  if (conv.source === 'facebook') {
    const s = (conv as { facebook_page_display_name?: string }).facebook_page_display_name?.trim();
    return s || 'Messenger';
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
  /** Mobile livechat shell: fullscreen payment history modal instead of desktop dialog. */
  useMobilePaymentHistoryShell?: boolean;
}

/** Unified row for display: from email_conversation_follow_up_updates or lead_follow_up_updates (WA, by conversation_id). */
interface FollowUpUpdateRow {
  id: string;
  update_details: string;
  status: string | null;
  created_by_name: string | null;
  created_at: string;
}

/** Polling `*_conversations` + optional seed from inbox row so status never flashes empty while React Query is pending. */
interface ConversationStatusSnapshot {
  lead_status_id?: string | null;
  last_inbound_at?: string | null;
  created_at?: string | null;
  assignee_id?: string | null;
  meta_session_expires_at?: string | null;
}

export function LivechatQuickActionPanel({
  conversation,
  hideLeadTitle = false,
  useMobilePaymentHistoryShell = false,
}: LivechatQuickActionPanelProps) {
  const isMobile = useIsMobile();
  const { height: visualViewportHeight, offsetTop: visualViewportOffsetTop, isKeyboardShellOpen } =
    useVisualViewport();
  const { keyboardHeightPx } = useCapacitorKeyboardInset();
  const serviceCategoryDialogScrollRef = useRef<HTMLDivElement>(null);
  const { t } = useAppTranslation();
  const queryClient = useQueryClient();
  const { organizationId } = useCurrentOrg();
  const { omnichannelBank, loading: omnichannelBankLoading } = useOmnichannelIncomeBankAccount();
  const omnichannelBankLabel = useMemo(
    () => (omnichannelBank ? formatOmnichannelBankLabel(omnichannelBank) : null),
    [omnichannelBank],
  );
  const omnichannelBankCopyText = useMemo(() => {
    if (!omnichannelBank) return null;
    const text = formatOmnichannelBankCopyText(omnichannelBank, {
      header: t('whatsappInbox.conversionBankCopyHeader', 'Payment transfer details:'),
      bankLinePrefix: t('whatsappInbox.conversionBankCopyBankLine', 'Bank:'),
      onBehalf: t('whatsappInbox.conversionBankCopyOnBehalf', 'a.n'),
    });
    const hasDetail =
      !!omnichannelBank.bank_name?.trim() || !!omnichannelBank.account_number?.trim();
    return hasDetail ? text : null;
  }, [omnichannelBank, t]);
  const { user: currentUser } = useCurrentUser();
  const { employee } = useCentralizedUserData();
  const currentEmployeeId = employee?.id ?? null;
  const { updateLead, deleteLead } = useLeads();
  const [updateDetails, setUpdateDetails] = useState('');
  const [prospectStatus, setProspectStatus] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFollowUpExpanded, setIsFollowUpExpanded] = useState(true);
  const [isSlaTargetExpanded, setIsSlaTargetExpanded] = useState(true);
  const [selectedServiceName, setSelectedServiceName] = useState<string>('');
  const [selectedCategoryName, setSelectedCategoryName] = useState<string>('');
  const [isUpdatingLead, setIsUpdatingLead] = useState(false);
  const [isMarkUnmarkLeadLoading, setIsMarkUnmarkLeadLoading] = useState(false);
  const [serviceCategoryDialogOpen, setServiceCategoryDialogOpen] = useState(false);
  const [pendingMarkAsLead, setPendingMarkAsLead] = useState(false);
  const [pendingStatusId, setPendingStatusId] = useState<string | null>(null);
  const [dialogServiceName, setDialogServiceName] = useState<string>('');
  const [dialogCategoryName, setDialogCategoryName] = useState<string>('');
  const [dialogUpdateDetails, setDialogUpdateDetails] = useState('');
  const [dialogProspectStatus, setDialogProspectStatus] = useState('');
  const [dialogEmail, setDialogEmail] = useState('');
  const [resolveDialogError, setResolveDialogError] = useState<string | null>(null);
  const [isResolveDialogSubmitting, setIsResolveDialogSubmitting] = useState(false);
  const [conversionLines, setConversionLines] = useState<ConversionDraftLine[]>(() => [createEmptyConversionDraftLine()]);
  const [conversionNotes, setConversionNotes] = useState('');
  const [isConversionSubmitting, setIsConversionSubmitting] = useState(false);
  const [conversionModalSession, setConversionModalSession] = useState(0);
  const [conversionPaymentKind, setConversionPaymentKind] = useState<ConversionPaymentKindUi>('full');
  const [conversionDownPaymentRaw, setConversionDownPaymentRaw] = useState('');
  const [conversionPaymentDate, setConversionPaymentDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [conversionPaymentMethod, setConversionPaymentMethod] = useState('');
  const [conversionReceiptFile, setConversionReceiptFile] = useState<File | null>(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentModalSalesActivityId, setPaymentModalSalesActivityId] = useState<string | null>(null);
  const paymentModalAutoOpenedRef = useRef(false);
  const { data: rosterAssignees = [] } = useOmnichannelRosterAssignees();

  const { data: servicesList = [] } = useServices();
  const { data: subServicesList = [] } = useSubServices();

  const refreshConversionMasterData = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['services', organizationId] });
    await queryClient.invalidateQueries({ queryKey: ['sub_services', organizationId] });
    await queryClient.refetchQueries({ queryKey: ['services', organizationId] });
    await queryClient.refetchQueries({ queryKey: ['sub_services', organizationId] });
  }, [organizationId, queryClient]);
  const dialogCategoriesForService = dialogServiceName
    ? (() => {
        const svc = servicesList.find((s) => s.name === dialogServiceName);
        return svc ? subServicesList.filter((ss) => ss.service_id === svc.id) : [];
      })()
    : [];

  const ticketId = conversation ? getTicketIdForConversation(conversation) : '';

  useEffect(() => {
    setConversionNotes('');
    setConversionLines([createEmptyConversionDraftLine()]);
    setConversionPaymentKind('full');
    setConversionDownPaymentRaw('');
    setConversionPaymentDate(format(new Date(), 'yyyy-MM-dd'));
    setConversionPaymentMethod('');
    setConversionReceiptFile(null);
    setPendingStatusId(null);
    setPendingMarkAsLead(false);
    setPaymentModalOpen(false);
    setPaymentModalSalesActivityId(null);
    paymentModalAutoOpenedRef.current = false;
    setServiceCategoryDialogOpen(false);
    setDialogUpdateDetails('');
    setDialogProspectStatus('');
    setDialogEmail('');
    setResolveDialogError(null);
    setIsConversionSubmitting(false);
    setPaymentModalOpen(false);
    setPaymentModalSalesActivityId(null);
    paymentModalAutoOpenedRef.current = false;
  }, [conversation?.id]);

  const { data: leadRow } = useQuery({
    queryKey: ['lead-by-ticket', organizationId, ticketId],
    queryFn: async () => {
      if (!organizationId || !ticketId) return null;
      const { data, error } = await supabase
        .from('leads')
        .select('id, services, category, client, phone_number')
        .eq('organization_id', organizationId)
        .ilike('ticket_id', ticketId)
        .maybeSingle();
      if (error) throw error;
      return data as {
        id: string;
        services: string | null;
        category: string | null;
        client: string | null;
        phone_number: string | null;
      } | null;
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

  const notifyAssigneeActionBlocked = useCallback(
    (reason: 'unassigned' | 'not_assignee', assigneeName?: string | null) => {
      if (reason === 'unassigned') {
        toast.error(
          t(
            'whatsappInbox.assignFromLeadsFirst',
            'Tetapkan assignee di Leads Management sebelum membalas.',
          ),
        );
        return;
      }
      if (assigneeName?.trim()) {
        toast.error(
          t(
            'whatsappInbox.sendOnlyAssignedAgentNamed',
            'Hanya {{name}} (assignee) yang dapat membalas chat ini.',
            { name: assigneeName.trim() },
          ),
        );
        return;
      }
      toast.error(
        t(
          'whatsappInbox.sendOnlyAssignedAgent',
          'Hanya agen yang ditetapkan (assignee) pada chat ini yang dapat membalas.',
        ),
      );
    },
    [t],
  );

  const updateLeadServicesCategory = useCallback(
    async (serviceName: string, categoryName: string): Promise<boolean> => {
      if (!organizationId || !ticketId) return false;
      const cachedAssigneeId = readConversationAssigneeIdFromQueryCache(queryClient, conversation);
      const blockReason = getAssigneeActionBlockReason(cachedAssigneeId, currentEmployeeId);
      if (blockReason) {
        notifyAssigneeActionBlocked(
          blockReason,
          rosterAssignees.find((e) => e.id === cachedAssigneeId)?.full_name ?? null,
        );
        return false;
      }
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
              : conversation?.source === 'facebook'
                ? ((conversation as { customer_name?: string; customer_psid?: string }).customer_name
                  || (conversation as { customer_psid?: string }).customer_psid
                  || 'Messenger')
              : ((conversation as { customer_name?: string; customer_wa_id?: string }).customer_name
                || (conversation as { customer_wa_id?: string }).customer_wa_id
                || 'WhatsApp');
          const title = (conversation as { last_message_body?: string }).last_message_body?.slice(0, 100) || 'Lead';
          const source =
            conversation?.source === 'email'
              ? 'Email'
              : conversation?.source === 'instagram'
                ? 'Instagram'
                : conversation?.source === 'facebook'
                  ? 'Messenger'
                  : 'WhatsApp';
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
            return false;
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
        return true;
      } catch (err) {
        devLog.error('Update lead services/category:', err);
        toast.error(t('whatsappInbox.serviceCategorySaveFailed', 'Failed to save service and category'));
        return false;
      } finally {
        setIsUpdatingLead(false);
      }
    },
    [
      organizationId,
      ticketId,
      leadRow?.id,
      conversation,
      queryClient,
      t,
      currentEmployeeId,
      notifyAssigneeActionBlocked,
      rosterAssignees,
    ]
  );

  const handleMarkAsLead = useCallback(async (serviceName?: string, categoryName?: string) => {
    if (!organizationId || !ticketId || !conversation || conversation.source !== 'email') return;
    const cachedAssigneeId = readConversationAssigneeIdFromQueryCache(queryClient, conversation);
    const blockReason = getAssigneeActionBlockReason(cachedAssigneeId, currentEmployeeId);
    if (blockReason) {
      notifyAssigneeActionBlocked(
        blockReason,
        rosterAssignees.find((e) => e.id === cachedAssigneeId)?.full_name ?? null,
      );
      return;
    }
    const svc = (
      serviceName ?? (selectedServiceName || leadRow?.services || '')
    ).trim();
    const cat = (
      categoryName ??
      (selectedCategoryName ||
        (leadRow?.category && leadRow.category !== '-' ? leadRow.category : '') ||
        '')
    ).trim();
    if (!svc || !cat) return;
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
        category: cat || '',
        created_by: '00000000-0000-0000-0000-000000000000',
        created_by_name: createdByName,
        assignee: '',
        status_id: defaultStatusId,
        organization_id: organizationId,
        source: 'Email',
        services: svc || null,
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
  }, [organizationId, ticketId, conversation, leadRow?.category, leadRow?.services, selectedCategoryName, selectedServiceName, queryClient, t]);

  const handleUnmarkAsLead = useCallback(async () => {
    if (!leadRow?.id) return;
    const cachedAssigneeId = readConversationAssigneeIdFromQueryCache(queryClient, conversation);
    const blockReason = getAssigneeActionBlockReason(cachedAssigneeId, currentEmployeeId);
    if (blockReason) {
      notifyAssigneeActionBlocked(
        blockReason,
        rosterAssignees.find((e) => e.id === cachedAssigneeId)?.full_name ?? null,
      );
      return;
    }
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
  const isFacebook = conversation?.source === 'facebook';
  const isWhatsApp = conversation?.source === 'whatsapp';
  const isMetaDm = isInstagram || isFacebook;

  useEnsureLivechatLeadStatuses(organizationId, Boolean(conversation && (isWhatsApp || isMetaDm)));
  const statusTable = isEmail
    ? 'email_conversations'
    : isInstagram
      ? 'instagram_conversations'
      : isFacebook
        ? 'facebook_conversations'
        : 'whatsapp_conversations';
  const statusQueryKeyBase = isEmail
    ? 'email-conversation-status'
    : isInstagram
      ? 'instagram-conversation-status'
      : isFacebook
        ? 'facebook-conversation-status'
        : 'whatsapp-conversation-status';

  const statusRowFromConversation = useMemo((): ConversationStatusSnapshot | null => {
    if (!conversation) return null;
    if (conversation.source === 'email') {
      const c = conversation as EmailConversation & { assignee_id?: string | null };
      return {
        lead_status_id: c.lead_status_id ?? null,
        last_inbound_at: null,
        created_at: c.created_at,
        assignee_id: c.assignee_id ?? null,
        meta_session_expires_at: null,
      };
    }
    const c = conversation as (WhatsAppConversation | InstagramConversation) & {
      last_inbound_at?: string | null;
      meta_session_expires_at?: string | null;
    };
    return {
      lead_status_id: c.lead_status_id ?? null,
      last_inbound_at: c.last_inbound_at ?? null,
      created_at: c.created_at,
      assignee_id: c.assignee_id ?? null,
      meta_session_expires_at: c.meta_session_expires_at ?? null,
    };
  }, [conversation]);

  const { data: conversationStatusQueryData, isPending: conversationStatusPending } = useQuery({
    queryKey: [statusQueryKeyBase, conversation?.id],
    queryFn: async () => {
      if (!conversation?.id) return null;
      const { data, error } = await supabase
        .from(statusTable)
        .select('lead_status_id, last_inbound_at, created_at, assignee_id, meta_session_expires_at')
        .eq('id', conversation.id)
        .maybeSingle();
      if (error) throw error;
      return data as ConversationStatusSnapshot | null;
    },
    enabled: !!conversation?.id,
    refetchInterval: 5000,
    staleTime: 4000,
  });

  const conversationStatusRow: ConversationStatusSnapshot | null =
    conversationStatusQueryData !== undefined
      ? conversationStatusQueryData
      : (statusRowFromConversation ?? null);

  const showLeadStatusDropdownLoading =
    Boolean(conversation?.id) &&
    conversationStatusPending &&
    conversationStatusQueryData === undefined &&
    !(statusRowFromConversation?.lead_status_id);

  const leadStatusesForSelect = useMemo(() => {
    const lid = conversationStatusRow?.lead_status_id;
    if (!lid || leadStatuses.some((s) => s.id === lid)) return leadStatuses;
    const nm = (
      conversation && 'lead_status_name' in conversation
        ? (conversation as { lead_status_name?: string | null }).lead_status_name
        : null
    )
      ?.trim();
    return [...leadStatuses, { id: lid, name: nm || 'Status', color: '#6B7280' }];
  }, [leadStatuses, conversationStatusRow?.lead_status_id, conversation]);

  const resolveStatusOption = useMemo(
    () => leadStatusesForSelect.find((s) => isResolvedStatus(s.name)),
    [leadStatusesForSelect],
  );

  const conversationStatusId = conversationStatusRow?.lead_status_id ?? null;
  const lastInboundAt = conversationStatusRow?.last_inbound_at ?? null;
  const conversationCreatedAt = conversationStatusRow?.created_at ?? null;
  const conversationAssigneeId = conversationStatusRow?.assignee_id ?? null;

  const { data: quickActionAssigneeEmployee } = useQuery({
    queryKey: ['omnichannel-assignee-display', conversationAssigneeId],
    queryFn: async () => {
      if (!conversationAssigneeId) return null;
      const { data, error } = await supabase
        .from('employees')
        .select('full_name, email')
        .eq('id', conversationAssigneeId)
        .maybeSingle();
      if (error) throw error;
      return data as { full_name?: string | null; email?: string | null } | null;
    },
    enabled: Boolean(conversationAssigneeId && isAssignedToOtherAgent(conversationAssigneeId, currentEmployeeId)),
    staleTime: 60_000,
  });
  const quickActionAssigneeDisplayName =
    (quickActionAssigneeEmployee?.full_name && String(quickActionAssigneeEmployee.full_name).trim()) ||
    (quickActionAssigneeEmployee?.email && String(quickActionAssigneeEmployee.email).trim()) ||
    rosterAssignees.find((e) => e.id === conversationAssigneeId)?.full_name ||
    null;

  const requireActiveAssigneeForQuickAction = useCallback((): boolean => {
    const reason = getAssigneeActionBlockReason(conversationAssigneeId, currentEmployeeId);
    if (!reason) return true;
    notifyAssigneeActionBlocked(reason, quickActionAssigneeDisplayName);
    return false;
  }, [
    conversationAssigneeId,
    currentEmployeeId,
    notifyAssigneeActionBlocked,
    quickActionAssigneeDisplayName,
  ]);

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

  const { data: submissionProfile } = useQuery({
    queryKey: ['lead-submission-profile', organizationId, leadRow?.id],
    queryFn: async () => {
      if (!organizationId || !leadRow?.id) return null;
      return fetchLeadSubmissionForProfile(leadRow.id, organizationId);
    },
    enabled: isWhatsApp && !!organizationId && !!leadRow?.id,
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
  const leadId = conversation
    ? conversation.source === 'email'
      ? `email-${conversation.id}`
      : conversation.source === 'facebook'
        ? `fb-${conversation.id}`
        : `wa-${conversation.id}`
    : '';
  const leadTitle = conversation ? getLeadTitle(conversation, t) : '';
  // Only use a status id that exists in leadStatuses so Select stays controlled and we never send invalid FK
  const currentStatusId = (() => {
    const fromConv = conversationStatusId ?? '';
    if (fromConv && leadStatusesForSelect.some((s) => s.id === fromConv)) return fromConv;
    return leadStatusesForSelect.length > 0 ? leadStatusesForSelect[0].id : '';
  })();
  const currentStatus = leadStatusesForSelect.find((s) => s.id === currentStatusId);
  const isConvertedStatus =
    (currentStatus?.name ?? '').trim().toLowerCase() === 'converted';
  const showLivechatPaymentHistory =
    !isEmail && (isWhatsApp || isMetaDm) && isConvertedStatus;
  const { data: conversionSalesActivity, refetch: refetchConversionSalesActivity } =
    useLeadConversionSalesActivity(leadRow?.id, showLivechatPaymentHistory);
  const isResolved = isResolvedStatus(currentStatus?.name ?? null);
  const isUnreadStatus = isUnreadLeadStatus(currentStatus?.name ?? null);
  const sessionLocked =
    (isWhatsApp || isMetaDm) &&
    isOutboundBlockedForLivechat({
      statusName: currentStatus?.name ?? null,
      metaSessionExpiresAt: conversationStatusRow?.meta_session_expires_at ?? null,
      lastInboundAt: conversationStatusRow?.last_inbound_at ?? null,
    });
  const assigneeQuickActionLocked = !canSendAsActiveAssignee(conversationAssigneeId, currentEmployeeId);
  const quickActionDropdownsDisabled = isUnreadStatus || sessionLocked || assigneeQuickActionLocked;
  const sessionLockedTitle = isUnreadStatus
    ? t(
        'whatsappInbox.quickActionDisabledWhileUnread',
        'Balas pesan terlebih dahulu — quick action aktif setelah status bukan Unread.',
      )
    : sessionLocked
      ? isResolved
        ? t('whatsappInbox.chatResolvedNoActions', 'Chat sudah di-resolve')
        : t(
            'whatsappInbox.metaSessionLockedNoActions',
            'Sesi percakapan Meta sudah berakhir — gunakan template untuk membalas',
          )
      : assigneeQuickActionLocked
        ? quickActionAssigneeDisplayName
          ? t(
              'whatsappInbox.sendOnlyAssignedAgentNamed',
              'Hanya {{name}} (assignee) yang dapat membalas chat ini.',
              { name: quickActionAssigneeDisplayName },
            )
          : t(
              'whatsappInbox.sendOnlyAssignedAgent',
              'Hanya agen yang ditetapkan (assignee) pada chat ini yang dapat membalas.',
            )
        : null;
  const statusQueryKey = statusQueryKeyBase;

  const hasPersistedFollowUpForResolve = useMemo(
    () =>
      followUpUpdates.some(
        (u) => Boolean(u.update_details?.trim()) && isProspectStatusValue(u.status),
      ),
    [followUpUpdates],
  );

  const getEffectiveServiceCategory = useCallback(() => {
    const svc = (selectedServiceName || leadRow?.services || '').trim();
    const cat = (
      selectedCategoryName ||
      (leadRow?.category && leadRow.category !== '-' ? leadRow.category : '') ||
      ''
    ).trim();
    return { svc, cat };
  }, [leadRow?.category, leadRow?.services, selectedCategoryName, selectedServiceName]);

  const openPaymentHistoryModal = useCallback((activityId?: string | null) => {
    const id = activityId ?? conversionSalesActivity?.id ?? paymentModalSalesActivityId;
    if (!id) return;
    setPaymentModalSalesActivityId(id);
    setPaymentModalOpen(true);
  }, [conversionSalesActivity?.id, paymentModalSalesActivityId]);

  const tryAutoOpenPaymentHistoryAfterConvert = useCallback(
    (salesActivityId?: string) => {
      if (paymentModalAutoOpenedRef.current) return;
      const resolvedId = salesActivityId ?? conversionSalesActivity?.id;
      if (resolvedId) {
        paymentModalAutoOpenedRef.current = true;
        openPaymentHistoryModal(resolvedId);
        return;
      }
      void refetchConversionSalesActivity().then((res) => {
        const fetchedId = res.data?.id;
        if (fetchedId && !paymentModalAutoOpenedRef.current) {
          paymentModalAutoOpenedRef.current = true;
          openPaymentHistoryModal(fetchedId);
        }
      });
    },
    [conversionSalesActivity?.id, openPaymentHistoryModal, refetchConversionSalesActivity],
  );

  const handleMarkAsLeadClick = useCallback(() => {
    const { svc, cat } = getEffectiveServiceCategory();
    if (!isServiceCategoryPairValid(svc, cat, servicesList, subServicesList)) {
      setDialogServiceName(svc || '');
      setDialogCategoryName(cat || '');
      setPendingMarkAsLead(true);
      setPendingStatusId(null);
      setResolveDialogError(null);
      setServiceCategoryDialogOpen(true);
      return;
    }
    void handleMarkAsLead(svc, cat);
  }, [getEffectiveServiceCategory, handleMarkAsLead, servicesList, subServicesList]);

  const buildInitialConversionLine = useCallback(() => {
    const { svc, cat } = getEffectiveServiceCategory();
    return createEmptyConversionDraftLine({
      serviceName: svc,
      categoryName: cat,
    });
  }, [getEffectiveServiceCategory]);

  const getResolvePrerequisiteMissing = useCallback((): ResolvePrerequisite[] => {
    const missing: ResolvePrerequisite[] = [];
    const { svc, cat } = getEffectiveServiceCategory();

    if (!isServiceCategoryPairValid(svc, cat, servicesList, subServicesList)) {
      if (!svc || !servicesList.some((s) => s.name === svc)) {
        missing.push('service');
      } else {
        missing.push('category');
      }
    }

    if (!isEmail && !leadRow?.id) {
      if (!missing.includes('service')) missing.push('service');
      if (!missing.includes('category')) missing.push('category');
    }

    const formReady = Boolean(updateDetails.trim() && prospectStatus);
    if (!formReady && !hasPersistedFollowUpForResolve) {
      const hasAnyDetails =
        Boolean(updateDetails.trim()) ||
        followUpUpdates.some((u) => Boolean(u.update_details?.trim()));
      const hasAnyProspect =
        Boolean(prospectStatus) || followUpUpdates.some((u) => isProspectStatusValue(u.status));

      if (!hasAnyDetails) missing.push('update');
      if (!hasAnyProspect) missing.push('prospect');
    }

    if (isWhatsApp) {
      if (!isLeadSubmissionEmailPresent(submissionProfile?.email)) {
        missing.push('email');
      }
    }

    return missing;
  }, [
    followUpUpdates,
    getEffectiveServiceCategory,
    hasPersistedFollowUpForResolve,
    isEmail,
    isWhatsApp,
    leadRow?.id,
    prospectStatus,
    servicesList,
    submissionProfile?.email,
    subServicesList,
    updateDetails,
  ]);

  const persistFollowUpUpdate = useCallback(
    async (overrides?: { updateDetails?: string; prospectStatus?: string }): Promise<boolean> => {
    if (!conversation?.id) return false;
    const details = (overrides?.updateDetails ?? updateDetails).trim();
    const prospect = (overrides?.prospectStatus ?? prospectStatus).trim();
    if (hasPersistedFollowUpForResolve && !details && !prospect) {
      return true;
    }
    if (!details || !prospect) {
      return hasPersistedFollowUpForResolve;
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
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
          update_details: details,
          status: prospect || null,
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
          toast.error(
            t(
              'whatsappInbox.saveServiceCategoryFirst',
              'Save service and category first to link this conversation to a lead.',
            ),
          );
          return false;
        }
        const { error } = await supabase.from('lead_follow_up_updates').insert({
          lead_id: leadUuid,
          conversation_id: conversation.id,
          update_details: details,
          status: prospect || null,
          created_by: user.id,
          created_by_name: profile?.full_name || user.email || 'Unknown',
          organization_id: orgId,
        });
        if (error) throw error;
      }

      await syncFollowUpCountAndPriority();
      await refetchFollowUps();
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      setUpdateDetails('');
      setProspectStatus('');
      return true;
    } catch (err) {
      devLog.error('Error persisting follow-up update:', err);
      toast.error(t('whatsappInbox.followUpAddFailed', 'Failed to add follow-up update'));
      return false;
    }
    },
    [
    conversation?.id,
    hasPersistedFollowUpForResolve,
    isEmail,
    leadRow?.id,
    organizationId,
    prospectStatus,
    queryClient,
    refetchFollowUps,
    syncFollowUpCountAndPriority,
    t,
    ticketId,
    updateDetails,
  ]);

  const openResolvePrerequisiteDialog = useCallback((resolveStatusId?: string | null) => {
    if (resolveStatusId) {
      setPendingStatusId(resolveStatusId);
    }
    const { svc, cat } = getEffectiveServiceCategory();
    const latestFollowUp = followUpUpdates.find(
      (u) => Boolean(u.update_details?.trim()) && isProspectStatusValue(u.status),
    );
    setDialogServiceName(svc || selectedServiceName || '');
    setDialogCategoryName(cat || selectedCategoryName || '');
    setDialogUpdateDetails(updateDetails.trim() || latestFollowUp?.update_details?.trim() || '');
    setDialogProspectStatus(prospectStatus.trim() || latestFollowUp?.status?.trim() || '');
    setDialogEmail(submissionProfile?.email?.trim() || '');
    setResolveDialogError(null);
    setServiceCategoryDialogOpen(true);
    setIsFollowUpExpanded(true);
  }, [
    followUpUpdates,
    getEffectiveServiceCategory,
    prospectStatus,
    selectedCategoryName,
    selectedServiceName,
    submissionProfile?.email,
    updateDetails,
  ]);

  const isResolveModalFollowUpReady = Boolean(dialogUpdateDetails.trim() && dialogProspectStatus.trim());
  const isWaDialogEmailReady =
    !isWhatsApp ||
    isLeadSubmissionEmailPresent(submissionProfile?.email) ||
    isValidResolveEmailFormat(dialogEmail);
  const isResolveModalReady = isResolveModalFollowUpReady && isWaDialogEmailReady;
  /** Converted prerequisite modal: service, category, WA email only (items + notes are inline after this step). */
  const isConvertedPrereqModalReady = isWaDialogEmailReady;

  const persistWaLeadSubmissionEmailFromDialog = useCallback(
    async (leadUuid: string): Promise<void> => {
      if (!organizationId || !isWhatsApp) return;
      if (!isLeadSubmissionEmailPresent(submissionProfile?.email)) {
        const refreshedLead = queryClient.getQueryData<{
          client: string | null;
          phone_number: string | null;
        }>(['lead-by-ticket', organizationId, ticketId]);
        const waCustomerId =
          conversation?.source === 'whatsapp'
            ? (conversation as WhatsAppConversation).customer_wa_id
            : null;
        await upsertLeadSubmissionEmailForResolve({
          leadId: leadUuid,
          organizationId,
          email: dialogEmail,
          defaults: {
            name: refreshedLead?.client ?? leadTitle,
            phone_number: refreshedLead?.phone_number ?? waCustomerId ?? null,
          },
        });
      }
      await queryClient.refetchQueries({
        queryKey: ['lead-submission-profile', organizationId, leadUuid],
      });
      await assertLeadSubmissionEmailSaved(leadUuid, organizationId);
    },
    [
      conversation,
      dialogEmail,
      isWhatsApp,
      leadTitle,
      organizationId,
      queryClient,
      submissionProfile?.email,
      ticketId,
    ],
  );

  const ensureResolvePrerequisites = useCallback(
    async (resolveStatusId?: string): Promise<boolean> => {
      const missing = getResolvePrerequisiteMissing();
      if (missing.length > 0) {
        openResolvePrerequisiteDialog(resolveStatusId);
        return false;
      }
      const saved = await persistFollowUpUpdate();
      if (!saved) {
        openResolvePrerequisiteDialog(resolveStatusId);
        return false;
      }
      return true;
    },
    [getResolvePrerequisiteMissing, openResolvePrerequisiteDialog, persistFollowUpUpdate],
  );

  const handleAddUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requireActiveAssigneeForQuickAction()) return;
    if (!conversation?.id || !updateDetails.trim() || !prospectStatus) return;
    setIsSubmitting(true);
    try {
      const ok = await persistFollowUpUpdate();
      if (ok) {
        toast.success(t('whatsappInbox.followUpAdded', 'Follow-up update added successfully'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const resolveLeadUuidForStatusChange = useCallback(
    (explicitLeadUuid?: string | null): string | null => {
      if (explicitLeadUuid) return explicitLeadUuid;
      if (!organizationId || !ticketId) return leadRow?.id ?? null;
      const fromCache = queryClient.getQueryData<{ id: string }>([
        'lead-by-ticket',
        organizationId,
        ticketId,
      ])?.id;
      return fromCache ?? leadRow?.id ?? null;
    },
    [leadRow?.id, organizationId, queryClient, ticketId],
  );

  const applyStatusChange = async (
    newStatusId: string,
    conversionDescription?: string,
    options?: {
      fromResolveModal?: boolean;
      leadUuid?: string | null;
      conversionItems?: Array<{
        quantity: number;
        unit_price: number;
        services: string;
        category: string;
      }> | null;
      conversionPayment?: ConversionLeadPaymentPayload | null;
      omnichannelBankAccountId?: string | null;
    },
  ): Promise<ApplyStatusChangeResult> => {
    if (!requireActiveAssigneeForQuickAction()) return { ok: false };
    const newStatus = leadStatusesForSelect.find((s) => s.id === newStatusId);
    const isResolve = isResolvedStatus(newStatus?.name ?? null);
    if (isResolve && !options?.fromResolveModal) {
      const ready = await ensureResolvePrerequisites(newStatusId);
      if (!ready) return { ok: false };
      const confirmed = window.confirm(t('leadsManagement.confirmResolve', 'Yakin ingin mengubah status menjadi Resolve? Chat outbound akan diblokir sampai ada pesan masuk baru dari customer.'));
      if (!confirmed) return { ok: false };
    }
    const isConverted =
      (newStatus?.name ?? '').trim().toLowerCase() === 'converted';
    const leadUuid = resolveLeadUuidForStatusChange(options?.leadUuid);
    if (
      (isResolve || isConverted) &&
      conversation.source === 'whatsapp' &&
      organizationId &&
      !options?.fromResolveModal
    ) {
      if (!leadUuid) {
        toast.error(
          t(
            'whatsappInbox.resolveEmailRequired',
            'Email wajib diisi di profil lead (lead_submissions) sebelum Resolve.',
          ),
        );
        return { ok: false };
      }
      const email = await getLeadSubmissionEmailForLead(leadUuid, organizationId);
      if (!email) {
        toast.error(
          t(
            isConverted
              ? 'whatsappInbox.convertedEmailRequired'
              : 'whatsappInbox.resolveEmailRequired',
            isConverted
              ? 'Email wajib diisi di profil lead (lead_submissions) sebelum Converted.'
              : 'Email wajib diisi di profil lead (lead_submissions) sebelum Resolve.',
          ),
        );
        return { ok: false };
      }
    }
    const oldStatusName = currentStatus?.name ?? null;
    try {
      // Use real lead UUID when available so mutation updates the correct row; pass conversation id to sync conversation status
      const idToUse = leadUuid ?? leadId;
      const updateResult = await updateLead({
        id: idToUse,
        status_id: newStatusId,
        organization_id: conversation.organization_id,
        lead_status: oldStatusName ? { name: oldStatusName } : undefined,
        conversionDescription,
        conversionItems: options?.conversionItems ?? undefined,
        conversionPayment: options?.conversionPayment ?? undefined,
        omnichannelBankAccountId: options?.omnichannelBankAccountId ?? undefined,
        ...(leadUuid && conversation.source === 'whatsapp' && { whatsapp_conversation_id: conversation.id }),
        ...(conversation.source === 'instagram' && { channel: 'instagram' }),
        ...(conversation.source === 'facebook' && { channel: 'facebook' }),
      });
      const salesActivityId = isConverted
        ? getSalesActivityIdFromUpdateLeadResult(updateResult)
        : undefined;
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
          ...(isResolve ? { assignee_id: null } : {}),
        };
      });
      await queryClient.invalidateQueries({ queryKey: [statusQueryKey, conversation.id] });
      await queryClient.invalidateQueries({ queryKey: ['leads'], refetchType: 'active' });
      await queryClient.invalidateQueries({ queryKey: ['lead-by-ticket', organizationId, ticketId] });
      await queryClient.invalidateQueries({ queryKey: ['crm-first-response-per-room', organizationId] });
      await queryClient.invalidateQueries({ queryKey: ['crm-sla-conversation', organizationId] });
      toast.success(t('whatsappInbox.statusUpdated', 'Status updated'));
      if (isResolve && conversation.source === 'whatsapp') {
        kickSurveyDispatchAfterResolve(conversation.id);
      }
      if (salesActivityId) {
        queryClient.invalidateQueries({
          queryKey: ['lead-conversion-sales-activity', organizationId, leadRow?.id],
        });
      }
      return { ok: true, salesActivityId };
    } catch (err) {
      devLog.error('Failed to update lead status:', err);
      if (err instanceof Error && err.message === 'invalid_conversion_items') {
        toast.error(
          t('whatsappInbox.conversionSubmitFailed', 'Gagal menyimpan data konversi. Periksa quantity dan harga.'),
        );
        return { ok: false };
      }
      if (err instanceof Error && err.message === 'converted_sales_payment_failed') {
        toast.error(
          t(
            'whatsappInbox.conversionPaymentFailed',
            'Konversi gagal: pembayaran atau pendapatan tidak tersimpan. Coba lagi atau hubungi admin.',
          ),
        );
        return { ok: false };
      }
      if (isResolveEmailRequiredError(err)) {
        toast.error(
          t(
            'whatsappInbox.resolveEmailRequired',
            'Email wajib diisi di profil lead (lead_submissions) sebelum Resolve.',
          ),
        );
        return { ok: false };
      }
      toast.error(t('whatsappInbox.statusUpdateFailed', 'Failed to update status'));
      return { ok: false };
    }
  };

  const handleStatusChange = async (newStatusId: string) => {
    if (!requireActiveAssigneeForQuickAction()) return;
    const newStatus = leadStatusesForSelect.find((s) => s.id === newStatusId);
    const newStatusNameNorm = (newStatus?.name ?? '').trim().toLowerCase();
    const isConverted = newStatusNameNorm === 'converted';
    const isResolve = isResolvedStatus(newStatus?.name ?? null);

    const pendingIsConverted =
      pendingStatusId != null &&
      (leadStatusesForSelect.find((s) => s.id === pendingStatusId)?.name ?? '').trim().toLowerCase() === 'converted';

    if (!isConverted && (pendingIsConverted || serviceCategoryDialogOpen)) {
      setServiceCategoryDialogOpen(false);
      setPendingStatusId(null);
      setConversionNotes('');
      setConversionLines([buildInitialConversionLine()]);
      setConversionPaymentKind('full');
      setConversionDownPaymentRaw('');
      setConversionPaymentDate(format(new Date(), 'yyyy-MM-dd'));
      setConversionPaymentMethod('');
      setConversionReceiptFile(null);
      setDialogUpdateDetails('');
      setDialogProspectStatus('');
      setDialogEmail('');
      setResolveDialogError(null);
    }

    if (isConverted) {
      setPendingStatusId(newStatusId);
      setConversionNotes('');
      setConversionLines([buildInitialConversionLine()]);
      setConversionPaymentKind('full');
      setConversionDownPaymentRaw('');
      setConversionPaymentDate(format(new Date(), 'yyyy-MM-dd'));
      setConversionPaymentMethod('');
      setConversionReceiptFile(null);
      setConversionModalSession((s) => s + 1);
      setDialogServiceName(selectedServiceName || '');
      setDialogCategoryName(selectedCategoryName || '');
      setDialogEmail(submissionProfile?.email?.trim() || '');
      setResolveDialogError(null);
      setServiceCategoryDialogOpen(true);
      return;
    }
    if (isResolve) {
      setPendingStatusId(newStatusId);
      const missing = getResolvePrerequisiteMissing();
      if (missing.length > 0) {
        openResolvePrerequisiteDialog(newStatusId);
        return;
      }
      const ready = await ensureResolvePrerequisites(newStatusId);
      if (!ready) return;
      await applyStatusChange(newStatusId);
      return;
    }

    await applyStatusChange(newStatusId);
  };

  const handleResolveClick = useCallback(() => {
    if (!resolveStatusOption?.id) return;
    if (!requireActiveAssigneeForQuickAction()) return;
    void handleStatusChange(resolveStatusOption.id);
  }, [resolveStatusOption?.id, handleStatusChange, requireActiveAssigneeForQuickAction]);

  const resolveButtonDisabled =
    !resolveStatusOption || isResolved || quickActionDropdownsDisabled;

  const isPendingConverted =
    pendingStatusId != null &&
    (leadStatusesForSelect.find((s) => s.id === pendingStatusId)?.name ?? '').trim().toLowerCase() === 'converted';

  const isPendingResolve =
    pendingStatusId != null &&
    isResolvedStatus(leadStatusesForSelect.find((s) => s.id === pendingStatusId)?.name ?? null);

  const primaryConversionLine = conversionLines[0];

  const modalConvertedDefaultPriceQuery = useQuery({
    queryKey: [
      'livechat-conversion-modal-default-price',
      organizationId,
      primaryConversionLine?.serviceName,
      primaryConversionLine?.categoryName,
      conversionModalSession,
    ],
    queryFn: async () => {
      const lineSvc = primaryConversionLine?.serviceName?.trim() ?? '';
      const lineCat = primaryConversionLine?.categoryName?.trim() ?? '';
      if (!organizationId || !lineSvc || !lineCat) return null;
      const svc = servicesList.find((s) => s.name === lineSvc);
      const sub = subServicesList.find(
        (ss) => ss.service_id === svc?.id && ss.name === lineCat,
      );
      if (!svc?.id || !sub?.id) return null;
      const { data, error } = await supabase
        .from('default_prices')
        .select('unit_price')
        .eq('organization_id', organizationId)
        .eq('kind', LEAD_CONVERSION_CATALOG_KIND)
        .eq('service_id', svc.id)
        .eq('sub_service_id', sub.id)
        .maybeSingle();
      if (error) return null;
      const n = Number(data?.unit_price);
      if (!Number.isFinite(n) || n <= 0) return null;
      return n;
    },
    enabled:
      serviceCategoryDialogOpen &&
      isPendingConverted &&
      Boolean(organizationId) &&
      Boolean(primaryConversionLine?.serviceName?.trim()) &&
      Boolean(primaryConversionLine?.categoryName?.trim()) &&
      servicesList.length > 0 &&
      subServicesList.length > 0,
  });

  useEffect(() => {
    if (!serviceCategoryDialogOpen || !isPendingConverted) return;
    const price = modalConvertedDefaultPriceQuery.data;
    if (price == null) return;
    setConversionLines((prev) => {
      if (prev.length !== 1) return prev;
      const first = prev[0];
      if (first.unitPriceRaw.trim() !== '') return prev;
      return [{ ...first, unitPriceRaw: String(price) }];
    });
  }, [
    conversionModalSession,
    serviceCategoryDialogOpen,
    isPendingConverted,
    modalConvertedDefaultPriceQuery.data,
  ]);

  /** Seed line 1 service/category when modal opens (lead/quick action may load after first paint). */
  useEffect(() => {
    if (!serviceCategoryDialogOpen || !isPendingConverted) return;
    const { svc, cat } = getEffectiveServiceCategory();
    if (!svc) return;
    setConversionLines((prev) => {
      if (prev.length === 0) return prev;
      const first = prev[0];
      const needsService = !first.serviceName.trim();
      const needsCategory = !first.categoryName.trim() && Boolean(cat);
      if (!needsService && !needsCategory) return prev;
      const matchedSvc = resolveServiceByName(svc, servicesList);
      const serviceToStore = matchedSvc?.name ?? svc;
      return [
        {
          ...first,
          serviceName: needsService ? serviceToStore : first.serviceName,
          categoryName: needsCategory ? cat : first.categoryName,
        },
        ...prev.slice(1),
      ];
    });
  }, [
    serviceCategoryDialogOpen,
    isPendingConverted,
    getEffectiveServiceCategory,
    leadRow?.services,
    leadRow?.category,
    selectedServiceName,
    selectedCategoryName,
    servicesList,
  ]);

  const androidKeyboardAnchoredModal =
    isMobile &&
    serviceCategoryDialogOpen &&
    Capacitor.isNativePlatform() &&
    Capacitor.getPlatform() === 'android' &&
    isKeyboardShellOpen &&
    keyboardHeightPx > 0;

  const mobileKeyboardAnchoredModal = isMobile && serviceCategoryDialogOpen && isKeyboardShellOpen;

  const serviceCategoryDialogHeight = useMemo(() => {
    if (!mobileKeyboardAnchoredModal) return undefined;
    if (!androidKeyboardAnchoredModal) {
      return visualViewportHeight;
    }
    if (typeof window === 'undefined') {
      return visualViewportHeight;
    }
    const innerH = window.innerHeight;
    const vvH = visualViewportHeight;
    if (keyboardHeightPx <= 0) {
      return Math.max(vvH, innerH);
    }
    const fromPlugin = innerH - keyboardHeightPx;
    const insetLooksDoubleSubtracted =
      fromPlugin < innerH * 0.55 ||
      (Math.abs(vvH - innerH) <= 56 && fromPlugin < vvH * 0.82);
    if (insetLooksDoubleSubtracted) {
      return Math.max(vvH, innerH);
    }
    return Math.max(vvH, fromPlugin);
  }, [
    mobileKeyboardAnchoredModal,
    androidKeyboardAnchoredModal,
    keyboardHeightPx,
    visualViewportHeight,
  ]);

  const serviceCategoryDialogStyle = useMemo((): React.CSSProperties | undefined => {
    if (!isMobile) return undefined;
    const base: React.CSSProperties = {
      left: 0,
      right: 0,
      width: '100%',
      maxWidth: '100vw',
      transform: 'none',
    };
    if (mobileKeyboardAnchoredModal) {
      return {
        ...base,
        top: visualViewportOffsetTop,
        height: serviceCategoryDialogHeight,
        bottom: 'auto',
        maxHeight: 'none',
      };
    }
    return { ...base, top: 0 };
  }, [
    isMobile,
    mobileKeyboardAnchoredModal,
    visualViewportOffsetTop,
    serviceCategoryDialogHeight,
  ]);

  const scrollServiceCategoryFieldIntoView = useCallback(
    (el: HTMLElement | null) => {
      if (!isMobile || !el) return;
      const run = () => {
        el.scrollIntoView({ block: 'end', inline: 'nearest', behavior: 'smooth' });
      };
      requestAnimationFrame(() => {
        requestAnimationFrame(run);
      });
    },
    [isMobile],
  );

  useEffect(() => {
    if (!mobileKeyboardAnchoredModal) return;
    const active = document.activeElement;
    if (
      active instanceof HTMLElement &&
      serviceCategoryDialogScrollRef.current?.contains(active)
    ) {
      scrollServiceCategoryFieldIntoView(active);
    }
  }, [
    mobileKeyboardAnchoredModal,
    visualViewportHeight,
    visualViewportOffsetTop,
    scrollServiceCategoryFieldIntoView,
  ]);

  const resetServiceCategoryDialog = () => {
    setServiceCategoryDialogOpen(false);
    setPendingMarkAsLead(false);
    setPendingStatusId(null);
    setDialogUpdateDetails('');
    setDialogProspectStatus('');
    setDialogEmail('');
    setResolveDialogError(null);
    setConversionNotes('');
    setConversionLines([buildInitialConversionLine()]);
    setConversionPaymentKind('full');
    setConversionDownPaymentRaw('');
    setConversionPaymentDate(format(new Date(), 'yyyy-MM-dd'));
    setConversionPaymentMethod('');
    setConversionReceiptFile(null);
    setIsConversionSubmitting(false);
  };

  const conversionFinancialReady = isConversionFinancialValid({
    lines: conversionLines,
    paymentKind: conversionPaymentKind,
    downPaymentRaw: conversionDownPaymentRaw,
    paymentDate: conversionPaymentDate,
    paymentMethod: conversionPaymentMethod,
    receiptFile: conversionReceiptFile,
    omnichannelBankId: omnichannelBank?.id ?? null,
  });

  const handleConvertedModalConfirm = async () => {
    if (!requireActiveAssigneeForQuickAction()) return;
    const firstLine = conversionLines[0];
    const svc = firstLine?.serviceName?.trim() ?? '';
    const cat = firstLine?.categoryName?.trim() ?? '';
    if (!isServiceCategoryPairValid(svc, cat, servicesList, subServicesList)) {
      setResolveDialogError(
        t(
          'whatsappInbox.conversionLineServiceCategoryRequired',
          'Setiap baris wajib memiliki Service dan Category yang valid.',
        ),
      );
      return;
    }
    if (isWhatsApp && !isWaDialogEmailReady) {
      setResolveDialogError(
        t('whatsappInbox.resolveEmailInvalid', 'Masukkan alamat email yang valid.'),
      );
      return;
    }
    const items = buildConversionItemsPayload(conversionLines, servicesList, subServicesList);
    if (!items || !conversionNotes.trim()) {
      setResolveDialogError(
        t(
          'whatsappInbox.conversionModalIncomplete',
          'Lengkapi setiap baris: Service, Category, quantity & harga satuan > 0, serta Notes.',
        ),
      );
      return;
    }
    if (!conversionFinancialReady) {
      if (!omnichannelBankLoading && !omnichannelBank?.id) {
        setResolveDialogError(
          t(
            'whatsappInbox.conversionOmnichannelBankMissing',
            'Belum ada rekening Omnichannel. Minta finance mengaktifkan toggle Omnichannel di Income → Transaction → Bank Accounts.',
          ),
        );
      } else {
        setResolveDialogError(
          t(
            'whatsappInbox.conversionFinancialIncomplete',
            'Lengkapi Financial Information: tanggal, metode pembayaran, bukti (receipt), dan nominal DP jika memilih Down Payment.',
          ),
        );
      }
      return;
    }
    if (!pendingStatusId) return;

    setIsConversionSubmitting(true);
    setResolveDialogError(null);
    try {
      const saved = await updateLeadServicesCategory(svc, cat);
      if (!saved) return;

      setSelectedServiceName(svc);
      setSelectedCategoryName(cat);
      await queryClient.refetchQueries({ queryKey: ['lead-by-ticket', organizationId, ticketId] });

      let leadUuidForStatus = resolveLeadUuidForStatusChange();
      if (isWhatsApp && organizationId) {
        if (!leadUuidForStatus) {
          setResolveDialogError(
            t(
              'whatsappInbox.saveServiceCategoryFirst',
              'Save service and category first to link this conversation to a lead.',
            ),
          );
          return;
        }
        await persistWaLeadSubmissionEmailFromDialog(leadUuidForStatus);
      }

      if (!currentUser?.id) {
        setResolveDialogError(
          t(
            'whatsappInbox.conversionAuthRequired',
            'Anda harus masuk untuk mengunggah bukti pembayaran.',
          ),
        );
        return;
      }

      let receiptStoragePath = '';
      if (conversionReceiptFile) {
        const fileExt = conversionReceiptFile.name.split('.').pop() || 'bin';
        const filePath = `${currentUser.id}/${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('income-receipts')
          .upload(filePath, conversionReceiptFile);
        if (uploadError) {
          devLog.error('conversion receipt upload', uploadError);
          setResolveDialogError(
            t(
              'whatsappInbox.conversionReceiptUploadFailed',
              'Gagal mengunggah bukti pembayaran. Coba lagi.',
            ),
          );
          return;
        }
        receiptStoragePath = filePath;
      } else {
        setResolveDialogError(
          t(
            'whatsappInbox.conversionFinancialIncomplete',
            'Lengkapi Financial Information: tanggal, metode pembayaran, bukti (receipt), dan nominal DP jika memilih Down Payment.',
          ),
        );
        return;
      }

      const conversionPayment: ConversionLeadPaymentPayload = {
        kind: conversionPaymentKind === 'dp' ? 'down_payment' : 'full',
        paymentDate: conversionPaymentDate.trim(),
        paymentMethod: conversionPaymentMethod.trim(),
        receiptStoragePath,
      };
      if (conversionPayment.kind === 'down_payment') {
        const dp = parseDownPaymentAmount(conversionDownPaymentRaw);
        if (dp == null) {
          setResolveDialogError(
            t(
              'whatsappInbox.conversionDpInvalid',
              'Nominal down payment tidak valid (harus lebih dari 0 dan tidak melebihi total).',
            ),
          );
          return;
        }
        conversionPayment.downPaymentAmount = dp;
      }

      const convertResult = await applyStatusChange(pendingStatusId, conversionNotes.trim(), {
        fromResolveModal: true,
        leadUuid: leadUuidForStatus,
        conversionItems: items,
        conversionPayment,
        omnichannelBankAccountId: omnichannelBank!.id,
      });
      if (convertResult.ok) {
        resetServiceCategoryDialog();
        tryAutoOpenPaymentHistoryAfterConvert(convertResult.salesActivityId);
      }
    } catch (err) {
      if (err instanceof Error && err.message === 'invalid_resolve_email') {
        setResolveDialogError(
          t('whatsappInbox.resolveEmailInvalid', 'Masukkan alamat email yang valid.'),
        );
      } else if (isResolveEmailRequiredError(err)) {
        setResolveDialogError(
          t(
            'whatsappInbox.convertedEmailRequired',
            'Email wajib diisi di profil lead (lead_submissions) sebelum Converted.',
          ),
        );
      } else if (isLeadSubmissionWebIdRequiredError(err)) {
        setResolveDialogError(
          t(
            'whatsappInbox.resolveWebIdRequired',
            'Tidak dapat menyimpan profil lead: hubungkan web_id analytics untuk organisasi ini (Traffic → Connect web_id).',
          ),
        );
      } else if (isLeadSubmissionFormIdRequiredError(err)) {
        setResolveDialogError(
          t(
            'whatsappInbox.resolveFormIdRequired',
            'Lead dari WhatsApp langsung belum punya form website. Pastikan organisasi punya minimal satu lead dari form website, atau hubungi admin untuk mengaktifkan form_id omnichannel.',
          ),
        );
      } else if (err instanceof Error && err.message === 'converted_sales_payment_failed') {
        setResolveDialogError(
          t(
            'whatsappInbox.conversionPaymentFailed',
            'Konversi gagal: pembayaran atau pendapatan tidak tersimpan. Coba lagi atau hubungi admin.',
          ),
        );
      } else if (err instanceof Error && err.message === 'converted_sales_omnichannel_bank_required') {
        setResolveDialogError(
          t(
            'whatsappInbox.conversionOmnichannelBankMissing',
            'Belum ada rekening Omnichannel. Minta finance mengaktifkan toggle Omnichannel di Income → Transaction → Bank Accounts.',
          ),
        );
      } else if (isLeadSubmissionProfileSaveError(err)) {
        setResolveDialogError(
          t(
            'whatsappInbox.resolveProfileSaveFailed',
            'Gagal menyimpan profil lead. Coba lagi atau hubungi admin.',
          ),
        );
      } else {
        console.error('handleConvertedModalConfirm:', err);
        setResolveDialogError(
          t('whatsappInbox.resolveProfileSaveFailed', 'Gagal menyimpan profil lead. Coba lagi atau hubungi admin.'),
        );
      }
    } finally {
      setIsConversionSubmitting(false);
    }
  };

  const handleServiceCategoryDialogSave = async () => {
    if (!requireActiveAssigneeForQuickAction()) return;
    const svc = dialogServiceName?.trim();
    const cat = dialogCategoryName?.trim();
    if (!svc || !cat) {
      setResolveDialogError(
        t(
          'whatsappInbox.fillServiceAndCategoryFirst',
          'Pilih Layanan dan Kategori terlebih dahulu sebelum mengubah status ke Converted atau Resolve.',
        ),
      );
      return;
    }

    const idToApply = pendingStatusId;

    if (isPendingResolve) {
      const details = dialogUpdateDetails.trim();
      const prospect = dialogProspectStatus.trim();
      if (!details || !prospect) {
        setResolveDialogError(
          t('whatsappInbox.resolveDialogValidationError', 'Lengkapi semua field yang wajib diisi.'),
        );
        return;
      }

      if (isWhatsApp && !isWaDialogEmailReady) {
        setResolveDialogError(
          t('whatsappInbox.resolveEmailInvalid', 'Masukkan alamat email yang valid.'),
        );
        return;
      }

      const followUpUnchanged = followUpUpdates.some(
        (u) => u.update_details?.trim() === details && (u.status?.trim() ?? '') === prospect,
      );

      setIsResolveDialogSubmitting(true);
      setResolveDialogError(null);
      try {
        const savedSvc = await updateLeadServicesCategory(svc, cat);
        if (!savedSvc) return;

        setSelectedServiceName(svc);
        setSelectedCategoryName(cat);
        await queryClient.refetchQueries({ queryKey: ['lead-by-ticket', organizationId, ticketId] });

        let leadUuidForStatus = resolveLeadUuidForStatusChange();
        if (isWhatsApp && organizationId) {
          if (!leadUuidForStatus) {
            setResolveDialogError(
              t(
                'whatsappInbox.saveServiceCategoryFirst',
                'Save service and category first to link this conversation to a lead.',
              ),
            );
            return;
          }
          await persistWaLeadSubmissionEmailFromDialog(leadUuidForStatus);
        }

        if (!followUpUnchanged) {
          const savedFollowUp = await persistFollowUpUpdate({
            updateDetails: details,
            prospectStatus: prospect,
          });
          if (!savedFollowUp) return;
          setUpdateDetails('');
          setProspectStatus('');
        }

        const statusApplied = idToApply
          ? await applyStatusChange(idToApply, undefined, {
              fromResolveModal: true,
              leadUuid: leadUuidForStatus,
            })
          : { ok: false };
        if (!statusApplied.ok) return;

        resetServiceCategoryDialog();
      } catch (err) {
        if (err instanceof Error && err.message === 'invalid_resolve_email') {
          setResolveDialogError(
            t('whatsappInbox.resolveEmailInvalid', 'Masukkan alamat email yang valid.'),
          );
        } else if (isResolveEmailRequiredError(err)) {
          setResolveDialogError(
            t(
              'whatsappInbox.resolveEmailRequired',
              'Email wajib diisi di profil lead (lead_submissions) sebelum Resolve.',
            ),
          );
        } else if (isLeadSubmissionWebIdRequiredError(err)) {
          setResolveDialogError(
            t(
              'whatsappInbox.resolveWebIdRequired',
              'Tidak dapat menyimpan profil lead: hubungkan web_id analytics untuk organisasi ini (Traffic → Connect web_id).',
            ),
          );
        } else if (isLeadSubmissionFormIdRequiredError(err)) {
          setResolveDialogError(
            t(
              'whatsappInbox.resolveFormIdRequired',
              'Lead dari WhatsApp langsung belum punya form website. Pastikan organisasi punya minimal satu lead dari form website, atau hubungi admin untuk mengaktifkan form_id omnichannel.',
            ),
          );
        } else if (isLeadSubmissionProfileSaveError(err)) {
          setResolveDialogError(
            t(
              'whatsappInbox.resolveProfileSaveFailed',
              'Gagal menyimpan profil lead. Coba lagi atau hubungi admin.',
            ),
          );
        } else {
          console.error('handleServiceCategoryDialogSave (resolve):', err);
          setResolveDialogError(
            t('whatsappInbox.resolveProfileSaveFailed', 'Gagal menyimpan profil lead. Coba lagi atau hubungi admin.'),
          );
        }
      } finally {
        setIsResolveDialogSubmitting(false);
      }
      return;
    }

    if (pendingMarkAsLead) {
      setIsResolveDialogSubmitting(true);
      setResolveDialogError(null);
      try {
        await handleMarkAsLead(svc, cat);
        setSelectedServiceName(svc);
        setSelectedCategoryName(cat);
        resetServiceCategoryDialog();
      } finally {
        setIsResolveDialogSubmitting(false);
      }
      return;
    }

    resetServiceCategoryDialog();
  };

  const resolveButtonLabel = getLeadStatusDisplayName(resolveStatusOption?.name ?? 'Closed') || 'Resolve';

  const resolveActionsSnapshot = useMemo((): LivechatResolveActionsSnapshot | null => {
    if (!conversation || !resolveStatusOption) return null;
    return {
      conversationId: conversation.id,
      resolveButtonLabel,
      resolveButtonDisabled,
      isResolved,
      sessionLockedTitle,
      handleResolveClick,
    };
  }, [
    conversation,
    resolveStatusOption,
    resolveButtonLabel,
    resolveButtonDisabled,
    isResolved,
    sessionLockedTitle,
    handleResolveClick,
  ]);

  usePublishLivechatResolveActions(resolveActionsSnapshot);

  const resolveButton = resolveStatusOption ? (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="block w-full">
          <Button
            type="button"
            size="sm"
            variant={isResolved ? 'outline' : 'default'}
            className="w-full"
            disabled={resolveButtonDisabled}
            onClick={handleResolveClick}
          >
            {resolveButtonLabel}
          </Button>
        </span>
      </TooltipTrigger>
      {resolveButtonDisabled && sessionLockedTitle ? (
        <TooltipContent side="top" className="max-w-[240px] text-xs">
          {sessionLockedTitle}
        </TooltipContent>
      ) : null}
    </Tooltip>
  ) : null;

  if (!conversation) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <p className="text-sm text-gray-500">
          {t('whatsappInbox.quickActionSelectConversation', 'Select a conversation to see quick actions')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Modal: data lengkap sebelum Resolve, atau Layanan/Kategori untuk Converted */}
      <Dialog
        open={serviceCategoryDialogOpen}
        onOpenChange={(open) => {
          if (open) {
            setServiceCategoryDialogOpen(true);
          } else {
            resetServiceCategoryDialog();
          }
        }}
      >
        <DialogContent
          className={cn(
            'gap-0 overflow-hidden p-0',
            isMobile
              ? cn(
                  'fixed inset-x-0 top-0 z-50 flex min-h-0 w-full min-w-0 max-w-none flex-col',
                  '!left-0 !right-0 !max-w-none !translate-x-0 !translate-y-0',
                  'rounded-none border-0 overscroll-y-contain',
                  !mobileKeyboardAnchoredModal && 'bottom-0 h-dvh modal-above-safe-area',
                )
              : 'grid h-[min(92vw,680px,92vh)] w-[min(92vw,560px,92vh)] max-h-[min(92vw,680px,92vh)] max-w-[min(92vw,560px,92vh)] grid-rows-[auto_1fr_auto] sm:rounded-lg',
          )}
          style={serviceCategoryDialogStyle}
          hideCloseButton={isMobile}
          fullscreenAnimation={isMobile}
          overlayClassName={
            isMobile && !mobileKeyboardAnchoredModal ? 'modal-overlay-above-safe-area' : undefined
          }
          onOpenAutoFocus={(e) => {
            if (isMobile) e.preventDefault();
          }}
        >
          <DialogHeader
            className={cn(
              'flex-shrink-0 space-y-0 text-left',
              isMobile ? 'safe-area-top px-4 pb-2 pt-4' : 'px-6 pb-2 pt-6',
            )}
          >
            <DialogTitle className="flex items-center gap-2 pr-8 text-lg">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                <AlertCircle className="h-4 w-4" />
              </span>
              {isPendingResolve
                ? t('whatsappInbox.resolvePrerequisiteDialogTitle', 'Lengkapi data sebelum Resolve')
                : isPendingConverted
                  ? t('whatsappInbox.conversionModalTitle', 'Konversi — lengkapi data penjualan')
                  : pendingMarkAsLead
                    ? t('whatsappInbox.markAsLeadServiceCategoryTitle', 'Pilih Layanan dan Kategori untuk lead')
                    : t('whatsappInbox.selectServiceAndCategory', 'Pilih Layanan dan Kategori')}
            </DialogTitle>
          </DialogHeader>
          <DialogFormScrollArea
            ref={serviceCategoryDialogScrollRef}
            className={cn(
              'min-h-0 min-w-0 flex-1',
              isMobile ? 'px-4 py-2' : 'px-6 py-2',
              mobileKeyboardAnchoredModal && 'pb-1',
            )}
          >
            <div className="min-w-0 space-y-4">
            {!isPendingConverted ? (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    {t('whatsappInbox.service', 'Layanan')}
                  </label>
                  <Select
                    value={dialogServiceName || undefined}
                    onValueChange={(v) => {
                      setDialogServiceName(v);
                      setDialogCategoryName('');
                    }}
                  >
                    <SelectTrigger className="w-full border-gray-200 bg-white">
                      <SelectValue placeholder={t('whatsappInbox.selectService', 'Pilih layanan')} />
                    </SelectTrigger>
                    <SelectContent>
                      {servicesList.map((s) => (
                        <SelectItem key={s.id} value={s.name}>
                          {s.name}
                        </SelectItem>
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
                    <SelectTrigger className="w-full border-gray-200 bg-white">
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
                        <SelectItem key={ss.id} value={ss.name}>
                          {ss.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : null}
            {(isPendingResolve || isPendingConverted) && isWhatsApp && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  {t('whatsappInbox.resolveEmailLabel', 'Email')} <span className="text-red-500">*</span>
                </label>
                <Input
                  type="email"
                  value={dialogEmail}
                  onChange={(e) => {
                    setDialogEmail(e.target.value);
                    setResolveDialogError(null);
                  }}
                  onFocus={(e) => scrollServiceCategoryFieldIntoView(e.currentTarget)}
                  placeholder={t('whatsappInbox.resolveEmailPlaceholder', 'nama@perusahaan.com')}
                  className="bg-white border-gray-200"
                  autoComplete="email"
                />
                <p className="text-xs text-muted-foreground">
                  {t(
                    isPendingResolve
                      ? 'whatsappInbox.resolveEmailHint'
                      : 'whatsappInbox.convertedEmailHint',
                    isPendingResolve
                      ? 'Email wajib diisi dan tersimpan di profil lead sebelum Resolve.'
                      : 'Email wajib diisi dan tersimpan di profil lead sebelum Converted.',
                  )}
                </p>
              </div>
            )}
            {isPendingConverted && (
              <LivechatConversionDraftSection
                lines={conversionLines}
                notes={conversionNotes}
                servicesList={servicesList}
                subServicesList={subServicesList}
                onLinesChange={setConversionLines}
                onNotesChange={setConversionNotes}
                onMasterDataRefresh={refreshConversionMasterData}
                fallbackServiceName={selectedServiceName || leadRow?.services || ''}
                fallbackCategoryName={
                  selectedCategoryName ||
                  (leadRow?.category && leadRow.category !== '-' ? leadRow.category : '') ||
                  ''
                }
                hidePrimaryAction
                disabled={quickActionDropdownsDisabled}
                isSubmitting={isConversionSubmitting}
                onFieldFocus={(el) => scrollServiceCategoryFieldIntoView(el)}
                t={t}
              />
            )}
            {isPendingConverted && (
              <LivechatConversionFinancialSection
                lines={conversionLines}
                categoryLabel={conversionLines[0]?.categoryName ?? ''}
                paymentKind={conversionPaymentKind}
                onPaymentKindChange={(k) => {
                  setConversionPaymentKind(k);
                  setResolveDialogError(null);
                }}
                downPaymentRaw={conversionDownPaymentRaw}
                onDownPaymentRawChange={(v) => {
                  setConversionDownPaymentRaw(v);
                  setResolveDialogError(null);
                }}
                paymentDate={conversionPaymentDate}
                onPaymentDateChange={(v) => {
                  setConversionPaymentDate(v);
                  setResolveDialogError(null);
                }}
                paymentMethod={conversionPaymentMethod}
                onPaymentMethodChange={(v) => {
                  setConversionPaymentMethod(v);
                  setResolveDialogError(null);
                }}
                onReceiptChange={(f) => {
                  setConversionReceiptFile(f);
                  setResolveDialogError(null);
                }}
                disabled={quickActionDropdownsDisabled || isConversionSubmitting}
                omnichannelBankLabel={omnichannelBankLabel}
                omnichannelBankCopyText={omnichannelBankCopyText}
                omnichannelBankLoading={omnichannelBankLoading}
                omnichannelBankMissing={!omnichannelBankLoading && !omnichannelBank?.id}
                onFieldFocus={(el) => scrollServiceCategoryFieldIntoView(el)}
                t={t}
              />
            )}
            {isPendingResolve && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    {t('whatsappInbox.updateDetails', 'Update Details')} <span className="text-red-500">*</span>
                  </label>
                  <Textarea
                    value={dialogUpdateDetails}
                    onChange={(e) => {
                      setDialogUpdateDetails(e.target.value);
                      setResolveDialogError(null);
                    }}
                    onFocus={(e) => scrollServiceCategoryFieldIntoView(e.currentTarget)}
                    placeholder={t('whatsappInbox.updateDetailsPlaceholder', '')}
                    className="min-h-[80px] resize-none text-sm bg-white border-gray-200"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    {t('whatsappInbox.prospectStatus', 'Prospect Status')} <span className="text-red-500">*</span>
                  </label>
                  <Select
                    value={dialogProspectStatus || undefined}
                    onValueChange={(v) => {
                      setDialogProspectStatus(v);
                      setResolveDialogError(null);
                    }}
                  >
                    <SelectTrigger className="w-full bg-white border-gray-200">
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
              </>
            )}
            {resolveDialogError ? (
              <p className="text-sm text-red-600" role="alert">
                {resolveDialogError}
              </p>
            ) : null}
            </div>
          </DialogFormScrollArea>
          <DialogFooter
            className={cn(
              'flex-shrink-0 gap-2 border-t border-border/60 pt-4 sm:gap-0',
              isMobile ? 'px-4 pb-4' : 'px-6 pb-6',
            )}
          >
            <Button
              type="button"
              variant="outline"
              onClick={resetServiceCategoryDialog}
              disabled={isResolveDialogSubmitting || isConversionSubmitting}
            >
              {t('whatsappInbox.cancel', 'Batal')}
            </Button>
            <Button
              type="button"
              onClick={isPendingConverted ? handleConvertedModalConfirm : handleServiceCategoryDialogSave}
              disabled={
                isResolveDialogSubmitting ||
                isConversionSubmitting ||
                (pendingMarkAsLead &&
                  (!dialogServiceName?.trim() || !dialogCategoryName?.trim())) ||
                (isPendingResolve &&
                  (!dialogServiceName?.trim() ||
                    !dialogCategoryName?.trim() ||
                    !isResolveModalReady)) ||
                (isPendingConverted &&
                  (!isConvertedPrereqModalReady ||
                    !isConversionDraftValid(
                      conversionLines,
                      conversionNotes.trim(),
                      servicesList,
                      subServicesList,
                    ) ||
                    !conversionFinancialReady))
              }
            >
              {isPendingConverted
                ? isConversionSubmitting
                  ? t('whatsappInbox.conversionSubmitting', 'Menyimpan…')
                  : t('whatsappInbox.conversionConfirm', 'Konfirmasi Converted')
                : isResolveDialogSubmitting
                  ? isPendingResolve
                    ? t('whatsappInbox.resolving', 'Resolve...')
                    : pendingMarkAsLead
                      ? t('whatsappInbox.markingAsLead', 'Menandai sebagai lead…')
                      : t('whatsappInbox.adding', 'Adding...')
                  : isPendingResolve
                    ? t('whatsappInbox.resolveFromModal', 'Resolve')
                    : pendingMarkAsLead
                      ? t('whatsappInbox.markAsLead', 'Mark as lead')
                      : t('whatsappInbox.saveAndContinue', 'Simpan dan lanjutkan')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {showLivechatPaymentHistory && (
        <div className="space-y-1.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="block w-full">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={
                    quickActionDropdownsDisabled ||
                    !(conversionSalesActivity?.id ?? paymentModalSalesActivityId)
                  }
                  onClick={() => openPaymentHistoryModal()}
                >
                  <Receipt className="mr-2 h-4 w-4 shrink-0" />
                  {t('whatsappInbox.paymentInvoice', 'Payment / Invoice')}
                </Button>
              </span>
            </TooltipTrigger>
            {!(conversionSalesActivity?.id ?? paymentModalSalesActivityId) ? (
              <TooltipContent side="top" className="max-w-[240px] text-xs">
                {t(
                  'whatsappInbox.paymentInvoiceUnavailable',
                  'No sales activity found for this converted lead.',
                )}
              </TooltipContent>
            ) : null}
          </Tooltip>
        </div>
      )}

      {paymentModalOpen && paymentModalSalesActivityId ? (
        <Suspense fallback={null}>
          {useMobilePaymentHistoryShell ? (
            <MobileLivechatPaymentHistoryModal
              open={paymentModalOpen}
              onClose={() => setPaymentModalOpen(false)}
              salesActivityId={paymentModalSalesActivityId}
              clientName={leadTitle}
            />
          ) : (
            <PaymentUpdateModal
              open={paymentModalOpen}
              onClose={() => setPaymentModalOpen(false)}
              salesActivityId={paymentModalSalesActivityId}
              clientName={leadTitle}
              variant="livechat"
            />
          )}
        </Suspense>
      ) : null}

      {/* Email only: Mark as lead / Unmark as lead in Quick Action */}
      {isEmail && (
        <div className="space-y-2">
          {leadRow?.id ? (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={isMarkUnmarkLeadLoading || quickActionDropdownsDisabled}
              onClick={handleUnmarkAsLead}
            >
              {isMarkUnmarkLeadLoading ? '...' : t('whatsappInbox.unmarkAsLead', 'Unmark as lead')}
            </Button>
          ) : (
            <Button
              type="button"
              className="w-full"
              disabled={quickActionDropdownsDisabled || isMarkUnmarkLeadLoading}
              onClick={handleMarkAsLeadClick}
            >
              {isMarkUnmarkLeadLoading ? '...' : t('whatsappInbox.markAsLead', 'Mark as lead')}
            </Button>
          )}
        </div>
      )}

      {/* Update Follow Up - expand/collapse */}
      <div className="rounded-lg border border-gray-200 bg-slate-50/80 shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => !quickActionDropdownsDisabled && setIsFollowUpExpanded((v) => !v)}
          disabled={quickActionDropdownsDisabled}
          className="w-full flex items-center justify-between gap-2 p-3 text-left hover:bg-slate-100/80 transition-colors rounded-t-lg disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-slate-50/80"
          aria-expanded={isFollowUpExpanded}
          title={
            quickActionDropdownsDisabled
              ? (sessionLockedTitle ?? '')
              : isFollowUpExpanded
                ? t('whatsappInbox.clickToCollapse', 'Click to collapse')
                : t('whatsappInbox.clickToExpand', 'Click to expand')
          }
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
                disabled={quickActionDropdownsDisabled}
              />
            </div>
            <div className="flex gap-2 items-end">
              <div className="flex-1 min-w-0">
                <label className="text-xs font-medium text-gray-600 block mb-1">
                  {t('whatsappInbox.prospectStatus', 'Prospect Status')} <span className="text-red-500">*</span>
                </label>
                <Select value={prospectStatus} onValueChange={setProspectStatus} required>
                  <SelectTrigger className="w-full text-sm bg-white border-gray-200" disabled={quickActionDropdownsDisabled}>
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
                disabled={quickActionDropdownsDisabled || isSubmitting || !updateDetails.trim() || !prospectStatus}
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
            leadResolved={isResolved}
          />
        ) : null}
      </div>

      {hideLeadTitle && resolveButton ? <div className="space-y-1.5">{resolveButton}</div> : null}

      {/* Status — terkunci saat Unread, resolve manual, atau sesi Meta habis */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-gray-600">
          {t('whatsappInbox.status', 'Status')}
        </label>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="w-full">
              <LeadStatusSelect
                value={currentStatusId || undefined}
                onValueChange={handleStatusChange}
                leadStatuses={leadStatusesForSelect}
                currentStatusName={currentStatus?.name ?? ''}
                disabled={quickActionDropdownsDisabled || isConversionSubmitting}
                excludeResolvedOption
                triggerClassName="w-full text-sm border rounded-lg font-medium"
                isLoading={showLeadStatusDropdownLoading}
              />
            </div>
          </TooltipTrigger>
          {quickActionDropdownsDisabled && sessionLockedTitle ? (
            <TooltipContent side="top" className="max-w-[240px] text-xs">
              {sessionLockedTitle}
            </TooltipContent>
          ) : null}
        </Tooltip>
      </div>
    </div>
  );
}
