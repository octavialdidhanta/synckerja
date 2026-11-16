import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import { useMetaContentConfig } from "@/meta-content/hooks/useMetaContentConfig";
import {
  facebookPublishScopesOk,
  instagramPublishScopesOk,
} from "@/meta-platform/constants/metaOAuthScopes";
import { ScheduleStatusBadge } from "@/6-1-scheduled-posts/components/ScheduleStatusBadge";
import { useOrgDefaultPostTime } from "@/6-1-scheduled-posts/hooks/useOrgDefaultPostTime";
import {
  pickInstagramScheduleForModal,
  useScheduledPostsByPlan,
} from "@/6-1-scheduled-posts/hooks/useScheduledPostsByPlan";
import { usePlatformScheduleMutations } from "@/6-1-scheduled-posts/hooks/usePlatformScheduleMutations";
import { calendarDayYmd } from "@/6-1-scheduled-posts/lib/onTimeStatus";
import { notifyPublishMutationError } from "@/6-1-scheduled-posts/lib/notifyPublishMutationError";
import { pickPlatformScheduleForModal } from "@/6-1-scheduled-posts/lib/pickPlatformScheduleDisplay";
import { resolveScheduledAtUtc } from "@/6-1-scheduled-posts/lib/resolveScheduledAtUtc";
import type { ScheduledPost } from "@/6-1-scheduled-posts/types/scheduled-post";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { storyExportPublicUrl } from "./storyStorage";

const QUICK_TIMES = ["09:00", "12:00", "15:00", "18:00", "20:00"];

export type StoryPublishTarget = {
  id: string;
  briefPreview: string;
  designUrl: string | null;
  exportPath: string | null;
  postDate: string | null;
  productionApproved: boolean;
};

type StoryAccount = {
  id: string;
  label: string;
  publishScopesOk: boolean;
};

