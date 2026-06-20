import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useLivechatUnreadByConversation } from '../../hooks/useLivechatUnreadByConversation';
import { useEmailUnreadByConversation } from '../../hooks/useEmailUnreadByConversation';
import { useLivechatProfilePhoto } from '../../hooks/useLivechatProfilePhoto';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { supabase } from '@/shared/lib/supabaseClient';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar';
import type { LiveChatConversation } from '../../types';
import type { WhatsAppConversation } from '../../types';
import { MessageCircle, Check, CheckCheck, Mail, User, ListChecks } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { devLog } from '@/shared/lib/logger';
import { isResolvedStatus } from '../../constants/leadStatus';
import { stripSurveyLinksFromText } from '@/features/customer-survey/utils/customerSurveyAgentVisibility';

/** Ikon platform chat (akun terconnect). WhatsApp, Instagram, atau Email. */
function ChannelIcon({ channel = 'whatsapp', className }: { channel?: string; className?: string }) {
  const c = (channel || 'whatsapp').toLowerCase();
  if (c === 'instagram') {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.268 4.771 1.691 5.077 4.97.06 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.296 3.225-1.824 4.771-5.077 4.97-1.266.06-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.194-4.771-1.691-5.077-4.97-.06-1.265-.07-1.644-.07-4.849 0-3.205.013-3.583.07-4.849.299-3.267 1.817-4.771 5.077-4.97 1.266-.059 1.645-.07 4.849-.07zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
      </svg>
    );
  }
  if (c === 'facebook' || c === 'messenger') {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2C6.477 2 2 6.145 2 11.243c0 2.891 1.436 5.474 3.684 7.157V22l3.372-1.848c.896.248 1.843.382 2.832.382 5.523 0 10-4.145 10-9.243C22 6.145 17.523 2 12 2zm.995 12.41h-2.52c-.276 0-.5-.224-.5-.5s.224-.5.5-.5h2.52c.276 0 .5.224.5.5s-.224.5-.5.5zm2.835-3.32h-7.69c-.276 0-.5-.224-.5-.5s.224-.5.5-.5h7.69c.276 0 .5.224.5.5s-.224.5-.5.5z" />
      </svg>
    );
  }
  if (c === 'email') {
    return <Mail className={className} />;
  }
  if (c === 'threads') {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.2 7.8l-1.4 1.4-2.8-2.8-2.8 2.8-1.4-1.4 4.2-4.2 4.2 4.2z" />
      </svg>
    );
  }
  // WhatsApp (default)
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

/** Avatar dengan foto asli dari API (WhatsApp) dan overlay logo channel (WhatsApp/Instagram/Email) di kanan bawah. */
function LivechatAvatar({
  conv,
  displayName,
}: {
  conv: LiveChatConversation;
  displayName: string;
}) {
  const isEmail = conv.source === 'email';
  const isInstagram = conv.source === 'instagram';
  const isFacebook = conv.source === 'facebook';
  const isThreads = conv.source === 'threads';
  const waConv = conv as WhatsAppConversation;
  const channel = isInstagram ? 'instagram' : isFacebook ? 'facebook' : isThreads ? 'threads' : (waConv.channel ?? 'whatsapp');

  const { profileUrl } = useLivechatProfilePhoto(conv.id, {
    source: conv.source,
    channel,
  });

  const initials = displayName
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?';

  const overlayColor =
    channel === 'instagram'
      ? 'bg-[#E4405F]'
      : channel === 'facebook'
        ? 'bg-[#1877F2]'
        : isEmail
          ? 'bg-blue-600'
          : 'bg-[#25D366]';

  return (
    <div className="relative shrink-0">
      <Avatar className="h-11 w-11 rounded-full bg-gray-200">
        <AvatarImage src={profileUrl ?? undefined} alt={displayName} className="object-cover" />
        <AvatarFallback className="rounded-full bg-gray-300 text-gray-600 text-sm font-medium">
          {initials || <User className="h-5 w-5" />}
        </AvatarFallback>
      </Avatar>
      <span
        className={`absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white ${overlayColor} text-white`}
        aria-hidden
      >
        <ChannelIcon
          channel={isEmail ? 'email' : channel}
          className="h-3.5 w-3.5"
        />
      </span>
    </div>
  );
}

