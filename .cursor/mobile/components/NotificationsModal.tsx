import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import type { Locale } from "date-fns";
import { Loader2, User, Eye } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/features/ui/dialog";
import { Button } from "@/mobile/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/mobile/components/ui/tabs";
import { useIsMobile } from "@/mobile/hooks/use-mobile";
import { useAppTranslation } from "@/features/share/i18n/useAppTranslation";
import { cn } from "@/lib/utils";
import { useReviewCommentNotifications, type ReviewCommentNotificationRow } from "@/features/6-1-dashboard/hook/useReviewCommentNotifications";
import { usePlanStatusChangeNotifications, type PlanStatusChangeNotificationRow } from "@/features/6-1-dashboard/hook/usePlanStatusChangeNotifications";
import { useCompletionApprovals } from "@/features/8-2-DailyTask/hooks/useCompletionApprovals";
import { useDailyTaskNotifications, type DailyTaskNotificationRow } from "@/features/8-2-DailyTask/hooks/useDailyTaskNotifications";
import { useCurrentOrg } from "@/features/1-login/hooks/useCurrentOrg";
import { useCurrentEmployee } from "@/features/share/hooks/useCurrentEmployee";
import { getCompletionApprovalCountQueryKey } from "@/mobile/hooks/useNotificationBadgeCount";
import { usePublicReviewToken } from "@/features/6-1-dashboard/hook/usePublicReviewToken";
import { useToast } from "@/features/ui/use-toast";
import type { CompletionApprovalRow } from "@/features/8-2-DailyTask/services/completionApprovalService";
import { supabase } from "@/integrations/supabase/client";
import { SocialMediaLinksMobileModal } from "@/mobile/components/SocialMediaLinksMobileModal";

export interface NotificationsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When opening from push tap (e.g. plan_status_change), open directly on this tab */
  initialTab?: "comments" | "tasks" | "updates";
  initialPostedLinksPlanId?: string;
  initialPostedLinksPlanTitle?: string;
  initialPostedLinksForceOpen?: boolean;
}

function getDisplayTitle(row: CompletionApprovalRow): string {
  const taskTitle = row.daily_tasks?.title ?? "Task";
  if (row.entity_type === "task") return taskTitle;
  const stepTitle = row.task_steps?.title ?? "Step";
  if (row.entity_type === "step") return `${taskTitle} → ${stepTitle}`;
  const subTitle = row.task_steps_to_steps?.title ?? "Sub-step";
  return `${taskTitle} → ${stepTitle} → ${subTitle}`;
}

function showViewContent(row: CompletionApprovalRow): boolean {
  return row.entity_type === "step" && !!row.task_steps?.social_media_plan_id;
}

function getEntityTypeLabel(entityType: string, t: (k: string, fallback: string) => string): string {
  if (entityType === "task") return t("dailyTask.approval.entityTask", "Task");
  if (entityType === "step") return t("dailyTask.approval.entityStep", "Step");
  return t("dailyTask.approval.entitySubstep", "Sub-step");
}

function isDoneToPostedNotification(item: PlanStatusChangeNotificationRow): boolean {
  const kindParts = (item.change_kind ?? "")
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);

  const isDoneKind = kindParts.includes("done");
  if (!isDoneKind) return false;

  const newValue = (item.new_value ?? "").trim().toLowerCase();
  if (newValue === "posted" || newValue === "sudah diposting") return true;

  const firstBodyLine = (item.body ?? "").split("\n")[0]?.trim().toLowerCase() ?? "";
  if (!firstBodyLine) return false;

  const notPostedToPosted =
    firstBodyLine.includes("not posted") &&
    firstBodyLine.includes("posted") &&
    !firstBodyLine.includes("posted to not posted");
  const belumToSudah =
    firstBodyLine.includes("belum diposting") &&
    firstBodyLine.includes("sudah diposting") &&
    !firstBodyLine.includes("sudah diposting -> belum diposting");

  const result = notPostedToPosted || belumToSudah;
  return result;
}