function StoryPlatformPanel({
  title,
  emptyHint,
  reconnectHint,
  accountLabel,
  accounts,
  accountId,
  onAccountIdChange,
  schedule,
  activeSchedule,
  baseReady,
  busy,
  timeLocked,
  onSchedule,
  onPostNow,
  onCancel,
}: {
  title: string;
  emptyHint: string;
  reconnectHint: string;
  accountLabel: string;
  accounts: StoryAccount[];
  accountId: string;
  onAccountIdChange: (value: string) => void;
  schedule: ScheduledPost | null;
  activeSchedule: ScheduledPost | null;
  baseReady: boolean;
  busy: boolean;
  timeLocked: boolean;
  onSchedule: () => void;
  onPostNow: () => void;
  onCancel: () => void;
}) {
  const { t } = useAppTranslation();
  const selected = accounts.find((a) => a.id === accountId);
  const scopesOk = selected?.publishScopesOk !== false;
  const eligible = baseReady && Boolean(accountId) && scopesOk;

  return (
    <div className="space-y-2 rounded-md border border-border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{title}</span>
        {schedule ? (
          <ScheduleStatusBadge
            status={schedule.status}
            publishStep={(schedule.provider_config as { publish_step?: string } | null)?.publish_step}
            errorMessage={schedule.error_message}
          />
        ) : null}
      </div>

      {accounts.length === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyHint}</p>
      ) : (
        <div className="space-y-1">
          <Label className="text-xs">{accountLabel}</Label>
          <Select
            value={accountId}
            onValueChange={onAccountIdChange}
            disabled={busy || Boolean(activeSchedule) || timeLocked}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder={t("aiEmployee.story.publishPickAccount", "Pilih akun")} />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {account.label}
                  {!account.publishScopesOk ? " (reconnect)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!scopesOk ? (
            <p className="text-xs text-destructive">{reconnectHint}</p>
          ) : null}
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        {activeSchedule ? (
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onCancel}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
            {t("aiEmployee.story.publishCancel", "Batalkan jadwal")}
          </Button>
        ) : (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!eligible || busy}
              onClick={onSchedule}
            >
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
              {t("aiEmployee.story.publishSchedule", "Jadwalkan")}
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!eligible || busy}
              onClick={onPostNow}
            >
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
              {t("aiEmployee.story.publishNow", "Post sekarang")}
            </Button>
          </>
        )}
      </div>

      {schedule?.published_url ? (
        <a
          href={schedule.published_url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          <ExternalLink className="h-3 w-3" aria-hidden />
          {t("aiEmployee.story.publishOpenResult", "Buka hasil publish")}
        </a>
      ) : null}
    </div>
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
  const { data: config } = useMetaContentConfig(organizationId);
  const { data: defaultTime } = useOrgDefaultPostTime();
  const { data: schedules } = useScheduledPostsByPlan(plan?.id);
  const { scheduleMutation, postNowMutation, cancelMutation } =
    usePlatformScheduleMutations("meta-story-publish");

  const igAccounts = useMemo(
    () =>
      (config?.accounts ?? [])
        .filter((a) => a.platform === "instagram")
        .map((a) => ({
          id: a.account_id,
          label: a.account_label || a.account_id,
          publishScopesOk: instagramPublishScopesOk(a.granted_scopes ?? []),
        })),
    [config?.accounts],
  );

  const fbAccounts = useMemo(
    () =>
      (config?.accounts ?? [])
        .filter((a) => a.platform === "facebook")
        .map((a) => ({
          id: a.account_id,
          label: a.account_label || a.account_id,
          publishScopesOk: facebookPublishScopesOk(a.granted_scopes ?? []),
        })),
    [config?.accounts],
  );

  const igSchedule = pickInstagramScheduleForModal(schedules ?? []);
  const fbSchedule = pickPlatformScheduleForModal(schedules ?? [], "Facebook");
  const igActive =
    schedules?.find(
      (s) => s.platform === "Instagram" && (s.status === "pending" || s.status === "publishing"),
    ) ?? null;
  const fbActive =
    schedules?.find(
      (s) => s.platform === "Facebook" && (s.status === "pending" || s.status === "publishing"),
    ) ?? null;

  const [igAccountId, setIgAccountId] = useState("");
  const [fbAccountId, setFbAccountId] = useState("");
  const [timeWib, setTimeWib] = useState(defaultTime ?? "18:00");

  useEffect(() => {
    if (igAccounts[0]?.id && !igAccountId) setIgAccountId(igAccounts[0].id);
  }, [igAccounts, igAccountId]);

  useEffect(() => {
    if (fbAccounts[0]?.id && !fbAccountId) setFbAccountId(fbAccounts[0].id);
  }, [fbAccounts, fbAccountId]);

  useEffect(() => {
    if (defaultTime) setTimeWib(defaultTime);
  }, [defaultTime]);

  if (!plan) return null;

  const previewUrl = plan.exportPath ? storyExportPublicUrl(plan.exportPath) : "";
  const postDateYmd = calendarDayYmd(plan.postDate) ?? "";
  const baseReady = Boolean(plan.productionApproved && plan.exportPath && postDateYmd);
  const busy =
    scheduleMutation.isPending || postNowMutation.isPending || cancelMutation.isPending;
  const timeLocked = Boolean(igActive || fbActive);

  const runPublish = async (
    action: "schedule" | "post_now",
    platform: "Instagram" | "Facebook",
  ) => {
    if (!baseReady) {
      toast.error(t("aiEmployee.story.publishNotReady", "Story belum siap publish"));
      return;
    }
    if (!organizationId) {
      toast.error(t("aiEmployee.story.publishNoOrg", "Organisasi tidak ditemukan"));
      return;
    }

    const accountId = platform === "Instagram" ? igAccountId : fbAccountId;
    const accounts = platform === "Instagram" ? igAccounts : fbAccounts;
    const selected = accounts.find((a) => a.id === accountId);
    if (!accountId || !selected?.publishScopesOk) {
      toast.error(t("aiEmployee.story.publishNotReady", "Story belum siap publish"));
      return;
    }

    const scheduledAt = action === "post_now"
      ? new Date().toISOString()
      : resolveScheduledAtUtc(plan.postDate ?? "", timeWib);
    if (!scheduledAt) {
      toast.error(t("aiEmployee.story.publishBadSchedule", "Jadwal tidak valid"));
      return;
    }

    const body: Record<string, unknown> = {
      organization_id: organizationId,
      social_media_plan_id: plan.id,
      platform,
      account_label: selected.label,
      scheduled_at: scheduledAt,
      title: plan.briefPreview.slice(0, 120) || "Story",
      employee_id: employeeId ?? null,
    };
    if (platform === "Instagram") body.instagram_business_account_id = accountId;
    else body.facebook_page_id = accountId;

    try {
      if (action === "schedule") {
        await scheduleMutation.mutateAsync(body);
        toast.success(
          platform === "Instagram"
            ? t("aiEmployee.story.publishScheduled", "Story dijadwalkan ke Instagram")
            : t("aiEmployee.story.publishScheduledFb", "Story dijadwalkan ke Facebook Page"),
        );
      } else {
        await postNowMutation.mutateAsync(body);
        toast.success(
          platform === "Instagram"
            ? t("aiEmployee.story.publishPosted", "Story diposting ke Instagram")
            : t("aiEmployee.story.publishPostedFb", "Story diposting ke Facebook Page"),
        );
      }
    } catch (error) {
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

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("aiEmployee.story.publishTitle", "Story Publish Setup")}</DialogTitle>
          <DialogDescription>
            {t(
              "aiEmployee.story.publishDesc",
              "Post Instagram Stories dan Facebook Page Stories. Caption tidak dikirim — teks sudah di dalam desain.",
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-[minmax(0,14rem)_1fr]">
          <div className="flex flex-col gap-2">
            {previewUrl ? (
              <img
                src={previewUrl}
                alt={t("aiEmployee.story.reviewPreviewAlt", "Preview Story")}
                className="w-full rounded-md border border-border object-cover"
              />
            ) : (
              <div className="flex min-h-[16rem] items-center justify-center rounded-md border border-dashed border-border bg-muted/40 px-3 text-center text-sm text-muted-foreground">
                {t("aiEmployee.story.reviewNoPreview", "Belum ada export JPG. Perbarui dari Canva dulu.")}
              </div>
            )}
            {plan.designUrl?.startsWith("https://") ? (
              <Button type="button" variant="outline" size="sm" asChild>
                <a href={plan.designUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1">
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                  {t("aiEmployee.story.openCanva", "Buka di Canva")}
                </a>
              </Button>
            ) : null}
          </div>

          <div className="flex min-h-0 flex-col gap-3">
            <div>
              <h3 className="mb-1 text-xs font-medium text-muted-foreground">
                {t("aiEmployee.story.colBrief", "Brief")}
              </h3>
              <p className="whitespace-pre-wrap break-words rounded-md border border-border bg-muted/30 p-2 text-xs">
                {plan.briefPreview || "—"}
              </p>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">
                {t("aiEmployee.story.publishTime", "Jam (WIB)")} · {postDateYmd || "—"}
              </Label>
              <div className="flex flex-wrap gap-1">
                {QUICK_TIMES.map((value) => (
                  <Button
                    key={value}
                    type="button"
                    size="sm"
                    variant={timeWib === value ? "default" : "outline"}
                    className="h-7 px-2 text-[11px]"
                    disabled={busy || timeLocked}
                    onClick={() => setTimeWib(value)}
                  >
                    {value}
                  </Button>
                ))}
              </div>
              <Input
                type="time"
                value={timeWib}
                onChange={(event) => setTimeWib(event.target.value)}
                disabled={busy || timeLocked}
                className="h-9 w-36"
              />
            </div>

            <StoryPlatformPanel
              title={t("aiEmployee.story.publishIg", "Instagram Stories")}
              emptyHint={t(
                "aiEmployee.story.publishConnectIg",
                "Hubungkan akun Instagram Business di pengaturan Meta.",
              )}
              reconnectHint={t(
                "aiEmployee.story.publishReconnect",
                "Reconnect Instagram untuk grant instagram_content_publish.",
              )}
              accountLabel={t("aiEmployee.story.publishAccount", "Akun Instagram")}
              accounts={igAccounts}
              accountId={igAccountId}
              onAccountIdChange={setIgAccountId}
              schedule={igSchedule}
              activeSchedule={igActive}
              baseReady={baseReady}
              busy={busy}
              timeLocked={false}
              onSchedule={() => void runPublish("schedule", "Instagram")}
              onPostNow={() => void runPublish("post_now", "Instagram")}
              onCancel={() => void cancelActive(igActive)}
            />

            <StoryPlatformPanel
              title={t("aiEmployee.story.publishFb", "Facebook Page Stories")}
              emptyHint={t(
                "aiEmployee.story.publishConnectFb",
                "Hubungkan Facebook Page di pengaturan Meta.",
              )}
              reconnectHint={t(
                "aiEmployee.story.publishReconnectFb",
                "Reconnect Facebook Page untuk grant pages_manage_posts.",
              )}
              accountLabel={t("aiEmployee.story.publishFbAccount", "Facebook Page")}
              accounts={fbAccounts}
              accountId={fbAccountId}
              onAccountIdChange={setFbAccountId}
              schedule={fbSchedule}
              activeSchedule={fbActive}
              baseReady={baseReady}
              busy={busy}
              timeLocked={false}
              onSchedule={() => void runPublish("schedule", "Facebook")}
              onPostNow={() => void runPublish("post_now", "Facebook")}
              onCancel={() => void cancelActive(fbActive)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            {t("common.close", "Tutup")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
