import React, { useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Search, User, MessageCircle, Check, CheckCheck } from 'lucide-react';
import { useWhatsAppConversations } from '../../hooks/useWhatsAppConversations';
import { useWhatsAppMessageSearch, type WhatsAppMessageSearchResult } from '../../hooks/useWhatsAppMessageSearch';
import { useWhatsAppConfig } from '../../hooks/useWhatsAppConfig';
import { useWhatsAppUnreadByConversation } from '../../hooks/useWhatsAppUnreadByConversation';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { supabase } from '@/shared/lib/supabaseClient';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import type { LiveChatConversation, WhatsAppConversation } from '../../types';
import type { EmailConversation } from '../../types';
import { stripHtmlForPreview } from './ConversationList';

/** WhatsApp icon for platform label */
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function maskPhoneLast4(phone: string | null | undefined): string {
  if (phone == null || phone === '') return '';
  const s = String(phone).trim();
  if (s.length <= 4) return '****';
  return s.slice(0, -4) + '****';
}

/** Format date like "Friday" for same week day name, or "26/09/2025" for older */
function formatMessageDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.floor((today.getTime() - d.getTime()) / (24 * 60 * 60 * 1000));
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'long' });
  return d.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: '2-digit' }).replace(/\//g, '/');
}

/** Format like "Today, 11:18 AM" for conversation list */
function formatTimeLong(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const dDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (dDate.getTime() === today.getTime()) return `Today, ${timeStr}`;
  if (dDate.getTime() === yesterday.getTime()) return `Yesterday, ${timeStr}`;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ', ' + timeStr;
}

