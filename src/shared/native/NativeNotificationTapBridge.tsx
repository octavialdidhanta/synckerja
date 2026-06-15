import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { PushNotifications } from "@capacitor/push-notifications";
import { useNavigate } from "react-router-dom";

type NotificationLaunchPlugin = {
  consumePendingPushTap: () => Promise<Record<string, unknown>>;
};

function parseUrlToPath(url: string): string | null {
  const raw = String(url || "").trim();
  if (!raw) return null;
  if (raw.startsWith("/")) return raw;
  try {
    const u = new URL(raw);
    return `${u.pathname}${u.search}${u.hash}`.startsWith("/") ? `${u.pathname}${u.search}${u.hash}` : null;
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

/**
 * Android native uses a custom FCM service + PendingIntent (see `NotificationLaunchStore`).
 * This bridge consumes the pending tap payload and navigates inside the React Router app.
 */
export function NativeNotificationTapBridge() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const consumeFromAndroidIntentStore = async () => {
      try {
        const plugin = (Capacitor as unknown as { Plugins?: { NotificationLaunch?: NotificationLaunchPlugin } })
          .Plugins?.NotificationLaunch;
        if (!plugin?.consumePendingPushTap) return;

        const payload = (await plugin.consumePendingPushTap()) as Record<string, unknown>;
        const notificationType = payload.notificationType != null ? String(payload.notificationType) : "";
        if (!notificationType) return;

        if (notificationType === "livechat_assignment") {
          const path = inferLivechatPathFromPayload(payload);
          if (path) navigate(path, { replace: true });
          return;
        }

        if (notificationType === "daily_task_assignment") {
          const path = inferDailyTaskPathFromPayload(payload);
          if (path) navigate(path, { replace: true });
          return;
        }

        if (notificationType === "daily_task_completion") {
          const path = inferDailyTaskPathFromPayload(payload);
          if (path) navigate(path, { replace: true });
          return;
        }

        if (notificationType === "daily_task_step_comment") {
          const path = inferDailyTaskPathFromPayload(payload);
          if (path) navigate(path, { replace: true });
          return;
        }

        if (notificationType === "social_media_production_review") {
          const path = inferProductionReviewPathFromPayload(payload);
          if (path) navigate(path, { replace: true });
          return;
        }

        // Unknown notification types are ignored here (handled by other modules).
      } catch {
        // ignore
      }
    };

    const onResume = async () => {
      await consumeFromAndroidIntentStore();
    };

    let resumeRemove: (() => void) | undefined;
    void App.addListener("resume", onResume).then((h) => {
      resumeRemove = () => void h.remove();
    });

    // Cold start / immediate mount
    void consumeFromAndroidIntentStore();

    // iOS/standard Capacitor path (if available)
    let actionRemove: (() => void) | undefined;
    if (Capacitor.isPluginAvailable("PushNotifications")) {
      void PushNotifications.addListener("pushNotificationActionPerformed", (ev: any) => {
        const data = (ev?.notification?.data ?? ev?.notification?.extra ?? {}) as Record<string, unknown>;
        const nt = data.notificationType != null ? String(data.notificationType) : "";
        if (
          nt !== "livechat_assignment" &&
          nt !== "daily_task_assignment" &&
          nt !== "daily_task_completion" &&
          nt !== "daily_task_step_comment" &&
          nt !== "social_media_production_review"
        )
          return;
        const path =
          nt === "social_media_production_review"
            ? inferProductionReviewPathFromPayload(data)
            : nt === "daily_task_assignment" ||
                nt === "daily_task_completion" ||
                nt === "daily_task_step_comment"
              ? inferDailyTaskPathFromPayload(data)
              : inferLivechatPathFromPayload(data);
        if (path) navigate(path, { replace: true });
      }).then((h) => {
        actionRemove = () => void h.remove();
      });
    }

    return () => {
      resumeRemove?.();
      actionRemove?.();
    };
  }, [navigate]);

  return null;
}

