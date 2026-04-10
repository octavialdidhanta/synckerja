/**
 * Global realtime subscription for inbound messages.
 * - Web: toast with sound when visible; Web Notification when tab hidden.
 * - Native: only FCM triggers sound + banner; Realtime shows toast without sound for in-app feedback.
 */
import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { devLog } from '@/config/logger';
import { playNotificationSound } from '@/lib/notificationSound';
import { useAppTranslation } from '@/features/share/i18n/useAppTranslation';

function showInboundNotification(
  title: string,
  body: string,
  timeoutsRef?: { current: ReturnType<typeof setTimeout>[] }
) {
  if (typeof document === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  try {
    playNotificationSound({ vibrate: true });
    const n = new Notification(title, {
      body,
      tag: 'livechat-inbound',
      requireInteraction: false,
    });
    const timeoutId = setTimeout(() => n.close(), 6000);
    if (timeoutsRef) timeoutsRef.current.push(timeoutId);
  } catch {
    // ignore
  }
}

type InboundTable = 'whatsapp_messages' | 'instagram_messages' | 'email_messages';

function getChannelLabel(table: InboundTable): string {
  if (table === 'whatsapp_messages') return 'WhatsApp';
  if (table === 'instagram_messages') return 'Instagram';
  return 'Email';
}

function getMessagePreview(row: Record<string, unknown>): string {
  const body = (row.body as string) ?? (row.caption as string) ?? (row.text as string) ?? (row.snippet as string) ?? '';
  const str = typeof body === 'string' ? body.trim() : '';
  if (str.length <= 48) return str;
  return str.slice(0, 45) + '…';
}

type TFunction = (key: string, fallback: string) => string;

/** Toast bergaya WhatsApp. On native no sound (FCM handles sound+banner). */
function showInboundToast(
  channelLabel: string,
  messagePreview: string,
  t: TFunction,
  playSound: boolean
) {
  if (playSound) playNotificationSound({ vibrate: true });
  const newMessageLabel = t('livechat.inboundNewMessage', 'Pesan baru');
  toast(`[${channelLabel}] ${newMessageLabel}`, {
    description: messagePreview || newMessageLabel,
    duration: 4000,
    position: 'top-center',
    classNames: {
      toast:
        'border-l-4 border-l-[#25D366] bg-white text-gray-900 shadow-lg max-w-[min(320px,calc(100vw-24px))]',
      description: 'text-gray-600',
      title: 'font-semibold',
    },
  });
}

export function useLiveChatInboundNotification(currentConversationId: string | null) {
  const { t } = useAppTranslation();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const notificationTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const channelName = 'livechat_inbound_global';

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    notificationTimeoutsRef.current = [];

    const newMessageLabel = t('livechat.inboundNewMessage', 'Pesan baru');
    const openAppHint = t('livechat.inboundMessageOpenApp', 'Ada pesan masuk di Live Chat. Buka aplikasi untuk melihat.');

    const handleInbound = (table: InboundTable) => (payload: { new?: Record<string, unknown> }) => {
      const row = payload?.new as { conversation_id?: string; direction?: string } | undefined;
      if (!row || row.direction !== 'inbound') return;
      const conversationId = row.conversation_id;
      if (!conversationId) return;
      if (currentConversationId === conversationId) return;

      const channelLabel = getChannelLabel(table);
      const messagePreview = getMessagePreview((payload?.new ?? {}) as Record<string, unknown>);
      const isNative = Capacitor.isNativePlatform();
      // Native: only FCM triggers sound + banner; Realtime shows toast without sound
      showInboundToast(channelLabel, messagePreview || newMessageLabel, t, !isNative);
      // Web: when tab hidden show system notification. Native background: FCM handles it
      if (!isNative && document.visibilityState === 'hidden') {
        showInboundNotification(
          `[${channelLabel}] ${newMessageLabel}`,
          messagePreview || openAppHint,
          notificationTimeoutsRef
        );
      }
    };

    channelRef.current = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'whatsapp_messages' },
        handleInbound('whatsapp_messages')
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'instagram_messages' },
        handleInbound('instagram_messages')
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'email_messages' },
        handleInbound('email_messages')
      );

    const channelErrorToastShownRef = { current: false };
    channelRef.current.subscribe((status) => {
      if (status === 'CHANNEL_ERROR') {
        devLog.warn('LiveChat inbound subscription failed', status);
        if (!channelErrorToastShownRef.current) {
          channelErrorToastShownRef.current = true;
          toast.warning(t('livechat.notificationConnectionDisrupted', 'Koneksi notifikasi terganggu'));
        }
      }
    });

    return () => {
      notificationTimeoutsRef.current.forEach((id) => clearTimeout(id));
      notificationTimeoutsRef.current = [];
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [currentConversationId, t]);
}
