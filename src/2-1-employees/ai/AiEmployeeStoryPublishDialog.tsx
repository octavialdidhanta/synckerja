import { useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import { useServiceRequiredPlatforms } from "@/6-1-dashboard/hook/useServiceRequiredPlatforms";
import { useMetaContentConfig } from "@/meta-content/hooks/useMetaContentConfig";
import { RequiredPlatformScheduleRow } from "@/6-1-scheduled-posts/components/RequiredPlatformScheduleRow";
import {
  SCHEDULE_TABLE_ACTIONS_HEAD_CLASS,
  SCHEDULE_TABLE_CONNECTION_CELL_CLASS,
  SCHEDULE_TABLE_HEADER_ROW_CLASS,
  SCHEDULE_TABLE_MIDDLE_GROUP_CLASS,
  SCHEDULE_TABLE_MIDDLE_HEAD_CLASS,
  SCHEDULE_TABLE_PLATFORM_HEAD_CLASS,
  SCHEDULE_TABLE_SCROLL_CLASS,
  SCHEDULE_TABLE_STATUS_CELL_CLASS,
  SCHEDULE_TABLE_TIME_CELL_CLASS,
  SCHEDULE_TABLE_VISIBILITY_CELL_CLASS,
} from "@/6-1-scheduled-posts/components/scheduleTableColumnStyles";
import { useOrgDefaultPostTime } from "@/6-1-scheduled-posts/hooks/useOrgDefaultPostTime";
import { useScheduledPostsByPlan } from "@/6-1-scheduled-posts/hooks/useScheduledPostsByPlan";
import { usePlatformScheduleMutations } from "@/6-1-scheduled-posts/hooks/usePlatformScheduleMutations";
import { calendarDayYmd } from "@/6-1-scheduled-posts/lib/onTimeStatus";
import { notifyPublishMutationError } from "@/6-1-scheduled-posts/lib/notifyPublishMutationError";
import { pickAccountScheduleForModal } from "@/6-1-scheduled-posts/lib/pickPlatformScheduleDisplay";
import type { RequiredPlatformAutoTarget } from "@/6-1-scheduled-posts/lib/resolveRequiredPlatformTargets";
import {
  resolveScheduledAtUtc,
  scheduleTimeWibOrDefault,
} from "@/6-1-scheduled-posts/lib/resolveScheduledAtUtc";
import type { ScheduledPost } from "@/6-1-scheduled-posts/types/scheduled-post";
import type { MetaContentAccount } from "@/meta-platform/types/metaContentTypes";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  storyPublishTargetsFromRequired,
  storyTargetEligible,
} from "./storyPublishAccounts";
import { storyExportPublicUrl } from "./storyStorage";

const EMPTY_META_ACCOUNTS: MetaContentAccount[] = [];

export type StoryPublishTarget = {
  id: string;
  briefPreview: string;
  designUrl: string | null;
  exportPath: string | null;
  postDate: string | null;
  serviceId: string | null;
  productionApproved: boolean;
};

function mutationAccountId(vars: Record<string, unknown> | undefined): string {
  if (!vars) return "";
  return String(
    vars.instagram_business_account_id
      ?? vars.facebook_page_id
      ?? vars.accountId
      ?? "",
  ).trim();
}

function reconnectHintFor(
  platform: string,
  t: (key: string, fallback: string) => string,
): string {
  if (platform === "Facebook") {
    return t(
      "aiEmployee.story.publishReconnectFb",
      "Reconnect Facebook Page untuk grant pages_manage_posts.",
    );
  }
  return t(
    "aiEmployee.story.publishReconnect",
    "Reconnect Instagram untuk grant instagram_content_publish.",
  );
}

