import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/shared/lib/supabaseClient';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { getLeadStatusDisplayName } from '@/5-1-leads-management/utils/leadStatusDisplay';
import { useWhatsAppConversations } from '@/5-3-whatsapp/hooks/useWhatsAppConversations';
import { useInstagramConversations } from '@/5-3-whatsapp/hooks/useInstagramConversations';
import { useFacebookConversations } from '@/5-3-whatsapp/hooks/useFacebookConversations';
import { useThreadsConversations } from '@/5-3-whatsapp/hooks/useThreadsConversations';
import { useEmailConversations } from '@/5-3-whatsapp/hooks/useEmailConversations';
import { useWhatsAppAccounts } from '@/5-3-whatsapp/hooks/useWhatsAppAccounts';
import { useInstagramAccounts } from '@/5-3-whatsapp/hooks/useInstagramAccounts';
import { useFacebookPages } from '@/5-3-whatsapp/hooks/useFacebookPages';
import { useEmailConnections } from '@/5-3-whatsapp/hooks/useEmailConnections';
import type { LiveChatConversation, WhatsAppConversation, InstagramConversation, FacebookConversation, ThreadsConversation } from '@/5-3-whatsapp/types';
import { getConversationTicketId } from './shared/getConversationTicketId';
import { LiveChatListView } from './LiveChatListView';
import { LiveChatChatView } from './LiveChatChatView';
import { useLiveChatInboundNotification } from './hooks/useLiveChatInboundNotification';
import { LiveChatAppBadgeSync } from '@/5-3-whatsapp/components/LiveChatAppBadgeSync';
import { CONSULTANT_LIVECHAT_PATH } from '@/mobile/4-leads-management/shared/consultantCrmNavPaths';
import { useStatusBarStyle } from '@/shared/hooks/useStatusBarStyle';
import { useOrgBootstrapPending } from '@/shared/auth/hooks/useOrgBootstrapPending';
import { useOptimizedSubscription } from '@/10-subscription/hooks/useOptimizedSubscription';
import { ModuleShellContentGate } from '@/shared/layouts/ModuleShellContentGate';
import { MOBILE_PAGE_PATH } from '@/shared/auth/page-access/mobileRoutePagePaths';

type AccountFilterValue = '' | `wa:${string}` | `ig:${string}` | `fb:${string}` | `th:${string}` | `email:${string}`;

export default function LiveChatPage() {
  const { t } = useAppTranslation();
  return (
    <>
      <LiveChatAppBadgeSync />
      <ModuleShellContentGate
        pagePath={MOBILE_PAGE_PATH.omnichannelLivechat}
        className="flex min-h-0 min-w-0 flex-1 flex-col"
      >
        <LiveChatPageInner t={t} />
      </ModuleShellContentGate>
    </>
  );
}

