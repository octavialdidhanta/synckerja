/**
 * Syncs the Live Chat unread count to the PWA app icon badge (Badging API).
 * Render this in layouts that are active when the user is logged in (desktop sidebar, mobile home, livechat page).
 */
import { useEffect } from 'react';
import { useWhatsAppUnreadCount } from '../hooks/useWhatsAppUnreadCount';

export function LiveChatAppBadgeSync() {
  const { data: count = 0 } = useWhatsAppUnreadCount();

  useEffect(() => {
    if (typeof navigator === 'undefined') return;
    const n = navigator as Navigator & { setAppBadge?: (count: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
    if (n.setAppBadge && n.clearAppBadge) {
      if (count > 0) {
        n.setAppBadge(count).catch(() => {});
      } else {
        n.clearAppBadge().catch(() => {});
      }
    }
  }, [count]);

  return null;
}
