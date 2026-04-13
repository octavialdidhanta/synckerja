import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useWhatsAppMessages } from '../../hooks/useWhatsAppMessages';
import { useInstagramMessages } from '../../hooks/useInstagramMessages';
import { useResolveWhatsAppMedia } from '../../hooks/useResolveWhatsAppMedia';
import { useSendWhatsAppMessage } from '../../hooks/useSendWhatsAppMessage';
import { useSendInstagramMessage } from '../../hooks/useSendInstagramMessage';
import type { LiveChatConversation, WhatsAppConversation, WhatsAppMessage, InstagramConversation, InstagramMessage, EmailConversation } from '../../types';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { Button } from '@/shared/components/ui/button';
import { Textarea } from '@/shared/components/ui/textarea';
import { isBlockedImageUrl } from '@/shared/components/ui/avatar';
import { supabase } from '@/shared/lib/supabaseClient';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogTitle } from '@/shared/components/ui/dialog';
import { Check, CheckCheck, Paperclip, FileText, X, Download, ChevronDown, Trash2, Reply, Copy, Image, Video, Music, Send } from 'lucide-react';
import { messageContainsContactRequest } from '../../constants/contactRequestBlockPhrases';
import { isLikelyInstagramId } from '../../constants/instagramId';
import { isResolvedStatus, isOutside24hWindow } from '../../constants/leadStatus';
import { format } from 'date-fns';
import type { Locale } from 'date-fns';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

/** Bucket yang sama dipakai untuk kirim (outbound) dan terima (webhook/resolve) media */
const WHATSAPP_MEDIA_BUCKET = 'whatsapp-media';

/** No-op: previously unlocked notification sound on user gesture. Bell sound removed. */
function unlockInboundNotificationAudio() {
  // no-op
}

function isTouchDevice() {
  return typeof window !== 'undefined' && ('ontouchstart' in window || (navigator as { maxTouchPoints?: number }).maxTouchPoints > 0);
}

function showSystemNotification(title: string, body: string) {
  if (typeof document === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    try {
      const n = new Notification(title, {
        body,
        tag: 'livechat-inbound',
        requireInteraction: false,
      });
      setTimeout(() => n.close(), 5000);
    } catch {
      // ignore
    }
    return;
  }
  if (Notification.permission === 'default') {
    Notification.requestPermission().then((permission) => {
      if (permission === 'granted') showSystemNotification(title, body);
    });
  }
}

function playInboundNotificationSound(options?: { conversationName?: string }) {
  if (typeof document === 'undefined') return;
  const isHidden = document.visibilityState === 'hidden';
  if (isHidden && 'Notification' in window) {
    const title = 'Pesan baru';
    const body = options?.conversationName ? `Dari ${options.conversationName}` : 'Pesan masuk di obrolan';
    showSystemNotification(title, body);
    return;
  }
  if (document.visibilityState === 'hidden') return;
  if (navigator.vibrate) navigator.vibrate(200);
}

interface ChatThreadProps {
  conversation: LiveChatConversation | null;
  /** Phone number IDs of currently connected WhatsApp accounts. If conversation.phone_number_id is not in this list, show "disconnected account" banner. */
  connectedPhoneNumberIds?: string[];
  /** When true, organisation has no connected WhatsApp account – disable send and show notice. */
  hasNoConnectedWhatsAppAccount?: boolean;
  /** When set, after messages load scroll to first message whose body contains this text (e.g. from search popup). */
  scrollToTextInChat?: string | null;
  /** Called after scroll-to-text is done so parent can clear scrollToTextInChat. */
  onScrollToTextDone?: () => void;
  /** When set, scroll to this message id and highlight it (e.g. from WhatsApp-style search result click). */
  scrollToMessageId?: string | null;
  /** Called after scroll-to-message and highlight is done. */
  onScrollToMessageDone?: () => void;
  /** When true, hide the in-component header (e.g. for mobile where parent provides back + avatar + name). */
  hideHeader?: boolean;
  /** When true, keyboard is open – use minimal bottom padding so input bar sticks to keyboard; when false, keep safe-area-bottom so position unchanged when keyboard closes. */
  keyboardOpen?: boolean;
}

function formatMessageTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

/** YYYY-MM-DD in local timezone for comparing message days. */
function getDateKey(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Label for date separator: "Hari ini", "Kemarin", or full date (e.g. "9 Maret 2026"). */
function formatDateSeparator(
  iso: string,
  t: (key: string, fallback: string) => string,
  dateLocale: Locale
): string {
  const key = getDateKey(iso);
  const today = getDateKey(new Date().toISOString());
  if (key === today) return t('whatsappInbox.today', 'Hari ini');
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (key === getDateKey(yesterday.toISOString())) return t('whatsappInbox.yesterday', 'Kemarin');
  return format(new Date(iso), 'd MMMM yyyy', { locale: dateLocale });
}

function DateSeparator({ label }: { label: string }) {
  return (
    <div className="flex justify-center py-2" data-date-separator data-date-label={label}>
      <span className="rounded-full bg-gray-800 px-3 py-1.5 text-[10px] text-white">
        {label}
      </span>
    </div>
  );
}

/** Mask 4 digit terakhir nomor telepon untuk privasi di UI. */
function maskPhoneLast4(phone: string | null | undefined): string {
  if (phone == null || phone === '') return '';
  const s = String(phone).trim();
  if (s.length <= 4) return '****';
  return s.slice(0, -4) + '****';
}

/** Checklist di sebelah pesan outbound: satu centang (terkirim), dua centang (delivered), dua centang biru (dibaca). */
function MessageStatus({ status }: { status: WhatsAppMessage['status'] | 'sending' | null }) {
  if (status === 'read') {
    return <CheckCheck className="w-4 h-4 shrink-0 text-[#7dd3fc]" aria-label="Read" />;
  }
  if (status === 'delivered') {
    return <CheckCheck className="w-4 h-4 shrink-0 text-white" aria-label="Delivered" />;
  }
  if (status === 'sent' || status === 'sending' || !status) {
    return <Check className="w-4 h-4 shrink-0 text-white" aria-label={status === 'sending' ? 'Sending' : 'Sent'} />;
  }
  return <span className="text-xs opacity-80">{status}</span>;
}

function getMediaType(file: File): 'image' | 'video' | 'document' {
  const type = (file.type || '').toLowerCase();
  if (type.startsWith('image/')) return 'image';
  if (type.startsWith('video/')) return 'video';
  return 'document';
}

const ACCEPT_MEDIA = 'image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip';

const MEDIA_TYPES = ['image', 'video', 'document', 'audio'];

const DEFAULT_EXT: Record<string, string> = {
  image: 'jpg',
  video: 'mp4',
  document: 'pdf',
  audio: 'mp3',
};

/** Ikon tipe media untuk tampilan reply (WhatsApp-style). */
function ReplyMediaIcon({ messageType, className }: { messageType?: string | null; className?: string }) {
  const t = (messageType ?? '').toLowerCase();
  if (t === 'image') return <Image className={className} />;
  if (t === 'video') return <Video className={className} />;
  if (t === 'audio') return <Music className={className} />;
  if (t === 'document') return <FileText className={className} />;
  return null;
}

/** Unduh media dari URL ke komputer. Jika fetch gagal (CORS), buka di tab baru. */
async function downloadMedia(url: string, messageType: string, messageId?: string): Promise<void> {
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) throw new Error('Gagal mengunduh');
    const blob = await res.blob();
    const pathname = new URL(url).pathname;
    const segment = pathname.split('/').filter(Boolean).pop() ?? '';
    const ext = segment.includes('.') ? segment.replace(/^.*\./, '').slice(0, 6) : (DEFAULT_EXT[messageType] ?? 'bin');
    const name = segment && segment.includes('.') ? segment : `media-${messageId ?? Date.now()}.${ext}`;
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = name;
    a.click();
    URL.revokeObjectURL(objectUrl);
  } catch {
    window.open(url, '_blank', 'noopener,noreferrer');
    throw new Error('Buka di tab baru untuk menyimpan');
  }
}

