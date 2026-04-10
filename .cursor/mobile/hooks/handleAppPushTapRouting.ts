import type { NavigateFunction } from "react-router-dom";
import type { QueryClient } from "@tanstack/react-query";

type OnDebug = (event: string, payload?: Record<string, unknown>) => void;

function notificationLooksLikeDonePosted(data: Record<string, string>) {
  const kind = (data.plan_change_kind ?? "").trim().toLowerCase();
  const kindParts = kind
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (!kindParts.includes("done")) return false;

  const newValue = (data.plan_new_value ?? "").trim().toLowerCase();
  if (newValue === "posted" || newValue === "sudah diposting") return true;

  const body = (data.plan_body ?? "").split("\n")[0]?.trim().toLowerCase() ?? "";
  const isPosted = body.includes("not posted") && body.includes("posted");
  const isReverse = body.includes("posted") && body.includes("not posted") && body.startsWith("posted");
  const isPostedId = body.includes("belum diposting") && body.includes("sudah diposting");
  const isReverseId =
    body.includes("sudah diposting") &&
    body.includes("belum diposting") &&
    body.startsWith("sudah diposting");

  if (isPosted && !isReverse) return true;
  if (isPostedId && !isReverseId) return true;
  return false;
}

/**
 * Shared routing for app push / notification-intent taps (FCM data payload as string map).
 */
export function handleAppPushTapRouting(
  data: Record<string, string>,
  navigate: NavigateFunction,
  queryClient: QueryClient,
  notifDebug: OnDebug
) {
  const url = data.url ?? "";
  const openNotifications = data.openNotifications === "true";
  notifDebug("routing", {
    notificationType: data.notificationType ?? "",
    openNotifications,
    url,
    social_media_plan_id: data.social_media_plan_id ?? "",
    plan_change_kind: data.plan_change_kind ?? "",
    plan_new_value: data.plan_new_value ?? "",
  });

  if (openNotifications || url === "/" || url === "") {
    queryClient.invalidateQueries({ queryKey: ["review-comment-notifications"] });
    queryClient.invalidateQueries({ queryKey: ["completion-approvals"] });
    queryClient.invalidateQueries({ queryKey: ["plan-status-change-notifications"] });
    queryClient.invalidateQueries({ queryKey: ["daily-task-notifications"] });
    const notificationType = data.notificationType ?? "";
    if (notificationType === "daily_task") {
      const dailyTaskId = data.daily_task_id ?? "";
      const taskStepId = data.task_step_id ?? "";
      const viewParam = data.view ?? "";
      const path = viewParam ? `/tools/daily-task?view=${encodeURIComponent(viewParam)}` : "/tools/daily-task";
      navigate(path, {
        state: dailyTaskId
          ? {
              pendingApprovalFocus: {
                taskId: dailyTaskId,
                stepId: taskStepId || undefined,
                openSubStepModalForStepId: taskStepId || undefined,
              },
            }
          : {},
      });
      return;
    }
    if (notificationType === "plan_status_change") {
      const shouldOpenPostedLinksModal = notificationLooksLikeDonePosted(data);
      notifDebug("plan_status_change decision", {
        shouldOpenPostedLinksModal,
        social_media_plan_id: data.social_media_plan_id ?? "",
      });
      navigate("/", {
        state: {
          reopenNotifications: true,
          openNotificationsTab: "updates" as const,
          openPostedLinksModal: shouldOpenPostedLinksModal,
          openPostedLinksForceOpen: shouldOpenPostedLinksModal,
          openPostedLinksPlanId: data.social_media_plan_id ?? "",
          openPostedLinksPlanTitle: data.plan_title ?? "",
        },
      });
      notifDebug("navigate home with state", {
        reopenNotifications: true,
        openNotificationsTab: "updates",
        openPostedLinksModal: shouldOpenPostedLinksModal,
        openPostedLinksPlanId: data.social_media_plan_id ?? "",
      });
      return;
    }
    if (notificationType === "review_comment") {
      navigate("/", { state: { reopenNotifications: true, openNotificationsTab: "comments" as const } });
      return;
    }
    if (notificationType === "tasks") {
      navigate("/", { state: { reopenNotifications: true, openNotificationsTab: "tasks" as const } });
      return;
    }
    navigate("/", { state: { reopenNotifications: true } });
    return;
  }
  if (url) {
    try {
      const parsed = new URL(url, "https://x");
      navigate(parsed.pathname + parsed.search);
    } catch {
      navigate("/operations/consultant/all/livechat");
    }
    return;
  }
  navigate("/operations/consultant/all/livechat");
}