/** One WhatsApp account for empty-state hint (display_phone_number, phone_number_id). */
export type WhatsAppAccountForHint = { display_phone_number?: string | null; phone_number_id: string };

interface ConversationListProps {
  /** Unified list (WhatsApp + Email). */
  conversations: LiveChatConversation[];
  selectedId: string | null;
  onSelect: (conv: LiveChatConversation) => void;
  /** When set, select this conversation once the list has loaded (e.g. from Leads "Open Chat" link). */
  initialConversationId?: string | null;
  /** When set (e.g. WA-xxx, EMAIL-xxx from Leads), select the conversation whose ticket_id matches. */
  initialTicketId?: string | null;
  /** Filter conversations by name or phone or email. */
  searchQuery?: string;
  /** Current account filter (e.g. 'wa:956884617514241'). When conversations are empty, show hint with this account's number. */
  accountFilter?: string;
  /** WhatsApp accounts (for empty-state: show "message this number" when filter is one account). */
  waAccountsForHint?: WhatsAppAccountForHint[];
  isLoading?: boolean;
  error?: Error | null;
  /** When gesture locks to horizontal swipe, call with true so parent can disable pull-to-refresh. Call with false when gesture ends. */
  onSwipeLockChange?: (locked: boolean) => void;
}

function formatTime(iso: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

/** Strip HTML tags and comments so preview shows plain text only (no raw HTML/code on cards). Exported for use in search popup and elsewhere. */
export function stripHtmlForPreview(html: string | null | undefined): string {
  if (html == null || html === '') return '';
  let s = String(html)
    .replace(/<!--[\s\S]*?-->/g, ' ')   // HTML comments (closed)
    .replace(/<!--[\s\S]*/g, ' ')      // unclosed comment to end (e.g. truncated "<!-- --")
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')  // closed style blocks
    .replace(/<style[\s\S]*/gi, ' ')            // unclosed <style> to end (e.g. truncated "p { color:#000; ...")
    .replace(/<[^>]*>/g, ' ')          // full tags
    .replace(/<[^>]*$/g, ' ')          // unclosed tag at end (e.g. truncated "<meta ...")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
  // If what's left looks like raw CSS (e.g. "p { color:#000; font-family: ..."), treat as empty so UI can show subject
  if (s.length > 0 && /^\s*\w+\s*\{[\s\S]*/.test(s) && /\b(color|font-family|font-size|margin|padding|background)\s*:/i.test(s)) s = '';
  return s;
}

/** Truncate at quoted-reply block so preview shows only the core message (no "Pada Rab, ..." / "On ... wrote:"). */
function truncateAtQuotedReply(text: string): string {
  if (!text.trim()) return text;
  const t = text.trim();
  const quoteStarts = [
    t.search(/\sPada\s+[A-Za-z]{2,4},\s*\d/), // " Pada Rab, 4 Feb" (ID)
    t.search(/\sOn\s+[A-Za-z]{2,4},\s*.+wrote:/i), // " On Wed, ... wrote:"
    t.search(/\s-{5,}/), // " -----..."
    t.search(/\sFrom\s*:/i),
    t.search(/\sSent\s*:/i),
  ].filter((i) => i >= 0);
  const first = quoteStarts.length > 0 ? Math.min(...quoteStarts) : t.length;
  return t.slice(0, first).trim();
}

/** Plain-text preview for list: strip HTML and remove quoted-reply block. */
function getEmailPreviewSnippet(html: string | null | undefined): string {
  const plain = stripHtmlForPreview(html);
  return truncateAtQuotedReply(plain);
}

/** Mask 4 digit terakhir nomor telepon untuk privasi di UI. */
function maskPhoneLast4(phone: string | null | undefined): string {
  if (phone == null || phone === '') return '';
  const s = String(phone).trim();
  if (s.length <= 4) return '****';
  return s.slice(0, -4) + '****';
}

/** Fallback when from_display_name is NULL: humanize local part of email (e.g. jasafotowedding85 -> Jasa Foto Wedding 85). */
function emailToDisplayLabel(email: string | null | undefined): string {
  if (!email || typeof email !== 'string') return '';
  const local = email.split('@')[0]?.trim() || email;
  if (!local) return email;
  const withSpaces = local.replace(/[._-]+/g, ' ');
  const titleCase = withSpaces.replace(/\b\w/g, (c) => c.toUpperCase());
  return titleCase.trim() || email;
}

/** Derive ticket_id for a conversation (same logic as leads table). Exported for URL sync. */
export function getConversationTicketId(conv: LiveChatConversation): string {
  if (conv.source === 'email') {
    return 'EMAIL-' + String(conv.id).replace(/-/g, '').slice(0, 8).toUpperCase();
  }
  if (conv.source === 'instagram') {
    return 'IG-' + String(conv.id).replace(/-/g, '').slice(0, 8).toUpperCase();
  }
  if (conv.source === 'facebook') {
    return 'FB-' + String(conv.id).replace(/-/g, '').slice(0, 8).toUpperCase();
  }
  if (conv.source === 'threads') {
    const ticket = (conv as { ticket_id?: string | null }).ticket_id;
    return ticket ?? ('TH-' + String(conv.id).replace(/-/g, '').slice(0, 8).toUpperCase());
  }
  return 'WA-' + String(conv.id).replace(/-/g, '').slice(0, 8).toUpperCase();
}

export function ConversationList({
  conversations,
  isLoading = false,
  error = null,
  selectedId,
  onSelect,
  initialConversationId,
  initialTicketId,
  searchQuery = '',
  accountFilter = '',
  waAccountsForHint = [],
  onSwipeLockChange,
}: ConversationListProps) {
  const { t } = useAppTranslation();
  const queryClient = useQueryClient();
  const { organizationId } = useCurrentOrg();
  const { unreadByConversation, markConversationRead } = useLivechatUnreadByConversation();
  const { unreadByConversation: emailUnreadByConversation, markConversationRead: markEmailConversationRead } = useEmailUnreadByConversation();

  const filteredConversations = React.useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.trim().toLowerCase();
    return conversations.filter((conv) => {
      if (conv.source === 'email') {
        const from = (conv.from_email ?? '').toLowerCase();
        const display = (conv.email_connection_display ?? '').toLowerCase();
        const fromName = (conv.from_display_name ?? '').toLowerCase();
        return from.includes(q) || display.includes(q) || fromName.includes(q);
      }
      if (conv.source === 'instagram') {
        const name = (conv.customer_name ?? '').toLowerCase();
        const igId = (conv.customer_ig_id ?? '').toLowerCase();
        return name.includes(q) || igId.includes(q);
      }
      if (conv.source === 'facebook') {
        const name = (conv.customer_name ?? '').toLowerCase();
        const psid = (conv.customer_psid ?? '').toLowerCase();
        return name.includes(q) || psid.includes(q);
      }
      const name = (conv.customer_name ?? '').toLowerCase();
      const waId = (conv.customer_wa_id ?? '').toLowerCase();
      return name.includes(q) || waId.includes(q);
    });
  }, [conversations, searchQuery]);

  const initialSelectionApplied = useRef(false);
  const lastInitialKey = useRef<string>('');
  useEffect(() => {
    const key = `${initialConversationId ?? ''}|${(initialTicketId ?? '').trim()}`;
    if (key !== lastInitialKey.current) {
      lastInitialKey.current = key;
      initialSelectionApplied.current = false;
    }
  }, [initialConversationId, initialTicketId]);

  useEffect(() => {
    if (conversations.length === 0) return;
    if (initialSelectionApplied.current) return;
    const hasInitial = initialConversationId || (initialTicketId && initialTicketId.trim());
    if (!hasInitial) return;

    let conv: LiveChatConversation | undefined;
    if (initialConversationId) {
      conv = conversations.find((c) => c.id === initialConversationId);
    } else if (initialTicketId && initialTicketId.trim()) {
      const tid = initialTicketId.trim().toUpperCase();
      conv = conversations.find((c) => getConversationTicketId(c) === tid);
    }
    if (conv) {
      if (conv.source === 'whatsapp') {
        supabase
          .from('whatsapp_conversations')
          .update({ last_opened_at: new Date().toISOString() })
          .eq('id', conv.id)
          .then(() => {
            if (organizationId) {
              queryClient.invalidateQueries({ queryKey: ['leads', organizationId] });
            }
          })
          .catch((err) => {
            devLog.warn('Failed to update last_opened_at', err);
          });
      }
      onSelect(conv);
      initialSelectionApplied.current = true;
    }
  }, [conversations, initialConversationId, initialTicketId, onSelect, organizationId, queryClient]);

  const SWIPE_MAX = 220;
  /** Min movement (px) before we lock direction. One decision only: swipe OR scroll OR pull-to-refresh. */
  const DIRECTION_LOCK_PX = 8;
  /** Horizontal must win by this margin (px) to count as swipe. Reduced from 10 to 5 so left-swipe feels responsive (logs showed margin 8–10 was locking vertical). */
  const DIRECTION_LOCK_MARGIN_PX = 5;
  const SNAP_TRANSITION = 'transform 0.25s cubic-bezier(0.33, 1, 0.68, 1)';
  const [swipeState, setSwipeState] = useState<{ convId: string; offset: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const pointerStartRef = useRef<{ x: number; y: number; convId: string; lockHorizontal: boolean | null } | null>(null);
  const touchStartRef = useRef<{ startX: number; startY: number; convId: string; lockHorizontal: boolean | null } | null>(null);
  const lockHorizontalRef = useRef(false);
  const swipeLockActiveRef = useRef(false);
  const swipingCardRef = useRef<HTMLDivElement | null>(null);
  const didSwipeRef = useRef(false);
  const listRef = useRef<HTMLUListElement>(null);

  /** Android/touch: touchmove is passive by default so preventDefault() has no effect. Attach native listener with passive: false so horizontal swipe can block vertical scroll. */
  const touchStartForNativeRef = useRef<{ startX: number; startY: number } | null>(null);
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const cards = list.querySelectorAll<HTMLDivElement>('[data-swipeable-card]');
    const cleanups: Array<() => void> = [];
    const handleTouchStart = (e: TouchEvent) => {
      const target = e.target as Node;
      if (!list.contains(target)) return;
      const card = (target as Element).closest?.('[data-swipeable-card]');
      if (!card) return;
      touchStartForNativeRef.current = { startX: e.touches[0].clientX, startY: e.touches[0].clientY };
    };
    const handleTouchEnd = () => {
      touchStartForNativeRef.current = null;
    };
    list.addEventListener('touchstart', handleTouchStart, { passive: true });
    list.addEventListener('touchend', handleTouchEnd, { passive: true });
    list.addEventListener('touchcancel', handleTouchEnd, { passive: true });
    cleanups.push(() => {
      list.removeEventListener('touchstart', handleTouchStart);
      list.removeEventListener('touchend', handleTouchEnd);
      list.removeEventListener('touchcancel', handleTouchEnd);
    });
    cards.forEach((el) => {
      const convId = el.getAttribute('data-conv-id');
      if (!convId) return;
      const handleTouchMove = (e: TouchEvent) => {
        const locked = lockHorizontalRef.current;
        const start = touchStartForNativeRef.current;
        let prevent = false;
        let absX = 0, absY = 0;
        if (start && e.touches.length > 0) {
          const deltaX = e.touches[0].clientX - start.startX;
          const deltaY = e.touches[0].clientY - start.startY;
          absX = Math.abs(deltaX);
          absY = Math.abs(deltaY);
          if (absX > DIRECTION_LOCK_PX || absY > DIRECTION_LOCK_PX) {
            const wouldLockH = absX > absY + DIRECTION_LOCK_MARGIN_PX;
            if (wouldLockH) prevent = true;
          }
        }
        if (prevent || locked) {
          if (e.cancelable) e.preventDefault();
        }
      };
      el.addEventListener('touchmove', handleTouchMove, { passive: false, capture: true });
      cleanups.push(() => el.removeEventListener('touchmove', handleTouchMove, { capture: true }));
    });
    return () => cleanups.forEach((c) => c());
  }, [filteredConversations]);

  const getAccountLabel = useCallback((c: LiveChatConversation) => {
    if (c.source === 'email') return (c as { email_connection_display?: string | null }).email_connection_display ?? '—';
    if (c.source === 'instagram') return (c as { instagram_account_display_name?: string | null }).instagram_account_display_name ?? '';
    if (c.source === 'facebook') return (c as { facebook_page_display_name?: string | null }).facebook_page_display_name ?? '';
    if (c.source === 'threads') return (c as { threads_account_display_name?: string | null }).threads_account_display_name ?? '';
    const wa = c as WhatsAppConversation;
    return wa.whatsapp_account_display_name ?? wa.channel ?? '';
  }, []);

  const handleSelect = (conv: LiveChatConversation) => {
    if (conv.source === 'whatsapp' || conv.source === 'facebook') {
      if (unreadByConversation[conv.id] > 0) {
        markConversationRead(conv).catch((err) => {
          devLog.warn('Failed to mark conversation read', err);
        });
      }
      if (conv.source === 'whatsapp') {
        supabase
          .from('whatsapp_conversations')
          .update({ last_opened_at: new Date().toISOString() })
          .eq('id', conv.id)
          .then(() => {
            if (organizationId) {
              queryClient.invalidateQueries({ queryKey: ['leads', organizationId] });
            }
          })
          .catch((err) => {
            devLog.warn('Failed to update last_opened_at', err);
          });
      }
    }
    if (conv.source === 'email' && (emailUnreadByConversation[conv.id] ?? 0) > 0) {
      markEmailConversationRead(conv.id).catch((err) => {
        devLog.warn('Failed to mark conversation read', err);
      });
    }
    onSelect(conv);
  };

  if (isLoading) return null;
  // Only show full error state when we have an error AND no conversations (e.g. all sources failed).
  // If at least one source succeeded, show the list so user can use it without clicking "Coba lagi".
  if (error && conversations.length === 0) {
    const handleRetry = () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-conversations'] });
      queryClient.invalidateQueries({ queryKey: ['instagram-conversations'] });
      queryClient.invalidateQueries({ queryKey: ['facebook-conversations'] });
      queryClient.invalidateQueries({ queryKey: ['email-conversations'] });
    };
    return (
      <div className="p-4 text-sm text-red-600 flex flex-col items-center justify-center gap-3 text-center">
        <span>{t('whatsappInbox.failedToLoadConversations', 'Failed to load conversations.')}</span>
        <span className="text-muted-foreground text-xs">
          {t('livechat.conversationsErrorHint', 'Salah satu sumber (WhatsApp/Instagram/Email) gagal. Coba lagi untuk memuat ulang semuanya.')}
        </span>
        <Button variant="outline" size="sm" onClick={handleRetry}>
          {t('common.retry', 'Coba lagi')}
        </Button>
      </div>
    );
  }
  const waAccountHint =
    accountFilter.startsWith('wa:') && waAccountsForHint.length > 0
      ? waAccountsForHint.find((a) => a.phone_number_id === accountFilter.slice(3))
      : null;
  const hintNumber = (waAccountHint?.display_phone_number ?? '').trim() || null;

  if (conversations.length === 0) {
    return (
      <div className="p-4 text-sm text-gray-500 flex flex-col items-center justify-center h-32 text-center">
        <MessageCircle className="w-8 h-8 text-gray-300 mb-2" />
        {hintNumber ? (
          <>
            <span>{t('whatsappInbox.noConversationsYet', 'No conversations yet.')}</span>
            <span className="mt-1.5 text-gray-600">
              {t('whatsappInbox.messageThisNumberToStart', 'Have customers send a message to {{number}} and conversations will appear here.', { number: hintNumber })}
            </span>
          </>
        ) : (
          <span>{t('whatsappInbox.noConversationsYetFull', 'No conversations yet. Messages will appear when customers message WhatsApp or when verification emails arrive.')}</span>
        )}
      </div>
    );
  }

  if (filteredConversations.length === 0) {
    return (
      <div className="p-4 text-sm text-gray-500 flex flex-col items-center justify-center h-32 text-center">
        <MessageCircle className="w-8 h-8 text-gray-300 mb-2" />
        {searchQuery ? (
          <span>{t('whatsappInbox.noSearchResults', 'No conversations or contacts match your search.')}</span>
        ) : hintNumber ? (
          <>
            <span>{t('whatsappInbox.noConversationsForThisAccount', 'No conversations for this account yet.')}</span>
            <span className="mt-1.5 text-gray-600">
              {t('whatsappInbox.messageThisNumberToStart', 'Have customers send a message to {{number}} and conversations will appear here.', { number: hintNumber })}
            </span>
          </>
        ) : (
          <span>{t('whatsappInbox.noConversationsYet', 'No conversations yet.')}</span>
        )}
      </div>
    );
  }

  return (
    <ul ref={listRef} className="divide-y divide-gray-100">
      {filteredConversations.map((conv) => {
        const isEmail = conv.source === 'email';
        const leadStatusName = (conv as { lead_status_name?: string | null }).lead_status_name ?? null;
        const isResolved = isResolvedStatus(leadStatusName);
        const unread = isEmail ? (emailUnreadByConversation[conv.id] ?? 0) : (unreadByConversation[conv.id] ?? 0);
        const displayName = isEmail
          ? (conv.from_display_name || emailToDisplayLabel(conv.from_email) || conv.from_email || conv.email_connection_display || 'Email')
          : conv.source === 'instagram'
            ? (conv.customer_name?.trim() || t('whatsappInbox.instagramContact', 'Kontak Instagram'))
            : conv.source === 'facebook'
              ? (conv.customer_name?.trim() || t('livechat.messengerContact', 'Kontak Messenger'))
              : (conv.customer_name || maskPhoneLast4(conv.customer_wa_id) || 'Unknown');
        const isSwiping = swipeState?.convId === conv.id;
        const swipeOffset = isSwiping ? swipeState.offset : 0;
        const useDomTransform = isDragging && isSwiping;
        const accountLabel = getAccountLabel(conv);

        const onPointerDown = (e: React.PointerEvent) => {
          pointerStartRef.current = {
            x: e.clientX,
            y: e.clientY,
            convId: conv.id,
            lockHorizontal: null,
          };
          swipingCardRef.current = e.currentTarget as HTMLDivElement;
          didSwipeRef.current = false;
          setIsDragging(true);
          setSwipeState({ convId: conv.id, offset: 0 });
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        };
        const onPointerMove = (e: React.PointerEvent) => {
          const start = pointerStartRef.current;
          if (!start || start.convId !== conv.id) return;
          const deltaX = e.clientX - start.x;
          const deltaY = e.clientY - start.y;
          if (start.lockHorizontal === null) {
            const absX = Math.abs(deltaX);
            const absY = Math.abs(deltaY);
            if (absX > DIRECTION_LOCK_PX || absY > DIRECTION_LOCK_PX) {
              start.lockHorizontal = absX > absY + DIRECTION_LOCK_MARGIN_PX;
              if (start.lockHorizontal) {
                swipeLockActiveRef.current = true;
                onSwipeLockChange?.(true);
              }
            }
          }
          if (start.lockHorizontal === true) {
            if (Math.abs(deltaX) > 10) didSwipeRef.current = true;
            const offset = Math.max(-SWIPE_MAX, Math.min(0, deltaX));
            const el = swipingCardRef.current;
            if (el) {
              el.style.transition = 'none';
              el.style.transform = `translateX(${offset}px)`;
            }
          }
        };
        const endSwipe = () => {
          const isThisCard = pointerStartRef.current?.convId === conv.id || touchStartRef.current?.convId === conv.id;
          if (!isThisCard) return;
          const wasLocked = swipeLockActiveRef.current;
          pointerStartRef.current = null;
          touchStartRef.current = null;
          lockHorizontalRef.current = false;
          swipeLockActiveRef.current = false;
          setIsDragging(false);
          if (wasLocked) onSwipeLockChange?.(false);
          const el = swipingCardRef.current;
          if (el) {
            el.style.transition = SNAP_TRANSITION;
            el.style.transform = 'translateX(0)';
          }
          setSwipeState({ convId: conv.id, offset: 0 });
          window.setTimeout(() => {
            setSwipeState(null);
            swipingCardRef.current = null;
          }, 250);
        };
        const onPointerUp = (e: React.PointerEvent) => {
          (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
          endSwipe();
        };
        const onPointerLeave = () => {
          if (pointerStartRef.current?.convId === conv.id) endSwipe();
        };
        const onTouchStart = (e: React.TouchEvent) => {
          pointerStartRef.current = {
            x: e.touches[0].clientX,
            y: e.touches[0].clientY,
            convId: conv.id,
            lockHorizontal: null,
          };
          touchStartRef.current = {
            startX: e.touches[0].clientX,
            startY: e.touches[0].clientY,
            convId: conv.id,
            lockHorizontal: null,
          };
          swipingCardRef.current = e.currentTarget as HTMLDivElement;
          didSwipeRef.current = false;
          setIsDragging(true);
          setSwipeState({ convId: conv.id, offset: 0 });
        };
        const onTouchMove = (e: React.TouchEvent) => {
          const start = touchStartRef.current;
          if (!start || start.convId !== conv.id) return;
          const currentX = e.touches[0].clientX;
          const currentY = e.touches[0].clientY;
          const deltaX = currentX - start.startX;
          const deltaY = currentY - start.startY;
          if (start.lockHorizontal === null) {
            const absX = Math.abs(deltaX);
            const absY = Math.abs(deltaY);
            if (absX > DIRECTION_LOCK_PX || absY > DIRECTION_LOCK_PX) {
              start.lockHorizontal = absX > absY + DIRECTION_LOCK_MARGIN_PX;
              lockHorizontalRef.current = start.lockHorizontal;
              if (start.lockHorizontal) {
                swipeLockActiveRef.current = true;
                onSwipeLockChange?.(true);
              }
            }
          }
          if (start.lockHorizontal === true) {
            if (Math.abs(deltaX) > 10) didSwipeRef.current = true;
            const offset = Math.max(-SWIPE_MAX, Math.min(0, deltaX));
            const el = swipingCardRef.current;
            if (el) {
              el.style.transition = 'none';
              el.style.transform = `translateX(${offset}px)`;
            }
          }
        };
        const onTouchEnd = () => {
          lockHorizontalRef.current = false;
          endSwipe();
        };
        const onRowClick = () => {
          if (didSwipeRef.current) {
            didSwipeRef.current = false;
            return;
          }
          handleSelect(conv);
        };

        return (
          <li
            key={conv.id}
            className="overflow-hidden list-none"
          >
            <div className="relative overflow-hidden">
              {/* Layer 1: opaque background + account name (visible on swipe); strip width = SWIPE_MAX so full name fits when revealed */}
              <div
                className="absolute inset-0 bg-gray-200 flex items-center"
                aria-hidden
              >
                <div className="ml-auto w-[220px] flex items-center justify-end pr-3 pl-2 min-w-0">
                  <span className="text-xs text-gray-600 text-right truncate max-w-full" title={accountLabel || undefined}>
                    {accountLabel || '—'}
                  </span>
                </div>
              </div>
              {/* Layer 2: card (slides with swipe) */}
              <div
                data-swipeable-card
                data-conv-id={conv.id}
                role="button"
                tabIndex={0}
                onClick={onRowClick}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onRowClick(); }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerLeave={onPointerLeave}
                onPointerCancel={onPointerUp}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
                onTouchCancel={onTouchEnd}
                className={`flex gap-3 items-start px-4 py-3 cursor-pointer hover:bg-gray-50 select-none ${
                  selectedId === conv.id ? (isEmail ? 'bg-blue-50 border-l-2 border-blue-500' : 'bg-[#d6ebe1] border-l-2 border-[#25D366]') : 'bg-white'
                }`}
                style={{
                  ...(useDomTransform
                    ? { transition: 'none', willChange: 'transform' as const }
                    : { transform: `translateX(${swipeOffset}px)`, transition: SNAP_TRANSITION }),
                  touchAction: 'pan-y',
                }}
              >
                <LivechatAvatar conv={conv} displayName={displayName} />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start gap-2">
                    <span className="font-medium text-gray-900 truncate min-w-0">
                      {displayName}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {isResolved && (
                        <span className="text-blue-600 shrink-0" title={t('whatsappInbox.chatResolvedNoActions', 'Chat sudah di-resolve')}>
                          <ListChecks className="w-4 h-4" />
                        </span>
                      )}
                      <span className="text-xs text-gray-500">
                        {formatTime(conv.last_message_at)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 min-h-0 mt-0.5">
                    {!isEmail && conv.last_message_direction === 'outbound' && (
                      <span className="shrink-0 text-gray-500" title={conv.last_message_status === 'read' ? 'Dibaca' : conv.last_message_status === 'delivered' ? 'Terkirim' : 'Terkirim'}>
                        {conv.last_message_status === 'read' ? (
                          <CheckCheck className="w-3.5 h-3.5 text-[#25D366]" />
                        ) : conv.last_message_status === 'delivered' ? (
                          <CheckCheck className="w-3.5 h-3.5" />
                        ) : (
                          <Check className="w-3.5 h-3.5" />
                        )}
                      </span>
                    )}
                    {(() => {
                      let preview = isEmail
                        ? getEmailPreviewSnippet(conv.last_message_body)
                        : stripHtmlForPreview(conv.last_message_body);
                      if (!isEmail) {
                        preview = stripSurveyLinksFromText(preview);
                        if (
                          !preview &&
                          conv.last_message_body &&
                          /\/s\/[A-Za-z0-9_-]+/i.test(conv.last_message_body)
                        ) {
                          preview = t(
                            'whatsappInbox.surveySentToCustomerShort',
                            'Survey sent to customer',
                          );
                        }
                      }
                      const subject = isEmail ? (conv as { thread_subject?: string | null }).thread_subject?.trim() ?? '' : '';
                      const displayText = preview !== '' ? preview : (subject !== '' ? subject : '');
                      const showSomething = (conv.last_message_body != null && conv.last_message_body !== '' && preview !== '') || (isEmail && subject !== '');
                      return showSomething ? (
                        <span className="text-xs text-gray-500 truncate flex-1 min-w-0" title={displayText}>
                          {displayText}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-500 italic flex-1 min-w-0">—</span>
                      );
                    })()}
                    {unread > 0 && (
                      <span className={`min-w-[1.25rem] h-5 px-1.5 rounded-full text-white text-xs font-medium flex items-center justify-center shrink-0 ${isEmail ? 'bg-blue-600' : 'bg-green-600'}`}>
                        {unread > 99 ? '99+' : unread}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