/** Simpan media ke lokasi yang dipilih user (Save As). Fallback ke download jika API tidak tersedia. */
async function saveMediaAs(
  url: string,
  messageType: string,
  messageId?: string
): Promise<void> {
  const res = await fetch(url, { mode: 'cors' });
  if (!res.ok) throw new Error('Failed to fetch');
  const blob = await res.blob();
  const pathname = new URL(url).pathname;
  const segment = pathname.split('/').filter(Boolean).pop() ?? '';
  const ext = segment.includes('.') ? segment.replace(/^.*\./, '').slice(0, 6) : (DEFAULT_EXT[messageType] ?? 'bin');
  const suggestedName = segment && segment.includes('.') ? segment : `media-${messageId ?? Date.now()}.${ext}`;

  const w = window as Window & { showSaveFilePicker?: (opts?: { suggestedName?: string }) => Promise<FileSystemFileHandle> };
  if (typeof w.showSaveFilePicker === 'function') {
    try {
      const handle = await w.showSaveFilePicker({ suggestedName });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (err) {
      if ((err as { name?: string })?.name === 'AbortError') return;
      throw err;
    }
  }
  await downloadMedia(url, messageType, messageId);
}

/** Ambil caption dari raw_metadata Meta (untuk pesan masuk lama yang body-nya masih placeholder). */
function getCaptionFromRawMetadata(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return null;
  const msg = raw as Record<string, unknown>;
  const trim = (v: unknown) => (v != null ? String(v).trim() : '');
  const top = trim(msg.caption);
  if (top) return top;
  for (const key of ['image', 'video', 'document'] as const) {
    const obj = msg[key];
    if (obj && typeof obj === 'object' && obj !== null && 'caption' in obj) {
      const c = trim((obj as { caption?: unknown }).caption);
      if (c) return c;
    }
  }
  return null;
}

/** Caption untuk tampilan reply: body jika bukan placeholder, else dari raw_metadata (inbound media). */
function getMessageCaptionForReply(msg: { body: string | null; raw_metadata?: unknown; message_type?: string }): string | null {
  const isPlaceholder = msg.body != null && MEDIA_TYPES.some((t) => msg.body === `[${t}]`);
  if (msg.body && !isPlaceholder) return msg.body;
  if (msg.message_type && MEDIA_TYPES.includes(msg.message_type.toLowerCase())) {
    const fromRaw = getCaptionFromRawMetadata(msg.raw_metadata);
    if (fromRaw) return fromRaw;
  }
  return msg.body ?? null;
}

function MediaPreview({
  messageType,
  mediaUrl,
  body,
  rawMetadata,
  isOutbound,
  messageId,
  direction,
  onResolve,
  isResolving,
  topRightAction,
  onMediaClick,
}: {
  messageType: string;
  mediaUrl: string | null | undefined;
  body: string | null;
  rawMetadata?: unknown;
  isOutbound: boolean;
  messageId?: string;
  direction?: 'inbound' | 'outbound';
  onResolve?: (id: string) => Promise<unknown>;
  isResolving?: boolean;
  /** Untuk pesan media inbound: titik tiga di dalam area media (overlay). */
  topRightAction?: React.ReactNode;
  /** Klik media → buka di modal (bukan new window). */
  onMediaClick?: (url: string, type: string) => void;
}) {
  const { t } = useAppTranslation();
  const canResolve =
    !mediaUrl &&
    messageId &&
    direction === 'inbound' &&
    MEDIA_TYPES.includes(messageType);

  if (!mediaUrl) {
    const fallbackCaption = direction === 'inbound' ? getCaptionFromRawMetadata(rawMetadata) : null;
    const displayBody = (body && !MEDIA_TYPES.some((t) => body === `[${t}]`)) ? body : (fallbackCaption ?? (body || '[Media]'));
    if (canResolve && onResolve) {
      return (
        <span className="block">
          <p className="text-sm whitespace-pre-wrap break-words mb-2">{displayBody}</p>
          <button
            type="button"
            onClick={async () => {
              try {
                await onResolve(messageId!);
              } catch {
                // useResolveWhatsAppMedia throws; show toast in caller if needed
              }
            }}
            disabled={isResolving}
            className="text-xs font-medium underline hover:no-underline disabled:opacity-50"
          >
            {isResolving ? t('whatsappInbox.loading', 'Loading...') : t('whatsappInbox.showImage', 'Show image')}
            </button>
        </span>
      );
    }
    return <p className="text-sm whitespace-pre-wrap break-words">{displayBody}</p>;
  }
  // Caption: dari body (jika bukan placeholder), atau dari raw_metadata untuk pesan masuk lama
  const isPlaceholder = body && MEDIA_TYPES.some((t) => body === `[${t}]`);
  const captionFromBody = body && !isPlaceholder ? body : null;
  const captionFromRaw = direction === 'inbound' ? getCaptionFromRawMetadata(rawMetadata) : null;
  const caption = captionFromBody ?? captionFromRaw ?? null;

  const textCls = isOutbound ? 'text-white/90' : 'text-gray-600';
  const mediaActionOverlay = topRightAction ? (
    <div className="absolute top-1 right-1 z-10" onClick={(e) => e.stopPropagation()}>
      {topRightAction}
    </div>
  ) : null;

  if (messageType === 'image') {
    return (
      <span className="block">
        <span className="relative inline-block max-w-[260px] rounded overflow-hidden">
          {onMediaClick ? (
            <button type="button" onClick={() => onMediaClick(mediaUrl, 'image')} className="block w-full text-left">
              <img src={mediaUrl} alt="" className="max-w-full max-h-[280px] object-contain rounded cursor-pointer" />
            </button>
          ) : (
            <a href={mediaUrl} target="_blank" rel="noopener noreferrer" className="block">
              <img src={mediaUrl} alt="" className="max-w-full max-h-[280px] object-contain rounded" />
            </a>
          )}
          {mediaActionOverlay}
        </span>
        {caption ? <p className={`text-sm mt-1 whitespace-pre-wrap break-words ${textCls}`}>{caption}</p> : null}
      </span>
    );
  }
  if (messageType === 'video') {
    return (
      <span className="block">
        <span className="relative inline-block max-w-[260px]">
          {onMediaClick ? (
            <button type="button" onClick={() => onMediaClick(mediaUrl, 'video')} className="block w-full">
              <video src={mediaUrl} className="max-w-full max-h-[280px] rounded cursor-pointer" />
            </button>
          ) : (
            <video src={mediaUrl} controls className="max-w-full max-h-[280px] rounded" />
          )}
          {mediaActionOverlay}
        </span>
        {caption ? <p className={`text-sm mt-1 whitespace-pre-wrap break-words ${textCls}`}>{caption}</p> : null}
      </span>
    );
  }
  if (messageType === 'document' || messageType === 'audio') {
    return (
      <span className="block">
        <span className="relative inline-flex items-center gap-2">
          {onMediaClick ? (
            <button
              type="button"
              onClick={() => onMediaClick(mediaUrl, messageType)}
              className={`inline-flex items-center gap-2 text-sm font-medium underline ${textCls} cursor-pointer hover:no-underline`}
            >
              <FileText className="w-4 h-4 shrink-0" />
              {caption ?? (messageType === 'document' ? 'Dokumen' : 'Audio')}
            </button>
          ) : (
            <a
              href={mediaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-2 text-sm font-medium underline ${textCls}`}
            >
              <FileText className="w-4 h-4 shrink-0" />
              {caption ?? (messageType === 'document' ? 'Dokumen' : 'Audio')}
            </a>
          )}
          {mediaActionOverlay}
        </span>
      </span>
    );
  }
  return <p className="text-sm whitespace-pre-wrap break-words">{body || '[Media]'}</p>;
}

type PendingMedia = {
  file: File;
  mediaType: 'image' | 'video' | 'document';
  previewUrl?: string;
};

export function ChatThread({ conversation, connectedPhoneNumberIds, hasNoConnectedWhatsAppAccount, scrollToTextInChat, onScrollToTextDone, scrollToMessageId, onScrollToMessageDone, hideHeader, keyboardOpen }: ChatThreadProps) {
  const [text, setText] = useState('');
  const [pendingMedia, setPendingMedia] = useState<PendingMedia | null>(null);
  type OptimisticEntry = {
    body: string;
    created_at: string;
    message_type?: string;
    media_url?: string | null;
    reply_to_body?: string | null;
    reply_to_wa_message_id?: string | null;
    reply_to_message_type?: string | null;
    reply_to_sender?: string | null;
  };
  const [optimisticMessage, setOptimisticMessage] = useState<OptimisticEntry | null>(null);
  const [optimisticMedia, setOptimisticMedia] = useState<OptimisticEntry | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isScrolling, setIsScrolling] = useState(false);
  const [stickyDateLabel, setStickyDateLabel] = useState<string | null>(null);
  const [stickyDateExiting, setStickyDateExiting] = useState(false);
  const [stickyDateAnimateIn, setStickyDateAnimateIn] = useState(false);
  const scrollEndTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stickyDateExitingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [replyTo, setReplyTo] = useState<{
    id: string;
    body: string | null;
    wa_message_id: string | null;
    message_type?: string;
    direction?: 'inbound' | 'outbound';
    media_url?: string | null;
  } | null>(null);
  const [mediaViewer, setMediaViewer] = useState<{ url: string; type: string } | null>(null);
  const [scrollToMessageIdLocal, setScrollToMessageIdLocal] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatInputBarRef = useRef<HTMLDivElement>(null);
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const touchStartRef = useRef<{ msgId: string; startX: number; startY: number; intent?: 'reply' | 'scroll' } | null>(null);
  const [swipeOffset, setSwipeOffset] = useState<{ msgId: string; translateX: number } | null>(null);
  const [isDraggingReply, setIsDraggingReply] = useState(false);
  /** During drag we update this element's transform directly for 60fps smoothness (no React re-renders). */
  const swipeBubbleElRef = useRef<HTMLDivElement | null>(null);
  const knownInboundIdsRef = useRef<Set<string>>(new Set());
  const hasScrollTargetRef = useRef(false);

  /** Threshold (px) to lock direction: one decision only — scroll OR reply (no diagonal). Same as ConversationList. */
  const DIRECTION_LOCK_PX = 4;
  const DIRECTION_LOCK_MARGIN_PX = 6;
  const SWIPE_REPLY_TRIGGER_PX = 42;
  const SWIPE_REPLY_MAX_TRANSLATE_PX = 92;
  const SNAP_TRANSITION = 'transform 0.25s cubic-bezier(0.33, 1, 0.68, 1)';

  /** Decide once: reply-swipe OR scroll. Lock vertical scroll only when intent is reply (mobile). Needs passive: false so preventDefault works. */
  useEffect(() => {
    if (!hideHeader) return;
    const el = messagesScrollRef.current;
    if (!el) return;
      const handleTouchMove = (e: TouchEvent) => {
      const start = touchStartRef.current;
      if (!start || !e.touches[0]) return;
      const t = e.touches[0];
      const deltaX = t.clientX - start.startX;
      const deltaY = t.clientY - start.startY;
      if (start.intent === undefined) {
        const absX = Math.abs(deltaX);
        const absY = Math.abs(deltaY);
        if (absX > DIRECTION_LOCK_PX || absY > DIRECTION_LOCK_PX) {
          start.intent = absX > absY + DIRECTION_LOCK_MARGIN_PX ? 'reply' : 'scroll';
        }
      }
      if (start.intent === 'reply' && e.cancelable) e.preventDefault();
    };
    el.addEventListener('touchmove', handleTouchMove, { passive: false, capture: true });
    return () => el.removeEventListener('touchmove', handleTouchMove, { capture: true });
  }, [hideHeader]);

  /** Sticky date: show at top while scrolling. Label = date separator that is topmost in the visible area (so when scrolled past 26 Feb, show 25 Feb). */
  useEffect(() => {
    const el = messagesScrollRef.current;
    if (!el) return;
    const SCROLL_END_MS = 1500;
    const FADEOUT_MS = 220;

    /** Sticky = date of the section we're currently viewing at the top of the viewport.
     * That is the section we've "entered" = the topmost separator that is at or above the top edge (the one we just passed). Pick the one with largest top among those = closest to top = e.g. "16 February" when 17 Feb is below. */
    const updateStickyDateFromVisible = () => {
      const containerRect = el.getBoundingClientRect();
      const containerTop = containerRect.top;
      const separators = el.querySelectorAll<HTMLElement>('[data-date-separator]');
      let bestLabelAtOrAbove: string | null = null;
      let bestTopAtOrAbove = -Infinity;
      let fallbackLabel: string | null = null;
      let fallbackTop = Infinity;
      for (const node of separators) {
        const label = node.getAttribute('data-date-label');
        if (!label) continue;
        const rect = node.getBoundingClientRect();
        if (rect.top <= containerTop) {
          if (rect.top > bestTopAtOrAbove) {
            bestTopAtOrAbove = rect.top;
            bestLabelAtOrAbove = label;
          }
        } else {
          if (rect.top < fallbackTop) {
            fallbackTop = rect.top;
            fallbackLabel = label;
          }
        }
      }
      if (bestLabelAtOrAbove != null) setStickyDateLabel(bestLabelAtOrAbove);
      else if (fallbackLabel != null) setStickyDateLabel(fallbackLabel);
    };

    const handleScroll = () => {
      setIsScrolling(true);
      setStickyDateExiting(false);
      if (stickyDateExitingTimeoutRef.current) {
        clearTimeout(stickyDateExitingTimeoutRef.current);
        stickyDateExitingTimeoutRef.current = null;
      }
      if (scrollEndTimeoutRef.current) clearTimeout(scrollEndTimeoutRef.current);
      updateStickyDateFromVisible();
      scrollEndTimeoutRef.current = setTimeout(() => {
        scrollEndTimeoutRef.current = null;
        setStickyDateExiting(true);
        stickyDateExitingTimeoutRef.current = setTimeout(() => {
          stickyDateExitingTimeoutRef.current = null;
          setIsScrolling(false);
          setStickyDateExiting(false);
        }, FADEOUT_MS);
      }, SCROLL_END_MS);
    };
    el.addEventListener('scroll', handleScroll, { passive: true });
    const observer = new IntersectionObserver(
      () => updateStickyDateFromVisible(),
      { root: el, rootMargin: '0px', threshold: 0 }
    );
    const observeSeparators = () => {
      el.querySelectorAll<HTMLElement>('[data-date-separator]').forEach((node) => observer.observe(node));
    };
    observeSeparators();
    const mo = new MutationObserver(observeSeparators);
    mo.observe(el, { childList: true, subtree: true });
    return () => {
      el.removeEventListener('scroll', handleScroll);
      if (scrollEndTimeoutRef.current) clearTimeout(scrollEndTimeoutRef.current);
      if (stickyDateExitingTimeoutRef.current) clearTimeout(stickyDateExitingTimeoutRef.current);
      observer.disconnect();
      mo.disconnect();
    };
  }, [conversation?.id]);

  /** Sticky date badge: trigger fade-in after mount, reset when hidden */
  const stickyDateVisible = (isScrolling || stickyDateExiting) && stickyDateLabel;
  useLayoutEffect(() => {
    if (!stickyDateVisible) {
      setStickyDateAnimateIn(false);
      return;
    }
    const id = requestAnimationFrame(() => setStickyDateAnimateIn(true));
    return () => cancelAnimationFrame(id);
  }, [stickyDateVisible]);

  /** Mobile (hideHeader): auto-expand textarea with Enter/newlines, fixed max height with vertical scroll */
  const MOBILE_INPUT_MIN_HEIGHT_PX = 44;
  const MOBILE_INPUT_MAX_HEIGHT_PX = 120;
  useLayoutEffect(() => {
    if (!hideHeader) return;
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const scrollH = el.scrollHeight;
    const h = Math.min(Math.max(scrollH, MOBILE_INPUT_MIN_HEIGHT_PX), MOBILE_INPUT_MAX_HEIGHT_PX);
    el.style.height = `${h}px`;
    el.style.overflowY = scrollH > MOBILE_INPUT_MAX_HEIGHT_PX ? 'auto' : 'hidden';
  }, [text, hideHeader]);

  const vibrate = useCallback((ms = 50) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(ms);
  }, []);
  const triggerReplyHaptic = useCallback(async () => {
    vibrate(30);
    if (!Capacitor.isNativePlatform()) return;
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch {
      // fallback already handled by navigator.vibrate
    }
  }, [vibrate]);

  const focusInputToKeepKeyboard = useCallback(() => {
    setTimeout(() => textareaRef.current?.focus(), 0);
  }, []);

  const scrollMessagesToBottom = useCallback(() => {
    const el = messagesScrollRef.current;
    if (!el) return;
    el.scrollTop = 0;
  }, []);

  const clearPendingMedia = useCallback(() => {
    setPendingMedia((prev) => {
      if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
      return null;
    });
  }, []);
  const { t, dateLocale } = useAppTranslation();
  const queryClient = useQueryClient();
  const isInstagram = (conversation as LiveChatConversation)?.source === 'instagram';
  const waMessagesQuery = useWhatsAppMessages(!isInstagram ? conversation?.id ?? null : null);
  const igMessagesQuery = useInstagramMessages(isInstagram ? conversation?.id ?? null : null);
  const waMessages = waMessagesQuery.data ?? [];
  const igMessages = igMessagesQuery.data ?? [];
  const messages: Array<WhatsAppMessage | (InstagramMessage & { wa_message_id?: string | null; reply_to_wa_message_id?: string | null })> = isInstagram
    ? (igMessages as InstagramMessage[]).map((m) => ({
        ...m,
        wa_message_id: m.platform_message_id,
        reply_to_wa_message_id: m.reply_to_platform_message_id ?? undefined,
      }))
    : waMessages;
  const isLoading = isInstagram ? igMessagesQuery.isLoading : waMessagesQuery.isLoading;
  const { send, isSending: isSendingWhatsApp } = useSendWhatsAppMessage();
  const { send: sendInstagram, isSending: isSendingInstagram } = useSendInstagramMessage();
  const { resolve: resolveMedia, isResolving: isResolvingMedia, resolvingMessageId } = useResolveWhatsAppMedia(!isInstagram ? conversation?.id ?? null : null);

  const hasConversationId = !!conversation?.id;
  const { data: conversationStatusRow } = useQuery({
    queryKey: isInstagram ? ['instagram-conversation-status', conversation?.id] : ['whatsapp-conversation-status', conversation?.id],
    queryFn: async () => {
      if (!conversation?.id) return null;
      if (isInstagram) {
        const { data, error } = await supabase
          .from('instagram_conversations')
          .select('lead_status_id, last_inbound_at, created_at')
          .eq('id', conversation.id)
          .maybeSingle();
        if (error) throw error;
        return data as { lead_status_id?: string; last_inbound_at?: string | null; created_at?: string } | null;
      }
      const { data, error } = await supabase
        .from('whatsapp_conversations')
        .select('lead_status_id, last_inbound_at, created_at')
        .eq('id', conversation.id)
        .maybeSingle();
      if (error) throw error;
      return data as { lead_status_id?: string; last_inbound_at?: string | null; created_at?: string } | null;
    },
    enabled: hasConversationId,
    refetchInterval: 5000,
  });
  const conversationStatusId = conversationStatusRow?.lead_status_id ?? null;
  const lastInboundAt = conversationStatusRow?.last_inbound_at ?? null;
  const conversationCreatedAt = conversationStatusRow?.created_at ?? null;
  const { data: leadStatuses = [] } = useQuery({
    queryKey: ['lead-statuses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lead_statuses')
        .select('id, name')
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      return (data ?? []) as unknown as Array<{ id: string; name: string }>;
    },
    enabled: hasConversationId,
  });
  const statusNameFromQuery =
    conversationStatusId != null
      ? leadStatuses.find((s) => s.id === conversationStatusId)?.name ?? null
      : null;
  const effectiveStatusName =
    statusNameFromQuery ??
    (conversation && conversation.source !== 'email' ? (conversation as WhatsAppConversation | InstagramConversation).lead_status_name ?? null : null);

  const isResolved = isResolvedStatus(effectiveStatusName);
  const isWhatsAppConversation = conversation?.source === 'whatsapp';
  const sendDisabledByNoAccount = Boolean(hasNoConnectedWhatsAppAccount && isWhatsAppConversation);
  const outside24h =
    (isWhatsAppConversation || isInstagram) &&
    isOutside24hWindow(lastInboundAt, conversationCreatedAt);
  const sendDisabled = isResolved || sendDisabledByNoAccount || outside24h;

  const isInstagramConversation = isInstagram;
  const isSending = isSendingWhatsApp || isSendingInstagram;
  const customerId = isInstagram ? (conversation as InstagramConversation)?.customer_ig_id : (conversation as WhatsAppConversation)?.customer_wa_id;
  const displayName =
    conversation?.source === 'email'
      ? (conversation as EmailConversation).from_display_name ?? (conversation as EmailConversation).from_email
      : (conversation as WhatsAppConversation | InstagramConversation).customer_name ?? null;

  const optimisticEntry = optimisticMessage || optimisticMedia;

  /** Pesan asli sudah ada di list (dari setQueryData/refetch) → jangan tampilkan duplikat & hapus optimistic. */
  const hasMatchingRealMessage = useCallback(
    (list: typeof messages, entry: NonNullable<typeof optimisticEntry>) => {
      const cutoff = Date.now() - 15000;
      return list.some((m) => {
        if (m.direction !== 'outbound' || m.body !== entry.body) return false;
        if (new Date(m.created_at).getTime() < cutoff) return false;
        const entryReplyId = entry.reply_to_wa_message_id ?? null;
        const mReplyId = m.reply_to_wa_message_id ?? null;
        if (entryReplyId !== mReplyId) return false;
        const entryBody = entry.reply_to_body ?? null;
        const mBody = m.reply_to_body ?? null;
        if (entryBody == null && mBody == null) return true;
        if (entryBody == null || mBody == null) return false;
        return (
          entryBody === mBody ||
          entryBody.slice(0, 500) === mBody ||
          mBody === entryBody.slice(0, 500)
        );
      });
    },
    []
  );

  useEffect(() => {
    if (!optimisticEntry || !conversation?.id) return;
    if (hasMatchingRealMessage(messages, optimisticEntry)) {
      setOptimisticMessage(null);
      setOptimisticMedia(null);
    }
  }, [messages, optimisticEntry, conversation?.id, hasMatchingRealMessage]);

  useEffect(() => {
    if (!conversation?.id) return;
    knownInboundIdsRef.current = new Set();
  }, [conversation?.id]);

  const notificationConversationName =
    (conversation as { customer_name?: string })?.customer_name ??
    (conversation as { from_display_name?: string })?.from_display_name ??
    (conversation as { from_email?: string })?.from_email ??
    null;

  useEffect(() => {
    const inboundIds = messages.filter((m) => m.direction === 'inbound').map((m) => m.id);
    const known = knownInboundIdsRef.current;
    const hasNewInbound = inboundIds.some((id) => !known.has(id));
    const isFirstMessageInEmptyConvo = hasNewInbound && known.size === 0 && inboundIds.length === 1;
    const isNewMessageAfterExisting = hasNewInbound && known.size > 0;
    if (isFirstMessageInEmptyConvo || isNewMessageAfterExisting) {
      playInboundNotificationSound({
        conversationName: notificationConversationName ?? undefined,
      });
    }
    inboundIds.forEach((id) => known.add(id));
    knownInboundIdsRef.current = known;
  }, [messages, notificationConversationName]);

  const hasScrollTarget = !!(scrollToMessageId ?? scrollToTextInChat?.trim());
  hasScrollTargetRef.current = hasScrollTarget;

  useEffect(() => {
    if (!hideHeader) return;
    if (hasScrollTarget) return;
    if (optimisticEntry) {
      requestAnimationFrame(() => scrollMessagesToBottom());
    }
  }, [hideHeader, hasScrollTarget, optimisticEntry, scrollMessagesToBottom]);

  useEffect(() => {
    if (!hideHeader) return;
    const el = messagesScrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      if (hasScrollTargetRef.current) return;
      scrollMessagesToBottom();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [hideHeader, scrollMessagesToBottom]);

  const filteredMessages = messages.filter(
    (m) => m.message_type !== 'unsupported' && m.body !== '[unsupported]'
  );
  const showOptimistic = optimisticEntry && !hasMatchingRealMessage(filteredMessages, optimisticEntry);
  type DisplayMessage = (WhatsAppMessage | (InstagramMessage & { wa_message_id?: string | null; reply_to_wa_message_id?: string | null; read_at?: null; reply_to_sender?: string | null })) & { status?: WhatsAppMessage['status'] | 'sending' };
  const displayMessages: DisplayMessage[] = [
    ...(filteredMessages as DisplayMessage[]),
    ...(showOptimistic
      ? [
          {
            id: 'optimistic-pending',
            conversation_id: conversation?.id ?? '',
            direction: 'outbound' as const,
            wa_message_id: null,
            body: optimisticEntry.body,
            message_type: optimisticEntry.message_type ?? 'text',
            raw_metadata: null,
            created_at: optimisticEntry.created_at,
            status: 'sending' as const,
            status_updated_at: null,
            read_at: null,
            media_url: optimisticEntry.media_url ?? null,
            reply_to_body: optimisticEntry.reply_to_body ?? null,
            reply_to_wa_message_id: optimisticEntry.reply_to_wa_message_id ?? null,
            reply_to_message_type: optimisticEntry.reply_to_message_type ?? null,
            reply_to_sender: optimisticEntry.reply_to_sender ?? null,
          } as DisplayMessage,
        ]
      : []),
  ];

  const scrollToTextInChatTrimmed = scrollToTextInChat?.trim();
  const onScrollToTextDoneRef = useRef(onScrollToTextDone);
  onScrollToTextDoneRef.current = onScrollToTextDone;
  useLayoutEffect(() => {
    if (!scrollToTextInChatTrimmed || isLoading || displayMessages.length === 0) return;
    const q = scrollToTextInChatTrimmed.toLowerCase();
    const allMatches = displayMessages.filter((msg) => {
      const body = (msg.body ?? '').toLowerCase();
      const caption = (getMessageCaptionForReply(msg) ?? '').toLowerCase();
      return body.includes(q) || caption.includes(q);
    });
    const firstMatch = allMatches[0] ?? null;
    const done = () => onScrollToTextDoneRef.current?.();
    if (firstMatch) {
      const el = document.getElementById(`msg-${firstMatch.id}`);
      if (el) {
        el.scrollIntoView({ behavior: 'auto', block: 'center' });
        done();
      } else {
        done();
      }
    } else {
      done();
    }
  }, [scrollToTextInChatTrimmed, isLoading, displayMessages]);

  const onScrollToMessageDoneRef = useRef(onScrollToMessageDone);
  onScrollToMessageDoneRef.current = onScrollToMessageDone;
  const scrollHighlightTimeoutRef = useRef<number | null>(null);
  const effectiveScrollToMessageId = scrollToMessageId ?? scrollToMessageIdLocal;
  const fromPropRef = useRef(false);
  useLayoutEffect(() => {
    if (!effectiveScrollToMessageId || isLoading || displayMessages.length === 0) return;
    const el = document.getElementById(`msg-${effectiveScrollToMessageId}`);
    const fromProp = scrollToMessageId != null && scrollToMessageId === effectiveScrollToMessageId;
    fromPropRef.current = fromProp;
    const done = () => {
      if (fromPropRef.current) onScrollToMessageDoneRef.current?.();
      else setScrollToMessageIdLocal(null);
    };
    if (el) {
      const bubble = el.querySelector<HTMLElement>(`[data-msg-bubble="${effectiveScrollToMessageId}"]`);
      const highlightTarget = bubble ?? el;
      el.scrollIntoView({ behavior: 'auto', block: 'center' });
      highlightTarget.classList.add('ring-2', 'ring-[#25D366]', 'bg-[#25D366]/15', 'rounded-lg');
      scrollHighlightTimeoutRef.current = window.setTimeout(() => {
        highlightTarget.classList.remove('ring-2', 'ring-[#25D366]', 'bg-[#25D366]/15', 'rounded-lg');
        scrollHighlightTimeoutRef.current = null;
        done();
      }, 2500);
    } else {
      done();
    }
    return () => {
      if (scrollHighlightTimeoutRef.current != null) {
        window.clearTimeout(scrollHighlightTimeoutRef.current);
        scrollHighlightTimeoutRef.current = null;
      }
    };
  }, [effectiveScrollToMessageId, scrollToMessageId, isLoading, displayMessages]);

  /** Hilangkan highlight segera saat user klik pesan yang sedang disorot (klik kedua). */
  const clearHighlightImmediately = useCallback(() => {
    if (!effectiveScrollToMessageId) return;
    const el = document.getElementById(`msg-${effectiveScrollToMessageId}`);
    if (el) {
      const bubble = el.querySelector<HTMLElement>(`[data-msg-bubble="${effectiveScrollToMessageId}"]`);
      (bubble ?? el).classList.remove('ring-2', 'ring-[#25D366]', 'bg-[#25D366]/15', 'rounded-lg');
    }
    if (scrollHighlightTimeoutRef.current != null) {
      window.clearTimeout(scrollHighlightTimeoutRef.current);
      scrollHighlightTimeoutRef.current = null;
    }
    if (fromPropRef.current) onScrollToMessageDoneRef.current?.();
    else setScrollToMessageIdLocal(null);
  }, [effectiveScrollToMessageId]);

  const SEND_TIMEOUT_MS = 12000;

  const sendMediaWithCaption = useCallback(
    async (
      file: File,
      mediaType: 'image' | 'video' | 'document',
      caption: string,
      replyToWaMessageId?: string | null,
      replyToBody?: string | null,
      replyToMessageType?: string | null,
      replyToSender?: string | null
    ) => {
      if (!customerId?.trim()) {
        toast.error(t('whatsappInbox.recipientNotAvailable', 'Penerima tidak tersedia.'));
        return;
      }
      if (isInstagramConversation) {
        toast.error(t('whatsappInbox.instagramMediaNotSupported', 'Pengiriman media ke Instagram belum tersedia. Kirim pesan teks saja.'));
        return;
      }
      if (!customerId.replace(/\D/g, '')) {
        toast.error('Nomor WhatsApp penerima tidak tersedia.');
        return;
      }
      const displayBody = caption || `[${mediaType}]`;
      const path = `${conversation.id}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      setIsUploading(true);
      setOptimisticMedia({
        body: displayBody,
        created_at: new Date().toISOString(),
        message_type: mediaType,
        reply_to_body: replyToBody ?? null,
        reply_to_wa_message_id: replyToWaMessageId ?? null,
        reply_to_message_type: replyToMessageType ?? null,
        reply_to_sender: replyToSender ?? null,
      });
      try {
        const { error: uploadError } = await supabase.storage.from(WHATSAPP_MEDIA_BUCKET).upload(path, file, {
          cacheControl: '3600',
          upsert: false,
        });
        if (uploadError) throw new Error(uploadError.message);
        const { data: urlData } = supabase.storage.from(WHATSAPP_MEDIA_BUCKET).getPublicUrl(path);
        const publicUrl = urlData.publicUrl;
        setOptimisticMedia((prev) => (prev ? { ...prev, media_url: publicUrl } : null));
        await send({
          to: customerId,
          text: '',
          conversation_id: conversation.id,
          media_type: mediaType,
          media_link: publicUrl,
          caption: caption || undefined,
          reply_to_wa_message_id: replyToWaMessageId ?? undefined,
          reply_to_body: replyToBody ?? undefined,
          reply_to_message_type: replyToMessageType ?? undefined,
          reply_to_sender: replyToSender ?? undefined,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Gagal mengirim media.';
        toast.error(msg);
        setOptimisticMedia(null);
      } finally {
        setIsUploading(false);
      }
      // Optimistic media dihapus saat pesan asli ada di list (useEffect hasMatchingRealMessage)
    },
    [conversation, customerId, send, isInstagramConversation, t]
  );

  /** Blokir pesan yang meminta kontak. Default ON; set VITE_WHATSAPP_BLOCK_CONTACT_REQUESTS=false untuk nonaktifkan. */
  const blockContactRequests =
    (import.meta.env.VITE_WHATSAPP_BLOCK_CONTACT_REQUESTS as string) !== 'false';

  const handleSend = async () => {
    if (!conversation) return;
    if (sendDisabled) {
      if (sendDisabledByNoAccount) {
        toast.error(t('whatsappInbox.noWhatsAppAccountCannotSend', 'Tidak ada akun WhatsApp terhubung untuk organisasi ini. Hubungkan akun di Connect WhatsApp untuk mengirim pesan.'));
      } else if (outside24h) {
        toast.error(t('whatsappInbox.outside24hCannotSend', 'Pesan terakhir dari customer sudah lewat 24 jam. Kirim pesan tidak diizinkan sampai customer mengirim pesan lagi.'));
      } else {
        toast.error(t('whatsappInbox.conversationResolvedCannotSend', 'Chat sudah di-resolve. Kirim pesan tidak diizinkan sampai ada pesan masuk baru dari customer.'));
      }
      return;
    }
    const trimmed = text.trim();

    if (blockContactRequests && messageContainsContactRequest(trimmed)) {
      toast.error(
        t('whatsappInbox.blockContactRequest', 'Pesan mengandung permintaan kontak dan tidak dapat dikirim.')
      );
      return;
    }

    const replySender =
      replyTo?.direction === 'inbound'
        ? (isInstagramConversation && !displayName?.trim()
          ? t('whatsappInbox.instagramContact', 'Kontak Instagram')
          : (displayName || (customerId ? maskPhoneLast4(customerId) : '') || ''))
        : replyTo?.direction === 'outbound'
          ? t('whatsappInbox.you', 'You')
          : '';
    const replyMessageType = replyTo?.message_type ?? undefined;

    if (!customerId?.trim()) {
      toast.error(t('whatsappInbox.recipientNotAvailable', 'Penerima tidak tersedia.'));
      return;
    }

    if (pendingMedia) {
      const toSend = pendingMedia;
      const replyWaId = replyTo?.wa_message_id ?? undefined;
      const replyBody = replyTo?.body ?? undefined;
      clearPendingMedia();
      setText('');
      setReplyTo(null);
      try {
        await sendMediaWithCaption(toSend.file, toSend.mediaType, trimmed, replyWaId, replyBody, replyMessageType || undefined, replySender || undefined);
      } catch {
        toast.error(t('whatsappInbox.sendMediaFailed', 'Gagal mengirim media.'));
        focusInputToKeepKeyboard();
      }
      return;
    }

    if (!trimmed) return;
    const replyWaId = replyTo?.wa_message_id ?? undefined;
    const replyBody = replyTo?.body ?? undefined;
    setOptimisticMessage({
      body: trimmed,
      created_at: new Date().toISOString(),
      reply_to_body: replyBody ?? null,
      reply_to_wa_message_id: replyWaId ?? null,
      reply_to_message_type: replyMessageType ?? null,
      reply_to_sender: replySender || null,
    });
    setText('');
    setReplyTo(null);
    try {
      if (isInstagramConversation) {
        const sendPromise = sendInstagram({
          to: customerId,
          text: trimmed,
          conversation_id: conversation.id,
          reply_to_wa_message_id: replyWaId ?? undefined,
        });
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Request timed out. Please try again.')), SEND_TIMEOUT_MS)
        );
        await Promise.race([sendPromise, timeoutPromise]);
      } else {
        const sendPromise = send({
          to: customerId,
          text: trimmed,
          conversation_id: conversation.id,
          reply_to_wa_message_id: replyWaId ?? undefined,
          reply_to_body: replyBody ?? undefined,
          reply_to_message_type: replyMessageType ?? undefined,
          reply_to_sender: replySender || undefined,
        });
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Request timed out. Please try again.')), SEND_TIMEOUT_MS)
        );
        await Promise.race([sendPromise, timeoutPromise]);
      }
      // Optimistic dihapus saat pesan asli sudah ada di list (useEffect hasMatchingRealMessage)
    } catch (err) {
      setOptimisticMessage(null);
      const msg = err instanceof Error ? err.message : 'Gagal mengirim pesan.';
      toast.error(msg);
      focusInputToKeepKeyboard();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !conversation) return;
    e.target.value = '';
    const mediaType = getMediaType(file);
    const previewUrl = mediaType === 'image' ? URL.createObjectURL(file) : undefined;
    setPendingMedia({ file, mediaType, previewUrl });
  };

  if (!conversation) {
    return (
      <div className="flex-1 min-w-0 flex items-center justify-center text-gray-500 bg-gray-50">
        <p>{t('whatsappInbox.selectConversation', 'Select a conversation to view and reply.')}</p>
      </div>
    );
  }

  const toggleSelectMessage = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  return (
    <div className="flex-1 min-w-0 flex flex-col min-h-0 relative bg-[#efeae2] border-l border-gray-200">
      {!hideHeader && (
        <>
          <div className="flex-shrink-0 flex items-center justify-between gap-2 px-3 py-2 min-h-[60px] border-b border-gray-200 bg-[#f0f2f5]">
            <div className="min-w-0 flex-1">
              <h3 className="font-medium text-gray-900 truncate">
                {isInstagramConversation && !displayName?.trim()
                  ? t('whatsappInbox.instagramContact', 'Kontak Instagram')
                  : (displayName || (customerId ? maskPhoneLast4(customerId) : '') || 'Unknown')}
              </h3>
              {displayName && !isInstagramConversation && customerId && (
                <p className="text-xs text-gray-500 truncate">{maskPhoneLast4(customerId)}</p>
              )}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 h-9 w-9 text-gray-600 hover:text-gray-900 hover:bg-gray-200/80"
              onClick={() => setSelectionMode((on) => !on)}
              title={t('whatsappInbox.selectMessages', 'Select messages')}
              aria-label={t('whatsappInbox.selectMessages', 'Select messages')}
            >
              <ChevronDown className="w-5 h-5 rotate-[-90deg]" />
            </Button>
          </div>
          {selectionMode && (
            <div className="flex-shrink-0 flex items-center justify-between gap-2 px-3 py-1.5 border-b border-gray-200 bg-[#f0f2f5] text-sm">
              <span className="text-gray-600">
                {selectedIds.size > 0 ? `${selectedIds.size} ${t('whatsappInbox.selected', 'selected')}` : t('whatsappInbox.selectMessages', 'Select messages')}
              </span>
              <Button type="button" variant="ghost" size="sm" className="text-gray-600" onClick={exitSelectionMode}>
                {t('whatsappInbox.cancel', 'Cancel')}
              </Button>
            </div>
          )}
        </>
      )}
      {isWhatsAppConversation &&
        (conversation as WhatsAppConversation).phone_number_id &&
        Array.isArray(connectedPhoneNumberIds) &&
        connectedPhoneNumberIds.length > 0 &&
        !connectedPhoneNumberIds.includes((conversation as WhatsAppConversation).phone_number_id!) && (
          <div className="flex-shrink-0 px-3 py-2 border-b border-amber-200 bg-amber-50 text-sm text-amber-900" role="alert">
            <p className="font-medium">{t('whatsappInbox.disconnectedAccountBannerTitle', 'Percakapan dari akun yang sudah diputus')}</p>
            <p className="mt-0.5 text-amber-800">
              {t(
                'whatsappInbox.disconnectedAccountBannerBody',
                'Pesan masuk (inbound) di thread ini dari akun WhatsApp yang sudah Anda disconnect di Connect WhatsApp. Pesan baru dari customer tidak akan muncul di sini. Untuk menerima pesan masuk, pastikan customer mengirim ke nomor akun yang saat ini terhubung.'
              )}
            </p>
            <p className="mt-1 text-amber-800 text-xs">
              {t(
                'whatsappInbox.disconnectedAccountSendNote',
                'Pesan yang Anda kirim dari thread ini akan dikirim dari nomor akun yang saat ini terhubung (bukan dari akun yang sudah diputus).'
              )}
            </p>
          </div>
        )}
      <div className="relative flex-1 min-h-0 flex flex-col">
        {stickyDateVisible && (
          <div
            className="absolute top-2 left-0 right-0 z-20 flex justify-center items-center pointer-events-none transition-all duration-200 ease-out pl-2 pr-2"
            style={{
              opacity: stickyDateExiting || !stickyDateAnimateIn ? 0 : 1,
              transform: stickyDateExiting || !stickyDateAnimateIn ? 'translateY(-6px)' : 'translateY(0)',
            }}
          >
            <span className="rounded-full bg-gray-800 px-3 py-1.5 text-[10px] text-white shadow min-w-0">
              {stickyDateLabel}
            </span>
          </div>
        )}
      <div
        ref={messagesScrollRef}
        className={`flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide seamless-scroll nested-scroll-touch-chain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden pl-2 pr-2 pt-6 min-h-0 bg-[#efeae2] flex flex-col-reverse gap-y-1 ${
          replyTo
            ? hideHeader
              ? keyboardOpen
                ? 'pb-[7rem]'
                : 'pb-[calc(7rem+max(var(--safe-area-inset-bottom,0px),env(safe-area-inset-bottom,0px)+0.5rem))]'
              : 'pb-[140px]'
            : hideHeader
              ? keyboardOpen
                ? 'pb-[4rem]'
                : 'pb-[calc(3.5rem+max(var(--safe-area-inset-bottom,0px),env(safe-area-inset-bottom,0px)+0.5rem))]'
              : 'pb-[84px]'
        }`}
        {...(hideHeader ? { onTouchStart: unlockInboundNotificationAudio } : {})}
      >
        {isLoading ? (
          <p className="text-sm text-gray-500">{t('whatsappInbox.loadingMessages', 'Loading messages...')}</p>
        ) : (
          (() => {
            const reversedMessages = [...displayMessages].reverse();
            return reversedMessages.map((msg, index) => {
            const nextMsg = reversedMessages[index + 1];
            /** Show date separator *after* this message in DOM so it appears *above* it in flex-col-reverse (date first, then chat). */
            const showDateSeparatorAfter = nextMsg && getDateKey(nextMsg.created_at) !== getDateKey(msg.created_at);
            const marginBetween = 'mb-0';
            const CheckboxBtn = () =>
              selectionMode ? (
                <button
                  type="button"
                  onClick={() => toggleSelectMessage(msg.id)}
                  className="shrink-0 mt-2 p-1 rounded border border-gray-400 bg-white flex items-center justify-center w-5 h-5 focus:outline-none focus:ring-2 focus:ring-[#25D366]"
                  aria-label={selectedIds.has(msg.id) ? t('whatsappInbox.cancel', 'Cancel') : t('whatsappInbox.selectMessages', 'Select messages')}
                >
                  {selectedIds.has(msg.id) ? (
                    <Check className="w-3 h-3 text-[#25D366]" />
                  ) : null}
                </button>
              ) : null;
            const handleSaveAs = async () => {
              if (msg.media_url) {
                try {
                  await saveMediaAs(msg.media_url, msg.message_type ?? 'image', msg.id);
                  toast.success(t('whatsappInbox.mediaSaved', 'Media saved.'));
                } catch (err) {
                  const m = err instanceof Error ? err.message : '';
                  if (m.includes('Buka di tab baru') || m.includes('new tab')) {
                    toast.info(t('whatsappInbox.openInNewTab', 'Media opened in new tab. Use Save from browser.'));
                  } else toast.error(t('whatsappInbox.saveFailed', 'Failed to download media.'));
                }
              } else {
                toast.info(t('whatsappInbox.clickToLoadMedia', 'Click "Show image" first to load media.'));
              }
            };
            const handleDeleteMsg = async () => {
              const confirmed = window.confirm(t('whatsappInbox.confirmDelete', 'Are you sure you want to delete this message?'));
              if (!confirmed) return;
              const table = isInstagramConversation ? 'instagram_messages' : 'whatsapp_messages';
              const { error } = await supabase.from(table).delete().eq('id', msg.id);
              if (error) {
                toast.error(t('whatsappInbox.deleteFailed', 'Failed to delete message.'));
                return;
              }
              if (conversation?.id) {
                if (isInstagramConversation) {
                  queryClient.invalidateQueries({ queryKey: ['instagram-messages', conversation.id] });
                  queryClient.invalidateQueries({ queryKey: ['instagram-conversations'] });
                } else {
                  queryClient.invalidateQueries({ queryKey: ['whatsapp-messages', conversation.id] });
                  queryClient.invalidateQueries({ queryKey: ['whatsapp-conversations'] });
                }
              }
              toast.success(t('whatsappInbox.messageDeleted', 'Message deleted.'));
            };

            const isInboundMedia =
              msg.direction === 'inbound' &&
              !!msg.media_url &&
              MEDIA_TYPES.includes(msg.message_type ?? '');
            const isInboundText =
              msg.direction === 'inbound' &&
              !isInboundMedia;
            const dropdownTriggerClass =
              'group h-7 w-7 flex items-center justify-center text-gray-600 hover:text-gray-800 p-0 min-w-0 border-0 bg-transparent shadow-none hover:bg-transparent rounded-none';
            const handleCopyMessage = () => {
              const text = getMessageCaptionForReply(msg) ?? msg.body ?? '';
              if (text.trim()) {
                navigator.clipboard.writeText(text.trim());
                toast.success(t('whatsappInbox.copiedToClipboard', 'Copied to clipboard'));
              } else {
                toast.info(t('whatsappInbox.noTextToCopy', 'No text to copy'));
              }
            };
            const replyMenuItem = (
              <DropdownMenuItem onClick={() => setReplyTo({ id: msg.id, body: getMessageCaptionForReply(msg) ?? msg.body, wa_message_id: msg.wa_message_id, message_type: msg.message_type, direction: msg.direction, media_url: msg.media_url ?? null })}>
                <Reply className="w-4 h-4 mr-2" />
                {t('whatsappInbox.reply', 'Reply')}
              </DropdownMenuItem>
            );
            const copyMenuItem = (
              <DropdownMenuItem onClick={handleCopyMessage}>
                <Copy className="w-4 h-4 mr-2" />
                {t('whatsappInbox.copy', 'Copy')}
              </DropdownMenuItem>
            );
            const inboundDropdown = msg.direction === 'inbound' && !selectionMode && !hideHeader ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={dropdownTriggerClass}
                    onClick={(e) => e.stopPropagation()}
                    aria-label="Opsi pesan"
                  >
                    <ChevronDown className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  {isInboundText ? (
                    <>
                      {copyMenuItem}
                      {replyMenuItem}
                    </>
                  ) : (
                    <>
                      {copyMenuItem}
                      <DropdownMenuItem onClick={handleSaveAs}>
                        <Download className="w-4 h-4 mr-2" />
                        {t('whatsappInbox.saveAs', 'Save as')}
                      </DropdownMenuItem>
                      {replyMenuItem}
                      <DropdownMenuItem onClick={handleDeleteMsg} className="text-red-600 focus:text-red-600">
                        <Trash2 className="w-4 h-4 mr-2" />
                        {t('whatsappInbox.delete', 'Delete')}
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null;

            const isOutboundText =
              msg.direction === 'outbound' &&
              !(msg.media_url && MEDIA_TYPES.includes(msg.message_type ?? ''));
            const isOutboundMedia =
              msg.direction === 'outbound' &&
              !!(msg.media_url && MEDIA_TYPES.includes(msg.message_type ?? ''));
            const hasReplyBlock = !!(msg.reply_to_body ?? msg.reply_to_wa_message_id ?? msg.reply_to_sender);
            const dropdownTriggerClassOutbound =
              'group h-7 w-7 flex items-center justify-center text-white/90 hover:text-white p-0 min-w-0 border-0 bg-transparent shadow-none hover:bg-transparent rounded-none';
            const outboundDropdown = msg.direction === 'outbound' && !selectionMode && !hideHeader ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={dropdownTriggerClassOutbound}
                    onClick={(e) => e.stopPropagation()}
                    aria-label={t('whatsappInbox.messageOptions', 'Message options')}
                  >
                    <ChevronDown className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  {isOutboundText ? (
                    <>
                      {copyMenuItem}
                      {replyMenuItem}
                    </>
                  ) : (
                    <>
                      {copyMenuItem}
                      <DropdownMenuItem onClick={handleSaveAs}>
                        <Download className="w-4 h-4 mr-2" />
                        {t('whatsappInbox.saveAs', 'Save as')}
                      </DropdownMenuItem>
                      {replyMenuItem}
                      <DropdownMenuItem onClick={handleDeleteMsg} className="text-red-600 focus:text-red-600">
                        <Trash2 className="w-4 h-4 mr-2" />
                        {t('whatsappInbox.delete', 'Delete')}
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null;

            return (
            <React.Fragment key={msg.id}>
            <div
              id={`msg-${msg.id}`}
              className={`flex items-start gap-2 shrink-0 ${marginBetween} ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'} ${effectiveScrollToMessageId === msg.id ? 'cursor-pointer' : ''}`}
              onClick={
                effectiveScrollToMessageId === msg.id
                  ? (e) => {
                      e.stopPropagation();
                      clearHighlightImmediately();
                    }
                  : undefined
              }
              role={effectiveScrollToMessageId === msg.id ? 'button' : undefined}
              tabIndex={effectiveScrollToMessageId === msg.id ? 0 : undefined}
              onKeyDown={
                effectiveScrollToMessageId === msg.id
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        clearHighlightImmediately();
                      }
                    }
                  : undefined
              }
              title={effectiveScrollToMessageId === msg.id ? t('whatsappInbox.clickToRemoveHighlight', 'Click to remove highlight') : undefined}
              aria-label={effectiveScrollToMessageId === msg.id ? t('whatsappInbox.clickToRemoveHighlight', 'Click to remove highlight') : undefined}
            >
              {msg.direction === 'inbound' && <CheckboxBtn />}
              <div
                data-msg-bubble={msg.id}
                className="relative max-w-[80%]"
                style={
                  hideHeader && swipeOffset?.msgId === msg.id
                    ? isDraggingReply
                      ? { transition: 'none', willChange: 'transform' as const, touchAction: 'pan-y' as const }
                      : {
                          transform: `translateX(${swipeOffset.translateX}px)`,
                          transition: SNAP_TRANSITION,
                          willChange: 'transform',
                          touchAction: 'pan-y' as const,
                        }
                    : undefined
                }
                {...(hideHeader && !selectionMode
                  ? {
                      onTouchStart: (e: React.TouchEvent) => {
                        e.stopPropagation();
                        const touch = e.touches[0];
                        touchStartRef.current = { msgId: msg.id, startX: touch.clientX, startY: touch.clientY };
                        swipeBubbleElRef.current = e.currentTarget as HTMLDivElement;
                        setIsDraggingReply(true);
                        setSwipeOffset({ msgId: msg.id, translateX: 0 });
                      },
                      onTouchMove: (e: React.TouchEvent) => {
                        const start = touchStartRef.current;
                        if (!start || start.msgId !== msg.id) return;
                        const currentX = e.touches[0].clientX;
                        const currentY = e.touches[0].clientY;
                        const deltaX = currentX - start.startX;
                        const deltaY = currentY - start.startY;
                        if (start.intent === undefined) {
                          const absX = Math.abs(deltaX);
                          const absY = Math.abs(deltaY);
                          if (absX > DIRECTION_LOCK_PX || absY > DIRECTION_LOCK_PX) {
                            start.intent = absX > absY + DIRECTION_LOCK_MARGIN_PX ? 'reply' : 'scroll';
                            if (start.intent === 'scroll') {
                              const el = swipeBubbleElRef.current;
                              if (el) {
                                el.style.transition = '';
                                el.style.transform = '';
                                swipeBubbleElRef.current = null;
                              }
                              setIsDraggingReply(false);
                              setSwipeOffset({ msgId: msg.id, translateX: 0 });
                              setTimeout(() => setSwipeOffset(null), 250);
                              touchStartRef.current = null;
                              return;
                            }
                          }
                        }
                        if (start.intent !== 'reply') return;
                        const translateX = Math.min(Math.max(0, deltaX), SWIPE_REPLY_MAX_TRANSLATE_PX);
                        const el = swipeBubbleElRef.current;
                        if (el) {
                          el.style.transition = 'none';
                          el.style.transform = `translateX(${translateX}px)`;
                        }
                      },
                      onTouchEnd: (e: React.TouchEvent) => {
                        const start = touchStartRef.current;
                        if (!start || start.msgId !== msg.id) return;
                        if (start.intent === 'scroll') return;
                        const endX = e.changedTouches[0].clientX;
                        const swipeDistance = endX - start.startX;
                        const triggeredReply = swipeDistance > SWIPE_REPLY_TRIGGER_PX;
                        if (triggeredReply) {
                          void triggerReplyHaptic();
                          setReplyTo({
                            id: msg.id,
                            body: getMessageCaptionForReply(msg) ?? msg.body ?? null,
                            wa_message_id: msg.wa_message_id ?? null,
                            message_type: msg.message_type ?? undefined,
                            direction: msg.direction,
                            media_url: msg.media_url ?? null,
                          });
                        }
                        const el = swipeBubbleElRef.current;
                        if (el) {
                          el.style.transition = SNAP_TRANSITION;
                          el.style.transform = 'translateX(0)';
                        }
                        setIsDraggingReply(false);
                        setSwipeOffset({ msgId: msg.id, translateX: 0 });
                        setTimeout(() => {
                          setSwipeOffset(null);
                          swipeBubbleElRef.current = null;
                        }, 250);
                        touchStartRef.current = null;
                      },
                      onTouchCancel: () => {
                        if (touchStartRef.current?.msgId === msg.id) {
                          const el = swipeBubbleElRef.current;
                          if (el) {
                            el.style.transition = SNAP_TRANSITION;
                            el.style.transform = 'translateX(0)';
                          }
                          setIsDraggingReply(false);
                          setSwipeOffset({ msgId: msg.id, translateX: 0 });
                          setTimeout(() => {
                            setSwipeOffset(null);
                            swipeBubbleElRef.current = null;
                          }, 250);
                          touchStartRef.current = null;
                        }
                      },
                      onPointerDown: (e: React.PointerEvent) => {
                        if (e.pointerType === 'touch') return;
                        e.stopPropagation();
                        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
                        touchStartRef.current = { msgId: msg.id, startX: e.clientX, startY: e.clientY };
                        swipeBubbleElRef.current = e.currentTarget as HTMLDivElement;
                        setIsDraggingReply(true);
                        setSwipeOffset({ msgId: msg.id, translateX: 0 });
                      },
                      onPointerMove: (e: React.PointerEvent) => {
                        if (e.pointerType === 'touch') return;
                        const start = touchStartRef.current;
                        if (!start || start.msgId !== msg.id) return;
                        const deltaX = e.clientX - start.startX;
                        const deltaY = e.clientY - start.startY;
                        if (start.intent === undefined) {
                          const absX = Math.abs(deltaX);
                          const absY = Math.abs(deltaY);
                          if (absX > DIRECTION_LOCK_PX || absY > DIRECTION_LOCK_PX) {
                            start.intent = absX > absY + DIRECTION_LOCK_MARGIN_PX ? 'reply' : 'scroll';
                            if (start.intent === 'scroll') {
                              const el = swipeBubbleElRef.current;
                              if (el) {
                                el.style.transition = '';
                                el.style.transform = '';
                                swipeBubbleElRef.current = null;
                              }
                              setIsDraggingReply(false);
                              setSwipeOffset({ msgId: msg.id, translateX: 0 });
                              setTimeout(() => setSwipeOffset(null), 250);
                              touchStartRef.current = null;
                              return;
                            }
                          }
                        }
                        if (start.intent !== 'reply') return;
                        const translateX = Math.min(Math.max(0, deltaX), SWIPE_REPLY_MAX_TRANSLATE_PX);
                        const el = swipeBubbleElRef.current;
                        if (el) {
                          el.style.transition = 'none';
                          el.style.transform = `translateX(${translateX}px)`;
                        }
                      },
                      onPointerUp: (e: React.PointerEvent) => {
                        if (e.pointerType === 'touch') return;
                        const start = touchStartRef.current;
                        if (!start || start.msgId !== msg.id) return;
                        if (start.intent === 'scroll') return;
                        const swipeDistance = e.clientX - start.startX;
                        const triggeredReply = swipeDistance > SWIPE_REPLY_TRIGGER_PX;
                        if (triggeredReply) {
                          void triggerReplyHaptic();
                          setReplyTo({
                            id: msg.id,
                            body: getMessageCaptionForReply(msg) ?? msg.body ?? null,
                            wa_message_id: msg.wa_message_id ?? null,
                            message_type: msg.message_type ?? undefined,
                            direction: msg.direction,
                            media_url: msg.media_url ?? null,
                          });
                        }
                        const el = swipeBubbleElRef.current;
                        if (el) {
                          el.style.transition = SNAP_TRANSITION;
                          el.style.transform = 'translateX(0)';
                        }
                        setIsDraggingReply(false);
                        setSwipeOffset({ msgId: msg.id, translateX: 0 });
                        setTimeout(() => {
                          setSwipeOffset(null);
                          swipeBubbleElRef.current = null;
                        }, 250);
                        touchStartRef.current = null;
                      },
                      onPointerLeave: (e: React.PointerEvent) => {
                        if (e.pointerType === 'touch') return;
                        if (touchStartRef.current?.msgId === msg.id) {
                          const el = swipeBubbleElRef.current;
                          if (el) {
                            el.style.transition = SNAP_TRANSITION;
                            el.style.transform = 'translateX(0)';
                          }
                          setIsDraggingReply(false);
                          setSwipeOffset({ msgId: msg.id, translateX: 0 });
                          setTimeout(() => {
                            setSwipeOffset(null);
                            swipeBubbleElRef.current = null;
                          }, 250);
                          touchStartRef.current = null;
                        }
                      },
                      onPointerCancel: (e: React.PointerEvent) => {
                        if (e.pointerType === 'touch') return;
                        (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
                        if (touchStartRef.current?.msgId === msg.id) {
                          const el = swipeBubbleElRef.current;
                          if (el) {
                            el.style.transition = SNAP_TRANSITION;
                            el.style.transform = 'translateX(0)';
                          }
                          setIsDraggingReply(false);
                          setSwipeOffset({ msgId: msg.id, translateX: 0 });
                          setTimeout(() => {
                            setSwipeOffset(null);
                            swipeBubbleElRef.current = null;
                          }, 250);
                          touchStartRef.current = null;
                        }
                      },
                    }
                  : {})}
              >
                <div
                  className={`relative rounded-xl ${
                    msg.media_url && MEDIA_TYPES.includes(msg.message_type ?? '')
                      ? 'px-1 py-1'
                      : 'px-2.5 py-1.5'
                  } ${
                    msg.direction === 'outbound'
                      ? 'bg-[#128C7E] text-white'
                      : 'bg-white text-gray-900 shadow-sm'
                  } ${selectionMode ? 'cursor-pointer' : ''} ${
                    isInboundText && !hideHeader ? 'pr-10' : ''
                  } ${
                    msg.direction === 'outbound' && !selectionMode && !hasReplyBlock && !hideHeader ? 'pr-10' : ''
                  }`}
                  onClick={selectionMode ? () => toggleSelectMessage(msg.id) : undefined}
                >
                  {isInboundText && inboundDropdown && (
                    <div className="absolute top-1 right-1" onClick={(e) => e.stopPropagation()}>
                      {inboundDropdown}
                    </div>
                  )}
                  {msg.direction === 'outbound' && !hasReplyBlock && outboundDropdown && (
                    <div className="absolute top-1 right-1" onClick={(e) => e.stopPropagation()}>
                      {outboundDropdown}
                    </div>
                  )}
                  {(msg.reply_to_body ?? msg.reply_to_wa_message_id ?? msg.reply_to_sender) && (() => {
                    const repliedToMsg = messages.find((m) => m.wa_message_id === msg.reply_to_wa_message_id);
                    const replyThumbUrl = repliedToMsg?.media_url && (repliedToMsg.message_type === 'image' || repliedToMsg.message_type === 'video') ? repliedToMsg.media_url : null;
                    const goToRepliedMessage = () => {
                      if (repliedToMsg?.id) setScrollToMessageIdLocal(repliedToMsg.id);
                    };
                    return (
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); goToRepliedMessage(); }}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goToRepliedMessage(); } }}
                      className={`flex items-start gap-1.5 mb-1.5 pb-1.5 -ml-0.5 -mr-0.5 px-1 rounded-r-sm border-l-2 border-r border-b cursor-pointer hover:opacity-95 ${
                        msg.direction === 'outbound'
                          ? 'bg-[#0a5a4a]/90 border-l-[#7dd3fc] border-r-white/90 border-white/20 text-white/90'
                          : 'bg-gray-100 border-l-[#128C7E] border-r-white border-gray-200 text-gray-700'
                      }`}
                      title={t('whatsappInbox.scrollToRepliedMessage', 'Click to go to the replied message')}
                      aria-label={t('whatsappInbox.scrollToRepliedMessage', 'Click to go to the replied message')}
                    >
                      {replyThumbUrl && !isBlockedImageUrl(replyThumbUrl) && (
                        <img src={replyThumbUrl} alt="" className="w-10 h-10 object-cover rounded shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className={`text-xs font-medium ${msg.direction === 'outbound' ? 'text-[#7dd3fc]' : 'text-[#128C7E]'}`}>
                          {msg.reply_to_sender?.trim() || t('whatsappInbox.replyTo', 'Balas: ')}
                        </div>
                        <div className="flex items-start gap-1.5 mt-0.5 text-xs break-words line-clamp-2 text-white/90 min-w-0">
                          {MEDIA_TYPES.includes((msg.reply_to_message_type ?? '').toLowerCase()) && !replyThumbUrl && (
                            <span className="shrink-0 mt-0.5 opacity-90">
                              <ReplyMediaIcon messageType={msg.reply_to_message_type} className="w-3.5 h-3.5" />
                            </span>
                          )}
                          <span className={msg.direction === 'outbound' ? 'text-white/90' : 'text-gray-600'}>
                            {msg.reply_to_body?.slice(0, 120) ?? (MEDIA_TYPES.includes((msg.reply_to_message_type ?? '').toLowerCase()) ? `[${(msg.reply_to_message_type ?? 'media').toLowerCase()}]` : '[Pesan]')}
                            {(msg.reply_to_body?.length ?? 0) > 120 ? '...' : ''}
                          </span>
                        </div>
                      </div>
                      {msg.direction === 'outbound' && outboundDropdown && (
                        <div className="shrink-0 self-center" onClick={(e) => e.stopPropagation()}>
                          {outboundDropdown}
                        </div>
                      )}
                    </div>
                    );
                  })()}
                  <div className="flex flex-col gap-0.5">
                    <div className="w-full min-w-0">
                      <MediaPreview
                        messageType={msg.message_type ?? 'text'}
                        mediaUrl={msg.media_url}
                        body={msg.body}
                        rawMetadata={msg.raw_metadata}
                        isOutbound={msg.direction === 'outbound'}
                        messageId={msg.id}
                        direction={msg.direction}
                        onResolve={resolveMedia}
                        isResolving={isResolvingMedia && resolvingMessageId === msg.id}
                        topRightAction={isInboundMedia ? inboundDropdown : undefined}
                        onMediaClick={(url, type) => setMediaViewer({ url, type })}
                      />
                    </div>
                    <p
                      className={`text-[10px] flex items-center justify-end gap-1 shrink-0 ${
                        msg.direction === 'outbound' ? 'text-white/80' : 'text-gray-500'
                      }`}
                    >
                      <span>{formatMessageTime(msg.created_at)}</span>
                      {msg.direction === 'outbound' && (() => {
                        const msgStatus = (msg as { status?: string | null }).status ?? null;
                        return (
                          <span className="flex items-center" title={msgStatus === 'read' ? 'Dibaca' : msgStatus === 'delivered' ? 'Terkirim' : msgStatus === 'sending' ? 'Mengirim...' : 'Terkirim'}>
                            <MessageStatus status={msgStatus as WhatsAppMessage['status'] | 'sending' | null} />
                          </span>
                        );
                      })()}
                    </p>
                  </div>
                </div>
              </div>
              {msg.direction === 'outbound' && <CheckboxBtn />}
            </div>
              {showDateSeparatorAfter && (
                <DateSeparator key={`date-${getDateKey(msg.created_at)}`} label={formatDateSeparator(msg.created_at, t, dateLocale)} />
              )}
            </React.Fragment>
            );
          });
          })()
        )}
      </div>
      </div>
      <div
        ref={chatInputBarRef}
        className={`flex-shrink-0 absolute bottom-0 left-0 right-0 z-10 bg-[#efeae2] ${hideHeader ? 'px-1 pt-2' : 'px-4 pt-4'} ${keyboardOpen ? 'pb-2' : 'pb-[max(0.5rem,calc(env(safe-area-inset-bottom,0px)+0.5rem))]'}`}
      >
        {sendDisabledByNoAccount && (
          <div
            className="text-sm font-medium text-slate-800 bg-slate-100 border-2 border-slate-300 rounded-lg px-3 py-2.5 mb-2 flex items-center gap-2"
            role="alert"
            aria-live="assertive"
          >
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-500 flex items-center justify-center text-white text-xs" aria-hidden>
              !
            </span>
            <span>
              {t('whatsappInbox.noWhatsAppAccountCannotSend', 'Tidak ada akun WhatsApp terhubung untuk organisasi ini. Hubungkan akun di Connect WhatsApp untuk mengirim pesan.')}
            </span>
          </div>
        )}
        {(isResolved || outside24h) && !sendDisabledByNoAccount && (
          <div
            className="text-sm font-medium text-amber-800 bg-amber-100 border-2 border-amber-400 rounded-lg px-3 py-2.5 mb-2 flex items-center gap-2"
            role="alert"
            aria-live="assertive"
          >
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center text-white text-xs" aria-hidden>
              !
            </span>
            <span>
              {outside24h
                ? t('whatsappInbox.outside24hCannotSend', 'Pesan terakhir dari customer sudah lewat 24 jam. Kirim pesan tidak diizinkan sampai customer mengirim pesan lagi.')
                : t('whatsappInbox.conversationResolvedCannotSend', 'Chat sudah di-resolve. Kirim pesan tidak diizinkan sampai ada pesan masuk baru dari customer.')}
            </span>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT_MEDIA}
          className="hidden"
          onChange={handleFileSelect}
        />
        {pendingMedia && (
          <div className="flex items-center gap-2 mb-2 p-2 rounded-lg bg-gray-100 border border-gray-200">
            {pendingMedia.previewUrl ? (
              <img
                src={pendingMedia.previewUrl}
                alt=""
                className="w-12 h-12 object-cover rounded shrink-0"
              />
            ) : (
              <div className="w-12 h-12 rounded bg-gray-200 flex items-center justify-center shrink-0">
                <FileText className="w-6 h-6 text-gray-500" />
              </div>
            )}
            <span className="text-sm text-gray-700 truncate flex-1 min-w-0" title={pendingMedia.file.name}>
              {pendingMedia.file.name}
            </span>
            <span className="text-xs text-gray-500 shrink-0">+ caption</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 h-8 w-8"
              onClick={clearPendingMedia}
              title={t('whatsappInbox.removeAttachment', 'Remove attachment')}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        )}
        <div className={`flex flex-col rounded-xl border-2 border-border bg-background shadow-sm overflow-hidden focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:border-primary/50 ${sendDisabled ? 'opacity-70' : ''} ${hideHeader ? 'min-h-[44px]' : 'min-h-[44px]'}`}>
          {replyTo && (
            <div className="flex items-start gap-2 px-2 pt-2 pb-1.5 border-b border-border bg-muted/50">
              <div className="flex items-start gap-2 min-w-0 flex-1">
                {(replyTo.media_url && (replyTo.message_type === 'image' || replyTo.message_type === 'video')) ? (
                  <img
                    src={replyTo.media_url}
                    alt=""
                    className="w-10 h-10 object-cover rounded shrink-0"
                  />
                ) : replyTo.message_type && MEDIA_TYPES.includes(replyTo.message_type.toLowerCase()) ? (
                  <div className="w-10 h-10 rounded bg-muted flex items-center justify-center shrink-0">
                    <ReplyMediaIcon messageType={replyTo.message_type} className="w-5 h-5 text-gray-500" />
                  </div>
                ) : null}
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium text-[#128C7E]">
                    {replyTo.direction === 'inbound'
                      ? (isInstagramConversation && !displayName?.trim()
                        ? t('whatsappInbox.instagramContact', 'Kontak Instagram')
                        : (displayName ?? (customerId ? maskPhoneLast4(customerId) : null) ?? 'Contact'))
                      : t('whatsappInbox.you', 'You')}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5 text-sm text-muted-foreground min-w-0">
                    {replyTo.message_type && MEDIA_TYPES.includes(replyTo.message_type.toLowerCase()) && !(replyTo.media_url && (replyTo.message_type === 'image' || replyTo.message_type === 'video')) && (
                      <span className="shrink-0 text-gray-500">
                        <ReplyMediaIcon messageType={replyTo.message_type} className="w-4 h-4" />
                      </span>
                    )}
                    <span className={replyTo.body ? 'truncate flex-1 min-w-0' : 'flex-1 min-w-0 text-gray-500'}>
                      {replyTo.body?.slice(0, 80) ?? (replyTo.message_type && MEDIA_TYPES.includes(replyTo.message_type.toLowerCase()) ? `[${replyTo.message_type}]` : '[Pesan]')}
                      {(replyTo.body?.length ?? 0) > 80 ? '...' : ''}
                    </span>
                  </div>
                </div>
              </div>
              <Button type="button" variant="ghost" size="icon" className="shrink-0 h-8 w-8" onClick={() => setReplyTo(null)} aria-label={t('whatsappInbox.cancelReply', 'Cancel reply')}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}
          <div className="flex min-h-[44px]">
          <button
            type="button"
            className={`shrink-0 text-muted-foreground hover:text-foreground disabled:opacity-50 self-end ${hideHeader ? 'p-2 pb-2.5' : 'p-2.5'}`}
            disabled={isSending || isUploading || sendDisabled}
            onClick={() => !sendDisabled && fileInputRef.current?.click()}
            title={t('whatsappInbox.attachMedia', 'Attach image, video, or document')}
            aria-label={t('whatsappInbox.attachMedia', 'Attach image, video, or document')}
          >
            <Paperclip className="w-4 h-4" />
          </button>
          <Textarea
            ref={textareaRef}
            placeholder={pendingMedia ? t('whatsappInbox.writeCaption', 'Write caption (optional)...') : t('whatsappInbox.typeMessage', 'Type a message...')}
            value={text}
            onChange={(e) => !sendDisabled && setText(e.target.value)}
            onFocus={() => {
              unlockInboundNotificationAudio();
              if (hideHeader && chatInputBarRef.current) {
                setTimeout(() => {
                  chatInputBarRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
                }, 300);
              }
            }}
            rows={hideHeader ? 1 : 2}
            readOnly={sendDisabled}
            className={`resize-none flex-1 border-0 focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none bg-transparent pr-1 pl-0 overflow-x-hidden seamless-scroll ${hideHeader ? 'min-h-[44px] max-h-[120px] py-2.5 text-base leading-normal' : 'min-h-[44px] py-2'}`}
          />
          <button
            type="button"
            onPointerDown={(e) => {
                e.preventDefault();
                unlockInboundNotificationAudio();
              }}
            onClick={handleSend}
            disabled={sendDisabled || (!text.trim() && !pendingMedia) || isSending || isUploading}
            title={t('whatsappInbox.send', 'Send')}
            aria-label={t('whatsappInbox.send', 'Send')}
            className={`shrink-0 self-end rounded-full bg-background border-2 border-border flex items-center justify-center text-foreground hover:bg-muted disabled:opacity-50 disabled:hover:bg-background ${hideHeader ? 'mr-1.5 mb-1 w-9 h-9' : 'mr-1.5 w-9 h-9'}`}
          >
            <Send className={hideHeader ? 'w-4 h-4' : 'w-4 h-4'} strokeWidth={2.5} />
          </button>
          </div>
        </div>
      </div>
      <Dialog open={!!mediaViewer} onOpenChange={(open) => !open && setMediaViewer(null)}>
        <DialogContent className="max-w-[95vw] max-h-[90vh] w-auto p-0 gap-0 overflow-hidden bg-black/95 border-0" hideCloseButton>
          <DialogTitle className="sr-only">
            {mediaViewer?.type === 'image'
              ? t('whatsappInbox.imagePreview', 'Image preview')
              : mediaViewer?.type === 'video'
                ? t('whatsappInbox.videoPreview', 'Video preview')
                : t('whatsappInbox.mediaPreview', 'Media preview')}
          </DialogTitle>
          {mediaViewer && (
            <div className="relative flex items-center justify-center min-h-[200px] max-h-[90vh] p-2">
              <button
                type="button"
                onClick={() => setMediaViewer(null)}
                aria-label={t('whatsappInbox.close', 'Tutup')}
                className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-md bg-white text-gray-800 shadow-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black/50"
              >
                <X className="h-5 w-5" />
              </button>
              {mediaViewer.type === 'image' && (
                <img src={mediaViewer.url} alt="" className="max-w-full max-h-[85vh] object-contain rounded" />
              )}
              {mediaViewer.type === 'video' && (
                <video src={mediaViewer.url} controls autoPlay className="max-w-full max-h-[85vh] rounded" />
              )}
              {(mediaViewer.type === 'document' || mediaViewer.type === 'audio') && (
                <div className="flex flex-col items-center gap-4 p-4 text-white">
                  {mediaViewer.type === 'audio' ? (
                    <audio src={mediaViewer.url} controls autoPlay className="w-full max-w-md" />
                  ) : (
                    <iframe src={mediaViewer.url} title="Document" className="w-full min-h-[70vh] max-h-[85vh] rounded bg-white" />
                  )}
                  <a href={mediaViewer.url} target="_blank" rel="noopener noreferrer" className="text-sm text-[#7dd3fc] underline hover:no-underline">
                    {t('whatsappInbox.openInNewTabLink', 'Buka di tab baru')}
                  </a>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
