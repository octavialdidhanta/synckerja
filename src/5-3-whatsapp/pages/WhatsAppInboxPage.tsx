import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getConversationTicketId } from '../components/inbox/ConversationList';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PanelRightOpen, PanelRightClose, Search } from 'lucide-react';
import { getLeadStatusDisplayName } from '@/5-1-leads-management/utils/leadStatusDisplay';
import { HeaderAndTab } from '@/5-3-dashboard/components/layout/HeaderAndTab';
import { ConversationList } from '../components/inbox/ConversationList';
import { ChatThread } from '../components/inbox/ChatThread';
import { EmailChatThread } from '../components/inbox/EmailChatThread';
import { LivechatQuickActionPanel } from '../components/inbox/LivechatQuickActionPanel';
import { SearchConversationPopup } from '../components/inbox/SearchConversationPopup';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { useWhatsAppConversations } from '../hooks/useWhatsAppConversations';
import { useInstagramConversations } from '../hooks/useInstagramConversations';
import { useEmailConversations } from '../hooks/useEmailConversations';
import { useWhatsAppAccounts } from '../hooks/useWhatsAppAccounts';
import { useInstagramAccounts } from '../hooks/useInstagramAccounts';
import { useEmailConnections } from '../hooks/useEmailConnections';
import { useWhatsAppLivechatPageSkeletonGate } from '../hooks/useWhatsAppLivechatPageSkeletonGate';
import { WhatsAppLivechatPageSkeleton } from '../skeletons/WhatsAppLivechatPageSkeleton';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useServices } from '@/6-1-product-knowledge/hooks/useServices';
import { useSubServices } from '@/6-1-product-knowledge/hooks/useSubServices';
import { supabase } from '@/shared/lib/supabaseClient';
import { cn } from '@/shared/lib/utils';
import type { LiveChatConversation, WhatsAppConversation, InstagramConversation } from '../types';

type AccountFilterValue = '' | `wa:${string}` | `ig:${string}` | `email:${string}`;

