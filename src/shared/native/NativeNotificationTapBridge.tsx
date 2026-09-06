import { useEffect, useRef } from "react";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { App } from "@capacitor/app";
import { PushNotifications } from "@capacitor/push-notifications";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/shared/auth/contexts/AuthContext";
import { useCentralizedUserData } from "@/shared/auth/contexts/CentralizedUserDataContext";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { SYNCKERJA_SPLASH_HIDDEN_EVENT } from "@/shared/hooks/useNativeSafeAreaCssVars";

type NotificationLaunchPlugin = {
  consumePendingPushTap: () => Promise<Record<string, unknown>>;
};

const NotificationLaunch = registerPlugin<NotificationLaunchPlugin>("NotificationLaunch");

const PENDING_PATH_KEY = "synckerja.pendingNotificationPath";

function parseUrlToPath(url: string): string | null {
  const raw = String(url || "").trim();
  if (!raw) return null;
  if (raw.startsWith("/")) return raw;
  try {
    const u = new URL(raw);
    return `${u.pathname}${u.search}${u.hash}`;
  } catch {
    return null;
  }
}

function inferLivechatPathFromPayload(payload: Record<string, unknown>): string | null {
  const url = payload.url != null ? String(payload.url) : "";
  const parsed = parseUrlToPath(url);
  if (parsed) return parsed;

  const conversationId = payload.conversation_id != null ? String(payload.conversation_id) : "";
  if (conversationId) {
    return `/omnichannel/livechat?conversation=${encodeURIComponent(conversationId)}`;
  }
  const ticketId = payload.ticket_id != null ? String(payload.ticket_id) : "";
  if (ticketId) {
    return `/omnichannel/livechat?ticket_id=${encodeURIComponent(ticketId)}`;
  }
  return null;
}

function inferDailyTaskPathFromPayload(payload: Record<string, unknown>): string | null {
  const url = payload.url != null ? String(payload.url) : "";
  const parsed = parseUrlToPath(url);
  if (parsed) return parsed;
  return "/tools/daily-task";
}

function inferProductionReviewPathFromPayload(payload: Record<string, unknown>): string | null {
  const url = payload.url != null ? String(payload.url) : "";
  const parsed = parseUrlToPath(url);
  if (parsed) return parsed;
  const reviewToken = payload.review_token != null ? String(payload.review_token) : "";
  if (reviewToken) return `/review/${encodeURIComponent(reviewToken)}`;
  const planId = payload.social_media_plan_id != null ? String(payload.social_media_plan_id) : "";
  if (planId) return `/digital-marketing/social-media/dashboard`;
  return "/digital-marketing/social-media/dashboard";
}

/** Resolve deep link from any known push payload shape. */
function resolveNavigationPath(payload: Record<string, unknown>): string | null {
  const notificationType = payload.notificationType != null ? String(payload.notificationType) : "";
  const openNotifications = payload.openNotifications != null ? String(payload.openNotifications) : "";

  if (openNotifications === "true") {
    const url = payload.url != null ? String(payload.url) : "";
    const parsed = parseUrlToPath(url);
    return parsed || "/";
  }

  if (notificationType === "livechat_assignment" || notificationType === "livechat_inbound") {
    return inferLivechatPathFromPayload(payload);
  }

  if (
    notificationType === "daily_task_assignment" ||
    notificationType === "daily_task_completion" ||
    notificationType === "daily_task_step_comment"
  ) {
    return inferDailyTaskPathFromPayload(payload);
  }

  if (notificationType === "social_media_production_review") {
    return inferProductionReviewPathFromPayload(payload);
  }

  // Fallback: any payload with url / livechat keys (e.g. older livechat pushes without notificationType).
  const livechatPath = inferLivechatPathFromPayload(payload);
  if (livechatPath) return livechatPath;

  const url = payload.url != null ? String(payload.url) : "";
  return parseUrlToPath(url);
}