/** Escape special regex chars */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Snippet: highlight query dengan warna brand (primary). Max 2 baris, tidak overflow. */
function HighlightSnippet({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  const baseClass = 'text-xs text-gray-700 flex-1 min-w-0 overflow-hidden line-clamp-2 break-words';
  if (!q) return <span className={baseClass}>{text}</span>;
  try {
    const re = new RegExp(`(${escapeRegex(q)})`, 'gi');
    const parts = text.split(re);
    return (
      <span className={baseClass}>
        {parts.map((part, i) =>
          part.toLowerCase() === q.toLowerCase() ? (
            <mark key={i} className="rounded bg-primary/25 px-0.5 font-medium text-foreground">
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </span>
    );
  } catch {
    return <span className={baseClass}>{text}</span>;
  }
}

export interface SearchConversationPopupProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onSelectConversation: (conv: LiveChatConversation) => void;
  /** When user clicks a message result (WhatsApp-style), open chat and highlight this message */
  onSelectMessageResult?: (conv: LiveChatConversation, messageId: string) => void;
  selectedId?: string | null;
  /** Optional merged list (WhatsApp + Instagram + Email). When provided, used instead of useWhatsAppConversations so search includes all channels. */
  conversations?: LiveChatConversation[];
}

export function SearchConversationPopup({
  searchQuery,
  onSearchChange,
  onSelectConversation,
  onSelectMessageResult,
  selectedId = null,
  conversations: conversationsProp,
}: SearchConversationPopupProps) {
  const { t } = useAppTranslation();
  const queryClient = useQueryClient();
  const { organizationId } = useCurrentOrg();
  const { data: waConversations = [], isLoading, error } = useWhatsAppConversations();
  const conversations: LiveChatConversation[] = conversationsProp ?? waConversations;
  const { data: messageResults = [], isLoading: isSearchingMessages } = useWhatsAppMessageSearch(searchQuery);
  const { config: whatsappConfig } = useWhatsAppConfig();
  const { unreadByConversation, markConversationRead } = useWhatsAppUnreadByConversation();
  const businessName = whatsappConfig?.whatsapp_business_name ?? whatsappConfig?.display_phone_number ?? null;

  const convById = useMemo(() => {
    const m: Record<string, LiveChatConversation> = {};
    conversations.forEach((c) => { m[c.id] = c; });
    return m;
  }, [conversations]);

  const filteredConversations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((conv) => {
      const name = (conv.customer_name ?? '').toLowerCase();
      const lastBody = (conv.last_message_body ?? '').toLowerCase();
      if (conv.source === 'instagram') {
        const igId = (conv as { customer_ig_id?: string }).customer_ig_id ?? '';
        return name.includes(q) || igId.toLowerCase().includes(q) || lastBody.includes(q);
      }
      const waId = (conv.customer_wa_id ?? '').toLowerCase();
      return name.includes(q) || waId.includes(q) || lastBody.includes(q);
    });
  }, [conversations, searchQuery]);

  const conversationIdsFromMessageResults = useMemo(
    () => new Set(messageResults.map((r) => r.conversation_id)),
    [messageResults]
  );
  const contactMatchesNotInMessageResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return filteredConversations.filter((c) => !conversationIdsFromMessageResults.has(c.id));
  }, [filteredConversations, conversationIdsFromMessageResults, searchQuery]);

  const hasMessageResults = searchQuery.trim() && messageResults.length > 0;
  const hasContactOnlyMatches = contactMatchesNotInMessageResults.length > 0;
  const showConversationListOnly = !searchQuery.trim() || (!hasMessageResults && !hasContactOnlyMatches && filteredConversations.length > 0);

  const handleSelectConv = (conv: LiveChatConversation) => {
    if (conv.source === 'whatsapp') {
      if (unreadByConversation[conv.id] > 0) markConversationRead(conv.id).catch(() => {});
      supabase
        .from('whatsapp_conversations')
        .update({ last_opened_at: new Date().toISOString() })
        .eq('id', conv.id)
        .then(() => {
          if (organizationId) queryClient.invalidateQueries({ queryKey: ['leads', organizationId] });
        })
        .catch(() => {});
    }
    onSelectConversation(conv);
  };

  const handleSelectMessageResult = (row: WhatsAppMessageSearchResult) => {
    const conv = convById[row.conversation_id];
    if (!conv) return;
    if (unreadByConversation[conv.id] > 0) markConversationRead(conv.id).catch(() => {});
    supabase
      .from('whatsapp_conversations')
      .update({ last_opened_at: new Date().toISOString() })
      .eq('id', conv.id)
      .then(() => {
        if (organizationId) queryClient.invalidateQueries({ queryKey: ['leads', organizationId] });
      })
      .catch(() => {});
    onSelectMessageResult?.(conv, row.message_id);
  };

  const messageListContent = (
    <ul className="divide-y divide-gray-100 overflow-y-auto overflow-x-hidden seamless-scroll max-h-[min(50vh,320px)] min-h-0">
      {messageResults.map((row) => {
        const conv = convById[row.conversation_id];
        const displayName = conv ? (conv.source === 'instagram' && !conv.customer_name?.trim() ? t('whatsappInbox.instagramContact', 'Kontak Instagram') : (conv.customer_name || maskPhoneLast4(conv.source === 'instagram' ? (conv as { customer_ig_id?: string }).customer_ig_id : conv.customer_wa_id) || 'Unknown')) : '—';
        const body = stripHtmlForPreview(row.body ?? '');
        const isOutbound = row.direction === 'outbound';
        return (
          <li
            key={row.message_id}
            role="button"
            tabIndex={0}
            onClick={() => handleSelectMessageResult(row)}
            onKeyDown={(e) => e.key === 'Enter' && handleSelectMessageResult(row)}
            className="flex items-start gap-3 px-3 py-2.5 cursor-pointer rounded-lg transition-colors hover:bg-gray-50 min-w-0 overflow-hidden"
          >
            <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 shrink-0">
              <User className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0 overflow-hidden">
              <div className="flex justify-between items-center gap-2">
                <span className="font-semibold text-gray-900 truncate">{displayName}</span>
                <span className="text-xs text-gray-500 shrink-0">{formatMessageDate(row.created_at)}</span>
              </div>
              <div className="flex items-start gap-2 min-h-0 mt-0.5 overflow-hidden">
                {isOutbound && (
                  <span className="shrink-0 text-gray-500 mt-0.5">
                    <CheckCheck className="w-3.5 h-3.5 text-primary" />
                  </span>
                )}
                <HighlightSnippet text={body} query={searchQuery.trim()} />
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );

  const conversationListContent = (
    <ul className="divide-y divide-gray-100 overflow-y-auto overflow-x-hidden seamless-scroll max-h-[min(50vh,320px)] min-h-0">
      {filteredConversations.length === 0 ? (
        <li className="py-8 text-center text-sm text-gray-500">
          {searchQuery.trim()
            ? t('whatsappInbox.noSearchResults', 'No conversations or contacts match your search.')
            : t('whatsappInbox.noConversationsYet', 'No conversations yet.')}
        </li>
      ) : (
        filteredConversations.map((conv) => {
          const unread = unreadByConversation[conv.id] ?? 0;
          const displayName = conv.source === 'instagram' && !conv.customer_name?.trim() ? t('whatsappInbox.instagramContact', 'Kontak Instagram') : (conv.customer_name || maskPhoneLast4(conv.source === 'instagram' ? (conv as { customer_ig_id?: string }).customer_ig_id : conv.customer_wa_id) || 'Unknown');
          const isSelected = selectedId === conv.id;
          const lastBodyRaw = conv.last_message_body ?? '';
          const lastBody = stripHtmlForPreview(lastBodyRaw);
          const subject = conv.source === 'email' ? (conv as EmailConversation).thread_subject?.trim() ?? '' : '';
          const displayText = lastBody !== '' ? lastBody : subject;
          const showHighlight = searchQuery.trim() && displayText.toLowerCase().includes(searchQuery.trim().toLowerCase());
          return (
            <li
              key={conv.id}
              role="button"
              tabIndex={0}
              onClick={() => handleSelectConv(conv)}
              onKeyDown={(e) => e.key === 'Enter' && handleSelectConv(conv)}
              className={`flex items-start gap-3 px-3 py-3 cursor-pointer rounded-lg transition-colors hover:bg-gray-50 min-w-0 overflow-hidden ${isSelected ? 'bg-primary/10' : ''}`}
            >
              <div className="relative shrink-0">
                <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500">
                  <User className="w-5 h-5" />
                </div>
                {unread > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground">
                    {unread > 99 ? '99+' : unread}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0 overflow-hidden">
                <div className="flex justify-between items-start gap-2">
                  <span className="font-semibold text-gray-900 truncate">{displayName}</span>
                  <span className="text-xs text-gray-500 shrink-0">{formatTimeLong(conv.last_message_at)}</span>
                </div>
                <div className="flex items-start gap-2 min-h-0 mt-0.5 overflow-hidden">
                  {conv.last_message_direction === 'outbound' && (
                    <span className="shrink-0 text-gray-500">
                      {conv.last_message_status === 'read' ? (
                        <CheckCheck className="w-3.5 h-3.5 text-primary" />
                      ) : (
                        <CheckCheck className="w-3.5 h-3.5" />
                      )}
                    </span>
                  )}
                  {lastBody || subject ? (
                    showHighlight ? (
                      <HighlightSnippet text={displayText} query={searchQuery.trim()} />
                    ) : (
                      <span className="text-xs text-gray-500 truncate flex-1 min-w-0" title={displayText}>{displayText}</span>
                    )
                  ) : (
                    <span className="text-xs text-gray-500 italic flex-1 min-w-0">—</span>
                  )}
                </div>
                {businessName && (
                  <div className="flex items-center gap-1.5 mt-1 min-w-0">
                    <span className="h-4 w-4 shrink-0 text-primary" aria-hidden><WhatsAppIcon className="h-4 w-4" /></span>
                    <span className="text-xs text-gray-400 truncate" title={businessName}>{businessName}</span>
                  </div>
                )}
              </div>
            </li>
          );
        })
      )}
    </ul>
  );

  const combinedListContent = (
    <ul className="divide-y divide-gray-100 overflow-y-auto overflow-x-hidden seamless-scroll max-h-[min(50vh,320px)] min-h-0">
      {messageResults.map((row) => {
        const conv = convById[row.conversation_id];
        const displayName = conv ? (conv.source === 'instagram' && !conv.customer_name?.trim() ? t('whatsappInbox.instagramContact', 'Kontak Instagram') : (conv.customer_name || maskPhoneLast4(conv.source === 'instagram' ? (conv as { customer_ig_id?: string }).customer_ig_id : conv.customer_wa_id) || 'Unknown')) : '—';
        const body = stripHtmlForPreview(row.body ?? '');
        const isOutbound = row.direction === 'outbound';
        return (
          <li
            key={`msg-${row.message_id}`}
            role="button"
            tabIndex={0}
            onClick={() => handleSelectMessageResult(row)}
            onKeyDown={(e) => e.key === 'Enter' && handleSelectMessageResult(row)}
            className="flex items-start gap-3 px-3 py-2.5 cursor-pointer rounded-lg transition-colors hover:bg-gray-50 min-w-0 overflow-hidden"
          >
            <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 shrink-0">
              <User className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0 overflow-hidden">
              <div className="flex justify-between items-center gap-2">
                <span className="font-semibold text-gray-900 truncate">{displayName}</span>
                <span className="text-xs text-gray-500 shrink-0">{formatMessageDate(row.created_at)}</span>
              </div>
              <div className="flex items-start gap-2 min-h-0 mt-0.5 overflow-hidden">
                {isOutbound && (
                  <span className="shrink-0 text-gray-500 mt-0.5">
                    <CheckCheck className="w-3.5 h-3.5 text-primary" />
                  </span>
                )}
                <HighlightSnippet text={body} query={searchQuery.trim()} />
              </div>
            </div>
          </li>
        );
      })}
      {contactMatchesNotInMessageResults.map((conv) => {
        const unread = unreadByConversation[conv.id] ?? 0;
        const displayName = conv.channel === 'instagram' && !conv.customer_name?.trim() ? t('whatsappInbox.instagramContact', 'Kontak Instagram') : (conv.customer_name || maskPhoneLast4(conv.customer_wa_id) || 'Unknown');
        const isSelected = selectedId === conv.id;
        const lastBodyRaw = conv.last_message_body ?? '';
        const lastBody = stripHtmlForPreview(lastBodyRaw);
        const subject = conv.source === 'email' ? (conv as EmailConversation).thread_subject?.trim() ?? '' : '';
        const displayText = lastBody !== '' ? lastBody : subject;
        const showHighlight = searchQuery.trim() && displayText.toLowerCase().includes(searchQuery.trim().toLowerCase());
        return (
          <li
            key={`conv-${conv.id}`}
            role="button"
            tabIndex={0}
            onClick={() => handleSelectConv(conv)}
            onKeyDown={(e) => e.key === 'Enter' && handleSelectConv(conv)}
            className={`flex items-start gap-3 px-3 py-3 cursor-pointer rounded-lg transition-colors hover:bg-gray-50 min-w-0 overflow-hidden ${isSelected ? 'bg-primary/10' : ''}`}
          >
            <div className="relative shrink-0">
              <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500">
                <User className="w-5 h-5" />
              </div>
              {unread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground">
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0 overflow-hidden">
              <div className="flex justify-between items-start gap-2">
                <span className="font-semibold text-gray-900 truncate">{displayName}</span>
                <span className="text-xs text-gray-500 shrink-0">{formatTimeLong(conv.last_message_at)}</span>
              </div>
              <div className="flex items-start gap-2 min-h-0 mt-0.5 overflow-hidden">
                {conv.last_message_direction === 'outbound' && (
                  <span className="shrink-0 text-gray-500">
                    {conv.last_message_status === 'read' ? (
                      <CheckCheck className="w-3.5 h-3.5 text-primary" />
                    ) : (
                      <CheckCheck className="w-3.5 h-3.5" />
                    )}
                  </span>
                )}
                {lastBody || subject ? (
                  showHighlight ? (
                    <HighlightSnippet text={displayText} query={searchQuery.trim()} />
                  ) : (
                    <span className="text-xs text-gray-500 truncate flex-1 min-w-0" title={displayText}>{displayText}</span>
                  )
                ) : (
                  <span className="text-xs text-gray-500 italic flex-1 min-w-0">—</span>
                )}
              </div>
              {businessName && (
                <div className="flex items-center gap-1.5 mt-1 min-w-0">
                  <span className="h-4 w-4 shrink-0 text-primary" aria-hidden><WhatsAppIcon className="h-4 w-4" /></span>
                  <span className="text-xs text-gray-400 truncate" title={businessName}>{businessName}</span>
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );

  const listContent = showConversationListOnly ? conversationListContent : (hasMessageResults || hasContactOnlyMatches ? combinedListContent : conversationListContent);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden pt-3">
      <div className="relative flex-shrink-0">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t('whatsappInbox.searchConversations', 'Search conversation or people')}
          className="w-full rounded-full border border-primary/25 bg-background py-2.5 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
          aria-label={t('whatsappInbox.searchConversations', 'Search conversation or people')}
          autoFocus
        />
      </div>
      <div className="mt-4 flex flex-col min-h-0 overflow-hidden flex-1">
        {isLoading ? (
          <div className="py-6 text-center text-sm text-gray-500 flex items-center justify-center gap-2">
            <MessageCircle className="w-4 h-4 animate-pulse" />
            {t('whatsappInbox.loading', 'Loading...')}
          </div>
        ) : error ? (
          <div className="py-6 text-center text-sm text-red-600">Failed to load.</div>
        ) : searchQuery.trim() && isSearchingMessages && !hasMessageResults ? (
          <div className="py-6 text-center text-sm text-gray-500 flex items-center justify-center gap-2">
            <MessageCircle className="w-4 h-4 animate-pulse" />
            {t('whatsappInbox.searchingInChats', 'Searching in chats...')}
          </div>
        ) : (
          listContent
        )}
      </div>
    </div>
  );
}
