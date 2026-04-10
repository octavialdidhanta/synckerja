/**
 * Show a local (in-app) system notification so it appears as a popup from the status bar.
 * Used when app is in foreground and we receive FCM or Realtime events.
 * Only runs on native (Capacitor); no-op on web.
 */
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

const NOTIFICATIONS_CHANNEL_ID = "notifications";
let channelCreated = false;
let permissionRequested = false;

async function ensureChannelAndPermission(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    if (!permissionRequested) {
      const { display } = await LocalNotifications.checkPermissions();
      if (display !== "granted") {
        const result = await LocalNotifications.requestPermissions();
        if (result.display !== "granted") return false;
      }
      permissionRequested = true;
    }
    if (!channelCreated) {
      // Channel tanpa sound agar notifikasi foreground tidak beep (hanya banner seperti background)
      await LocalNotifications.createChannel({
        id: NOTIFICATIONS_CHANNEL_ID,
        name: "Notifikasi Aplikasi",
        description: "Komentar, persetujuan tugas, dan notifikasi lain",
        importance: 5,
        visibility: 1,
        vibration: true,
        // sound tidak diset = tidak ada suara saat notifikasi tampil (foreground)
      });
      channelCreated = true;
    }
    return true;
  } catch {
    return false;
  }
}

export interface ShowLocalNotificationOptions {
  title: string;
  body: string;
  /** Optional; if not provided a timestamp-based id is used (32-bit safe). */
  id?: number;
}

/**
 * Display a system notification (popup from status bar). No-op on web or if permission denied.
 */
export async function showLocalNotification(options: {
  title: string;
  body: string;
  id?: number;
}): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  const ok = await ensureChannelAndPermission();
  if (!ok) return;
  try {
    const id =
      options.id != null
        ? Math.floor(options.id) % 2147483647
        : Math.abs((Date.now() / 10) % 2147483647) || 1;
    await LocalNotifications.schedule({
      notifications: [
        {
          id,
          title: options.title || "Notifikasi",
          body: options.body || "",
          channelId: NOTIFICATIONS_CHANNEL_ID,
          schedule: { at: new Date(Date.now() + 100) },
        },
      ],
    });
  } catch {
    // ignore
  }
}