export function AiEmployeeStoryPublishDialog({
  open,
  plan,
  organizationId,
  employeeId,
  onClose,
}: {
  open: boolean;
  plan: StoryPublishTarget | null;
  organizationId: string;
  employeeId?: string;
  onClose: () => void;
}) {
  const { t } = useAppTranslation();
  const { t: i18nT } = useTranslation();
  const serviceId = plan?.serviceId || undefined;
  const { data: config } = useMetaContentConfig(organizationId);
  const { requiredPlatforms = [] } = useServiceRequiredPlatforms(serviceId);
  const { data: defaultTime } = useOrgDefaultPostTime();
  const { data: schedules } = useScheduledPostsByPlan(plan?.id);
  const { scheduleMutation, postNowMutation, cancelMutation } =
    usePlatformScheduleMutations("meta-story-publish");

  const storyRequired = useMemo(() => {
    if (!plan?.serviceId) return [];
    return requiredPlatforms.filter(
      (row) => row.service_id === plan.serviceId && row.is_active,
    );
  }, [plan?.serviceId, requiredPlatforms]);

  const metaAccounts = config?.accounts ?? EMPTY_META_ACCOUNTS;
  const targets = useMemo(
    () => storyPublishTargetsFromRequired(storyRequired, metaAccounts),
    [storyRequired, metaAccounts],
  );

  const defaultTimeWib = defaultTime ?? "18:00";
  const [timeWibByRowId, setTimeWibByRowId] = useState<Record<string, string>>({});
  const editedTimeRowIds = useRef(new Set<string>());
  const [bulkAction, setBulkAction] = useState<"schedule" | "post_now" | null>(null);
  const isBulkRunning = bulkAction !== null;

  useEffect(() => {
    if (!open || !targets.length) return;
    const rows = schedules ?? [];
    setTimeWibByRowId((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const target of targets) {
        const rowId = target.requiredPlatformRowId;
        if (editedTimeRowIds.current.has(rowId)) continue;
        const schedule = pickAccountScheduleForModal(rows, target.platform, target.accountId);
        const resolved = scheduleTimeWibOrDefault(schedule?.scheduled_at, defaultTimeWib);
        if (next[rowId] !== resolved) {
          next[rowId] = resolved;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [open, targets, schedules, defaultTimeWib]);

  useEffect(() => {
    if (!open) {
      editedTimeRowIds.current.clear();
      setTimeWibByRowId({});
      setBulkAction(null);
    }
  }, [open, plan?.id]);

  if (!plan) return null;

  const previewUrl = plan.exportPath ? storyExportPublicUrl(plan.exportPath) : "";
  const postDateYmd = calendarDayYmd(plan.postDate) ?? "";
  const baseReady = Boolean(plan.productionApproved && plan.exportPath && postDateYmd);
  const scheduleRows = schedules ?? [];

  const getTimeWib = (rowId: string) => timeWibByRowId[rowId] ?? defaultTimeWib;

  const bulkEligible = targets.filter((target) => {
    if (!baseReady || !storyTargetEligible(target)) return false;
    const schedule = pickAccountScheduleForModal(scheduleRows, target.platform, target.accountId);
    if (schedule && (schedule.status === "pending" || schedule.status === "publishing")) return false;
    if (schedule?.status === "published") return false;
    return true;
  });

  const publishOne = async (
    target: RequiredPlatformAutoTarget,
    action: "schedule" | "post_now",
  ) => {
    if (!baseReady) throw new Error("not_ready");
    if (!organizationId) throw new Error("no_org");
    if (!storyTargetEligible(target)) throw new Error("not_ready");

    const scheduledAt = action === "post_now"
      ? new Date().toISOString()
      : resolveScheduledAtUtc(plan.postDate ?? "", getTimeWib(target.requiredPlatformRowId));
    if (!scheduledAt) throw new Error("bad_schedule");

    const platform = target.platform as "Instagram" | "Facebook";
    const body: Record<string, unknown> = {
      organization_id: organizationId,
      social_media_plan_id: plan.id,
      platform,
      account_label: target.accountLabel,
      scheduled_at: scheduledAt,
      title: plan.briefPreview.slice(0, 120) || "Story",
      employee_id: employeeId ?? null,
    };
    if (platform === "Instagram") body.instagram_business_account_id = target.accountId;
    else body.facebook_page_id = target.accountId;

    if (action === "schedule") await scheduleMutation.mutateAsync(body);
    else await postNowMutation.mutateAsync(body);
  };

  const runPublish = async (
    target: RequiredPlatformAutoTarget,
    action: "schedule" | "post_now",
  ) => {
    try {
      await publishOne(target, action);
      const platform = target.platform as "Instagram" | "Facebook";
      toast.success(
        action === "schedule"
          ? platform === "Instagram"
            ? t("aiEmployee.story.publishScheduled", "Story dijadwalkan ke Instagram")
            : t("aiEmployee.story.publishScheduledFb", "Story dijadwalkan ke Facebook Page")
          : platform === "Instagram"
            ? t("aiEmployee.story.publishPosted", "Story diposting ke Instagram")
            : t("aiEmployee.story.publishPostedFb", "Story diposting ke Facebook Page"),
      );
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === "not_ready") {
          toast.error(t("aiEmployee.story.publishNotReady", "Story belum siap publish"));
          return;
        }
        if (error.message === "no_org") {
          toast.error(t("aiEmployee.story.publishNoOrg", "Organisasi tidak ditemukan"));
          return;
        }
        if (error.message === "bad_schedule") {
          toast.error(t("aiEmployee.story.publishBadSchedule", "Jadwal tidak valid"));
          return;
        }
      }
      notifyPublishMutationError(error, i18nT, "aiEmployee.story.publishFailed");
    }
  };

  const cancelActive = async (active: ScheduledPost | null) => {
    if (!active?.id) return;
    try {
      await cancelMutation.mutateAsync({
        organizationId,
        scheduleId: active.id,
        planId: plan.id,
      });
      toast.success(t("aiEmployee.story.publishCancelled", "Jadwal Story dibatalkan"));
    } catch (error) {
      notifyPublishMutationError(error, i18nT, "aiEmployee.story.publishCancelFailed");
    }
  };

  const runBulk = async (action: "schedule" | "post_now") => {
    if (!bulkEligible.length) return;
    setBulkAction(action);
    let ok = 0;
    let failed = 0;
    try {
      for (const target of bulkEligible) {
        try {
          await publishOne(target, action);
          ok += 1;
        } catch {
          failed += 1;
        }
      }
      if (failed === 0) {
        toast.success(
          t("aiEmployee.story.publishBulkOk", "{{count}} akun Story diproses", {
            count: ok,
          }),
        );
      } else {
        toast.error(
          t(
            "aiEmployee.story.publishBulkPartial",
            "{{ok}} berhasil, {{failed}} gagal",
            { ok, failed },
          ),
        );
      }
    } finally {
      setBulkAction(null);
    }
  };

  const busy =
    isBulkRunning
    || scheduleMutation.isPending
    || postNowMutation.isPending
    || cancelMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="max-h-[90vh] max-w-5xl overflow-x-hidden overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("aiEmployee.story.publishTitle", "Story Publish Setup")}</DialogTitle>
          <DialogDescription>
            {t(
              "aiEmployee.story.publishDesc",
              "Post Instagram Stories dan Facebook Page Stories. Caption tidak dikirim — teks sudah di dalam desain.",
            )}
          </DialogDescription>
        </DialogHeader>

        {/*
          Desktop grid:
          [preview] [brief + table]
          [Canva  ] [Schedule · Post · Close]  ← same row, aligned bottoms
        */}
        <div className="grid w-full min-w-0 grid-cols-1 gap-x-4 gap-y-3 md:grid-cols-[15.5rem_minmax(0,1fr)]">
          <div className="min-w-0 md:col-start-1 md:row-start-1">
            {previewUrl ? (
              <img
                src={previewUrl}
                alt={t("aiEmployee.story.reviewPreviewAlt", "Preview Story")}
                className="h-auto w-full rounded-md border border-border object-contain"
              />
            ) : (
              <div className="flex aspect-[9/16] w-full items-center justify-center rounded-md border border-dashed border-border bg-muted/40 px-3 text-center text-sm text-muted-foreground">
                {t("aiEmployee.story.reviewNoPreview", "Belum ada export JPG. Perbarui dari Canva dulu.")}
              </div>
            )}
          </div>

          <div className="flex min-w-0 flex-col gap-3 overflow-x-hidden md:col-start-2 md:row-start-1">
            <div className="min-w-0 rounded-md border border-border bg-muted/30 p-2.5">
              <p className="mb-1 text-[11px] font-medium text-muted-foreground">
                {t("aiEmployee.story.colBrief", "Brief")} · {postDateYmd || "—"}
              </p>
              <p className="max-h-24 overflow-y-auto whitespace-pre-wrap break-words text-xs leading-relaxed">
                {plan.briefPreview || "—"}
              </p>
            </div>

            {!targets.length ? (
              <div className="rounded-md border border-border bg-muted/20 px-3 py-4 text-sm text-muted-foreground">
                {t(
                  "aiEmployee.story.publishSchedulingEmpty",
                  "Atur akun Instagram / Facebook aktif di Content Scheduling untuk kategori plan ini.",
                )}
              </div>
            ) : (
              <section className="min-w-0 max-w-full overflow-hidden rounded-md border border-border bg-card">
                <div className="border-b border-border/60 px-3 py-2">
                  <p className="text-sm font-medium">
                    {t(
                      "aiEmployee.story.publishAccountsTitle",
                      "Akun Story (Content Scheduling)",
                    )}
                  </p>
                </div>

                <div className="min-w-0 max-w-full overflow-hidden p-2">
                  <div className={`${SCHEDULE_TABLE_SCROLL_CLASS} max-w-full rounded-md border border-border/60`}>
                    <div className="inline-block min-w-max text-sm">
                      <div className={SCHEDULE_TABLE_HEADER_ROW_CLASS}>
                        <div className={SCHEDULE_TABLE_PLATFORM_HEAD_CLASS}>
                          {t(
                            "digitalMarketing.scheduledPosts.tablePlatformAccount",
                            "Platform / Account",
                          )}
                        </div>
                        <div className={SCHEDULE_TABLE_MIDDLE_GROUP_CLASS}>
                          <div className={`${SCHEDULE_TABLE_STATUS_CELL_CLASS} ${SCHEDULE_TABLE_MIDDLE_HEAD_CLASS}`}>
                            {t("digitalMarketing.scheduledPosts.tableStatus", "Status")}
                          </div>
                          <div className={`${SCHEDULE_TABLE_CONNECTION_CELL_CLASS} ${SCHEDULE_TABLE_MIDDLE_HEAD_CLASS}`}>
                            {t("digitalMarketing.scheduledPosts.tableConnection", "Connection")}
                          </div>
                          <div className={`${SCHEDULE_TABLE_VISIBILITY_CELL_CLASS} ${SCHEDULE_TABLE_MIDDLE_HEAD_CLASS}`}>
                            {t("digitalMarketing.scheduledPosts.privacyLabel", "Visibility")}
                          </div>
                          <div className={`${SCHEDULE_TABLE_TIME_CELL_CLASS} ${SCHEDULE_TABLE_MIDDLE_HEAD_CLASS}`}>
                            {t("digitalMarketing.scheduledPosts.postTimeLabel", "Post time (WIB)")}
                          </div>
                        </div>
                        <div className={SCHEDULE_TABLE_ACTIONS_HEAD_CLASS}>
                          {t("digitalMarketing.scheduledPosts.tableActions", "Actions")}
                        </div>
                      </div>

                      {targets.map((target) => {
                        const schedule = pickAccountScheduleForModal(
                          scheduleRows,
                          target.platform,
                          target.accountId,
                        );
                        const activeSchedule =
                          schedule
                          && (schedule.status === "pending" || schedule.status === "publishing")
                            ? schedule
                            : null;
                        const rowId = target.requiredPlatformRowId;
                        const scheduleVars = scheduleMutation.variables as Record<string, unknown> | undefined;
                        const postVars = postNowMutation.variables as Record<string, unknown> | undefined;
                        const isSchedulePending =
                          !isBulkRunning
                          && scheduleMutation.isPending
                          && String(scheduleVars?.platform ?? "") === target.platform
                          && mutationAccountId(scheduleVars) === target.accountId;
                        const isPostNowPending =
                          !isBulkRunning
                          && postNowMutation.isPending
                          && String(postVars?.platform ?? "") === target.platform
                          && mutationAccountId(postVars) === target.accountId;

                        return (
                          <RequiredPlatformScheduleRow
                            key={rowId}
                            target={target}
                            schedule={schedule}
                            activeSchedule={activeSchedule}
                            timeWib={getTimeWib(rowId)}
                            onTimeChange={(value) => {
                              editedTimeRowIds.current.add(rowId);
                              setTimeWibByRowId((prev) => ({ ...prev, [rowId]: value }));
                            }}
                            onSchedule={() => {
                              void runPublish(target, "schedule");
                            }}
                            onPostNow={() => {
                              void runPublish(target, "post_now");
                            }}
                            onCancel={() => {
                              void cancelActive(activeSchedule);
                            }}
                            actionsDisabled={!baseReady}
                            isSchedulePending={isSchedulePending}
                            isPostNowPending={isPostNowPending}
                            isCancelPending={
                              cancelMutation.isPending
                              && cancelMutation.variables?.scheduleId === activeSchedule?.id
                            }
                            bulkRunning={isBulkRunning}
                            reconnectHint={reconnectHintFor(target.platform, t)}
                            pinActions
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>
              </section>
            )}
          </div>

          <div className="flex min-w-0 items-center md:col-start-1 md:row-start-2">
            {plan.designUrl?.startsWith("https://") ? (
              <Button type="button" variant="outline" size="sm" className="h-8 w-full" asChild>
                <a href={plan.designUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-1">
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                  {t("aiEmployee.story.openCanva", "Buka di Canva")}
                </a>
              </Button>
            ) : (
              <div className="h-8" aria-hidden />
            )}
          </div>

          <div className="flex min-w-0 flex-wrap items-center gap-2 md:col-start-2 md:row-start-2">
            {targets.length > 0 ? (
              <>
                <Button
                  type="button"
                  size="sm"
                  className="h-8"
                  disabled={!baseReady || bulkEligible.length === 0 || busy}
                  onClick={() => {
                    void runBulk("schedule");
                  }}
                >
                  {bulkAction === "schedule" ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : null}
                  {i18nT("digitalMarketing.scheduledPosts.scheduleAll", {
                    count: bulkEligible.length,
                    defaultValue: `Schedule all (${bulkEligible.length})`,
                  })}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8"
                  disabled={!baseReady || bulkEligible.length === 0 || busy}
                  onClick={() => {
                    void runBulk("post_now");
                  }}
                >
                  {bulkAction === "post_now" ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : null}
                  {i18nT("digitalMarketing.scheduledPosts.postNowToAll", {
                    count: bulkEligible.length,
                    defaultValue: `Post now to all (${bulkEligible.length})`,
                  })}
                </Button>
              </>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8"
              onClick={onClose}
              disabled={busy}
            >
              {t("common.close", "Tutup")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
