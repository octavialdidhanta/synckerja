/**
 * Registers FCM token with context "general" for app notifications (comments, pending approvals, etc.)
 * so push is sent when app is in background. Call once at app shell when on native.
 * When app is in foreground: shows system banner only (same style as background), no sound, no toast.
 *
 * Satu perangkat = satu user: token selalu di-save untuk user yang sedang login. Saat ganti akun
 * (Octa → Milda atau sebaliknya), token di backend dipindah ke user baru; re-save saat user berubah
 * dan saat app ke foreground agar notifikasi tidak salah kirim.
 *
 * Does not use useAppTranslation so it can run outside LanguageProvider (e.g. during HMR or at app shell).
 */
import { useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Capacitor } from "@capacitor/core";
import type { PluginListenerHandle } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { supabase } from "@/integrations/supabase/client";
import { SUPABASE_URL } from "@/integrations/supabase/client";
import { showLocalNotification } from "@/mobile/utils/showLocalNotification";
import { devLog } from "@/config/logger";
import { toast } from "sonner";
import { useAuth } from "@/features/1-login/contexts/AuthContext";

const FALLBACK = {
  fcmTokenSaveFailed: "Gagal menyimpan token notifikasi. Coba lagi nanti.",
  fcmTokenSaveError: "Token notifikasi gagal disimpan.",
  newNotification: "Notifikasi",
} as const;

export function useAppNotificationsFCM() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const handlesRef = useRef<PluginListenerHandle[]>([]);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTokenRef = useRef<string | null>(null);

  const saveToken = useCallback(async (token: string) => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      const platform = Capacitor.getPlatform() as "android" | "ios";
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      };
      // Save for both "general" (app notifications) and "livechat" so one device gets all push types.
      for (const context of ["general", "livechat"] as const) {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/livechat-save-fcm-token`, {
          method: "POST",
          headers,
          body: JSON.stringify({ token, platform, context }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          devLog.error(`FCM token save failed (${context})`, res.status, err);
          toast.error(FALLBACK.fcmTokenSaveFailed);
        }
      }
    } catch (e) {
      devLog.error("app-notifications FCM token save error", e);
      toast.error(FALLBACK.fcmTokenSaveError);
    }
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    if (!Capacitor.isPluginAvailable("PushNotifications")) return;

    const run = async () => {
      try {
        const perm = await PushNotifications.requestPermissions();
        if (perm.receive !== "granted") return;
        await PushNotifications.register();
      } catch (e) {
        devLog.error("PushNotifications register (app notifications) error", e);
      }
    };

    // Re-register when app comes to foreground; re-save token untuk user saat ini (event registration
    // kadang tidak fire lagi jika token di-cache, jadi kita panggil saveToken dengan token yang tersimpan).
    let lastRegisterAt = 0;
    const REGISTER_THROTTLE_MS = 30_000;
    const handleAppActive = async () => {
      const now = Date.now();
      if (now - lastRegisterAt < REGISTER_THROTTLE_MS) return;
      lastRegisterAt = now;
      try {
        const perm = await PushNotifications.checkPermissions();
        if (perm.receive !== "granted") return;
        await PushNotifications.register();
        if (lastTokenRef.current) await saveToken(lastTokenRef.current);
      } catch (e) {
        devLog.error("PushNotifications re-register on app active error", e);
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") handleAppActive();
    };

    const setup = async () => {
      const h1 = await PushNotifications.addListener("registration", (ev: { value: string }) => {
        if (ev.value) {
          lastTokenRef.current = ev.value;
          saveToken(ev.value);
        }
      });
      const h2 = await PushNotifications.addListener(
        "pushNotificationReceived",
        (ev: { data?: Record<string, string>; title?: string; body?: string }) => {
          const data = ev.data ?? {};
          const isAppNotification = data.openNotifications === "true" || data.url === "/";
          if (!isAppNotification) return;
          // Foreground: show system banner only (sound from FCM/OS)
          const title = ev.title ?? FALLBACK.newNotification;
          const body = ev.body ?? "";
          showLocalNotification({ title, body });
          queryClient.invalidateQueries({ queryKey: ["review-comment-notifications"] });
          queryClient.invalidateQueries({ queryKey: ["completion-approvals"] });
          queryClient.invalidateQueries({ queryKey: ["plan-status-change-notifications"] });
          queryClient.invalidateQueries({ queryKey: ["daily-task-notifications"] });
        }
      );
      handlesRef.current = [h1, h2];
      run();

      document.addEventListener("visibilitychange", onVisibilityChange);

      // Satu kali re-register setelah app ready agar token pasti di-save untuk user yang login
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(handleAppActive, 2000);
    };

    setup().catch(() => {});
    return () => {
      handlesRef.current.forEach((h) => h.remove());
      handlesRef.current = [];
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (userSaveTimeoutRef.current) {
        clearTimeout(userSaveTimeoutRef.current);
        userSaveTimeoutRef.current = null;
      }
    };
  }, [queryClient, saveToken]);

  // Saat user ganti (switch akun), re-save token untuk user baru agar notif tidak ke device user lama
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    if (!user?.id || !lastTokenRef.current) return;
    if (userSaveTimeoutRef.current) clearTimeout(userSaveTimeoutRef.current);
    userSaveTimeoutRef.current = setTimeout(() => {
      if (lastTokenRef.current) void saveToken(lastTokenRef.current);
    }, 500);
    return () => {
      if (userSaveTimeoutRef.current) {
        clearTimeout(userSaveTimeoutRef.current);
        userSaveTimeoutRef.current = null;
      }
    };
  }, [user?.id, saveToken]);
}
