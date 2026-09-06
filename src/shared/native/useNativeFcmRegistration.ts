import { useEffect, useRef } from "react";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import type { PluginListenerHandle } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { useAuth } from "@/shared/auth/contexts/AuthContext";
import { supabase } from "@/shared/lib/supabaseClient";
import { FirebaseReady } from "@/shared/native/firebaseReadyPlugin";
import {
  getNativeAppId,
  isPosNativeApp,
  NATIVE_APP_ID_OFFICE,
  NATIVE_APP_ID_POS,
} from "@/shared/native/appSurface";

const OFFICE_CONTEXTS = ["livechat", "general"] as const;
const POS_CONTEXTS = ["general"] as const;

/** False when POS native has no initialized FirebaseApp (missing google-services.json). */
async function isNativeFirebaseReady(): Promise<boolean> {
  if (!Capacitor.isPluginAvailable("FirebaseReady")) return true;
  try {
    const { ready } = await FirebaseReady.isReady();
    return Boolean(ready);
  } catch {
    return false;
  }
}

async function persistFcmToken(fcmToken: string, platform: "android" | "ios") {
  const appId = getNativeAppId() ?? (isPosNativeApp() ? NATIVE_APP_ID_POS : NATIVE_APP_ID_OFFICE);
  const contexts = appId === NATIVE_APP_ID_POS ? POS_CONTEXTS : OFFICE_CONTEXTS;

  // POS: always ask server to drop any stale livechat rows for this device token.
  if (appId === NATIVE_APP_ID_POS) {
    const { error } = await supabase.functions.invoke("livechat-save-fcm-token", {
      body: { token: fcmToken, platform, context: "livechat", app_id: appId },
    });
    if (error) {
      console.warn("[FCM] POS livechat cleanup failed", error.message);
    }
  }

  await Promise.all(
    contexts.map(async (context) => {
      const { error } = await supabase.functions.invoke("livechat-save-fcm-token", {
        body: { token: fcmToken, platform, context, app_id: appId },
      });
      if (error) {
        console.warn("[FCM] livechat-save-fcm-token failed", context, error.message);
      }
    }),
  );
}

/**
 * Capacitor native: minta izin, daftar ke FCM/APNs, simpan token ke `fcm_tokens`.
 * Omnichannel livechat tokens = Office only (`id.synckerja.app`).
 */
export function useNativeFcmRegistration() {
  const { user, loading } = useAuth();
  const lastPersistedRef = useRef<{ userId: string; token: string } | null>(null);
  const handlesRef = useRef<PluginListenerHandle[]>([]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    if (!Capacitor.isPluginAvailable("PushNotifications")) return;
    if (loading) return;

    if (!user?.id) {
      lastPersistedRef.current = null;
      return;
    }

    const userId = user.id;
    let cancelled = false;

    const clearListeners = async () => {
      for (const h of handlesRef.current) {
        await h.remove();
      }
      handlesRef.current = [];
    };

    const run = async () => {
      try {
        if (!(await isNativeFirebaseReady())) {
          console.warn("[FCM] skipped: FirebaseApp is not initialized");
          return;
        }

        await clearListeners();

        const {
          data: { session: preSession },
        } = await supabase.auth.getSession();
        if (cancelled) return;
        if (!preSession?.access_token) return;

        const regHandle = await PushNotifications.addListener("registration", async (ev) => {
          if (cancelled) return;
          const token = typeof ev.value === "string" ? ev.value.trim() : "";
          if (!token) return;

          const platform = Capacitor.getPlatform();
          if (platform !== "android" && platform !== "ios") return;

          const prev = lastPersistedRef.current;
          if (prev?.userId === userId && prev.token === token) return;

          const {
            data: { session: live },
          } = await supabase.auth.getSession();
          if (!live?.user || live.user.id !== userId) return;

          await persistFcmToken(token, platform);
          lastPersistedRef.current = { userId, token };
        });

        const errHandle = await PushNotifications.addListener("registrationError", (err) => {
          console.warn("[FCM] registrationError", err);
        });

        handlesRef.current = [regHandle, errHandle];

        const perm = await PushNotifications.requestPermissions();
        if (cancelled) return;
        if (perm.receive !== "granted") return;

        await PushNotifications.register();

        // Setelah user mengaktifkan notifikasi di pengaturan sistem, `register()` perlu dipanggil lagi.
        if (Capacitor.isPluginAvailable("App")) {
          const resumeH = await App.addListener("resume", () => {
            if (cancelled) return;
            void (async () => {
              try {
                if (!(await isNativeFirebaseReady())) return;
                const {
                  data: { session: s },
                } = await supabase.auth.getSession();
                if (!s?.user || s.user.id !== userId) return;
                const p = await PushNotifications.requestPermissions();
                if (p.receive !== "granted") return;
                await PushNotifications.register();
              } catch (err) {
                console.warn("[FCM] resume register failed", err);
              }
            })();
          });
          handlesRef.current.push(resumeH);
        }
      } catch (err) {
        console.warn("[FCM] registration failed", err);
      }
    };

    void run();

    return () => {
      cancelled = true;
      void clearListeners();
    };
  }, [loading, user?.id]);
}