function stashPath(path: string) {
  try {
    sessionStorage.setItem(PENDING_PATH_KEY, path);
  } catch {
    // ignore
  }
}

function takeStashedPath(): string | null {
  try {
    const path = sessionStorage.getItem(PENDING_PATH_KEY);
    if (path) sessionStorage.removeItem(PENDING_PATH_KEY);
    return path;
  } catch {
    return null;
  }
}

function clearStashedPath() {
  try {
    sessionStorage.removeItem(PENDING_PATH_KEY);
  } catch {
    // ignore
  }
}

/**
 * Android native uses a custom FCM service + PendingIntent (see `NotificationLaunchStore`).
 * This bridge consumes the pending tap payload and navigates inside the React Router app.
 *
 * Cold start: do not navigate until auth/org bootstrap is ready — early `replace` into a
 * lazy route (e.g. livechat) races splash/auth and can leave a blank white WebView.
 */
export function NativeNotificationTapBridge() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { loading: orgLoading } = useCurrentOrg();
  const { loading: centralLoading } = useCentralizedUserData();

  const pendingPathRef = useRef<string | null>(null);
  const authSettledRef = useRef(false);
  const canNavigateRef = useRef(false);

  const authSettled = !authLoading && !orgLoading && !centralLoading;
  const canNavigate = authSettled && !!user;
  authSettledRef.current = authSettled;
  canNavigateRef.current = canNavigate;

  const queueOrNavigate = (path: string) => {
    if (!path) return;
    if (!authSettledRef.current || !canNavigateRef.current) {
      pendingPathRef.current = path;
      stashPath(path);
      return;
    }
    pendingPathRef.current = null;
    clearStashedPath();
    navigate(path, { replace: true });
  };

  // Flush deep link once session + org bootstrap finish (covers cold start from shade tap).
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    if (!authSettled) return;

    if (!user) {
      pendingPathRef.current = null;
      clearStashedPath();
      return;
    }

    const path = pendingPathRef.current || takeStashedPath();
    if (!path) return;
    pendingPathRef.current = null;
    clearStashedPath();
    navigate(path, { replace: true });
  }, [authSettled, user, navigate]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const handlePayload = (payload: Record<string, unknown>) => {
      if (!payload || Object.keys(payload).length === 0) return;
      const path = resolveNavigationPath(payload);
      if (path) queueOrNavigate(path);
    };

    const consumeFromAndroidIntentStore = async () => {
      try {
        const payload = (await NotificationLaunch.consumePendingPushTap()) as Record<string, unknown>;
        handlePayload(payload);
      } catch {
        // ignore
      }
    };

    const onResume = () => {
      void consumeFromAndroidIntentStore();
    };

    const onSplashHidden = () => {
      void consumeFromAndroidIntentStore();
      const path = pendingPathRef.current || takeStashedPath();
      if (path) queueOrNavigate(path);
    };

    let resumeRemove: (() => void) | undefined;
    void App.addListener("resume", onResume).then((h) => {
      resumeRemove = () => void h.remove();
    });

    window.addEventListener(SYNCKERJA_SPLASH_HIDDEN_EVENT, onSplashHidden);

    // Cold start / immediate mount — stash until bootstrap if needed.
    void consumeFromAndroidIntentStore();

    // iOS/standard Capacitor path (if available)
    let actionRemove: (() => void) | undefined;
    if (Capacitor.isPluginAvailable("PushNotifications")) {
      void PushNotifications.addListener("pushNotificationActionPerformed", (ev: any) => {
        const data = (ev?.notification?.data ?? ev?.notification?.extra ?? {}) as Record<string, unknown>;
        handlePayload(data);
      }).then((h) => {
        actionRemove = () => void h.remove();
      });
    }

    return () => {
      resumeRemove?.();
      actionRemove?.();
      window.removeEventListener(SYNCKERJA_SPLASH_HIDDEN_EVENT, onSplashHidden);
    };
    // Intentionally once on mount; navigation gated via refs + flush effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only listeners
  }, [navigate]);

  return null;
}