export function WhatsAppInboxPage() {
  const { t } = useAppTranslation();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { organizationId, loading: orgLoading } = useCurrentOrg();
  const hasOrg = Boolean(organizationId);
  const { data: waConversations = [], isLoading: waLoading, error: waError } = useWhatsAppConversations();
  const { data: igConversations = [], isLoading: igLoading, error: igError } = useInstagramConversations();

  const { data: leadStatuses = [], isLoading: leadStatusesLoading } = useQuery({
    queryKey: ['lead-statuses'],
    queryFn: async () => {
      const { data, error } = await supabase.from('lead_statuses').select('id, name, color').eq('is_active', true).order('sort_order');
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; name: string; color: string | null }>;
    },
    staleTime: 60_000,
  });
  const { data: emailConversations = [], isLoading: emailLoading, error: emailError } = useEmailConversations();
  const { accounts: waAccounts, isLoading: waAccountsLoading } = useWhatsAppAccounts();
  const { accounts: igAccounts, isLoading: igAccountsLoading } = useInstagramAccounts();
  const { connections: emailConnections, isLoading: emailConnectionsLoading } = useEmailConnections();
  const { isPending: servicesPending } = useServices();
  const { isPending: subServicesPending } = useSubServices();

  const rawPagePending = useMemo(
    () =>
      orgLoading ||
      (hasOrg &&
        (waLoading ||
          igLoading ||
          emailLoading ||
          waAccountsLoading ||
          igAccountsLoading ||
          emailConnectionsLoading ||
          leadStatusesLoading ||
          servicesPending ||
          subServicesPending)),
    [
      orgLoading,
      hasOrg,
      waLoading,
      igLoading,
      emailLoading,
      waAccountsLoading,
      igAccountsLoading,
      emailConnectionsLoading,
      leadStatusesLoading,
      servicesPending,
      subServicesPending,
    ],
  );
  const showSkeleton = useWhatsAppLivechatPageSkeletonGate(rawPagePending);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isQuickActionExpanded, setIsQuickActionExpanded] = useState(true);
  const [conversationSearch, setConversationSearch] = useState('');
  const [searchPopupOpen, setSearchPopupOpen] = useState(false);
  const [accountFilter, setAccountFilter] = useState<AccountFilterValue>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [scrollToTextInChat, setScrollToTextInChat] = useState<string | null>(null);
  const [scrollToMessageId, setScrollToMessageId] = useState<string | null>(null);
  const initialConversationId = searchParams.get('conversation');
  const initialTicketId = searchParams.get('ticket_id');

  const allConversations: LiveChatConversation[] = useMemo(() => {
    const wa: LiveChatConversation[] = (waConversations as WhatsAppConversation[]).map((c) => ({ ...c, source: 'whatsapp' as const }));
    const ig: LiveChatConversation[] = (igConversations as InstagramConversation[]).map((c) => ({ ...c, source: 'instagram' as const }));
    const email: LiveChatConversation[] = emailConversations.map((c) => ({ ...c, source: 'email' as const }));
    const merged = [...wa, ...ig, ...email];
    merged.sort((a, b) => {
      const aAt = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
      const bAt = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
      return bAt - aAt;
    });
    return merged;
  }, [waConversations, igConversations, emailConversations]);

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
    });
    emailConnections.forEach((conn) => {
      opts.push({ value: `email:${conn.id}` as const, label: `Email - ${conn.email_address}` });
    });
    return opts;
  }, [waAccounts, igAccounts, emailConnections, t]);

  const uniqueLeadStatusOptions = useMemo(() => {
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
    return sorted.filter((s) => {
      const displayName = getLeadStatusDisplayName(s.name);
      if (seen.has(displayName)) return false;
      seen.add(displayName);
      return true;
    });
  }, [leadStatuses]);

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

  const selectedConversation = useMemo(
    () => (selectedId ? conversations.find((c) => c.id === selectedId) ?? null : null),
    [conversations, selectedId]
  );

  const handleSelectConversation = (conv: LiveChatConversation) => {
    setSelectedId(conv.id);
    setSearchParams({ ticket_id: getConversationTicketId(conv) }, { replace: true });
  };

  return (
      <div className="relative flex min-h-0 flex-1 flex-col bg-surface-muted font-sans">
        <div
          className={cn(
            'flex flex-1 min-h-0',
            showSkeleton && 'invisible pointer-events-none select-none',
          )}
          aria-hidden={showSkeleton}
        >
        <div className="flex min-h-0 flex-1 flex-col pl-2 pr-4 pb-4 sm:pl-3">
            <div className="h-full flex flex-col">
              <div className="flex-shrink-0">
                <HeaderAndTab />
              </div>
              <div className="flex-1 min-h-0 min-w-0 overflow-hidden flex flex-row max-w-full rounded-lg border border-gray-200 shadow-sm bg-white max-h-[calc(100vh-120px)]">
                {/* Kiri: daftar conversation - sidebar */}
                <aside className="flex-shrink-0 border-r border-gray-200 flex flex-col min-h-0 bg-white" style={{ width: '20rem', minWidth: '20rem' }} aria-label="Conversations">
                  <div className="flex-shrink-0 px-2 py-2 border-b border-gray-200 bg-gray-50">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Select value={accountFilter || 'all'} onValueChange={(v) => setAccountFilter((v === 'all' ? '' : v) as AccountFilterValue)}>
                        <SelectTrigger className="h-8 px-2 min-w-[6rem] max-w-[10rem] flex-1 text-sm font-medium text-gray-900 border-gray-200 bg-white" aria-label={t('whatsappInbox.filterByAccount', 'Filter menurut akun')}>
                          <SelectValue placeholder={t('whatsappInbox.filterByAccount', 'Filter menurut akun')} />
                        </SelectTrigger>
                        <SelectContent className="bg-white border shadow-md z-50 max-h-[min(60vh,400px)]">
                          {accountOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value} className="text-sm">
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="h-8 px-2 w-[7.5rem] shrink-0 text-sm font-medium text-gray-900 border-gray-200 bg-white" aria-label={t('whatsappInbox.filterByStatus', 'Filter menurut status')}>
                          <SelectValue placeholder={t('whatsappInbox.status', 'Status')} />
                        </SelectTrigger>
                        <SelectContent className="bg-white border shadow-md z-50 max-h-[min(60vh,400px)]">
                          <SelectItem value="all" className="text-sm">
                            {t('whatsappInbox.allStatus', 'All Status')}
                          </SelectItem>
                          {uniqueLeadStatusOptions.map((status) => (
                            <SelectItem key={status.id} value={status.name} className="text-sm">
                              {getLeadStatusDisplayName(status.name)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <button
                        type="button"
                        onClick={() => setSearchPopupOpen(true)}
                        className="shrink-0 h-8 w-8 flex items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                        title={t('whatsappInbox.searchConversations', 'Search conversation or people')}
                        aria-label={t('whatsappInbox.searchConversations', 'Search conversation or people')}
                      >
                        <Search className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <Dialog open={searchPopupOpen} onOpenChange={(open) => { setSearchPopupOpen(open); if (!open) setConversationSearch(''); }}>
                    <DialogContent className="sm:max-w-md max-h-[85vh] overflow-hidden flex flex-col p-4">
                      <DialogHeader className="flex-shrink-0">
                        <DialogTitle>{t('whatsappInbox.searchConversations', 'Search conversation or people')}</DialogTitle>
                      </DialogHeader>
                      <div className="min-h-0 flex flex-col overflow-hidden flex-1">
                      <SearchConversationPopup
                        searchQuery={conversationSearch}
                        onSearchChange={setConversationSearch}
                        conversations={conversations}
                        onSelectConversation={(conv) => {
                          handleSelectConversation(conv);
                          setSearchPopupOpen(false);
                          setScrollToTextInChat(conversationSearch.trim() || null);
                          setScrollToMessageId(null);
                        }}
                        onSelectMessageResult={(conv, messageId) => {
                          handleSelectConversation(conv);
                          setSearchPopupOpen(false);
                          setScrollToMessageId(messageId);
                          setScrollToTextInChat(null);
                        }}
                        selectedId={selectedId}
                      />
                      </div>
                    </DialogContent>
                  </Dialog>
                  <div className="flex-1 overflow-y-auto overflow-x-hidden seamless-scroll nested-scroll-touch-chain min-h-0">
                    <ConversationList
                      conversations={conversations}
                      error={waError ?? igError ?? emailError}
                      selectedId={selectedId}
                      onSelect={handleSelectConversation}
                      initialConversationId={initialConversationId}
                      initialTicketId={initialTicketId}
                      searchQuery={conversationSearch.trim()}
                      accountFilter={accountFilter || undefined}
                      waAccountsForHint={waAccounts.map((a) => ({ display_phone_number: a.display_phone_number, phone_number_id: a.phone_number_id }))}
                    />
                  </div>
                </aside>
                {/* Tengah: chat thread */}
                <main className="flex-1 min-w-0 flex flex-col min-h-0 overflow-hidden" role="main">
                  {selectedConversation?.source === 'email' ? (
                    <EmailChatThread conversation={selectedConversation} />
                  ) : selectedConversation ? (
                    <ChatThread
                      conversation={selectedConversation}
                      connectedPhoneNumberIds={waAccounts.map((a) => a.phone_number_id)}
                      hasNoConnectedWhatsAppAccount={waAccounts.length === 0}
                      scrollToTextInChat={scrollToTextInChat}
                      onScrollToTextDone={() => setScrollToTextInChat(null)}
                      scrollToMessageId={scrollToMessageId}
                      onScrollToMessageDone={() => setScrollToMessageId(null)}
                    />
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-500 p-4">
                      <p className="text-sm">{t('whatsappInbox.selectConversation', 'Pilih percakapan untuk melihat dan membalas.')}</p>
                    </div>
                  )}
                </main>
                {/* Kanan: quick action - sidebar (bisa collapse agar body chat lebih luas) */}
                <aside
                  className="flex-shrink-0 border-l border-gray-200 flex flex-col min-h-0 bg-white transition-[width] duration-200"
                  style={{ width: isQuickActionExpanded ? '20rem' : '3rem', minWidth: isQuickActionExpanded ? '20rem' : '3rem' }}
                  aria-label="Quick Action"
                  aria-expanded={isQuickActionExpanded}
                >
                  {isQuickActionExpanded ? (
                    <>
                      <div className="flex-shrink-0 px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between gap-2">
                        <h2 className="font-semibold text-gray-900 truncate">{t('whatsappInbox.quickAction', 'Quick Action')}</h2>
                        <button
                          type="button"
                          onClick={() => setIsQuickActionExpanded(false)}
                          className="shrink-0 p-1.5 rounded hover:bg-gray-200 text-gray-600"
                          title={t('whatsappInbox.collapseQuickAction', 'Collapse sidebar')}
                          aria-label={t('whatsappInbox.collapseQuickAction', 'Collapse sidebar')}
                        >
                          <PanelRightClose className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 min-h-0 overflow-x-hidden overflow-y-auto p-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        <LivechatQuickActionPanel conversation={selectedConversation ?? null} />
                      </div>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsQuickActionExpanded(true)}
                      className="flex-1 flex flex-col items-center justify-center py-4 text-gray-600 hover:bg-gray-50"
                      title={t('whatsappInbox.expandQuickAction', 'Expand Quick Action')}
                      aria-label={t('whatsappInbox.expandQuickAction', 'Expand Quick Action')}
                    >
                      <PanelRightOpen className="w-5 h-5" />
                    </button>
                  )}
                </aside>
              </div>
            </div>
        </div>
        </div>
        {showSkeleton ? (
          <div
            className="absolute inset-0 z-20 overflow-hidden bg-surface-muted"
            aria-busy
            aria-label={t('pageAccess.loading', 'Loading…')}
          >
            <WhatsAppLivechatPageSkeleton />
            <span className="sr-only">{t('pageAccess.loading', 'Loading…')}</span>
          </div>
        ) : null}
      </div>
  );
}
