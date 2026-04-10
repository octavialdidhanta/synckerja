/**
 * Single global handler for push notification tap: routes to home + reopen notifications modal
 * (general app notifications) or to Live Chat (livechat notifications).
 *
 * Android: custom SynckerjaFirebaseMessagingService shows local notifications with a direct
 * MainActivity PendingIntent, so Capacitor's pushNotificationActionPerformed does not fire.
 * Pending payload is bridged via NotificationLaunch.consumePendingPushTap().
 */
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import type { PluginListenerHandle } from "@capacitor/core";
import { App } from "@capacitor/app";
import { PushNotifications } from "@capacitor/push-notifications";
import { NotificationLaunch } from "@/mobile/native/notificationLaunch";
import { handleAppPushTapRouting } from "@/mobile/hooks/handleAppPushTapRouting";

const notifDebug = (event: string, payload?: Record<string, unknown>) => {
  try {
    const body = payload ? ` ${JSON.stringify(payload)}` : "";
    console.info(`[NOTIF_DEBUG][pushAction] ${event}${body}`);
  } catch {
    console.info(`[NOTIF_DEBUG][pushAction] ${event} [payload-unserializable]`);
  }
};

export function usePushNotificationHandlers() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const handleRef = useRef<PluginListenerHandle | null>(null);
  const resumeRef = useRef<PluginListenerHandle | null>(null);
  const lastHandledSigRef = useRef<string | null>(null);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    if (!Capacitor.isPluginAvailable("PushNotifications")) return;

    const runTap = (data: Record<string, string>, source: string) => {
      const sig = JSON.stringify(data);
      if (lastHandledSigRef.current === sig) {
        notifDebug("skip duplicate tap", { source });
        return;
      }
      lastHandledSigRef.current = sig;
      window.setTimeout(() => {
        if (lastHandledSigRef.current === sig) lastHandledSigRef.current = null;
      }, 4000);
      notifDebug("handle tap", { source, keys: Object.keys(data) });
      handleAppPushTapRouting(data, navigate, queryClient, notifDebug);
    };

    const tryConsumeAndroidIntentTap = async (source: string) => {
      if (Capacitor.getPlatform() !== "android") return;
      try {
        const data = await NotificationLaunch.consumePendingPushTap();
        if (!data || Object.keys(data).length === 0) return;
        runTap(data, source);
      } catch (e) {
        notifDebug("consumePendingPushTap error", { source, err: String(e) });
      }
    };

    const setup = async () => {
      const h = await PushNotifications.addListener(
        "pushNotificationActionPerformed",
        (ev: { notification: { data?: Record<string, string> } }) => {
          const data = ev.notification?.data ?? {};
          runTap(data, "pushNotificationActionPerformed");
        }
      );
      handleRef.current = h;

      if (Capacitor.isPluginAvailable("App")) {
        const rh = await App.addListener("resume", () => {
          void tryConsumeAndroidIntentTap("appResume");
        });
        resumeRef.current = rh;
      }

      await tryConsumeAndroidIntentTap("mount");

      if (Capacitor.getPlatform() === "android") {
        window.setTimeout(() => void tryConsumeAndroidIntentTap("delay250"), 250);
        window.setTimeout(() => void tryConsumeAndroidIntentTap("delay900"), 900);
        window.setTimeout(() => void tryConsumeAndroidIntentTap("delay2000"), 2000);
      }
    };

    setup().catch(() => {});
    return () => {
      handleRef.current?.remove();
      handleRef.current = null;
      resumeRef.current?.remove();
      resumeRef.current = null;
    };
  }, [navigate, queryClient]);
}
