/**
 * Live Chat foreground notification presentation.
 * Token save + register flow is centralized in useAppNotificationsFCM to avoid duplicate listeners.
 */
import { useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import type { PluginListenerHandle } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { showLocalNotification } from "@/mobile/utils/showLocalNotification";

export function useLiveChatFCM() {
  const handlesRef = useRef<PluginListenerHandle[]>([]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    if (!Capacitor.isPluginAvailable("PushNotifications")) return;

    const setup = async () => {
      const h = await PushNotifications.addListener(
        "pushNotificationReceived",
        (ev: { data?: Record<string, string>; title?: string; body?: string }) => {
          const data = ev.data ?? {};
          // Hanya handle push Live Chat; skip push app-notifications (review comment, pending approval, dll)
          const isAppNotification = data.openNotifications === "true" || data.url === "/";
          if (isAppNotification) return;

          const title = ev.title ?? "Live Chat";
          const body = ev.body ?? "";
          const isForeground =
            typeof document !== "undefined" && document.visibilityState === "visible";

          // Foreground: tampilkan system banner saja (sama seperti background), tanpa suara
          if (isForeground) {
            showLocalNotification({ title, body });
          }
          // Background: biarkan FCM OS yang menampilkan banner + bunyi dari payload server
        }
      );
      // pushNotificationActionPerformed is handled globally by usePushNotificationHandlers
      handlesRef.current = [h];
    };

    setup().catch(() => {});

    return () => {
      handlesRef.current.forEach((h) => h.remove());
      handlesRef.current = [];
    };
  }, []);
}
