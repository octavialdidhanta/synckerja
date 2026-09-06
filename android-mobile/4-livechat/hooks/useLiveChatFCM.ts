import { useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import type { PluginListenerHandle } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { showLocalNotification } from "@/mobile-app/utils/showLocalNotification";
import { isPosNativeApp } from "@/shared/native/appSurface";

export function useLiveChatFCM() {
  const handlesRef = useRef<PluginListenerHandle[]>([]);

  useEffect(() => {
    // Omnichannel livechat banners are Office-only (POS must not present them).
    if (isPosNativeApp()) return;
    if (!Capacitor.isNativePlatform()) return;
    if (!Capacitor.isPluginAvailable("PushNotifications")) return;

    const setup = async () => {
      if (Capacitor.isPluginAvailable("FirebaseReady")) {
        try {
          const { FirebaseReady } = await import("@/shared/native/firebaseReadyPlugin");
          const { ready } = await FirebaseReady.isReady();
          if (!ready) return;
        } catch {
          return;
        }
      }

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
      // pushNotificationActionPerformed: wire a global listener in the app shell if tap routing is required
      handlesRef.current = [h];
    };

    setup().catch(() => {});

    return () => {
      handlesRef.current.forEach((h) => h.remove());
      handlesRef.current = [];
    };
  }, []);
}