function notifDebugUpdates(event: string, payload?: unknown) {
  try {
    const body = payload == null ? "" : ` ${JSON.stringify(payload)}`;
    console.info(`[NOTIF_DEBUG][updatesTab] ${event}${body}`);
  } catch {
    console.info(`[NOTIF_DEBUG][updatesTab] ${event} [payload-unserializable]`);
  }
}

/**
 * Modal fullscreen notifikasi untuk halaman home Android.
 * Tab Comments: notifikasi komentar (unread); klik = mark read, tutup modal, navigate ke /review.
 * Tab Tasks: Pending Approval; tombol "View Content" sama seperti jobdesc → navigate ke /review.
 * Mengikuti aturan .cursor/rules/modal-android-fullscreen.mdc.
 */
export function NotificationsModal({
  open,
  onOpenChange,
  initialTab,
  initialPostedLinksPlanId,
  initialPostedLinksPlanTitle,
  initialPostedLinksForceOpen = false,
}: NotificationsModalProps) {
  const isMobile = useIsMobile();
  const { t, dateLocale } = useAppTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { organizationId } = useCurrentOrg();
  const { data: currentEmployee } = useCurrentEmployee();
  const [activeTab, setActiveTab] = useState<"comments" | "tasks" | "updates">("comments");

  useEffect(() => {
    if (open && initialTab) setActiveTab(initialTab);
  }, [open, initialTab]);

  const currentEmployeeId = (currentEmployee as { id?: string } | null)?.id ?? null;

  const handleClose = () => {
    queryClient.invalidateQueries({
      queryKey: getCompletionApprovalCountQueryKey(organizationId ?? null, currentEmployeeId),
    });
    onOpenChange(false);
  };

  const handleCommentClick = async (item: ReviewCommentNotificationRow, markOneRead: (id: string) => Promise<void>) => {
    await markOneRead(item.id);
    onOpenChange(false);
    navigate(`/review/${item.review_token}`, { state: { from: "notifications-modal" } });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && handleClose()}>
      <DialogContent
        className={cn(
          "w-full max-w-none m-0 rounded-none translate-x-0 translate-y-0 flex flex-col p-0 gap-0 border-none bg-card shadow-xl focus:outline-none overflow-hidden",
          isMobile
            ? "fixed left-0 right-0 top-0 modal-above-safe-area h-screen"
            : "md:max-w-lg md:max-h-[85vh] md:rounded-lg md:translate-x-[-50%] md:translate-y-[-50%] md:left-[50%] md:top-[50%] fixed inset-0 md:h-auto"
        )}
        fullscreenAnimation={isMobile}
      >
        <DialogHeader
          className={cn(
            "flex-shrink-0 border-b bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 text-left",
            isMobile ? "safe-area-top px-4 pt-4 pb-3" : "px-4 pt-4 pb-3"
          )}
        >
          <DialogTitle className="text-lg font-semibold text-foreground">
            {t("mobileHome.notificationsTitle", "Notifikasi")}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "comments" | "tasks" | "updates")} className="flex-1 flex flex-col min-h-0">
          <TabsList className="flex-shrink-0 w-full justify-start rounded-none border-b bg-transparent p-0 h-auto gap-0">
            <TabsTrigger
              value="comments"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2.5"
            >
              {t("mobileHome.notificationsTabComments", "Comments")}
            </TabsTrigger>
            <TabsTrigger
              value="tasks"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2.5"
            >
              {t("mobileHome.notificationsTabTasks", "Tasks")}
            </TabsTrigger>
            <TabsTrigger
              value="updates"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2.5"
            >
              {t("mobileHome.notificationsTabUpdates", "Updates")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="comments" className="flex-1 min-h-0 mt-0 overflow-hidden flex flex-col data-[state=inactive]:hidden">
            <CommentsTab onCommentClick={handleCommentClick} onOpenChange={onOpenChange} dateLocale={dateLocale} t={t} />
          </TabsContent>
          <TabsContent value="tasks" className="flex-1 min-h-0 mt-0 overflow-hidden flex flex-col data-[state=inactive]:hidden">
            <TasksTab onOpenChange={onOpenChange} />
          </TabsContent>
          <TabsContent value="updates" className="flex-1 min-h-0 mt-0 overflow-hidden flex flex-col data-[state=inactive]:hidden">
            <UpdatesTab
              onOpenChange={onOpenChange}
              initialPostedLinksPlanId={initialPostedLinksPlanId}
              initialPostedLinksPlanTitle={initialPostedLinksPlanTitle}
              initialPostedLinksForceOpen={initialPostedLinksForceOpen}
            />
          </TabsContent>
        </Tabs>

        <div className="px-4 pt-3 pb-3 flex-shrink-0 border-t bg-muted/30">
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              size="sm"
              onClick={handleClose}
              className="min-w-[120px] flex items-center justify-center gap-1.5"
            >
              {t("mobileHome.close", "Tutup")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CommentsTab({
  onCommentClick,
  onOpenChange,
  dateLocale,
  t,
}: {
  onCommentClick: (item: ReviewCommentNotificationRow, markOneRead: (id: string) => Promise<void>) => void;
  onOpenChange: (open: boolean) => void;
  dateLocale: Locale;
  t: (key: string, fallback: string, vars?: Record<string, string | number>) => string;
}) {
  const { notifications, markOneRead } = useReviewCommentNotifications();
  const unreadNotifications = notifications.filter((n) => n.read_at == null);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden seamless-scroll px-4 pt-4 pb-4">
      {unreadNotifications.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("reviewCommentNotifications.empty", "No notifications")}</p>
      ) : (
        <ul className="space-y-2">
          {unreadNotifications.map((n) => (
            <CommentNotificationItem
              key={n.id}
              item={n}
              locale={dateLocale}
              t={t}
              onOpenReview={() => onCommentClick(n, markOneRead)}
              onMarkAsReadOnly={markOneRead}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function CommentNotificationItem({
  item,
  locale,
  t,
  onOpenReview,
  onMarkAsReadOnly,
}: {
  item: ReviewCommentNotificationRow;
  locale: Locale;
  t: (key: string, fallback: string, vars?: Record<string, string | number>) => string;
  onOpenReview: () => void;
  onMarkAsReadOnly: (id: string) => Promise<void>;
}) {
  const name = (item.commenter_display_name && item.commenter_display_name.trim()) || "Someone";
  const planTitle = (item.plan_title && item.plan_title.trim()) || "plan";
  const label = t("reviewCommentNotifications.commentedOn", "{{name}} commented on {{planTitle}}", { name, planTitle });
  const commentText = (item.comment_text && item.comment_text.trim()) || null;
  const timeAgo = formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale });
  const isUnread = item.read_at == null;

  const handleMarkAsRead = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onMarkAsReadOnly(item.id);
  };

  return (
    <li>
      <div className="rounded-lg border border-border bg-muted/50 p-2 transition-colors hover:bg-muted/70">
        <button type="button" onClick={onOpenReview} className="block w-full text-left text-sm">
          <span className="font-medium text-foreground">{label}</span>
          {commentText && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{commentText}</p>}
        </button>
        <div className="mt-1 flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">{timeAgo}</span>
          {isUnread && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 shrink-0 border-input text-xs"
              onClick={handleMarkAsRead}
            >
              {t("reviewCommentNotifications.markAsRead", "Mark as read")}
            </Button>
          )}
        </div>
      </div>
    </li>
  );
}

function TasksTab({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const { t, dateLocale } = useAppTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { pending, loading, fetchError, refresh } = useCompletionApprovals([]);
  const { notifications: dailyTaskNotifications, isLoading: dailyTaskLoading, markOneRead: markDailyTaskOneRead, markAllRead: markDailyTaskAllRead, refetch: refetchDailyTask } = useDailyTaskNotifications();
  const unreadDailyTaskNotifications = dailyTaskNotifications.filter((n) => n.read_at == null);
  const { getOrCreate } = usePublicReviewToken();
  const [loadingRowId, setLoadingRowId] = useState<string | null>(null);

  const handlePendingTitleClick = (row: CompletionApprovalRow) => {
    onOpenChange(false);
    const taskId = row.daily_task_id;
    const stepId = row.task_step_id ?? undefined;
    navigate("/tools/daily-task", {
      state: {
        pendingApprovalFocus: {
          taskId,
          stepId,
          openSubStepModalForStepId: row.entity_type === "substep" ? stepId : undefined,
        },
      },
    });
  };

  const handleDailyTaskNotificationClick = (item: DailyTaskNotificationRow) => {
    onOpenChange(false);
    const taskId = item.daily_task_id ?? undefined;
    if (!taskId) {
      navigate("/tools/daily-task");
      return;
    }
    const stepId = item.task_step_id ?? undefined;
    navigate("/tools/daily-task", {
      state: {
        pendingApprovalFocus: {
          taskId,
          stepId,
          openSubStepModalForStepId: item.task_steps_to_steps_id ? stepId : undefined,
        },
      },
    });
    markDailyTaskOneRead(item.id);
  };

  const handleViewContent = async (row: CompletionApprovalRow) => {
    if (!showViewContent(row)) return;
    const planId = row.task_steps?.social_media_plan_id;
    if (!planId) return;

    onOpenChange(false);
    setLoadingRowId(row.id);
    try {
      const { data, error } = await supabase
        .from("social_media_plans")
        .select("google_drive_link")
        .eq("id", planId)
        .maybeSingle();
      if (error) throw error;
      const linkUrl = (data as { google_drive_link?: string | null } | null)?.google_drive_link?.trim();
      if (!linkUrl) {
        toast({
          title: t("dailyTask.approval.error", "Error"),
          description: t("dailyTask.approval.noContentLink", "No content link for this plan."),
          variant: "destructive",
        });
        return;
      }
      const { token } = await getOrCreate({ socialMediaPlanId: planId, linkUrl });
      navigate(`/review/${token}`, { state: { from: "notifications-modal" } });
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message
          : (e as { code?: string; message?: string })?.code === "PGRST116"
            ? t("dailyTask.approval.reviewAccessDenied", "Content not found or access denied.")
            : t("dailyTask.approval.reviewOpenFailed", "Failed to open review.");
      toast({
        title: t("dailyTask.approval.error", "Error"),
        description: msg,
        variant: "destructive",
      });
    } finally {
      setLoadingRowId(null);
    }
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden seamless-scroll px-4 pt-4 pb-4">
      {fetchError ? (
        <p className="text-sm text-destructive py-2">
          {t("dailyTask.approval.fetchError", "Failed to load approvals. Please try again.")}
          <button type="button" onClick={() => refresh()} className="ml-2 underline font-medium">
            {t("dailyTask.approval.retry", "Retry")}
          </button>
        </p>
      ) : loading && pending.length === 0 && !dailyTaskLoading && dailyTaskNotifications.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2 flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
          {t("dailyTask.approval.loading", "Loading...")}
        </p>
      ) : pending.length === 0 && unreadDailyTaskNotifications.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("dailyTask.notificationsEmpty", "No task notifications.")}</p>
      ) : (
        <div className="space-y-4">
          {pending.length > 0 && (
            <>
              <p className="text-xs font-medium text-muted-foreground">{t("dailyTask.approval.pendingTitle", "Pending your approval")}</p>
              <ul className="space-y-2">
                {pending.map((row) => (
                  <li
                    key={row.id}
                    className="border border-gray-200 rounded-lg p-3 bg-white text-sm overflow-hidden min-w-0"
                  >
                    <button
                      type="button"
                      onClick={() => handlePendingTitleClick(row)}
                      className="w-full text-left"
                    >
                      <p className="font-medium text-gray-900 truncate" title={getDisplayTitle(row)}>
                        {getDisplayTitle(row)}
                      </p>
                    </button>
                    <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                      <User className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{row.assignee?.full_name ?? t("dailyTask.approval.assignee", "Assignee")}</span>
                      <span className="text-gray-400 flex-shrink-0">·</span>
                      <span className="flex-shrink-0">{getEntityTypeLabel(row.entity_type, t)}</span>
                    </div>
                    {showViewContent(row) && (
                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-gray-700 border-gray-200 hover:bg-gray-50 h-7 px-2 text-xs"
                          onClick={() => handleViewContent(row)}
                          disabled={loadingRowId !== null}
                        >
                          {loadingRowId === row.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                          ) : (
                            <Eye className="h-3.5 w-3.5 mr-1" />
                          )}
                          {t("dailyTask.approval.viewContent", "View Content")}
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
          {unreadDailyTaskNotifications.length > 0 && (
            <>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-muted-foreground">{t("dailyTask.notificationsUpdates", "Task updates")}</p>
                <Button type="button" variant="outline" size="sm" className="text-xs" onClick={() => markDailyTaskAllRead()}>
                  {t("mobileHome.notificationsMarkAllRead", "Mark all as read")}
                </Button>
              </div>
              <ul className="space-y-2">
                {unreadDailyTaskNotifications.map((item) => (
                  <li key={item.id}>
                    <div
                      className={cn(
                        "rounded-lg border border-border p-2 transition-colors",
                        item.read_at == null ? "bg-muted/50 hover:bg-muted/70" : "bg-background"
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => handleDailyTaskNotificationClick(item)}
                        className="block w-full text-left text-sm"
                      >
                        <span className="font-medium text-foreground">{item.title}</span>
                        {(item.body?.trim() ?? "") && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.body}</p>}
                      </button>
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: dateLocale })}
                        </span>
                        {item.read_at == null && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 shrink-0 border-input text-xs"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              markDailyTaskOneRead(item.id);
                            }}
                          >
                            {t("reviewCommentNotifications.markAsRead", "Mark as read")}
                          </Button>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function UpdatesTab({
  onOpenChange,
  initialPostedLinksPlanId,
  initialPostedLinksPlanTitle,
  initialPostedLinksForceOpen,
}: {
  onOpenChange: (open: boolean) => void;
  initialPostedLinksPlanId?: string;
  initialPostedLinksPlanTitle?: string;
  initialPostedLinksForceOpen?: boolean;
}) {
  const { t, dateLocale } = useAppTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { notifications, isLoading, error, markOneRead, markAllRead, refetch } = usePlanStatusChangeNotifications();
  const unreadNotifications = notifications.filter((n) => n.read_at == null);
  const { getOrCreate } = usePublicReviewToken();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [linksModalPlanId, setLinksModalPlanId] = useState<string | null>(null);
  const [linksModalPlanTitle, setLinksModalPlanTitle] = useState<string | null>(null);

  useEffect(() => {
    if (!initialPostedLinksPlanId) return;
    if (linksModalPlanId === initialPostedLinksPlanId) return;

    notifDebugUpdates("initial posted-links check", {
      initialPostedLinksPlanId,
      initialPostedLinksPlanTitle: initialPostedLinksPlanTitle ?? "",
      initialPostedLinksForceOpen: !!initialPostedLinksForceOpen,
      unreadCount: unreadNotifications.length,
    });

    if (initialPostedLinksForceOpen) {
      setLinksModalPlanId(initialPostedLinksPlanId);
      setLinksModalPlanTitle(initialPostedLinksPlanTitle ?? null);
      notifDebugUpdates("modal opened by force flag", {
        planId: initialPostedLinksPlanId,
      });
      return;
    }

    const matched = unreadNotifications.find(
      (item) =>
        item.social_media_plan_id === initialPostedLinksPlanId &&
        isDoneToPostedNotification(item)
    );
    if (matched) {
      setLinksModalPlanId(initialPostedLinksPlanId);
      setLinksModalPlanTitle(matched.plan_title ?? initialPostedLinksPlanTitle ?? null);
      notifDebugUpdates("modal opened by matched notification", {
        planId: initialPostedLinksPlanId,
        matchedNotificationId: matched.id,
        matchedTitle: matched.title,
        matchedBody: matched.body,
      });
    } else {
      notifDebugUpdates("no matched done->posted notification for plan", {
        planId: initialPostedLinksPlanId,
        unreadPlanNotificationIds: unreadNotifications
          .filter((item) => item.social_media_plan_id === initialPostedLinksPlanId)
          .map((item) => item.id),
      });
    }
  }, [
    initialPostedLinksPlanId,
    initialPostedLinksPlanTitle,
    initialPostedLinksForceOpen,
    unreadNotifications,
    linksModalPlanId,
  ]);

  const handleItemClick = async (item: PlanStatusChangeNotificationRow) => {
    notifDebugUpdates("item clicked", {
      id: item.id,
      change_kind: item.change_kind,
      old_value: item.old_value,
      new_value: item.new_value,
      title: item.title,
      body: item.body,
      social_media_plan_id: item.social_media_plan_id,
    });
    if (isDoneToPostedNotification(item)) {
      setLinksModalPlanId(item.social_media_plan_id);
      setLinksModalPlanTitle(item.plan_title ?? null);
      notifDebugUpdates("opened links modal from tapped notification", {
        planId: item.social_media_plan_id,
        notificationId: item.id,
      });
      return;
    }

    onOpenChange(false);
    setLoadingId(item.id);
    try {
      const { data, error: fetchErr } = await supabase
        .from("social_media_plans")
        .select("google_drive_link")
        .eq("id", item.social_media_plan_id)
        .maybeSingle();
      if (fetchErr) throw fetchErr;
      const linkUrl = (data as { google_drive_link?: string | null } | null)?.google_drive_link?.trim();
      if (!linkUrl) {
        toast({
          title: t("dailyTask.approval.error", "Error"),
          description: t("dailyTask.approval.noContentLink", "No content link for this plan."),
          variant: "destructive",
        });
        return;
      }
      await markOneRead(item.id);
      const { token } = await getOrCreate({ socialMediaPlanId: item.social_media_plan_id, linkUrl });
      navigate(`/review/${token}`, { state: { from: "notifications-modal" } });
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message
          : (e as { code?: string; message?: string })?.code === "PGRST116"
            ? t("dailyTask.approval.reviewAccessDenied", "Content not found or access denied.")
            : t("dailyTask.approval.reviewOpenFailed", "Failed to open review.");
      toast({
        title: t("dailyTask.approval.error", "Error"),
        description: msg,
        variant: "destructive",
      });
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <>
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden seamless-scroll px-4 pt-4 pb-4">
        {error ? (
          <p className="text-sm text-destructive py-2">
            {t("mobileHome.notificationsUpdatesError", "Failed to load updates.")}
            <button type="button" onClick={() => refetch()} className="ml-2 underline font-medium">
              {t("mobileHome.retry", "Retry")}
            </button>
          </p>
        ) : isLoading && notifications.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2 flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
            {t("mobileHome.loading", "Loading...")}
          </p>
        ) : unreadNotifications.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("mobileHome.notificationsNoUpdates", "No updates")}</p>
        ) : (
          <>
            <div className="flex justify-end mb-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => markAllRead()}
              >
                {t("mobileHome.notificationsMarkAllRead", "Mark all as read")}
              </Button>
            </div>
            <ul className="space-y-2">
              {unreadNotifications.map((item) => (
                <li key={item.id}>
                  <div
                    className={cn(
                      "rounded-lg border border-border p-2 transition-colors",
                      item.read_at == null ? "bg-muted/50 hover:bg-muted/70" : "bg-background"
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => handleItemClick(item)}
                      disabled={loadingId !== null}
                      className="block w-full text-left text-sm"
                    >
                      <span className="font-medium text-foreground">{item.title}</span>
                      {(item.body?.trim() ?? "") && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.body}</p>}
                    </button>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: dateLocale })}
                      </span>
                      {item.read_at == null && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 shrink-0 border-input text-xs"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            markOneRead(item.id);
                          }}
                        >
                          {t("reviewCommentNotifications.markAsRead", "Mark as read")}
                        </Button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <SocialMediaLinksMobileModal
        open={linksModalPlanId !== null}
        onOpenChange={(next) => {
          if (!next) {
            setLinksModalPlanId(null);
            setLinksModalPlanTitle(null);
          }
        }}
        socialMediaPlanId={linksModalPlanId}
        planTitle={linksModalPlanTitle}
        onBack={() => {
          setLinksModalPlanId(null);
          setLinksModalPlanTitle(null);
          onOpenChange(false);
          navigate("/", { replace: true });
        }}
      />
    </>
  );
}