function LiveChatPageInner({ t }: { t: (key: string, fallback: string) => string }) {
  useStatusBarStyle('livechat');
  const { organizationId } = useOrgBootstrapPending();
  const { refreshSubscriptionStatus } = useOptimizedSubscription({ includePlans: false });

  useEffect(() => {
    if (!organizationId) return;
    refreshSubscriptionStatus();
  }, [organizationId, refreshSubscriptionStatus]);

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const ticketId = searchParams.get('ticket_id');
  const [accountFilter, setAccountFilter] = useState<AccountFilterValue>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showInvalidTicketBanner, setShowInvalidTicketBanner] = useState(false);
  const [scrollToTextInChat, setScrollToTextInChat] = useState<string | null>(null);
  const [scrollToMessageId, setScrollToMessageId] = useState<string | null>(null);

  const { data: waConversations = [], isLoading: waLoading, error: waError, refetch: refetchWa } = useWhatsAppConversations();
  const { data: igConversations = [], isLoading: igLoading, error: igError, refetch: refetchIg } = useInstagramConversations();
  const { data: fbConversations = [], isLoading: fbLoading, error: fbError, refetch: refetchFb } = useFacebookConversations();
  const { data: thConversations = [], isLoading: thLoading, error: thError, refetch: refetchTh } = useThreadsConversations();
  const { data: emailConversations = [], isLoading: emailLoading, error: emailError, refetch: refetchEmail } = useEmailConversations();
  const { accounts: waAccounts } = useWhatsAppAccounts();
  const { accounts: igAccounts } = useInstagramAccounts();
  const { pages: fbPages } = useFacebookPages();
  const { connections: emailConnections } = useEmailConnections();

  const { data: leadStatuses = [], error: leadStatusesError } = useQuery({
    queryKey: ['lead-statuses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lead_statuses')
        .select('id, name, color')
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; name: string; color: string | null }>;
    },
    staleTime: 60_000,
  });

  useEffect(() => {
    if (leadStatusesError) {
      toast.error(t('livechat.leadStatusesLoadFailed', 'Gagal memuat daftar status.'));
    }
  }, [leadStatusesError, t]);

  const allConversations: LiveChatConversation[] = useMemo(() => {
    const wa: LiveChatConversation[] = (waConversations as WhatsAppConversation[]).map((c) => ({ ...c, source: 'whatsapp' as const }));
    const ig: LiveChatConversation[] = (igConversations as InstagramConversation[]).map((c) => ({ ...c, source: 'instagram' as const }));
    const fb: LiveChatConversation[] = (fbConversations as FacebookConversation[]).map((c) => ({ ...c, source: 'facebook' as const }));
    const th: LiveChatConversation[] = (thConversations as ThreadsConversation[]).map((c) => ({ ...c, source: 'threads' as const }));
    const email: LiveChatConversation[] = emailConversations.map((c) => ({ ...c, source: 'email' as const }));
    const merged = [...wa, ...ig, ...fb, ...th, ...email];
    merged.sort((a, b) => {
      const aAt = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
      const bAt = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
      return bAt - aAt;
    });
    return merged;
  }, [waConversations, igConversations, fbConversations, thConversations, emailConversations]);

  const accountOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [
      { value: 'all', label: t('whatsappInbox.filterAllAccounts', 'Semua akun') },
    ];
    waAccounts.forEach((acc) => {
      const name = acc.whatsapp_business_name?.trim() || acc.display_phone_number?.trim() || acc.phone_number_id || t('whatsappInbox.whatsApp', 'WhatsApp');
      opts.push({ value: `wa:${acc.phone_number_id}` as const, label: `WhatsApp - ${name}` });
    });
    igAccounts.forEach((acc) => {
      const name = acc.instagram_username?.trim() ? `@${acc.instagram_username}` : acc.instagram_name?.trim() || acc.instagram_business_account_id || t('whatsappInbox.instagram', 'Instagram');
      opts.push({ value: `ig:${acc.instagram_business_account_id}` as const, label: `Instagram - ${name}` });
      if (acc.has_threads && acc.threads_user_id) {
        const thName = acc.threads_username?.trim() ? `@${acc.threads_username}` : acc.threads_user_id;
        opts.push({ value: `th:${acc.threads_user_id}` as const, label: `Threads - ${thName}` });
      }
    });
    fbPages.forEach((page) => {
      const name = page.page_name?.trim() || page.facebook_page_id || t('livechat.channelMessenger', 'Messenger');
      opts.push({ value: `fb:${page.facebook_page_id}` as const, label: `Messenger - ${name}` });
    });
    emailConnections.forEach((conn) => {
      opts.push({ value: `email:${conn.id}` as const, label: `Email - ${conn.email_address}` });
    });
    return opts;
  }, [waAccounts, igAccounts, fbPages, emailConnections, t]);

  const statusOptions = useMemo(() => {
    const excluded = leadStatuses.filter((s) => {
      const name = (s.name?.trim().toLowerCase() ?? '');
      return name !== 'lost' && name !== 'qualified';
    });
    const canonical = ['Open', 'Unread', 'In Progress', 'Converted', 'Qualified', 'Closed', 'Resolve'];
    const byDisplay = (a: { name: string | null }, b: { name: string | null }) => {
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
    const unique = sorted.filter((s) => {
      const displayName = getLeadStatusDisplayName(s.name);
      if (seen.has(displayName)) return false;
      seen.add(displayName);
      return true;
    });
    return [
      { value: 'all', label: t('whatsappInbox.allStatus', 'All Status') },
      ...unique.map((s) => ({ value: s.name, label: getLeadStatusDisplayName(s.name) })),
    ];
  }, [leadStatuses, t]);

  const conversations = useMemo(() => {
    let list = allConversations;
    if (accountFilter) {
      if (accountFilter.startsWith('wa:')) {
        const pnid = accountFilter.slice(3);
        list = list.filter(
          (c) => c.source === 'whatsapp' && (c as WhatsAppConversation).phone_number_id === pnid
        );
      } else if (accountFilter.startsWith('ig:')) {
        const igAccountId = accountFilter.slice(3);
        list = list.filter((c) => {
          if (c.source !== 'instagram') return false;
          return (c as InstagramConversation).instagram_business_account_id === igAccountId;
        });
      } else if (accountFilter.startsWith('fb:')) {
        const fbPageId = accountFilter.slice(3);
        list = list.filter((c) => {
          if (c.source !== 'facebook') return false;
          return (c as FacebookConversation).facebook_page_id === fbPageId;
        });
      } else if (accountFilter.startsWith('th:')) {
        const threadsUserId = accountFilter.slice(3);
        list = list.filter((c) => {
          if (c.source !== 'threads') return false;
          return (c as ThreadsConversation).threads_user_id === threadsUserId;
        });
      } else if (accountFilter.startsWith('email:')) {
        const connId = accountFilter.slice(6);
        list = list.filter((c) => c.source === 'email' && (c as { email_connection_id: string }).email_connection_id === connId);
      }
    }
    if (statusFilter !== 'all') {
      list = list.filter((c) => (c as { lead_status_name?: string | null }).lead_status_name === statusFilter);
    }
    return list;
  }, [allConversations, accountFilter, statusFilter]);

  const selectedConversation = useMemo(() => {
    if (!ticketId?.trim()) return null;
    const tid = ticketId.trim().toUpperCase();
    return conversations.find((c) => getConversationTicketId(c) === tid) ?? null;
  }, [ticketId, conversations]);

  // Global realtime: show system notification on inbound message (list view or app in background)
  useLiveChatInboundNotification(selectedConversation?.id ?? null);

  const isLoading = waLoading || igLoading || fbLoading || emailLoading;
  const invalidTicketId = !!(ticketId?.trim() && !isLoading && !selectedConversation);

  useEffect(() => {
    if (!invalidTicketId) return;
    setShowInvalidTicketBanner(true);
    navigate(CONSULTANT_LIVECHAT_PATH, { replace: true });
  }, [invalidTicketId, navigate]);

  useEffect(() => {
    if (!showInvalidTicketBanner) return;
    const tId = window.setTimeout(() => setShowInvalidTicketBanner(false), 4000);
    return () => window.clearTimeout(tId);
  }, [showInvalidTicketBanner]);

  const handleSelectConversation = (conv: LiveChatConversation) => {
    navigate(`${CONSULTANT_LIVECHAT_PATH}?ticket_id=${encodeURIComponent(getConversationTicketId(conv))}`);
  };

  const handleSelectFromSearch = (
    conv: LiveChatConversation,
    opts?: { textQuery?: string; messageId?: string }
  ) => {
    setScrollToTextInChat(opts?.textQuery ?? null);
    setScrollToMessageId(opts?.messageId ?? null);
    navigate(`${CONSULTANT_LIVECHAT_PATH}?ticket_id=${encodeURIComponent(getConversationTicketId(conv))}`);
  };

  const handleBack = () => {
    navigate(CONSULTANT_LIVECHAT_PATH);
  };

  const refreshLiveChat = useCallback(() => {
    return Promise.all([refetchWa(), refetchIg(), refetchFb(), refetchEmail()]);
  }, [refetchWa, refetchIg, refetchFb, refetchEmail]);

  if (ticketId && selectedConversation) {
    return (
      <LiveChatChatView
        selectedConversation={selectedConversation}
        onBack={handleBack}
        waAccounts={waAccounts}
        scrollToTextInChat={scrollToTextInChat}
        scrollToMessageId={scrollToMessageId}
        onScrollToTextDone={() => setScrollToTextInChat(null)}
        onScrollToMessageDone={() => setScrollToMessageId(null)}
      />
    );
  }

  return (
    <LiveChatListView
      conversations={conversations}
      isLoading={isLoading}
      error={waError ?? igError ?? fbError ?? emailError}
      waAccounts={waAccounts}
      accountOptions={accountOptions}
      accountFilter={accountFilter}
      setAccountFilter={setAccountFilter}
      statusFilter={statusFilter}
      setStatusFilter={setStatusFilter}
      statusOptions={statusOptions}
      initialTicketId={ticketId}
      onSelectConversation={handleSelectConversation}
      onSelectFromSearch={handleSelectFromSearch}
      invalidTicketId={showInvalidTicketBanner}
      onRefetch={refreshLiveChat}
    />
  );
}
